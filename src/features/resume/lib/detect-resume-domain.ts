export type ResumeDomain =
  | "software"
  | "design"
  | "marketing"
  | "sales"
  | "data"
  | "business"
  | "education"
  | "healthcare"
  | "unknown";

type DomainSignal = {
  term: string;
  weight?: number;
};

const DOMAIN_SIGNALS: Record<Exclude<ResumeDomain, "unknown">, DomainSignal[]> = {
  design: [
    { term: "graphic design", weight: 3 },
    { term: "graphic designer", weight: 3 },
    { term: "visual designer", weight: 3 },
    { term: "brand designer", weight: 3 },
    { term: "motion designer", weight: 3 },
    { term: "branding", weight: 2 },
    { term: "logo design", weight: 2 },
    { term: "visual identity", weight: 2 },
    { term: "typography", weight: 2 },
    { term: "layout", weight: 1 },
    { term: "poster design", weight: 2 },
    { term: "social media design", weight: 2 },
    { term: "print design", weight: 2 },
    { term: "digital design", weight: 2 },
    { term: "creative direction", weight: 2 },
    { term: "portfolio", weight: 1 },
    { term: "behance", weight: 2 },
    { term: "dribbble", weight: 2 },
    { term: "photoshop", weight: 2 },
    { term: "illustrator", weight: 2 },
    { term: "indesign", weight: 2 },
    { term: "figma", weight: 2 },
    { term: "after effects", weight: 2 },
    { term: "premiere pro", weight: 2 },
    { term: "canva", weight: 1 },
    { term: "motion graphics", weight: 2 },
    { term: "adobe creative suite", weight: 2 },
    { term: "ui/visual", weight: 2 },
    { term: "creative designer", weight: 2 },
  ],
  software: [
    { term: "software engineer", weight: 3 },
    { term: "software developer", weight: 3 },
    { term: "web developer", weight: 2 },
    { term: "developer", weight: 2 },
    { term: "frontend", weight: 2 },
    { term: "front-end", weight: 2 },
    { term: "backend", weight: 2 },
    { term: "back-end", weight: 2 },
    { term: "full stack", weight: 3 },
    { term: "fullstack", weight: 3 },
    { term: "react", weight: 2 },
    { term: "next.js", weight: 2 },
    { term: "nextjs", weight: 2 },
    { term: "node.js", weight: 2 },
    { term: "nodejs", weight: 2 },
    { term: "typescript", weight: 2 },
    { term: "javascript", weight: 2 },
    { term: "python", weight: 1 },
    { term: "java", weight: 1 },
    { term: " api ", weight: 1 },
    { term: "rest api", weight: 2 },
    { term: "database", weight: 1 },
    { term: "postgresql", weight: 2 },
    { term: "postgres", weight: 2 },
    { term: "mongodb", weight: 2 },
    { term: "docker", weight: 2 },
    { term: " git ", weight: 1 },
    { term: " sql ", weight: 1 },
    { term: "programming", weight: 2 },
    { term: "software development", weight: 3 },
  ],
  marketing: [
    { term: "marketing", weight: 2 },
    { term: "digital marketing", weight: 3 },
    { term: "content marketing", weight: 2 },
    { term: "social media marketing", weight: 2 },
    { term: "social media specialist", weight: 3 },
    { term: "marketing specialist", weight: 3 },
    { term: "marketing manager", weight: 2 },
    { term: "seo", weight: 2 },
    { term: "sem", weight: 1 },
    { term: "google ads", weight: 2 },
    { term: "email marketing", weight: 2 },
    { term: "brand marketing", weight: 2 },
    { term: "campaign", weight: 1 },
    { term: "copywriting", weight: 1 },
  ],
  sales: [
    { term: "sales representative", weight: 3 },
    { term: "sales specialist", weight: 3 },
    { term: "account executive", weight: 2 },
    { term: "business development", weight: 2 },
    { term: "sales manager", weight: 2 },
    { term: "inside sales", weight: 2 },
    { term: "outside sales", weight: 2 },
    { term: "b2b sales", weight: 2 },
    { term: "b2c sales", weight: 2 },
    { term: "lead generation", weight: 1 },
    { term: "crm", weight: 1 },
    { term: " quota ", weight: 1 },
    { term: "sales", weight: 1 },
  ],
  data: [
    { term: "data analyst", weight: 3 },
    { term: "data analysis", weight: 2 },
    { term: "data scientist", weight: 3 },
    { term: "business intelligence", weight: 2 },
    { term: "tableau", weight: 2 },
    { term: "power bi", weight: 2 },
    { term: "data visualization", weight: 2 },
    { term: "sql queries", weight: 1 },
    { term: "statistical analysis", weight: 2 },
    { term: "etl", weight: 2 },
    { term: "machine learning", weight: 2 },
    { term: "analytics", weight: 1 },
  ],
  business: [
    { term: "project management", weight: 2 },
    { term: "operations", weight: 2 },
    { term: "business analyst", weight: 3 },
    { term: "management consultant", weight: 2 },
    { term: "strategy", weight: 1 },
    { term: "stakeholder", weight: 1 },
    { term: "process improvement", weight: 2 },
    { term: "administration", weight: 1 },
    { term: "office manager", weight: 2 },
    { term: "executive assistant", weight: 2 },
  ],
  education: [
    { term: "teacher", weight: 2 },
    { term: "professor", weight: 2 },
    { term: "instructor", weight: 2 },
    { term: "curriculum", weight: 2 },
    { term: "classroom", weight: 2 },
    { term: "education", weight: 1 },
    { term: "teaching", weight: 2 },
    { term: "school", weight: 1 },
    { term: "student learning", weight: 2 },
    { term: "academic", weight: 1 },
  ],
  healthcare: [
    { term: "nurse", weight: 3 },
    { term: "nursing", weight: 2 },
    { term: "physician", weight: 2 },
    { term: "medical", weight: 2 },
    { term: "healthcare", weight: 2 },
    { term: "clinical", weight: 2 },
    { term: "patient care", weight: 2 },
    { term: "hospital", weight: 1 },
    { term: "pharmacy", weight: 2 },
    { term: "therapist", weight: 2 },
  ],
};

const MIN_DOMAIN_SCORE = 3;

function scoreDomain(text: string, signals: DomainSignal[]): number {
  const lowerText = ` ${text.toLowerCase()} `;

  return signals.reduce((total, signal) => {
    const term = signal.term.toLowerCase();
    if (lowerText.includes(term)) {
      return total + (signal.weight ?? 1);
    }
    return total;
  }, 0);
}

export type DomainDetectionResult = {
  domain: ResumeDomain;
  scores: Record<ResumeDomain, number>;
};

export function detectResumeDomain(text: string): DomainDetectionResult {
  const scores = {
    software: scoreDomain(text, DOMAIN_SIGNALS.software),
    design: scoreDomain(text, DOMAIN_SIGNALS.design),
    marketing: scoreDomain(text, DOMAIN_SIGNALS.marketing),
    sales: scoreDomain(text, DOMAIN_SIGNALS.sales),
    data: scoreDomain(text, DOMAIN_SIGNALS.data),
    business: scoreDomain(text, DOMAIN_SIGNALS.business),
    education: scoreDomain(text, DOMAIN_SIGNALS.education),
    healthcare: scoreDomain(text, DOMAIN_SIGNALS.healthcare),
    unknown: 0,
  };

  const ranked = (Object.entries(scores) as [ResumeDomain, number][])
    .filter(([domain]) => domain !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const [topDomain, topScore] = ranked[0] ?? ["unknown", 0];
  const [, secondScore] = ranked[1] ?? ["unknown", 0];

  if (topScore < MIN_DOMAIN_SCORE) {
    return { domain: "unknown", scores };
  }

  if (topDomain === "software" && topScore - secondScore <= 1 && scores.design >= MIN_DOMAIN_SCORE) {
    return { domain: "design", scores };
  }

  return { domain: topDomain, scores };
}
