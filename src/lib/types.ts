export type VerifyRequest = {
  /** The URL of the app/page the agent just built. */
  url: string;
  /** Plain-English description of what should work, e.g. "log in with test@test.com / password". */
  goal: string;
  /** Max number of browser actions Computah may take. Default 8. */
  maxSteps?: number;
};

export type VerificationStatus = "running" | "passed" | "failed" | "error";

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
