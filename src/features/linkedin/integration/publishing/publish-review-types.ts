export type LinkedinPublishReview = {
  attemptId: string;
  planId: string;
  postId: string;
  revisionId: string;
  revisionNumber: number;
  finalText: string;
  contentFingerprint: string;
  connectionSummary: {
    status: string;
    displayName: string | null;
    email: string | null;
  };
  capabilitySummary: {
    capability: "PUBLISH_MEMBER_POST";
    state: string;
    reason: string;
  };
  attemptStatus: string;
  newerRevisionExists: boolean;
  newerRevisionWarning: string | null;
  planStatus: string;
  officialPublishAvailable: boolean;
};
