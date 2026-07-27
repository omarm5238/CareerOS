import type { CareerExecutionPlan } from "../types/execution-plan";

export function groupCareerPlanWeeks(plan: CareerExecutionPlan) {
  return [0, 1, 2, 3].map((index) => ({
    summary: plan.weeks[index],
    days:
      index === 3
        ? plan.days.slice(index * 7)
        : plan.days.slice(index * 7, index * 7 + 7),
  }));
}
