const MODULES = [
  { glyph: "RS", label: "Resume", status: "Profile ready" },
  { glyph: "JB", label: "Jobs", status: "2 applied · 68%" },
  { glyph: "SK", label: "Skills", status: "12 skills · 2 gaps" },
  { glyph: "AN", label: "Analytics", status: "68% · Developing" },
] as const;

export function ProductPreview() {
  return (
    <section className="scroll-mt-24 px-6 py-16 lg:px-8 lg:py-20" id="preview">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-secondary)]">
            Operating Shell
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            A focused workspace built around your career data.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            Profile status, module nodes, and readiness metrics stay connected around a central
            CareerCore — without switching between disconnected tools.
          </p>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4 shadow-[var(--shadow-lg)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgb(99_102_241_/_10%),transparent_32%)]" />

          <div className="relative grid gap-4 lg:grid-cols-[220px_1fr_180px]">
            <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_62%)] p-4 backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                Profile
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                Product Designer
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">72% complete</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgb(38_38_38)]">
                <div className="h-full w-[72%] rounded-full bg-[var(--color-accent)]" />
              </div>
            </aside>

            <div className="relative min-h-[280px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[linear-gradient(145deg,rgb(17_17_17_/_42%),rgb(10_10_10_/_18%))]">
              <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(99_102_241_/_28%)] bg-[radial-gradient(circle,rgb(99_102_241_/_24%),rgb(17_17_17_/_20%))] shadow-[0_0_40px_rgb(99_102_241_/_18%)]" />
              <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(99_102_241_/_10%)]" />
              <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(99_102_241_/_6%)]" />

              {MODULES.map((module, index) => {
                const positions = [
                  "left-[12%] top-[16%]",
                  "right-[10%] top-[14%]",
                  "left-[10%] bottom-[14%]",
                  "right-[8%] bottom-[12%]",
                ] as const;

                return (
                  <div
                    className={`absolute ${positions[index]} w-[132px] rounded-[var(--radius-lg)] border border-[rgb(245_245_245_/_8%)] bg-[rgb(17_17_17_/_68%)] px-2.5 py-2 backdrop-blur-md`}
                    key={module.label}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_72%)] text-[9px] font-semibold tracking-[0.12em] text-[var(--color-text-secondary)]">
                        {module.glyph}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-[var(--color-text-primary)]">
                          {module.label}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-secondary)]">
                          {module.status}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_62%)] p-4 backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                Readiness
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)]">68%</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Career health</p>
              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-secondary)]">
                <li>Resume baseline established</li>
                <li>2 jobs in active pipeline</li>
                <li>2 skill gaps identified</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
