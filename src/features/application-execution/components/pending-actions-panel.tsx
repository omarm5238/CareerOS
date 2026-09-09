"use client";

import type { ExecutionSessionView } from "../types";

export function PendingActionsPanel({
  view,
  onConfirm,
  onGenerate,
  onResume,
}: {
  view: ExecutionSessionView;
  onConfirm: (fieldId: string, value: string, extras?: { reviewed?: boolean }) => void;
  onGenerate: (fieldId: string) => void;
  onResume: () => void;
}) {
  if (view.pendingActions.length === 0) return null;
  return (
    <section className="surface-glass p-4">
      <p className="section-eyebrow">Needs your input</p>
      <ul className="mt-3 space-y-4">
        {view.pendingActions.map((action) => {
          const field = view.fields.find((item) => item.id === action.fieldId);
          return (
            <li key={`${action.kind}-${action.fieldId}`} className="border-b border-[var(--color-border-subtle)] pb-3 last:border-0">
              <p className="font-medium text-[var(--color-text-primary)]">{field?.label ?? action.kind.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{action.message}</p>
              {action.kind === "LOGIN" || action.kind === "MFA" || action.kind === "CAPTCHA" || action.kind === "ASSESSMENT" || action.kind === "UNSUPPORTED_WIDGET" ? (
                <button className="btn-primary mt-3" onClick={onResume} type="button">
                  Resume
                </button>
              ) : null}
              {action.kind === "LEGAL" && field ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {field.previousAnswerAvailable ? <p className="w-full text-sm">Previous answer available.</p> : null}
                  <button className="btn-secondary" onClick={() => onConfirm(field.id, "yes")} type="button">
                    Yes
                  </button>
                  <button className="btn-secondary" onClick={() => onConfirm(field.id, "no")} type="button">
                    No
                  </button>
                  <button className="btn-secondary" onClick={() => onConfirm(field.id, "other")} type="button">
                    Other
                  </button>
                </div>
              ) : null}
              {action.kind === "SENSITIVE" && field ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(new FormData(event.currentTarget).get("value") ?? "");
                    onConfirm(field.id, value);
                  }}
                >
                  <input className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm" name="value" placeholder="Your decision" />
                  <button className="btn-secondary" type="submit">
                    Save
                  </button>
                </form>
              ) : null}
              {action.kind === "CONSENT" && field ? (
                <button className="btn-primary mt-3" onClick={() => onConfirm(field.id, "true")} type="button">
                  Confirm
                </button>
              ) : null}
              {action.kind === "FREE_TEXT" && field ? (
                <div className="mt-3 space-y-2">
                  {field.proposedValue ? <p className="whitespace-pre-wrap text-sm">{field.proposedValue}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => onGenerate(field.id)} type="button">
                      Generate draft
                    </button>
                    {field.proposedValue ? (
                      <button className="btn-primary" onClick={() => onConfirm(field.id, field.proposedValue ?? "", { reviewed: true })} type="button">
                        Approve answer
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {action.kind === "USER_INPUT" && field ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onConfirm(field.id, String(new FormData(event.currentTarget).get("value") ?? ""));
                  }}
                >
                  <input className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm" name="value" />
                  <button className="btn-secondary" type="submit">
                    Save
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
