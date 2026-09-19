"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmTestId?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  confirmTestId,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className="dialog-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        aria-describedby="confirm-dialog-body"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="dialog-panel"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
        ref={panelRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <h3 className="font-display text-lg" id="confirm-dialog-title">
          {title}
        </h3>
        <div className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]" id="confirm-dialog-body">
          {children}
        </div>
        <div className="mt-5 flex min-w-0 flex-wrap gap-3">
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            data-testid={confirmTestId}
            disabled={busy}
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
