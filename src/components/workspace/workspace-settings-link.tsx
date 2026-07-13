import Link from "next/link";

type WorkspaceSettingsLinkProps = {
  isActive?: boolean;
};

export function WorkspaceSettingsLink({ isActive = false }: WorkspaceSettingsLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      aria-label="Settings"
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-lg)] border text-xs font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
        isActive
          ? "border-[rgb(99_102_241_/_35%)] bg-[rgb(99_102_241_/_12%)] text-[var(--color-accent)]"
          : "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_45%)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--surface-soft-glass)] hover:text-[var(--color-text-primary)]"
      }`}
      href="/workspace/settings"
      title="Settings"
    >
      <span aria-hidden="true">⚙</span>
    </Link>
  );
}
