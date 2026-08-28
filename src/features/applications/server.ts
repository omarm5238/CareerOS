export {
  ApplicationAccessError,
  APPLICATION_INSIGHT_TYPES,
  APPLICATION_NEXT_ACTION_TYPES,
  APPLICATION_REJECTION_SOURCES,
  APPLICATION_STATUSES,
  assertApplicationOwnedByUser,
  isApplicationInsightType,
  isApplicationRejectionSource,
  isApplicationStatus,
  isManualApplicationEventType,
  MANUAL_APPLICATION_EVENT_TYPES,
  toApplicationErrorResponse,
} from "./lib/application-permissions";

export {
  allowedTransitionsFor,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_SHORT_LABELS,
  canChangeResumeLink,
  canTransition,
  isActiveApplicationStatus,
  isClosedApplicationStatus,
} from "./lib/application-state";

export { addApplicationContact, updateApplicationContact } from "./lib/application-contacts";
export { buildApplicationSnapshot } from "./lib/build-application-snapshot";
export { addManualApplicationEvent, recordApplicationEvent } from "./lib/create-application-event";
export { createApplicationForJob } from "./lib/create-application-for-job";
export type {
  CreateApplicationForJobInput,
  CreateApplicationForJobResult,
} from "./lib/create-application-for-job";
export {
  getApplicationDetailForUser,
  getLatestApplicationInsight,
} from "./lib/get-application-detail-for-user";
export { getApplicationSummaryForJob } from "./lib/get-application-for-job";
export type { JobApplicationSummary } from "./lib/get-application-for-job";
export {
  computeApplicationMetrics,
  getApplicationsForUser,
  isApplicationDue,
} from "./lib/get-applications-for-user";
export { linkApplicationResume } from "./lib/link-application-resume";
export {
  syncLegacyJobApplicationFields,
  toLegacyApplicationStatus,
} from "./lib/legacy-application-compatibility";
export { scheduleApplicationFollowUp } from "./lib/schedule-application-follow-up";
export { transitionApplicationStatus } from "./lib/transition-application-status";
export { updateApplicationDetails } from "./lib/update-application-details";

export {
  refreshApplicationNextAction,
  resolveApplicationInsight,
  stageInsightTypeFor,
} from "./ai/resolve-application-insight";
export { buildApplicationAiContext } from "./ai/build-application-ai-context";
