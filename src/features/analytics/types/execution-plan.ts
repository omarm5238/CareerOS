export type CareerPlanTaskType =
  | "resume"
  | "skill"
  | "project"
  | "job"
  | "interview"
  | "portfolio"
  | "review";

export type CareerPlanDay = {
  date: string;
  displayDate: string;
  dayNumber: number;
  taskTitle: string;
  taskDetails?: string;
  taskType: CareerPlanTaskType;
  estimatedHours: number;
  outcome: string;
  priority: "High" | "Medium" | "Low";
};

export type CareerPlanWeekSummary = {
  week: string;
  focus: string;
  outcome: string;
  totalHours: number;
};

export type CareerExecutionPlan = {
  startDate: string;
  endDate: string;
  totalEstimatedHours: number;
  weeks: CareerPlanWeekSummary[];
  days: CareerPlanDay[];
};
