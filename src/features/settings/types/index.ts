export type UserProfile = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountSummary = {
  resumeAnalysesCount: number;
  savedJobsCount: number;
  appliedJobsCount: number;
  applicationSummary: string;
};

export type SettingsProviderStatus = {
  aiConfigured: boolean;
  linkedinMode: "official" | "fixture";
  linkedinStatus: string;
  linkedinPublishAvailable: boolean;
};

export type SettingsModuleData = {
  profile: UserProfile;
  accountSummary: AccountSummary;
  providerStatus: SettingsProviderStatus;
};

export type ProfileUpdateInput = {
  name: string;
};

export type ProfileUpdateValidationResult =
  | { valid: true; data: ProfileUpdateInput }
  | { valid: false; message: string; field?: string };
