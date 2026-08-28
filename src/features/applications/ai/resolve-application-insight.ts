import { isAiConfigured, logAiFallback } from "@/server/ai";
import { prisma } from "@/server/db/prisma";

import type { ApplicationInsightType } from "@/generated/prisma/client";

import { toPrismaJson } from "../lib/json-parsers";
import type {
  ApplicationInsightContent,
  ApplicationInsightDetail,
  ApplicationNextActionContent,
  ApplicationRejectionAnalysis,
  ApplicationStagePrep,
} from "../types";
import { buildApplicationAiContext } from "./build-application-ai-context";
import { buildApplicationContextFingerprint } from "./application-context-fingerprint";
import {
  buildFallbackNextAction,
  buildFallbackRejectionAnalysis,
  buildFallbackStagePrep,
} from "./fallback-application-insight";
import {
  generateApplicationNextAction,
  generateApplicationRejectionAnalysis,
  generateApplicationStagePrep,
} from "./generate-application-insight";
import {
  sanitizeNextActionOutput,
  sanitizeRejectionOutput,
  sanitizeStagePrepOutput,
} from "./parse-application-insight";
import type { ApplicationAiContext } from "./types";

const STAGE_INSIGHT_TYPES: Record<ApplicationStagePrep["stage"], ApplicationInsightType> = {
  SCREENING: "SCREENING_PREP",
  ASSESSMENT: "ASSESSMENT_PREP",
  INTERVIEW: "INTERVIEW_PREP",
  OFFER: "OFFER_REVIEW",
};

export type ResolveApplicationInsightOptions = {
  userId: string;
  applicationId: string;
  type: ApplicationInsightType;
  stage?: ApplicationStagePrep["stage"];
  /** Manual refresh bypasses the fingerprint cache and stores a new row. */
  forceRefresh?: boolean;
};

async function findCachedInsight(
  userId: string,
  applicationId: string,
  type: ApplicationInsightType,
  fingerprint: string,
): Promise<ApplicationInsightDetail | null> {
  const cached = await prisma.applicationInsight.findFirst({
    where: { userId, applicationId, type, contextFingerprint: fingerprint },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      source: true,
      contentJson: true,
      model: true,
      aiSource: true,
      warningsJson: true,
      createdAt: true,
    },
  });

  if (!cached) return null;

  return {
    id: cached.id,
    type: cached.type,
    source: cached.source,
    content: cached.contentJson as ApplicationInsightContent,
    model: cached.model,
    aiSource: cached.aiSource,
    warnings: Array.isArray(cached.warningsJson) ? (cached.warningsJson as string[]) : [],
    createdAt: cached.createdAt.toISOString(),
  };
}

async function runGeneration(
  type: ApplicationInsightType,
  context: ApplicationAiContext,
  stage: ApplicationStagePrep["stage"] | undefined,
): Promise<{
  content: ApplicationInsightContent;
  source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
  model: string | null;
  aiSource: string;
  warnings: string[];
}> {
  const taskName = `application-insight-${type.toLowerCase()}`;

  const fallback = (): ApplicationInsightContent => {
    if (type === "NEXT_ACTION") return buildFallbackNextAction(context);
    if (type === "REJECTION_ANALYSIS") return buildFallbackRejectionAnalysis(context);
    return buildFallbackStagePrep(context, stage ?? "INTERVIEW");
  };

  const asFallback = () => {
    const content = fallback();
    return {
      content,
      source: "RULE_BASED_FALLBACK" as const,
      model: null,
      aiSource: "rule_based",
      warnings: (content as { warnings?: string[] }).warnings ?? [],
    };
  };

  if (!isAiConfigured()) {
    logAiFallback(taskName, { hasApiKey: false, model: "", reason: "missing_api_key" });
    return asFallback();
  }

  try {
    if (type === "NEXT_ACTION") {
      const outcome = await generateApplicationNextAction<ApplicationNextActionContent>(
        context,
        sanitizeNextActionOutput,
      );
      if (outcome.success) {
        return {
          content: outcome.payload,
          source: "AI_GENERATED",
          model: outcome.model,
          aiSource: "ai",
          warnings: outcome.payload.warnings,
        };
      }
      logAiFallback(taskName, outcome.diagnostic);
      return asFallback();
    }

    if (type === "REJECTION_ANALYSIS") {
      const outcome = await generateApplicationRejectionAnalysis<ApplicationRejectionAnalysis>(
        context,
        // The stored confirmed fact is injected here, never taken from the model.
        (payload) => sanitizeRejectionOutput(payload, context.confirmedRejectionReason),
      );
      if (outcome.success) {
        return {
          content: outcome.payload,
          source: "AI_GENERATED",
          model: outcome.model,
          aiSource: "ai",
          warnings: outcome.payload.warnings,
        };
      }
      logAiFallback(taskName, outcome.diagnostic);
      return asFallback();
    }

    const resolvedStage = stage ?? "INTERVIEW";
    const outcome = await generateApplicationStagePrep<ApplicationStagePrep>(
      context,
      resolvedStage,
      (payload) => sanitizeStagePrepOutput(payload, resolvedStage),
    );
    if (outcome.success) {
      return {
        content: outcome.payload,
        source: "AI_GENERATED",
        model: outcome.model,
        aiSource: "ai",
        warnings: outcome.payload.warnings,
      };
    }
    logAiFallback(taskName, outcome.diagnostic);
    return asFallback();
  } catch (error) {
    logAiFallback(taskName, {
      hasApiKey: true,
      model: "",
      reason: "unexpected_error",
      message: error instanceof Error ? error.message : "Unknown application insight error",
    });
    return asFallback();
  }
}

/**
 * Produces an application insight, reusing a cached row when nothing relevant
 * has changed. This never throws and never blocks application state: the worst
 * case is a rule-based draft.
 */
export async function resolveApplicationInsight(
  options: ResolveApplicationInsightOptions,
): Promise<ApplicationInsightDetail | null> {
  const context = await buildApplicationAiContext(options.userId, options.applicationId);
  if (!context) return null;

  const fingerprint = buildApplicationContextFingerprint(options.type, context);

  if (!options.forceRefresh) {
    const cached = await findCachedInsight(
      options.userId,
      options.applicationId,
      options.type,
      fingerprint,
    );
    if (cached) return cached;
  }

  const generated = await runGeneration(options.type, context, options.stage);

  const stored = await prisma.applicationInsight.create({
    data: {
      applicationId: options.applicationId,
      userId: options.userId,
      type: options.type,
      source: generated.source,
      contentJson: toPrismaJson(generated.content),
      contextSnapshotJson: toPrismaJson(context),
      contextFingerprint: fingerprint,
      model: generated.model,
      aiSource: generated.aiSource,
      warningsJson: toPrismaJson(generated.warnings),
    },
    select: { id: true, createdAt: true },
  });

  return {
    id: stored.id,
    type: options.type,
    source: generated.source,
    content: generated.content,
    model: generated.model,
    aiSource: generated.aiSource,
    warnings: generated.warnings,
    createdAt: stored.createdAt.toISOString(),
  };
}

/**
 * Refreshes the application's stored next action columns from a resolved
 * insight. Called after a deterministic state change has already committed.
 */
export async function refreshApplicationNextAction(
  userId: string,
  applicationId: string,
  forceRefresh = false,
): Promise<void> {
  const insight = await resolveApplicationInsight({
    userId,
    applicationId,
    type: "NEXT_ACTION",
    forceRefresh,
  });

  if (!insight) return;

  const content = insight.content as ApplicationNextActionContent;

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      nextActionType: content.type,
      nextActionTitle: content.title,
      nextActionReason: content.reason,
      nextActionDueAt: content.dueAt ? new Date(content.dueAt) : null,
      nextActionSource: insight.source === "AI_GENERATED" ? "AI" : "RULE_BASED",
    },
  });
}

export function stageInsightTypeFor(stage: ApplicationStagePrep["stage"]): ApplicationInsightType {
  return STAGE_INSIGHT_TYPES[stage];
}
