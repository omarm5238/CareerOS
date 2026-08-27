import type { ResumeVersionContent } from "../types";

type ResumeVersionPrintViewProps = {
  content: ResumeVersionContent;
  header: {
    name: string | null;
    title: string;
    targetJobTitle: string | null;
    targetJobCompany: string | null;
  };
};

/**
 * Resume-ready print layout. Internal analysis (keyword map, warnings, evidence notes,
 * change log, AI metadata) is intentionally excluded from the printed document.
 */
export function ResumeVersionPrintView({ content, header }: ResumeVersionPrintViewProps) {
  const roleLine = header.targetJobTitle ?? header.title;

  return (
    <div aria-hidden className="resume-version-print">
      <header className="resume-version-print__header">
        {header.name ? <h1>{header.name}</h1> : null}
        {roleLine ? <p className="resume-version-print__role">{roleLine}</p> : null}
      </header>

      {content.summary ? (
        <section>
          <h2>Professional Summary</h2>
          <p>{content.summary}</p>
        </section>
      ) : null}

      {content.coreSkills.length > 0 ? (
        <section>
          <h2>Core Skills</h2>
          <p>{content.coreSkills.join(" · ")}</p>
        </section>
      ) : null}

      {content.technicalSkills.length > 0 ? (
        <section>
          <h2>Technical Skills</h2>
          <ul>
            {content.technicalSkills.map((group) => (
              <li key={group.category}>
                <strong>{group.category}:</strong> {group.skills.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.experienceBullets.length > 0 ? (
        <section>
          <h2>Experience</h2>
          <ul>
            {content.experienceBullets.map((bullet, index) => (
              <li key={`experience-${index}`}>{bullet.tailored}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.projects.length > 0 ? (
        <section>
          <h2>Projects</h2>
          <ul>
            {content.projects.map((project, index) => (
              <li key={`project-${index}`}>{project.tailored}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.education.length > 0 ? (
        <section>
          <h2>Education</h2>
          <ul>
            {content.education.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.certifications.length > 0 ? (
        <section>
          <h2>Certifications</h2>
          <ul>
            {content.certifications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
