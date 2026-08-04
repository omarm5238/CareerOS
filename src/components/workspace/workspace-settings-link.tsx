import Link from "next/link";

type WorkspaceSettingsLinkProps = {
  isActive?: boolean;
};

export function WorkspaceSettingsLink({ isActive = false }: WorkspaceSettingsLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      aria-label="Settings"
      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-lg)] border text-xs font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
        isActive
          ? "border-[var(--color-border)] bg-[rgb(199_203_209_/_6%)] text-[var(--color-text-primary)]"
          : "border-[var(--color-border-subtle)] bg-[var(--surface-inset)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--surface-soft-glass)] hover:text-[var(--color-text-primary)]"
      }`}
      href="/workspace/settings"
      title="Settings"
    >
      <span aria-hidden="true">⚙</span>
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--color-intelligence)]"
        />
      ) : null}
    </Link>
  );
}
