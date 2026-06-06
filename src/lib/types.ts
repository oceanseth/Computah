export type VerifyRequest = {
  /** The URL of the app/page the agent just built. */
  url: string;
  /** Plain-English description of what should work, e.g. "log in with test@test.com / password". */
  goal: string;
  /** Max number of browser actions Computah may take. Default 8. */
  maxSteps?: number;
  /** If true, pause before the first AI decision to allow prompt review/editing. */
  reviewPrompts?: boolean;
  /** Optional custom system prompt to override the default. */
  customSystemPrompt?: string;
  /** Optional custom user prompt to override the default. */
  customUserPrompt?: string;
};

export type PromptReview = {
  /** Verification session ID. */
  sessionId: string;
  /** Current step index. */
  stepIdx: number;
  /** The system prompt that will be sent to the AI. */
  systemPrompt: string;
  /** The user message that will be sent to the AI. */
  userPrompt: string;
  /** Screenshot URL of the current page state. */
  screenshotUrl: string | null;
  /** Current page state for context. */
  pageTitle: string;
  pageUrl: string;
};

export type PromptEditRequest = {
  /** Verification session ID. */
  sessionId: string;
  /** Step index to continue from. */
  stepIdx: number;
  /** Edited system prompt. */
  systemPrompt: string;
  /** Edited user prompt. */
  userPrompt: string;
};

export type VerificationStatus = "running" | "passed" | "failed" | "error" | "review_pending";

/** One action Computah took while driving the browser. */
export type Step = {
  idx: number;
  /** Human-readable action, e.g. `click #3 "Sign in"` or `type #1 "test@test.com"`. */
  action: string;
  /** The model's reasoning for this action. */
  thought: string;
  /** The page URL at the moment of the screenshot. */
  pageUrl: string;
  /** Public InsForge Storage URL for the screenshot of this step. */
  screenshotUrl: string | null;
  /** Browser console errors observed since the previous step. */
  consoleErrors: string[];
};

/** The row persisted to the InsForge `verifications` table. */
export type VerificationRecord = {
  id: string;
  url: string;
  goal: string;
  status: VerificationStatus;
  passed: boolean | null;
  reason: string | null;
  summary: string | null;
  steps: Step[];
  console_errors: string[];
  duration_ms: number | null;
  created_at: string;
};
