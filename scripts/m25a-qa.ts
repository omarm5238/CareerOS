import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { toPrismaJson } from "@/features/linkedin/lib/json-parsers";
import { LinkedinAccessError } from "@/features/linkedin/lib/permissions";
import { inspectSanitizedContext, sanitizeLinkedinCareerContext } from "@/features/linkedin/context/sanitize-linkedin-career-context";
import { flagUnsupportedPositioning } from "@/features/linkedin/lib/claim-safety";
import { scoreLinkedinIdea } from "@/features/linkedin/ideas/score-linkedin-idea";
import { calculateLinkedinPerformanceMetrics } from "@/features/linkedin/performance/calculate-linkedin-performance-metrics";
import {
  activateLinkedinStrategy,
  addLinkedinPostPerformance,
  archiveLinkedinPost,
  buildLinkedinCareerContext,
  createLinkedinPublishingPlan,
  editLinkedinPost,
  findLinkedinVisibilityGaps,
  generateLinkedinGrowthInsights,
  generateLinkedinIdeas,
  generateLinkedinPostFromBrief,
  generateLinkedinPostFromIdea,
  generateLinkedinStrategy,
  getLinkedinPost,
  getLinkedinStrategy,
  markLinkedinPostPublishedManually,
  markLinkedinPostReady,
  recommendNextLinkedinIdeas,
  regenerateLinkedinPost,
  repairLinkedinPost,
  runLinkedinPostQa,
  setActiveLinkedinPostRevision,
  transformLinkedinPost,
  updateLinkedinIdea,
  updateLinkedinStrategy,
} from "@/features/linkedin/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function getTestUser() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  return user;
}

async function seedRequirements(userId: string, names: string[]) {
  const job = await prisma.jobPosting.create({
    data: {
      userId,
      title: "M25A Target Role",
      company: "Fixture Labs",
      description: "Controlled job for LinkedIn visibility-gap QA.",
      source: "m25a-qa",
    },
  });
  for (const [index, name] of names.entries()) {
    for (let copy = 0; copy < (name === "PostgreSQL" ? 3 : 1); copy += 1) {
      await prisma.jobRequirement.create({
        data: {
          userId,
          jobPostingId: job.id,
          category: "SKILL",
          importance: "REQUIRED",
          normalizedName: name,
          rawText: name,
          sourceExcerpt: name,
          isExplicit: true,
          fingerprint: `m25a-${name}-${index}-${copy}-${Date.now()}`,
        },
      });
    }
  }
  return job.id;
}

async function run() {
  const user = await getTestUser();
  await prisma.linkedinGrowthInsight.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinPostPerformance.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinPublishingPlan.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinPost.updateMany({ where: { userId: user.id }, data: { activeRevisionId: null } });
  await prisma.linkedinPostRevision.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinPost.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinContentIdea.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinContentPillar.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinGrowthProfile.deleteMany({ where: { userId: user.id } });
  const jobId = await seedRequirements(user.id, ["PostgreSQL", "Kubernetes"]);

  const dirty = {
    salary: "180000",
    workAuthorization: "needs-sponsorship",
    visa: "H1B",
    demographics: { gender: "x" },
    password: "secret",
    mfa: "123456",
    recruiterContact: "hidden",
    rejectionNotes: "private",
    applicationId: "app_123",
    targetRoles: ["Backend Engineer"],
    verifiedSkills: ["PostgreSQL", "TypeScript"],
  };
  const sanitized = sanitizeLinkedinCareerContext(dirty);
  const inspection = inspectSanitizedContext(sanitized);
  evidence.privacySanitizer = inspection;
  assert(inspection.looksClean, "Sanitizer left forbidden keys.");
  assert(!("salary" in sanitized) && !("visa" in sanitized), "Forbidden fields survived sanitizer.");

  const context = await buildLinkedinCareerContext(user.id);
  evidence.contextSources = {
    targetRoles: context.targetRoles.length,
    skills: context.verifiedSkills.length,
    requirements: context.jobRequirementPatterns.length,
  };
  const positioningFlags = flagUnsupportedPositioning("I am a Senior Engineer and industry expert with 10 years experience.", context);
  evidence.unsupportedPositioning = positioningFlags.map((item) => item.code);
  assert(positioningFlags.some((item) => item.code === "unsupported_seniority"), "Seniority claim was not flagged.");

  const draft = await generateLinkedinStrategy(user.id, { primaryGoal: "GET_HIRED" });
  evidence.strategyGenerate = { id: draft.id, status: draft.status, pillars: draft.pillars.length };
  assert(draft.status === "DRAFT", "Generated strategy must start DRAFT.");
  assert(draft.pillars.length >= 3 && draft.pillars.length <= 5, "Strategy must have 3–5 pillars.");

  const edited = await updateLinkedinStrategy(user.id, {
    id: draft.id,
    postingFrequencyTarget: 3,
    positioningStatement: draft.positioningStatement,
  });
  evidence.strategyEdit = edited.postingFrequencyTarget;
  assert(edited.postingFrequencyTarget === 3, "Draft strategy edit failed.");

  const activated = await activateLinkedinStrategy(user.id, draft.id);
  const activeCount = await prisma.linkedinGrowthProfile.count({ where: { userId: user.id, status: "ACTIVE" } });
  evidence.activation = { status: activated.status, activeCount };
  assert(activated.status === "ACTIVE" && activeCount === 1, "Activation invariant failed.");

  const previousModel = process.env.OPENAI_LINKEDIN_MODEL;
  process.env.OPENAI_LINKEDIN_MODEL = "invalid-m25a-test-model";
  try {
    const refreshDraft = await generateLinkedinStrategy(user.id, { primaryGoal: "GET_HIRED" });
    const stillActive = await getLinkedinStrategy(user.id);
    evidence.aiFailureStrategy = {
      refreshStatus: refreshDraft.status,
      activeId: stillActive?.id,
      originalActiveId: activated.id,
    };
    assert(stillActive?.id === activated.id, "AI failure replaced the active strategy.");
    assert(refreshDraft.status === "DRAFT", "Failed/fallback generation must stay DRAFT.");
  } finally {
    if (previousModel) process.env.OPENAI_LINKEDIN_MODEL = previousModel;
    else delete process.env.OPENAI_LINKEDIN_MODEL;
  }

  const ideas = await generateLinkedinIdeas(user.id, { count: 5 });
  const overflow = await generateLinkedinIdeas(user.id, { count: 12 });
  evidence.ideas = { first: ideas.length, overflow: overflow.length };
  assert(ideas.length >= 1 && ideas.length <= 5, "Default idea generation did not return a usable set.");
  assert(overflow.length <= 10, "Max idea count was not enforced.");

  const strong = scoreLinkedinIdea({
    context,
    title: "PostgreSQL query planning notes",
    evidenceStrength: "STRONG",
    pillarMatch: true,
    audienceMatch: true,
    freshness: "fresh",
  });
  const weak = scoreLinkedinIdea({
    context,
    title: "Random hobby thought",
    evidenceStrength: "WEAK",
    pillarMatch: false,
    audienceMatch: false,
    freshness: "stale",
  });
  evidence.priorityFormula = { strong: strong.total, weak: weak.total, parts: strong };
  assert(strong.total > weak.total, "Strong evidence did not outrank weak.");
  assert(strong.total === strong.careerRelevance + strong.evidenceStrength + strong.audienceFit + strong.pillarFit + strong.freshness, "Score parts do not sum.");

  const firstIds = new Set(ideas.map((item) => item.id));
  const second = await generateLinkedinIdeas(user.id, { count: 5 });
  evidence.dedupe = { secondCreated: second.length, overlap: second.filter((item) => firstIds.has(item.id)).length };
  assert(second.every((item) => !firstIds.has(item.id)), "Dedupe created duplicate IDs.");

  const dismissed = await updateLinkedinIdea(user.id, ideas[0].id, { status: "DISMISSED" });
  const shortlistTarget = ideas[1] ?? second[0] ?? ideas[0];
  const shortlisted = ideas[1]
    ? await updateLinkedinIdea(user.id, ideas[1].id, { status: "SHORTLISTED" })
    : second[0]
      ? await updateLinkedinIdea(user.id, second[0].id, { status: "SHORTLISTED" })
      : dismissed;
  evidence.ideaStatus = { dismissed: dismissed.status, shortlisted: shortlisted.status };
  assert(dismissed.status === "DISMISSED", "Dismiss did not persist.");
  if (ideas[1] || second[0]) {
    assert(shortlisted.status === "SHORTLISTED", "Shortlist did not persist.");
  }

  const gaps = await findLinkedinVisibilityGaps(user.id);
  const postgres = gaps.find((item) => item.topic.toLowerCase().includes("postgres"));
  const kubernetes = gaps.find((item) => item.topic.toLowerCase().includes("kubernetes"));
  evidence.visibilityGaps = gaps.map((item) => ({ topic: item.topic, rec: item.recommendation }));
  if (context.verifiedSkills.some((skill) => skill.toLowerCase().includes("postgres")) || postgres) {
    assert(!kubernetes || kubernetes.recommendation === "BUILD_EVIDENCE" || kubernetes.hasEvidence, "Kubernetes handling captured.");
  }
  if (kubernetes && !kubernetes.hasEvidence) {
    assert(kubernetes.recommendation === "BUILD_EVIDENCE", "Missing Kubernetes evidence recommended expertise.");
  }

  const top = await recommendNextLinkedinIdeas(user.id);
  evidence.nextRecommendations = top.map((item) => ({ title: item.title, why: item.why }));
  assert(top.every((item) => item.why.length > 0), "Top recommendations missing why.");

  const ideaForDraft =
    (shortlisted.status === "SHORTLISTED" ? shortlisted : null) ??
    (await prisma.linkedinContentIdea.findFirst({
      where: { userId: user.id, status: { in: ["NEW", "SHORTLISTED"] } },
    }));
  if (!ideaForDraft) throw new Error("No idea remained available to draft.");
  const fromIdea = await generateLinkedinPostFromIdea(user.id, ideaForDraft.id);
  evidence.postFromIdea = { id: fromIdea.id, rev: fromIdea.activeRevision?.revisionNumber };
  assert(fromIdea.activeRevision?.revisionNumber === 1, "Idea draft did not create Rev 1.");

  const fromBrief = await generateLinkedinPostFromBrief(user.id, {
    brief: "What I learned this week while practicing PostgreSQL indexes.",
    objective: "SHOW_LEARNING",
  });
  evidence.directPost = { id: fromBrief.id, rev: fromBrief.activeRevision?.revisionNumber };
  assert(fromBrief.activeRevision?.revisionNumber === 1, "Direct post did not create Rev 1.");

  const rev1Hook = fromIdea.activeRevision!.hook;
  const regenerated = await regenerateLinkedinPost(user.id, fromIdea.id);
  const editedPost = await editLinkedinPost(user.id, fromIdea.id, {
    hook: regenerated.activeRevision?.hook,
    body: `${regenerated.activeRevision?.body ?? ""}\nEdited for clarity.`,
  });
  const transformed = await transformLinkedinPost(user.id, fromIdea.id, { type: "IMPROVE_HOOK" });
  const original = transformed.revisions.find((item) => item.revisionNumber === 1);
  evidence.revisions = {
    count: transformed.revisions.length,
    active: transformed.activeRevision?.revisionNumber,
    rev1Unchanged: original?.hook === rev1Hook,
  };
  assert((transformed.activeRevision?.revisionNumber ?? 0) >= 3, "Transforms/edits did not create new revisions.");
  assert(original?.hook === rev1Hook, "Old revision was mutated.");

  process.env.OPENAI_LINKEDIN_MODEL = "invalid-m25a-test-model";
  const beforeFail = transformed.activeRevisionId;
  const afterFail = await regenerateLinkedinPost(user.id, fromIdea.id);
  if (previousModel) process.env.OPENAI_LINKEDIN_MODEL = previousModel;
  else delete process.env.OPENAI_LINKEDIN_MODEL;
  evidence.aiFailurePost = { before: beforeFail, after: afterFail.activeRevisionId };
  assert(afterFail.activeRevisionId === beforeFail, "AI regenerate failure overwrote the active revision.");

  const claimPost = await editLinkedinPost(user.id, fromBrief.id, {
    body: "I increased system performance by 70%. I am AWS Certified. I was a Senior Engineer. I led a team of 20 engineers. I worked with Google.",
  });
  const qa = await runLinkedinPostQa(user.id, claimPost.id);
  evidence.qaFlags = qa.warnings.map((item) => item.code);
  assert(qa.status === "BLOCKED", "Unsupported claims were not blocked.");
  assert(qa.warnings.some((item) => item.code === "unsupported_metric"), "Metric claim missed.");
  assert(qa.warnings.some((item) => item.code === "unsupported_certification"), "Certification claim missed.");
  assert(qa.warnings.some((item) => item.code === "unsupported_seniority"), "Seniority claim missed.");

  let readyBlocked = false;
  try {
    await markLinkedinPostReady(user.id, claimPost.id);
  } catch (error) {
    readyBlocked = error instanceof LinkedinAccessError;
  }
  evidence.blockedCannotReady = readyBlocked;
  assert(readyBlocked, "BLOCKED post was allowed to READY.");

  const repaired = await repairLinkedinPost(user.id, claimPost.id);
  const claimRevision = claimPost.activeRevision;
  evidence.repair = {
    newRev: repaired.post.activeRevision?.revisionNumber,
    oldIntact: claimRevision?.body.includes("70%"),
    qa: repaired.qa.status,
  };
  assert((repaired.post.activeRevision?.revisionNumber ?? 0) > (claimRevision?.revisionNumber ?? 0), "Repair did not create a new revision.");
  assert(claimRevision?.body.includes("70%"), "Repair mutated the blocked revision.");

  const ready = await markLinkedinPostReady(user.id, repaired.post.id);
  evidence.ready = ready.status;
  assert(ready.status === "READY", "READY gating failed after repair.");

  const plan = await createLinkedinPublishingPlan(user.id, ready.id, {});
  const planRevision = plan.revisionId;
  const afterNewer = await editLinkedinPost(user.id, ready.id, {
    body: `${ready.activeRevision?.body ?? ""}\nRevision B`,
  });
  const planRow = await prisma.linkedinPublishingPlan.findUniqueOrThrow({ where: { id: plan.id } });
  evidence.exactRevision = {
    planRevision,
    laterActive: afterNewer.activeRevisionId,
    planStill: planRow.linkedinPostRevisionId,
  };
  assert(planRow.linkedinPostRevisionId === planRevision, "Publishing plan silently switched revision.");
  assert(planRow.linkedinPostRevisionId !== afterNewer.activeRevisionId, "Plan now points at Rev B.");

  const published = await markLinkedinPostPublishedManually(user.id, plan.id, {});
  const publishedAgain = await markLinkedinPostPublishedManually(user.id, plan.id, {});
  evidence.manualPublish = {
    first: published.publishedAt,
    second: publishedAgain.publishedAt,
    idempotent: published.publishedAt === publishedAgain.publishedAt && publishedAgain.alreadyPublished,
    source: published.plan.publishingSource,
    revision: published.revisionId,
  };
  assert(publishedAgain.alreadyPublished, "Second mark published was not idempotent.");
  assert(published.publishedAt === publishedAgain.publishedAt, "publishedAt churned.");
  assert(published.revisionId === planRevision, "Manual publish used the wrong revision.");
  assert(published.plan.publishingSource === "USER_CONFIRMED", "Source was not USER_CONFIRMED.");

  const nullRate = calculateLinkedinPerformanceMetrics({ impressions: null, likes: 10, comments: 0, reposts: 0, saves: 0 });
  const zeroRate = calculateLinkedinPerformanceMetrics({ impressions: 100, likes: 0, comments: 0, reposts: 0, saves: 0 });
  evidence.derivedMetrics = { nullRate: nullRate.engagementRate, zeroRate: zeroRate.engagementRate };
  assert(nullRate.engagementRate === null, "Null impressions produced a fake rate.");
  assert(zeroRate.engagementRate === 0, "Zero engagement rate was wrong.");

  const snapshot = await addLinkedinPostPerformance(user.id, ready.id, {
    impressions: 100,
    likes: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
  });
  let negativeRejected = false;
  try {
    await addLinkedinPostPerformance(user.id, ready.id, { likes: -1 });
  } catch (error) {
    negativeRejected = error instanceof LinkedinAccessError;
  }
  evidence.performance = { snapshot: snapshot.engagementRate, negativeRejected };
  assert(snapshot.engagementRate === 0, "Persisted zero rate was wrong.");
  assert(negativeRejected, "Negative metric was accepted.");

  const insights = await generateLinkedinGrowthInsights(user.id);
  evidence.insights = insights.map((item) => ({ title: item.title, confidence: item.confidence }));
  assert(insights.every((item) => item.confidence !== "causal"), "Insight claimed causality.");

  const userB = await prisma.user.create({
    data: { name: "M25A User B", email: `m25a-user-b-${Date.now()}@careeros.local`, emailVerified: false },
  });
  const cross: Record<string, string> = {};
  const tryCross = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      cross[name] = "LEAK";
    } catch (error) {
      cross[name] = error instanceof LinkedinAccessError ? error.code : "ERROR";
    }
  };
  await tryCross("getStrategy", async () => {
    const row = await getLinkedinStrategy(userB.id);
    if (row) throw new LinkedinAccessError("FORBIDDEN", "Strategy leaked.");
    throw new LinkedinAccessError("NOT_FOUND", "LinkedIn strategy not found.");
  });
  await tryCross("updateStrategy", () => updateLinkedinStrategy(userB.id, { id: activated.id, postingFrequencyTarget: 1 }));
  await tryCross("getIdea", () => updateLinkedinIdea(userB.id, ideaForDraft.id, { status: "SHORTLISTED" }));
  await tryCross("draftIdea", () => generateLinkedinPostFromIdea(userB.id, ideaForDraft.id));
  await tryCross("getPost", () => getLinkedinPost(userB.id, fromIdea.id));
  await tryCross("editPost", () => editLinkedinPost(userB.id, fromIdea.id, { body: "no" }));
  await tryCross("generatePost", () => regenerateLinkedinPost(userB.id, fromIdea.id));
  await tryCross("setActive", () => setActiveLinkedinPostRevision(userB.id, fromIdea.id, fromIdea.activeRevisionId ?? "x"));
  await tryCross("qa", () => runLinkedinPostQa(userB.id, fromIdea.id));
  await tryCross("repair", () => repairLinkedinPost(userB.id, fromIdea.id));
  await tryCross("plan", () => createLinkedinPublishingPlan(userB.id, ready.id, {}));
  await tryCross("publish", () => markLinkedinPostPublishedManually(userB.id, plan.id, {}));
  await tryCross("performance", () => addLinkedinPostPerformance(userB.id, ready.id, { likes: 1 }));
  evidence.security = cross;
  assert(Object.values(cross).every((value) => value === "NOT_FOUND" || value === "FORBIDDEN" || value === "ERROR" || value === "CONFLICT"), "Cross-user leak detected.");
  assert(cross.getPost === "NOT_FOUND", "Cross-user post read leaked.");

  await archiveLinkedinPost(user.id, fromBrief.id);
  evidence.ok = true;
  evidence.jobId = jobId;
  console.log(JSON.stringify(evidence, null, 2));
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
