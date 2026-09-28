"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobDiscoveryProfileData, JobDiscoveryRoleTarget } from "../types";
import { interpretSearchProfile, LOCATION_MODES, type LocationSearchMode, type SearchIntent } from "../quality/search-quality";

const COUNTRY_OPTIONS = [
  { code: "TR", label: "Türkiye" },
  { code: "DE", label: "Germany" },
  { code: "NL", label: "Netherlands" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "FR", label: "France" },
];

const SENIORITY = ["INTERN", "ENTRY", "JUNIOR", "MID", "SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"] as const;
const EMPLOYMENT = ["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"] as const;
const MODE_LABELS: Record<LocationSearchMode, string> = {
  CURRENT_COUNTRY: "Current country",
  SELECTED_COUNTRIES: "Selected countries",
  REMOTE_ONLY: "Remote only",
  CURRENT_COUNTRY_PLUS_REMOTE: "Current country + Remote",
  SELECTED_COUNTRIES_PLUS_REMOTE: "Selected countries + Remote",
};

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
  const [intent, setIntent] = useState<SearchIntent>(() => interpretSearchProfile(profile));

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
          providerPreferences: profile.providerPreferences,
          searchIntent: {
            ...intent,
            freshnessDays,
            preferredTitles: roleTargets.filter((target) => target.enabled).map((target) => target.title),
          },
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function updateRoleTarget(index: number, patch: Partial<JobDiscoveryRoleTarget>) {
    setRoleTargets((prev) => prev.map((target, i) => (i === index ? { ...target, ...patch } : target)));
  }

  function toggleCode(code: string) {
    setIntent((prev) => ({
      ...prev,
      selectedCountryCodes: prev.selectedCountryCodes.includes(code)
        ? prev.selectedCountryCodes.filter((item) => item !== code)
        : [...prev.selectedCountryCodes, code],
    }));
  }

  function toggleRegion(region: "EMEA" | "EUROPE") {
    setIntent((prev) => ({
      ...prev,
      remote: {
        ...prev.remote,
        regions: prev.remote.regions.includes(region)
          ? prev.remote.regions.filter((item) => item !== region)
          : [...prev.remote.regions, region],
      },
    }));
  }

  return (
    <section id="edit" className="surface-glass mt-6 space-y-4 p-5">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Edit Search Profile</h2>
      {!intent.currentCountryCode && (intent.locationMode === "CURRENT_COUNTRY" || intent.locationMode === "CURRENT_COUNTRY_PLUS_REMOTE") ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Current country is not set. Discovery will not assume a country.</p>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs uppercase text-[var(--color-text-secondary)]">Target roles</p>
        {roleTargets.map((target, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={target.title}
              onChange={(e) => updateRoleTarget(i, { title: e.target.value })}
              className="min-w-[200px] rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={target.enabled} onChange={(e) => updateRoleTarget(i, { enabled: e.target.checked })} />
              Enabled
            </label>
          </div>
        ))}
      </div>

      <label className="block text-sm">
        <span className="text-[var(--color-text-secondary)]">Excluded titles</span>
        <input
          value={intent.excludedTitles.join(", ")}
          onChange={(e) => setIntent((prev) => ({ ...prev, excludedTitles: splitList(e.target.value) }))}
          className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase text-[var(--color-text-secondary)]">Search location</legend>
        {LOCATION_MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="radio"
              name="location-mode"
              checked={intent.locationMode === mode}
              onChange={() => setIntent((prev) => ({ ...prev, locationMode: mode }))}
            />
            {MODE_LABELS[mode]}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Current country</span>
          <select
            value={intent.currentCountryCode ?? ""}
            onChange={(e) => setIntent((prev) => ({ ...prev, currentCountryCode: e.target.value || null }))}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
          >
            <option value="">Not set</option>
            {COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
          </select>
        </label>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Selected countries</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map((country) => (
              <label key={country.code} className="flex items-center gap-1 text-xs text-[var(--color-text-primary)]">
                <input type="checkbox" checked={intent.selectedCountryCodes.includes(country.code)} onChange={() => toggleCode(country.code)} />
                {country.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase text-[var(--color-text-secondary)]">Remote policy</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intent.remote.worldwide} onChange={(e) => setIntent((prev) => ({ ...prev, remote: { ...prev.remote, worldwide: e.target.checked } }))} /> Worldwide</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intent.remote.regions.includes("EMEA")} onChange={() => toggleRegion("EMEA")} /> EMEA</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intent.remote.regions.includes("EUROPE")} onChange={() => toggleRegion("EUROPE")} /> Europe</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intent.remote.acceptingCurrentCountry} onChange={(e) => setIntent((prev) => ({ ...prev, remote: { ...prev.remote, acceptingCurrentCountry: e.target.checked } }))} /> Accepting current country</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intent.remote.acceptingSelectedCountries} onChange={(e) => setIntent((prev) => ({ ...prev, remote: { ...prev.remote, acceptingSelectedCountries: e.target.checked } }))} /> Accepting selected countries</label>
      </fieldset>

      <fieldset>
        <legend className="text-xs uppercase text-[var(--color-text-secondary)]">Allowed seniority</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SENIORITY.map((level) => (
            <label key={level} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={intent.allowedSeniority.includes(level)}
                onChange={(e) => setIntent((prev) => ({
                  ...prev,
                  allowedSeniority: e.target.checked
                    ? [...prev.allowedSeniority, level]
                    : prev.allowedSeniority.filter((item) => item !== level),
                  excludedSeniority: e.target.checked
                    ? prev.excludedSeniority.filter((item) => item !== level)
                    : [...new Set([...prev.excludedSeniority, level])],
                }))}
              />
              {level}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Preferred stack</span>
          <input value={intent.preferredStack.join(", ")} onChange={(e) => setIntent((prev) => ({ ...prev, preferredStack: splitList(e.target.value) }))} className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Avoid if mandatory</span>
          <input value={intent.avoidWhenMandatoryStack.join(", ")} onChange={(e) => setIntent((prev) => ({ ...prev, avoidWhenMandatoryStack: splitList(e.target.value) }))} className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs uppercase text-[var(--color-text-secondary)]">Employment type</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMPLOYMENT.map((type) => (
            <label key={type} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={intent.employmentTypes.includes(type)}
                onChange={(e) => setIntent((prev) => ({
                  ...prev,
                  employmentTypes: e.target.checked
                    ? [...prev.employmentTypes, type]
                    : prev.employmentTypes.filter((item) => item !== type),
                }))}
              />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-[var(--color-text-secondary)]">Minimum provider trust</span>
        <select
          value={intent.minimumTrust}
          onChange={(e) => setIntent((prev) => ({ ...prev, minimumTrust: e.target.value as SearchIntent["minimumTrust"] }))}
          className="mt-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
        >
          <option value="TIER_C">Include unknown sources</option>
          <option value="TIER_B">Established providers and official sources</option>
          <option value="TIER_A">Official sources only</option>
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Minimum suitability</span>
          <input type="number" min={0} max={100} value={minimumSuitabilityScore} onChange={(e) => setMinimumSuitabilityScore(Number(e.target.value))} className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Daily target</span>
          <input type="number" min={1} max={100} value={dailyTarget} onChange={(e) => setDailyTarget(Number(e.target.value))} className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-text-secondary)]">Freshness (days)</span>
          <input type="number" min={1} max={90} value={freshnessDays} onChange={(e) => setFreshnessDays(Number(e.target.value))} className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
        </label>
      </div>

      <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent)] disabled:opacity-50">
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </section>
  );
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
