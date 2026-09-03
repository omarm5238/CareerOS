"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobDiscoveryProfileData, JobDiscoveryRoleTarget } from "../types";

type ProfileEditorProps = {
  profile: JobDiscoveryProfileData & { id: string };
};

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [roleTargets, setRoleTargets] = useState(profile.roleTargets);
  const [minimumSuitabilityScore, setMinimumSuitabilityScore] = useState(profile.minimumSuitabilityScore);
  const [dailyTarget, setDailyTarget] = useState(profile.dailyTarget);
  const [freshnessDays, setFreshnessDays] = useState(profile.freshnessDays);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/jobs/discovery/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTargets,
          minimumSuitabilityScore,
          dailyTarget,
          freshnessDays,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function updateRoleTarget(index: number, patch: Partial<JobDiscoveryRoleTarget>) {
    setRoleTargets((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  return (
    <section id="edit" className="surface-glass mt-6 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Edit Search Profile</h2>

      <div className="space-y-3">
        <p className="text-xs uppercase text-[var(--color-text-secondary)]">Role Targets</p>
        {roleTargets.map((target, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={target.title}
              onChange={(e) => updateRoleTarget(i, { title: e.target.value })}
              className="min-w-[200px] rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={target.enabled}
                onChange={(e) => updateRoleTarget(i, { enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Minimum Suitability</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minimumSuitabilityScore}
            onChange={(e) => setMinimumSuitabilityScore(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Daily Target</span>
          <input
            type="number"
            min={1}
            max={100}
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Freshness (days)</span>
          <input
            type="number"
            min={1}
            max={90}
            value={freshnessDays}
            onChange={(e) => setFreshnessDays(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </section>
  );
}
