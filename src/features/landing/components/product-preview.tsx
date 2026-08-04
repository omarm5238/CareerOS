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
          <p className="section-eyebrow">Operating Shell</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            A focused workspace built around your career data.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            Profile status, module nodes, and readiness metrics stay connected around a central
            CareerCore — without switching between disconnected tools.
          </p>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-[rgb(207_193_154_/_16%)] bg-[var(--surface-glass)] p-4 shadow-[var(--shadow-xl)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgb(199_203_209_/_5%),transparent_34%),radial-gradient(circle_at_60%_42%,rgb(91_86_152_/_4%),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(207_193_154_/_30%)] to-transparent" />

          <div className="relative grid gap-4 lg:grid-cols-[220px_1fr_180px]">
            <aside className="surface-glass p-4">
              <p className="section-eyebrow">Profile</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                Product Designer
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">72% complete</p>
              <div className="progress-track mt-3 h-1.5">
                <div className="progress-fill w-[72%]" />
              </div>
            </aside>

            <div className="relative min-h-[280px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[linear-gradient(145deg,rgb(20_22_27_/_78%),rgb(8_10_13_/_50%))]">
              <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(91_86_152_/_18%)] bg-[radial-gradient(circle,rgb(91_86_152_/_12%),rgb(14_16_20_/_20%))]" />
              <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(91_86_152_/_8%)]" />
              <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgb(199_203_209_/_6%)]" />

              {MODULES.map((module, index) => {
                const positions = [
                  "left-[12%] top-[16%]",
                  "right-[10%] top-[14%]",
                  "left-[10%] bottom-[14%]",
                  "right-[8%] bottom-[12%]",
                ] as const;

                return (
                  <div
                    className={`absolute ${positions[index]} surface-card w-[132px] px-2.5 py-2 backdrop-blur-md`}
                    key={module.label}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-mono-meta flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] text-[9px] font-semibold tracking-[0.12em] text-[var(--color-text-secondary)]">
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

            <aside className="surface-glass p-4">
              <p className="section-eyebrow">Readiness</p>
              <p className="metric-number mt-3 text-3xl text-[var(--color-text-primary)]">68%</p>
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
