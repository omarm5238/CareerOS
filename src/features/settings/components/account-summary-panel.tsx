import type { AccountSummary, UserProfile } from "../types";

type AccountSummaryPanelProps = {
  profile: UserProfile;
  accountSummary: AccountSummary;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AccountSummaryPanel({ profile, accountSummary }: AccountSummaryPanelProps) {
  const items = [
    { label: "Email", value: profile.email },
    { label: "Account ID", value: profile.id },
    { label: "Resume analyses", value: String(accountSummary.resumeAnalysesCount) },
    { label: "Saved jobs", value: String(accountSummary.savedJobsCount) },
    { label: "Applications", value: accountSummary.applicationSummary },
    { label: "Account created", value: formatDate(profile.createdAt) },
    { label: "Last updated", value: formatDate(profile.updatedAt) },
  ];

  return (
    <section
      aria-labelledby="account-summary-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="account-summary-heading"
      >
        Account Summary
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3"
            key={item.label}
          >
            <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              {item.label}
            </dt>
            <dd className="mt-1 break-all text-sm font-medium text-[var(--color-text-primary)]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
