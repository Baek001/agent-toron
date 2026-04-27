export type DebateStatus = "draft" | "running" | "paused" | "completed" | "failed";

export type DebateRoleId =
  | "moderator"
  | "builder"
  | "skeptic"
  | "product"
  | "risk"
  | "synthesizer";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export type MessageAuthor = DebateRoleId | "human" | "system";

export type DebateRole = {
  id: DebateRoleId;
  name: string;
  description: string;
  color: string;
  initials: string;
  provider: "mock" | "openclaw" | "codex-acp";
};

export type DebateMessage = {
  id: string;
  sessionId: string;
  roleId: MessageAuthor;
  round: number;
  content: string;
  status: MessageStatus;
  createdAt: string;
};

export type DebateSession = {
  id: string;
  title: string;
  topic: string;
  status: DebateStatus;
  harnessId: string;
  roles: DebateRole[];
  messages: DebateMessage[];
  createdAt: string;
  updatedAt: string;
};

export type HumanIntervention = {
  id: string;
  sessionId: string;
  target: "all" | DebateRoleId;
  content: string;
  createdAt: string;
};

export type FinalReport = {
  conclusion: string;
  evidence: string;
  objections: string;
  openQuestions: string;
  nextActions: string;
};
