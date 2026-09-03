"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { JobsSubNav } from "@/features/jobs/components/jobs-sub-nav";
import { DiscoveredJobCard } from "./discovered-job-card";
import { ProfileEditor } from "./profile-editor";
import type { DiscoveryListItem, ProviderError } from "../types";
import type { JobDiscoveryProfileData } from "../types";

type ProviderStatus = { provider: string; status: string; label: string };

type DiscoveryPageProps = {
  profile: (JobDiscoveryProfileData & { id: string }) | null;
  results: DiscoveryListItem[];
  providerStatus: ProviderStatus[];
  lastRun: {
    startedAt: string;
    status: string;
    strongMatchCount: number;
    providerErrors: ProviderError[];
  } | null;
  todayStrong: number;
  dailyTarget: number;
};

export function DiscoveryPage({
  profile,
  results: initialResults,
  providerStatus,
  lastRun,
  todayStrong,
  dailyTarget,
}: DiscoveryPageProps) {
  const router = useRouter();
  const [results, setResults] = useState(initialResults);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "strong" | "possible" | "dismissed">("all");
  const [generating, setGenerating] = useState(false);

  const minScore = profile?.minimumSuitabilityScore ?? 75;

  const filtered = results.filter((j) => {
    if (filter === "dismissed") return !!j.dismissedAt;
    if (j.dismissedAt) return false;
    if (filter === "strong") return (j.finalScore ?? 0) >= minScore;
    if (filter === "possible") return (j.finalScore ?? 0) >= 65 && (j.finalScore ?? 0) < minScore;
    return true;
  });

  const handleRunDiscovery = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/jobs/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Discovery failed");
      router.refresh();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setRunning(false);
    }
  }, [router]);

  const handleGenerateProfile = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/jobs/discovery/profile/generate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate profile");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }, [router]);

  const handleAddToQueue = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/discovery/${id}/queue`, { method: "POST" });
    if (!res.ok) return;
    setResults((prev) =>
      prev.map((j) => (j.id === id ? { ...j, queueItemId: "queued", queueStatus: "QUEUED" } : j)),
    );
    router.refresh();
  }, [router]);

  const handleDismiss = useCallback(async (id: string, reason?: string) => {
    const res = await fetch(`/api/jobs/discovery/${id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) return;
    setResults((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, dismissedAt: new Date().toISOString(), discoveryStatus: "DISMISSED" } : j,
      ),
    );
    router.refresh();
  }, [router]);

  const handleBatchAdd = useCallback(async () => {
    const strongIds = results
      .filter((j) => !j.dismissedAt && !j.queueItemId && (j.finalScore ?? 0) >= minScore)
      .slice(0, 10)
      .map((j) => j.id);
    if (strongIds.length === 0) return;
    const res = await fetch("/api/jobs/discovery/queue/batch-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discoveredJobIds: strongIds, minimumScore: minScore }),
    });
    if (res.ok) {
      setResults((prev) =>
        prev.map((j) =>
          strongIds.includes(j.id) ? { ...j, queueItemId: j.queueItemId ?? "queued", queueStatus: j.queueStatus ?? "QUEUED" } : j,
        ),
      );
    }
    router.refresh();
  }, [results, minScore, router]);

  const availableCount = providerStatus.filter((p) => p.status === "available").length;

  return (
    <WorkspaceModuleLayout title="Job Discovery">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative mx-auto module-shell px-6 py-8 lg:px-8">
          <JobsSubNav />

          <header className="mt-6 space-y-4">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Job Discovery</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Last discovery: {lastRun ? new Date(lastRun.startedAt).toLocaleString() : "Never"}
                {lastRun ? ` · ${lastRun.status}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-[var(--color-text-secondary)]">Providers: </span>
                <span className="text-[var(--color-text-primary)]">{availableCount} / {providerStatus.length} available</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)]">Today&apos;s strong opportunities: </span>
                <span className="text-[var(--color-text-primary)]">{todayStrong} / {dailyTarget}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Job provider status">
              {providerStatus.map((p) => (
                <span
                  key={p.provider}
                  className="rounded border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
                >
                  {p.label} — {p.status === "available" ? "Available" : p.status === "not_configured" ? "Not configured" : "Unavailable this run"}
                </span>
              ))}
            </div>

            {lastRun?.status === "PARTIAL" && lastRun.providerErrors.length > 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Discovery completed with a provider issue:{" "}
                {lastRun.providerErrors
                  .map((err) => `${err.provider} (${err.category})`)
                  .join(", ")}
                . Results from successful providers are still available.
              </p>
            ) : null}

            {profile ? (
              <div className="surface-glass p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">Career Search Profile</p>
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                  {profile.roleTargets.filter((t) => t.enabled).map((t) => t.title).join(" · ") || "No role targets"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Min suitability {profile.minimumSuitabilityScore} · Freshness {profile.freshnessDays}d · Target {profile.dailyTarget}/day
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/workspace/jobs/discover#edit" className="text-sm text-[var(--color-accent)] hover:underline">
                    Edit Profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="surface-glass p-6 text-center">
                <p className="text-[var(--color-text-secondary)]">Create your Career Search Profile to begin discovery.</p>
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerateProfile}
                  className="mt-4 rounded-lg border border-[var(--color-accent)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Generate Search Profile"}
                </button>
              </div>
            )}

            {profile ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={handleRunDiscovery}
                  className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {running ? "Running discovery…" : "Run Discovery"}
                </button>
                <button
                  type="button"
                  onClick={handleBatchAdd}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  Add Strong Matches to Queue
                </button>
              </div>
            ) : null}

            {runError ? <p className="text-sm text-red-400">{runError}</p> : null}

            {profile ? <ProfileEditor profile={profile} /> : null}
          </header>

          {profile ? (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                {(["all", "strong", "possible", "dismissed"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded px-3 py-1 text-sm capitalize ${
                      filter === f
                        ? "bg-[var(--surface-soft-glass)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {f === "strong" ? "Strong+" : f}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {filtered.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {filter === "dismissed"
                      ? "No dismissed jobs."
                      : filter === "all" && results.length === 0
                      ? "Run discovery to find opportunities."
                      : "Discovery completed, but no opportunities met your current suitability threshold."}
                  </p>
                ) : (
                  filtered.map((job) => (
                    <DiscoveredJobCard
                      key={job.id}
                      job={job}
                      minimumScore={minScore}
                      onAddToQueue={handleAddToQueue}
                      onDismiss={handleDismiss}
                    />
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
