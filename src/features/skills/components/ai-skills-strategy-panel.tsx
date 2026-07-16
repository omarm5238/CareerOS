import type { SkillsInsightView } from "../types";
import { GenerateSkillsInsightButton } from "./generate-skills-insight-button";
import { SkillsInsightSourceBadge } from "./skills-insight-source-badge";

type AiSkillsStrategyPanelProps = {
  insight: SkillsInsightView | null;
};

function formatGeneratedDate(value: string | null): string {
  if (!value) return "Not generated yet";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function priorityClass(priority: string): string {
  if (priority === "High") {
    return "border-[rgb(239_68_68_/_30%)] bg-[rgb(239_68_68_/_10%)] text-[rgb(252_165_165)]";
  }
  if (priority === "Medium") {
    return "border-[rgb(245_158_11_/_30%)] bg-[rgb(245_158_11_/_10%)] text-[rgb(253_186_116)]";
  }
  return "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";
}

function actionClass(action: string): string {
  if (action === "Add to resume") {
    return "text-[var(--color-accent)]";
  }
  if (action === "Do not add yet") {
    return "text-[rgb(252_165_165)]";
  }
  return "text-[rgb(253_186_116)]";
}

export function AiSkillsStrategyPanel({ insight }: AiSkillsStrategyPanelProps) {
  return (
    <section
      aria-labelledby="ai-skills-strategy-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
            id="ai-skills-strategy-heading"
          >
            AI Skills Strategy
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Personalized guidance on which skills matter now, what to learn next, and what is safe
            to add to your resume.
          </p>
        </div>

        <GenerateSkillsInsightButton
          analysisSource={insight?.analysisSource ?? null}
          hasInsight={!!insight}
        />
      </div>

      {insight ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <SkillsInsightSourceBadge source={insight.analysisSource} />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Last generated: {formatGeneratedDate(insight.generatedAt)}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Coverage: {insight.skillCoverageScore}%
            </p>
            {insight.jobCount > 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Based on {insight.jobCount} saved job{insight.jobCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          {insight.warnings.length > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[rgb(245_158_11_/_25%)] bg-[rgb(245_158_11_/_8%)] p-4">
              <h3 className="text-sm font-medium text-[rgb(253_186_116)]">Warnings</h3>
              <ul className="mt-2 space-y-1">
                {insight.warnings.map((warning) => (
                  <li className="text-sm text-[var(--color-text-secondary)]" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.prioritySkills.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Priority Skills
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.prioritySkills.map((item) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4"
                    key={item.skill}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.skill}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                      <span
                        className={`text-[11px] uppercase tracking-[0.1em] ${
                          item.resumeSafe
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {item.resumeSafe ? "Resume safe" : "Needs proof first"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Evidence: {item.evidence}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.learningRoadmap.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Learning Roadmap
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.learningRoadmap.map((item) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4"
                    key={item.title}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {item.timeframe}
                    </p>
                    {item.skills.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.skills.map((skill) => (
                          <span
                            className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.outcome}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.projectIdeas.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Project Ideas
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.projectIdeas.map((item) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4"
                    key={item.title}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.title}
                    </p>
                    {item.skills.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.skills.map((skill) => (
                          <span
                            className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.proof}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.resumeSkillAdvice.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Resume Skill Advice
              </h3>
              <ul className="mt-3 space-y-3">
                {insight.resumeSkillAdvice.map((item) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4"
                    key={item.skill}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.skill}
                      </span>
                      <span
                        className={`text-[11px] font-medium uppercase tracking-[0.1em] ${actionClass(item.action)}`}
                      >
                        {item.action}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.advice}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.marketSignals.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Market Signals
              </h3>
              <ul className="mt-3 space-y-2">
                {insight.marketSignals.map((signal) => (
                  <li
                    className="flex gap-2 text-sm leading-6 text-[var(--color-text-secondary)]"
                    key={signal}
                  >
                    <span aria-hidden="true" className="text-[var(--color-accent)]">
                      ·
                    </span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          No skills strategy generated yet. Click Generate AI strategy to create personalized
          guidance from your resume and saved jobs.
        </p>
      )}
    </section>
  );
}
