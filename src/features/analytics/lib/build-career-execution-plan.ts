import type {
  CareerExecutionPlan,
  CareerPlanDay,
  CareerPlanTaskType,
  CareerPlanWeekSummary,
} from "../types/execution-plan";
import { estimateLearningEffort } from "@/features/shared/insights";

type PlanSeed = {
  hasResume: boolean;
  resumeFixes: string[];
  skillGaps: string[];
  projectIdeas: string[];
  savedJobsCount: number;
  appliedCount: number;
  selectedJobTitle?: string | null;
  selectedJobCompany?: string | null;
  startDate?: Date;
};

type DayBlueprint = {
  taskTitle: string;
  taskDetails: string;
  taskType: CareerPlanTaskType;
  outcome: string;
  priority: "High" | "Medium" | "Low";
  estimatedHours: number;
};

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function distinctResumeTasks(resumeFixes: string[]): DayBlueprint[] {
  const defaults: DayBlueprint[] = [
    {
      taskTitle: "Rewrite profile summary with role target",
      taskDetails: "Write a 3–4 line summary aimed at your strongest target role family.",
      taskType: "resume",
      outcome: "Sharper role-targeted summary",
      priority: "High",
      estimatedHours: 1.5,
    },
    {
      taskTitle: "Add measurable metrics to project bullets",
      taskDetails: "Upgrade one project with numbers (users, latency, coverage, or scope).",
      taskType: "resume",
      outcome: "Stronger quantified project proof",
      priority: "High",
      estimatedHours: 1.5,
    },
    {
      taskTitle: "Add education dates and degree details",
      taskDetails: "Clarify school, degree, and date range so timeline is recruiter-readable.",
      taskType: "resume",
      outcome: "Clearer education timeline",
      priority: "Medium",
      estimatedHours: 1,
    },
    {
      taskTitle: "Add proof links for strongest project",
      taskDetails: "Attach GitHub/demo links only where the artifact actually exists.",
      taskType: "portfolio",
      outcome: "Clickable project evidence",
      priority: "High",
      estimatedHours: 1,
    },
    {
      taskTitle: "Remove unsupported claims",
      taskDetails: "Delete skill or impact language you cannot defend in an interview.",
      taskType: "resume",
      outcome: "Honest resume claims only",
      priority: "High",
      estimatedHours: 1,
    },
    {
      taskTitle: "ATS keyword pass against saved job",
      taskDetails: "Mirror exact job keywords only where they match real experience.",
      taskType: "resume",
      outcome: "ATS-aware wording without fabrication",
      priority: "Medium",
      estimatedHours: 1.5,
    },
  ];

  const fromFixes = resumeFixes
    .map((fix) => fix.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map<DayBlueprint>((fix, index) => ({
      taskTitle:
        index === 0
          ? "Fix highest-impact resume gap"
          : "Address second resume clarity issue",
      taskDetails: fix.slice(0, 160),
      taskType: "resume",
      outcome: "Specific resume issue reduced",
      priority: "High",
      estimatedHours: 1.5,
    }));

  const merged = [...fromFixes, ...defaults];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.taskTitle.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distinctJobTasks(
  savedJobsCount: number,
  selectedJobTitle?: string | null,
  selectedJobCompany?: string | null,
): DayBlueprint[] {
  if (savedJobsCount === 0) {
    return [
      {
        taskTitle: "Collect 3 backend job descriptions",
        taskDetails: "Shortlist realistic roles from trusted boards; note shared requirements.",
        taskType: "job",
        outcome: "Shortlist of saved jobs",
        priority: "High",
        estimatedHours: 1,
      },
      {
        taskTitle: "Save the strongest target job in CareerOS",
        taskDetails: "Paste one high-fit JD so CareerOS can compute match and gaps.",
        taskType: "job",
        outcome: "First market benchmark",
        priority: "High",
        estimatedHours: 1,
      },
      {
        taskTitle: "Analyze job match and record gaps",
        taskDetails: "Review match score, matched skills, and missing skills for the saved job.",
        taskType: "job",
        outcome: "Learning priorities chosen",
        priority: "High",
        estimatedHours: 1,
      },
      {
        taskTitle: "Compare repeated requirements",
        taskDetails: "List skills that appear in multiple descriptions as top gaps.",
        taskType: "job",
        outcome: "Repeated market requirements list",
        priority: "Medium",
        estimatedHours: 1,
      },
    ];
  }

  if (selectedJobTitle) {
    const label = selectedJobCompany
      ? `${selectedJobTitle} at ${selectedJobCompany}`
      : selectedJobTitle;
    return [
      {
        taskTitle: `Review requirements for ${selectedJobTitle}`,
        taskDetails: `Identify the repeated responsibilities and evidence expected for ${label}.`,
        taskType: "job",
        outcome: "Selected-job requirements shortlist",
        priority: "High",
        estimatedHours: 1,
      },
      {
        taskTitle: `Compare resume against ${selectedJobTitle}`,
        taskDetails: "Map each key requirement to real resume or project evidence.",
        taskType: "job",
        outcome: "Selected-job evidence map",
        priority: "High",
        estimatedHours: 1.5,
      },
      {
        taskTitle: `Fix highest-impact gap for ${selectedJobTitle}`,
        taskDetails: "Improve one truthful resume bullet or proof artifact for the selected role.",
        taskType: "resume",
        outcome: "Highest-impact target gap reduced",
        priority: "High",
        estimatedHours: 1.5,
      },
      {
        taskTitle: `Prepare application for ${selectedJobTitle}`,
        taskDetails: "Review the tailored resume and record the next application step.",
        taskType: "job",
        outcome: "Selected-job application ready",
        priority: "Medium",
        estimatedHours: 1,
      },
    ];
  }

  return [
    {
      taskTitle: "Review top saved job match gaps",
      taskDetails: "Pick the two highest-impact missing skills from current analyses.",
      taskType: "job",
      outcome: "Top 2 skill priorities selected",
      priority: "High",
      estimatedHours: 1,
    },
    {
      taskTitle: "Compare repeated requirements across jobs",
      taskDetails: "Note skills mentioned in multiple saved roles.",
      taskType: "job",
      outcome: "Market demand shortlist",
      priority: "Medium",
      estimatedHours: 1,
    },
    {
      taskTitle:
        savedJobsCount > 0
          ? "Apply to one strongest-fit saved job"
          : "Save one additional target job",
      taskDetails: "Choose the best match and record status honestly.",
      taskType: "job",
      outcome: "Application progress recorded",
      priority: "High",
      estimatedHours: 1.5,
    },
    {
      taskTitle: "Update statuses and notes on active jobs",
      taskDetails: "Keep pipeline accurate so follow-ups stay actionable.",
      taskType: "job",
      outcome: "Clean job tracker",
      priority: "Medium",
      estimatedHours: 1,
    },
  ];
}

function projectMilestones(projectTitle: string, skill: string | undefined): DayBlueprint[] {
  const label = projectTitle || (skill ? `${skill} proof project` : "Backend Job Tracker API");
  return [
    {
      taskTitle: "Define API scope",
      taskDetails: `Outline routes and entities for ${label}.`,
      taskType: "project",
      outcome: "Written project scope",
      priority: "High",
      estimatedHours: 2,
    },
    {
      taskTitle: "Build CRUD endpoints",
      taskDetails: "Implement create/read/update/delete paths with validation.",
      taskType: "project",
      outcome: "Working CRUD API",
      priority: "High",
      estimatedHours: 2.5,
    },
    {
      taskTitle: "Add PostgreSQL schema",
      taskDetails: "Persist core entities with a simple migration or schema file.",
      taskType: "project",
      outcome: "Database-backed storage",
      priority: "High",
      estimatedHours: 2.5,
    },
    {
      taskTitle: "Add README proof",
      taskDetails: "Document setup, run command, and sample requests.",
      taskType: "portfolio",
      outcome: "Readable project README",
      priority: "High",
      estimatedHours: 2,
    },
    {
      taskTitle: "Deploy or document local run",
      taskDetails: "Either deploy lightly or prove local run with screenshots/commands.",
      taskType: "portfolio",
      outcome: "Runnable project evidence",
      priority: "High",
      estimatedHours: 2.5,
    },
  ];
}

function skillTasks(skillGaps: string[]): DayBlueprint[] {
  const skills = skillGaps.slice(0, 3);
  if (skills.length === 0) {
    return [
      {
        taskTitle: "Choose top 2 skills after saving a job",
        taskDetails: "Wait for market gaps before deep skill study.",
        taskType: "skill",
        outcome: "Learning priorities locked",
        priority: "Medium",
        estimatedHours: 1,
      },
    ];
  }

  return skills.flatMap((skill) => [
    {
      taskTitle: `Study ${skill} fundamentals`,
      taskDetails: `Cover core concepts you can explain in an interview for ${skill}.`,
      taskType: "skill" as const,
      outcome: `${skill} concepts practiced`,
      priority: "High" as const,
      estimatedHours:
        estimateLearningEffort(skill).intensity === "high" ? 2.5 : 1.5,
    },
    {
      taskTitle: `Apply ${skill} in a small exercise`,
      taskDetails: `Complete one hands-on task that uses ${skill} outside the main project.`,
      taskType: "skill" as const,
      outcome: `${skill} practice artifact`,
      priority: "Medium" as const,
      estimatedHours:
        estimateLearningEffort(skill).intensity === "low" ? 1.5 : 2.5,
    },
  ]);
}

function reviewDay(): DayBlueprint {
  return {
    taskTitle: "Weekly review",
    taskDetails: "Refresh CareerOS Brief/skills strategy and adjust next week priorities.",
    taskType: "review",
    outcome: "Plan adjusted",
    priority: "Medium",
    estimatedHours: 0.5,
  };
}

function interviewTasks(appliedCount: number): DayBlueprint[] {
  if (appliedCount <= 0) {
    return [
      {
        taskTitle: "Draft 2 STAR stories from resume evidence",
        taskDetails: "Write situation/task/action/result for your strongest project.",
        taskType: "interview",
        outcome: "2 STAR outlines ready",
        priority: "Medium",
        estimatedHours: 1.5,
      },
    ];
  }
  return [
    {
      taskTitle: "Draft 2 STAR stories from resume evidence",
      taskDetails: "Write situation/task/action/result for applied-role themes.",
      taskType: "interview",
      outcome: "2 STAR outlines ready",
      priority: "High",
      estimatedHours: 1.5,
    },
    {
      taskTitle: "Run a 20-minute mock interview",
      taskDetails: "Practice aloud; note weak answers to rewrite.",
      taskType: "interview",
      outcome: "Mock interview notes",
      priority: "Medium",
      estimatedHours: 1.5,
    },
    {
      taskTitle: "Follow up on applied roles",
      taskDetails: "Send concise follow-ups where timing is appropriate.",
      taskType: "job",
      outcome: "Follow-ups logged",
      priority: "Medium",
      estimatedHours: 1,
    },
  ];
}

function pickNext(
  pool: DayBlueprint[],
  usedTitles: Map<string, number>,
  recentTypes: CareerPlanTaskType[],
): DayBlueprint | null {
  for (const candidate of pool) {
    const count = usedTitles.get(candidate.taskTitle) ?? 0;
    if (count >= 2) continue;
    const lastThree = recentTypes.slice(-3);
    if (
      lastThree.length === 3 &&
      lastThree.every((type) => type === candidate.taskType)
    ) {
      continue;
    }
    return candidate;
  }
  return pool.find((candidate) => (usedTitles.get(candidate.taskTitle) ?? 0) < 2) ?? null;
}

function buildDaySequence(seed: PlanSeed): DayBlueprint[] {
  const resumePool = distinctResumeTasks(seed.resumeFixes);
  const jobPool = distinctJobTasks(
    seed.savedJobsCount,
    seed.selectedJobTitle,
    seed.selectedJobCompany,
  );
  const projectPool = projectMilestones(
    seed.projectIdeas[0] ?? "",
    seed.skillGaps[0],
  );
  const skillPool = skillTasks(seed.skillGaps);
  const interviewPool = interviewTasks(seed.appliedCount);

  const weekTemplates: DayBlueprint[][] = [
    // Week 1
    seed.savedJobsCount === 0
      ? [
          jobPool[0]!,
          jobPool[1]!,
          jobPool[2]!,
          resumePool[0]!,
          resumePool[1]!,
          resumePool[2]!,
          reviewDay(),
        ]
      : seed.selectedJobTitle
        ? [
            jobPool[0]!,
            jobPool[1]!,
            jobPool[2]!,
            resumePool[0]!,
            skillPool[0] ?? resumePool[1]!,
            resumePool[2]!,
            reviewDay(),
          ]
        : [
            jobPool[0]!,
            resumePool[0]!,
            resumePool[1]!,
            skillPool[0] ?? resumePool[2]!,
            resumePool[2]!,
            resumePool[3] ?? resumePool[0]!,
            reviewDay(),
          ],
    // Week 2
    [
      skillPool[0] ?? projectPool[0]!,
      projectPool[0]!,
      projectPool[1]!,
      skillPool[1] ?? projectPool[2]!,
      projectPool[2]!,
      projectPool[3]!,
      reviewDay(),
    ],
    // Week 3
    [
      projectPool[4] ?? projectPool[3]!,
      resumePool.find((item) => item.taskType === "portfolio") ?? resumePool[3]!,
      jobPool[2]!,
      skillPool[2] ?? skillPool[0] ?? resumePool[4]!,
      jobPool[3] ?? jobPool[1]!,
      resumePool[4] ?? resumePool[1]!,
      reviewDay(),
      {
        taskTitle: "Review 30-day evidence produced",
        taskDetails: "Inventory resume, project, job, and interview outputs from the plan.",
        taskType: "review",
        outcome: "30-day evidence inventory",
        priority: "Medium",
        estimatedHours: 1,
      },
      {
        taskTitle: "Set the next 30-day priority",
        taskDetails: "Choose one evidence-backed goal based on remaining gaps.",
        taskType: "review",
        outcome: "Next-cycle priority selected",
        priority: "Medium",
        estimatedHours: 0.5,
      },
    ],
    // Week 4
    [
      interviewPool[0]!,
      resumePool[5] ?? resumePool[0]!,
      interviewPool[1] ?? interviewPool[0]!,
      jobPool[3] ?? jobPool[0]!,
      interviewPool[2] ?? {
        taskTitle: "Polish portfolio landing summary",
        taskDetails: "Make the project README the first thing a recruiter understands.",
        taskType: "portfolio" as const,
        outcome: "Clear portfolio narrative",
        priority: "Medium" as const,
        estimatedHours: 1.5,
      },
      resumePool[4] ?? resumePool[1]!,
      reviewDay(),
    ],
  ];

  const days: DayBlueprint[] = [];
  const usedTitles = new Map<string, number>();
  const recentTypes: CareerPlanTaskType[] = [];

  for (const week of weekTemplates) {
    const weekTitleCounts = new Map<string, number>();
    for (const planned of week) {
      let chosen = planned;
      const weekCount = weekTitleCounts.get(chosen.taskTitle) ?? 0;
      if (weekCount >= 2) {
        const alternate =
          pickNext([...resumePool, ...jobPool, ...projectPool, ...skillPool], usedTitles, recentTypes) ??
          reviewDay();
        chosen = alternate;
      }

      const lastThree = recentTypes.slice(-3);
      if (
        lastThree.length === 3 &&
        lastThree.every((type) => type === chosen.taskType)
      ) {
        const alternate =
          pickNext(
            [...resumePool, ...jobPool, ...projectPool, ...skillPool, ...interviewPool].filter(
              (item) => item.taskType !== chosen.taskType,
            ),
            usedTitles,
            recentTypes,
          ) ?? reviewDay();
        chosen = alternate;
      }

      days.push(chosen);
      usedTitles.set(chosen.taskTitle, (usedTitles.get(chosen.taskTitle) ?? 0) + 1);
      weekTitleCounts.set(chosen.taskTitle, (weekTitleCounts.get(chosen.taskTitle) ?? 0) + 1);
      recentTypes.push(chosen.taskType);
    }
  }

  return days.slice(0, 30);
}

export function buildCareerExecutionPlan(seed: PlanSeed): CareerExecutionPlan {
  const start = seed.startDate ? new Date(seed.startDate) : new Date();
  start.setHours(12, 0, 0, 0);

  const sequence = buildDaySequence(seed);
  const days: CareerPlanDay[] = sequence.map((task, index) => {
    const dayNumber = index + 1;
    const date = addDays(start, index);
    return {
      date: toIsoDate(date),
      displayDate: formatDisplayDate(date),
      dayNumber,
      taskTitle: task.taskTitle,
      taskDetails: task.taskDetails,
      taskType: task.taskType,
      estimatedHours: task.estimatedHours,
      outcome: task.outcome,
      priority: task.priority,
    };
  });

  const weeks: CareerPlanWeekSummary[] = [0, 1, 2, 3].map((index) => {
    const weekDays =
      index === 3 ? days.slice(21) : days.slice(index * 7, index * 7 + 7);
    const typeCounts = new Map<CareerPlanTaskType, number>();
    for (const day of weekDays) {
      typeCounts.set(day.taskType, (typeCounts.get(day.taskType) ?? 0) + 1);
    }
    const dominantType =
      [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "review";
    const firstTask = weekDays[0]?.taskTitle ?? "Review priorities";
    const focus =
      index === 0 && seed.selectedJobTitle
        ? `${seed.selectedJobTitle} requirements and evidence`
        : index === 0 && seed.savedJobsCount === 0
          ? "Target job collection and resume baseline"
          : `${dominantType.charAt(0).toUpperCase()}${dominantType.slice(1)} execution: ${firstTask}`;
    const outcomes = Array.from(new Set(weekDays.map((day) => day.outcome))).slice(0, 2);
    return {
      week: `Week ${index + 1}`,
      focus,
      outcome: outcomes.join(" + ") || "Concrete progress recorded",
      totalHours: Number(
        weekDays.reduce((sum, day) => sum + day.estimatedHours, 0).toFixed(1),
      ),
    };
  });

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(addDays(start, 29)),
    totalEstimatedHours: Number(
      days.reduce((sum, day) => sum + day.estimatedHours, 0).toFixed(1),
    ),
    weeks,
    days,
  };
}

const VALID_TYPES = new Set<CareerPlanTaskType>([
  "resume",
  "skill",
  "project",
  "job",
  "interview",
  "portfolio",
  "review",
]);

export function sanitizeCareerExecutionPlan(value: unknown): CareerExecutionPlan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (Array.isArray(value)) {
    const weeks = value
      .filter((item) => item && typeof item === "object")
      .slice(0, 4)
      .map((item, index) => {
        const entry = item as Record<string, unknown>;
        return {
          week: typeof entry.week === "string" ? entry.week : `Week ${index + 1}`,
          focus: typeof entry.focus === "string" ? entry.focus : "Focus on readiness",
          outcome:
            typeof entry.outcome === "string" ? entry.outcome : "Produce one concrete output",
          totalHours: 0,
        };
      });

    if (weeks.length === 0) return null;
    return {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      totalEstimatedHours: 0,
      weeks,
      days: [],
    };
  }

  const daysRaw = Array.isArray(record.days) ? record.days : [];
  const days: CareerPlanDay[] = [];
  for (const entry of daysRaw) {
    if (!entry || typeof entry !== "object") continue;
    const day = entry as Record<string, unknown>;
    if (typeof day.taskTitle !== "string" || typeof day.date !== "string") continue;
    const taskType = day.taskType;
    if (typeof taskType !== "string" || !VALID_TYPES.has(taskType as CareerPlanTaskType)) {
      continue;
    }
    days.push({
      date: day.date,
      displayDate: typeof day.displayDate === "string" ? day.displayDate : day.date,
      dayNumber: typeof day.dayNumber === "number" ? day.dayNumber : days.length + 1,
      taskTitle: day.taskTitle.slice(0, 140),
      taskDetails:
        typeof day.taskDetails === "string"
          ? day.taskDetails.slice(0, 240)
          : typeof day.outcome === "string"
            ? day.outcome.slice(0, 240)
            : "",
      taskType: taskType as CareerPlanTaskType,
      estimatedHours: typeof day.estimatedHours === "number" ? day.estimatedHours : 1.5,
      outcome: typeof day.outcome === "string" ? day.outcome.slice(0, 200) : "Progress",
      priority:
        day.priority === "High" || day.priority === "Medium" || day.priority === "Low"
          ? day.priority
          : "Medium",
    });
    if (days.length >= 30) break;
  }

  const weeksRaw = Array.isArray(record.weeks) ? record.weeks : [];
  let weeks: CareerPlanWeekSummary[] = weeksRaw
    .filter((item) => item && typeof item === "object")
    .slice(0, 4)
    .map((item, index) => {
      const week = item as Record<string, unknown>;
      return {
        week: typeof week.week === "string" ? week.week : `Week ${index + 1}`,
        focus: typeof week.focus === "string" ? week.focus : "Focus",
        outcome: typeof week.outcome === "string" ? week.outcome : "Outcome",
        totalHours: typeof week.totalHours === "number" ? week.totalHours : 0,
      };
    });

  if (days.length > 0) {
    weeks = [0, 1, 2, 3].map((index) => {
      const weekDays =
        index === 3 ? days.slice(21) : days.slice(index * 7, index * 7 + 7);
      const existing = weeks[index];
      const typeCounts = new Map<CareerPlanTaskType, number>();
      for (const day of weekDays) {
        typeCounts.set(day.taskType, (typeCounts.get(day.taskType) ?? 0) + 1);
      }
      const dominantType =
        [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "review";
      return {
        week: existing?.week ?? `Week ${index + 1}`,
        focus: `${dominantType.charAt(0).toUpperCase()}${dominantType.slice(1)} execution: ${weekDays[0]?.taskTitle ?? "Review priorities"}`,
        outcome:
          Array.from(new Set(weekDays.map((day) => day.outcome)))
            .slice(0, 2)
            .join(" + ") || "Concrete progress recorded",
        totalHours: Number(
          weekDays.reduce((sum, day) => sum + day.estimatedHours, 0).toFixed(1),
        ),
      };
    });
  }

  if (days.length === 0 && weeks.length === 0) return null;

  return {
    startDate:
      typeof record.startDate === "string"
        ? record.startDate
        : days[0]?.date ?? new Date().toISOString().slice(0, 10),
    endDate:
      typeof record.endDate === "string"
        ? record.endDate
        : days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
    totalEstimatedHours: Number(
      days.reduce((sum, day) => sum + day.estimatedHours, 0).toFixed(1),
    ),
    weeks,
    days,
  };
}
