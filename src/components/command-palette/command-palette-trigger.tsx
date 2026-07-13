"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { useCommandPalette } from "./command-palette-provider";
import { usePlatformShortcutLabel } from "./use-platform-shortcut-label";

export function CommandPaletteTrigger() {
  const { openPalette, setTriggerElement } = useCommandPalette();
  const shortcutLabel = usePlatformShortcutLabel();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTriggerElement(buttonRef.current);
    return () => setTriggerElement(null);
  }, [setTriggerElement]);

  return (
    <div className="ml-auto flex min-w-0 max-w-md shrink items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_54%)] px-3 py-2.5 shadow-[var(--shadow-sm)] sm:gap-3 sm:px-4">
      <button
        ref={buttonRef}
        aria-haspopup="dialog"
        aria-label="Open command palette"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] text-left [transition:var(--motion-fade)] hover:bg-[rgb(23_23_23_/_42%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:gap-3"
        onClick={openPalette}
        type="button"
      >
        <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)] opacity-80 sm:block" />
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          Command CareerOS
        </span>
        <kbd className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
          {shortcutLabel}
        </kbd>
      </button>
      <Link
        className="shrink-0 border-l border-[var(--color-border-subtle)] pl-2 text-[11px] text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:pl-3"
        href="/workspace/settings"
      >
        Settings
      </Link>
    </div>
  );
}
