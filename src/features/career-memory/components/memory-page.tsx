"use client";

import { useMemo, useState } from "react";

import type { CareerMemoryView, MemoryWorkspaceView } from "../types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Request failed.");
  return payload;
}

function MemoryCard({
  memory,
  busy,
  onAction,
}: {
  memory: CareerMemoryView;
  busy: boolean;
  onAction: (action: string, memory: CareerMemoryView, value?: string) => void;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [value, setValue] = useState(memory.normalizedText);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <article className="surface-glass min-w-0 p-4" data-memory-id={memory.id} data-testid="memory-card">
      <p className="section-eyebrow">
        {memory.type.replaceAll("_", " ")} · {memory.category.replaceAll("_", " ")}
      </p>
      <h4 className="mt-1 font-display text-base">{memory.normalizedText}</h4>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {memory.confidenceLabel} · {memory.sourceLabel}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm underline">Why this is remembered</summary>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {memory.whyRemembered.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      {memory.status === "ACTIVE" ? (
        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" disabled={busy} onClick={() => onAction("confirm", memory)} type="button">
            Confirm
          </button>
          <button className="min-h-9 px-3 text-sm underline" disabled={busy} onClick={() => setCorrecting((open) => !open)} type="button">
            Correct
          </button>
          <button className="min-h-9 px-3 text-sm underline" disabled={busy} onClick={() => onAction("outdated", memory)} type="button">
            Outdated
          </button>
          <button className="min-h-9 px-3 text-sm underline" data-testid="suppress-memory" disabled={busy} onClick={() => onAction("suppress", memory)} type="button">
            Don&apos;t use
          </button>
          <button className="min-h-9 px-3 text-sm underline" data-testid="delete-memory" disabled={busy} onClick={() => setConfirmDelete(true)} type="button">
            Delete
          </button>
        </div>
      ) : memory.status === "SUPPRESSED" || memory.status === "EXPIRED" ? (
        <button className="mt-3 min-h-9 text-sm underline" disabled={busy} onClick={() => onAction("restore", memory)} type="button">
          Restore
        </button>
      ) : null}
      {correcting ? (
        <form
          className="mt-3 flex min-w-0 flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onAction("correct", memory, value);
            setCorrecting(false);
          }}
        >
          <p className="text-sm text-[var(--color-text-secondary)]">The current memory will be superseded.</p>
          <input
            className="min-h-9 rounded border border-[var(--color-border)] bg-transparent px-3 text-sm"
            data-testid="correct-memory-input"
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
          <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" type="submit">
            Save correction
          </button>
        </form>
      ) : null}
      {confirmDelete ? (
        <div className="mt-3 text-sm">
          <p>Delete this career memory? Original applications, resumes, jobs, and weekly reviews stay.</p>
          <div className="mt-2 flex gap-2">
            <button className="min-h-9 rounded border border-[var(--color-border)] px-3" data-testid="confirm-delete-memory" onClick={() => onAction("delete", memory)} type="button">
              Delete this career memory
            </button>
            <button className="underline" onClick={() => setConfirmDelete(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function MemoryPageClient({ initial }: { initial: MemoryWorkspaceView }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCategory, setManualCategory] = useState("skill");
  const [manualValue, setManualValue] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  async function reload() {
    setData(await api<MemoryWorkspaceView>("/api/memory"));
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const memories = data.memories;
    return {
      focus: memories.filter((item) => item.type === "FOCUS" || item.category === "CAREER_TARGET"),
      preferences: memories.filter((item) => item.type === "PREFERENCE"),
      skills: memories.filter((item) => item.category === "SKILL" || item.type === "SKILL_SIGNAL"),
      evidence: memories.filter((item) => item.category === "EVIDENCE" || item.subjectKey === "skill.gap"),
      patterns: memories.filter((item) => item.type === "BEHAVIOR_PATTERN" || item.type === "CAREER_PATTERN"),
      milestones: memories.filter((item) => item.type === "MILESTONE"),
    };
  }, [data.memories]);

  function onAction(action: string, memory: CareerMemoryView, value?: string) {
    void run(async () => {
      if (action === "confirm") await api(`/api/memory/${memory.id}/confirm`, { method: "POST" });
      if (action === "outdated") await api(`/api/memory/${memory.id}/outdated`, { method: "POST" });
      if (action === "suppress") await api(`/api/memory/${memory.id}/suppress`, { method: "POST" });
      if (action === "restore") await api(`/api/memory/${memory.id}/restore`, { method: "POST" });
      if (action === "delete") await api(`/api/memory/${memory.id}`, { method: "DELETE" });
      if (action === "correct" && value) await api(`/api/memory/${memory.id}/correct`, { method: "POST", body: JSON.stringify({ value }) });
    });
  }

  return (
    <div className="relative mx-auto min-w-0 module-shell overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      {error ? <p className="mb-4 text-sm text-[var(--color-champagne)]">{error}</p> : null}
      <header>
        <p className="section-eyebrow">Career Memory</p>
        <h2 className="mt-2 font-display text-2xl">What CareerOS currently remembers</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
          CareerOS remembers structured career facts from information you provided and your activity. It does not replace
          applications, resumes, jobs, or weekly scores.
        </p>
      </header>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" data-testid="refresh-memory" disabled={busy} onClick={() => run(async () => { await api("/api/memory/refresh", { method: "POST" }); })} type="button">
          {data.empty ? "Build Memory" : "Refresh Memory"}
        </button>
        <button className="min-h-9 px-3 text-sm underline" data-testid="rebuild-memory" disabled={busy} onClick={() => setConfirmRebuild(true)} type="button">
          Rebuild from CareerOS History
        </button>
      </div>

      {data.empty ? (
        <section className="surface-glass mt-6 p-5" data-testid="memory-empty">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {data.preferences.memoryResetAt
              ? "No long-term career memory is currently stored. New future activity may create new memories if memory stays enabled."
              : "No long-term career memory is stored yet. Build Memory processes recent CareerOS history (about 12 weeks) and current preferences."}
          </p>
        </section>
      ) : null}

      {data.needsReview.length >= 2 ? (
        <section className="surface-glass mt-6 p-5" data-testid="needs-review">
          <h3 className="font-display text-lg">Needs review</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Career focus needs review</p>
          <div className="mt-3 grid gap-2">
            {data.needsReview.slice(0, 2).map((item) => (
              <p key={item.id}>{item.normalizedText}</p>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" onClick={() => run(async () => { await api("/api/memory/resolve", { method: "POST", body: JSON.stringify({ leftId: data.needsReview[0]?.id, rightId: data.needsReview[1]?.id, action: "left" }) }); })} type="button">
              Keep {data.needsReview[0]?.normalizedText}
            </button>
            <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" onClick={() => run(async () => { await api("/api/memory/resolve", { method: "POST", body: JSON.stringify({ leftId: data.needsReview[0]?.id, rightId: data.needsReview[1]?.id, action: "right" }) }); })} type="button">
              Keep {data.needsReview[1]?.normalizedText}
            </button>
            {data.needsReview[0]?.subjectKey !== "focus.primary" ? (
              <button className="min-h-9 px-3 text-sm underline" onClick={() => run(async () => { await api("/api/memory/resolve", { method: "POST", body: JSON.stringify({ leftId: data.needsReview[0]?.id, rightId: data.needsReview[1]?.id, action: "both" }) }); })} type="button">
                Both are relevant
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {(["focus", "preferences", "skills", "evidence", "patterns", "milestones"] as const).map((key) =>
        grouped[key].length === 0 ? null : (
          <section className="mt-6" data-testid={`memory-section-${key}`} key={key}>
            <h3 className="font-display text-lg capitalize">{key === "focus" ? "Current Focus" : key}</h3>
            <div className="mt-3 grid min-w-0 gap-3">
              {grouped[key].map((memory) => (
                <MemoryCard busy={busy} key={memory.id} memory={memory} onAction={onAction} />
              ))}
            </div>
          </section>
        ),
      )}

      <section className="mt-8" data-testid="knowledge-graph">
        <h3 className="font-display text-lg">Knowledge Graph</h3>
        {data.graph.relations.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No active graph relations yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.graph.relations.map((relation) => (
              <li className="surface-glass p-3" key={relation.id}>
                You → {relation.relationType.replaceAll("_", " ").toLowerCase()} → {relation.toName}
                <p className="mt-1 text-[var(--color-text-secondary)]">{relation.confidenceLabel}. {relation.why}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" data-testid="memory-controls">
        <h3 className="font-display text-lg">Memory Controls</h3>
        <label className="mt-3 flex min-h-9 items-center gap-2 text-sm">
          <input checked={data.preferences.memoryEnabled} onChange={(event) => run(async () => { await api("/api/memory/preferences", { method: "PATCH", body: JSON.stringify({ memoryEnabled: event.target.checked }) }); })} type="checkbox" />
          Memory enabled — CareerOS will stop creating and using long-term memory when off. Stored memory remains until deleted.
        </label>
        <label className="mt-2 flex min-h-9 items-center gap-2 text-sm">
          <input checked={data.preferences.allowBehavioralMemory} onChange={(event) => run(async () => { await api("/api/memory/preferences", { method: "PATCH", body: JSON.stringify({ allowBehavioralMemory: event.target.checked }) }); })} type="checkbox" />
          Behavioral memory from daily/weekly execution
        </label>
        <label className="mt-2 flex min-h-9 items-center gap-2 text-sm">
          <input checked={data.preferences.allowDerivedPatterns} onChange={(event) => run(async () => { await api("/api/memory/preferences", { method: "PATCH", body: JSON.stringify({ allowDerivedPatterns: event.target.checked }) }); })} type="checkbox" />
          Derived patterns
        </label>
        <label className="mt-2 flex min-h-9 items-center gap-2 text-sm">
          <input checked={data.preferences.allowLongTermPreferences} onChange={(event) => run(async () => { await api("/api/memory/preferences", { method: "PATCH", body: JSON.stringify({ allowLongTermPreferences: event.target.checked }) }); })} type="checkbox" />
          Long-term preference inferences
        </label>
      </section>

      <section className="mt-8">
        <h3 className="font-display text-lg">Add a career memory</h3>
        <form
          className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api("/api/memory", { method: "POST", body: JSON.stringify({ category: manualCategory, value: manualValue }) });
              setManualValue("");
            });
          }}
        >
          <select className="min-h-9 rounded border border-[var(--color-border)] bg-transparent px-2 text-sm" data-testid="manual-memory-category" onChange={(event) => setManualCategory(event.target.value)} value={manualCategory}>
            <option value="role">Role</option>
            <option value="skill">Skill</option>
            <option value="goal">Goal</option>
            <option value="location">Location</option>
            <option value="work-style">Work style</option>
            <option value="focus">Career focus</option>
            <option value="constraint">Constraint</option>
            <option value="project">Project/evidence</option>
            <option value="preference">Preference</option>
          </select>
          <input className="min-h-9 min-w-0 flex-1 rounded border border-[var(--color-border)] bg-transparent px-3 text-sm" data-testid="manual-memory-value" onChange={(event) => setManualValue(event.target.value)} placeholder="Short career fact" value={manualValue} />
          <button className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm" data-testid="create-memory" type="submit">
            Save
          </button>
        </form>
      </section>

      <section className="mt-10">
        <button className="min-h-9 text-sm underline" data-testid="delete-all-memory" onClick={() => setConfirmDeleteAll(true)} type="button">
          Delete All Career Memory
        </button>
      </section>

      {confirmDeleteAll ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="surface-glass w-full max-w-md p-5">
            <h3 className="font-display text-lg">Delete all career memory?</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              This removes CareerOS long-term memory and knowledge graph data. Applications, resumes, jobs, LinkedIn data,
              Today history, and weekly reviews remain.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                data-testid="confirm-delete-all"
                onClick={() => {
                  setConfirmDeleteAll(false);
                  void run(async () => { await api("/api/memory/all", { method: "DELETE" }); });
                }}
                type="button"
              >
                Delete all career memory
              </button>
              <button className="text-sm underline" onClick={() => setConfirmDeleteAll(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRebuild ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="surface-glass w-full max-w-md p-5">
            <h3 className="font-display text-lg">Rebuild from CareerOS history?</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              CareerOS will reprocess recent existing career history to rebuild long-term memory.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                data-testid="confirm-rebuild"
                onClick={() => {
                  setConfirmRebuild(false);
                  void run(async () => { await api("/api/memory/rebuild", { method: "POST" }); });
                }}
                type="button"
              >
                Rebuild from CareerOS History
              </button>
              <button className="text-sm underline" onClick={() => setConfirmRebuild(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
