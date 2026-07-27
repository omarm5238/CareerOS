export type CommandPaletteGroup = "Navigation" | "Actions";

export type CommandPaletteCommand = {
  id: string;
  title: string;
  group: CommandPaletteGroup;
  keywords: string[];
  href: string;
};

export const COMMAND_PALETTE_COMMANDS: CommandPaletteCommand[] = [
  {
    id: "nav-workspace",
    title: "Go to Workspace",
    group: "Navigation",
    keywords: ["workspace", "home", "shell", "dashboard"],
    href: "/workspace",
  },
  {
    id: "nav-resume",
    title: "Go to Resume",
    group: "Navigation",
    keywords: ["resume", "cv", "profile", "documents"],
    href: "/workspace/resume",
  },
  {
    id: "nav-jobs",
    title: "Go to Jobs",
    group: "Navigation",
    keywords: ["jobs", "applications", "pipeline", "tracker"],
    href: "/workspace/jobs",
  },
  {
    id: "nav-skills",
    title: "Go to Skills",
    group: "Navigation",
    keywords: ["skills", "capabilities", "gaps"],
    href: "/workspace/skills",
  },
  {
    id: "nav-analytics",
    title: "Go to Analytics",
    group: "Navigation",
    keywords: ["analytics", "health", "metrics", "insights"],
    href: "/workspace/analytics",
  },
  {
    id: "nav-settings",
    title: "Open Settings",
    group: "Navigation",
    keywords: ["settings", "account", "profile", "preferences"],
    href: "/workspace/settings",
  },
  {
    id: "action-upload-resume",
    title: "Upload resume",
    group: "Actions",
    keywords: ["upload", "resume", "onboarding", "import"],
    href: "/onboarding",
  },
  {
    id: "action-add-job",
    title: "Add job",
    group: "Actions",
    keywords: ["add", "job", "posting", "save", "track"],
    href: "/workspace/jobs",
  },
  {
    id: "action-view-resume",
    title: "View resume analysis",
    group: "Actions",
    keywords: ["resume", "analysis", "review", "profile"],
    href: "/workspace/resume",
  },
  {
    id: "action-view-analytics",
    title: "View career analytics",
    group: "Actions",
    keywords: ["analytics", "career", "health", "score"],
    href: "/workspace/analytics",
  },
  {
    id: "action-analytics-brief",
    title: "Open Analytics Brief",
    group: "Actions",
    keywords: ["brief", "analytics", "careeros", "action center"],
    href: "/workspace/analytics",
  },
  {
    id: "action-export-data",
    title: "Export workspace data",
    group: "Actions",
    keywords: ["export", "download", "data", "backup", "settings"],
    href: "/workspace/settings",
  },
  {
    id: "action-open-report",
    title: "Open Report",
    group: "Actions",
    keywords: ["report", "pdf", "print", "summary", "careeros"],
    href: "/workspace/report",
  },
  {
    id: "action-sign-out",
    title: "Manage sign out",
    group: "Actions",
    keywords: ["sign out", "logout", "session", "settings", "manage"],
    href: "/workspace/settings",
  },
];

export function filterCommandPaletteCommands(
  commands: CommandPaletteCommand[],
  query: string,
): CommandPaletteCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return commands;

  return commands.filter((command) => {
    if (command.title.toLowerCase().includes(normalizedQuery)) return true;
    if (command.group.toLowerCase().includes(normalizedQuery)) return true;
    return command.keywords.some((keyword) =>
      keyword.toLowerCase().includes(normalizedQuery),
    );
  });
}
