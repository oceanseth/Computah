import type { Browser, Page } from "playwright-core";
import { getInsforge, SHOTS_BUCKET, VERIFICATIONS_TABLE } from "./insforge";
import type { Step, VerificationRecord, VerifyRequest } from "./types";

/**
 * Computah's verification engine.
 *
 * Given a URL + a plain-English goal, it drives a real Chromium browser like a
 * QA tester: the InsForge vision model looks at a screenshot + the interactive
 * elements on the page, picks ONE action at a time (click / type / goto / ...),
 * and repeats until it can deliver a pass/fail verdict on the goal.
 *
 * Every step's screenshot is stored in InsForge Storage and the full session is
 * persisted to the InsForge `verifications` table for replay in the dashboard.
 */

const MODELS = (
  process.env.COMPUTAH_MODEL || "openai/gpt-4o-mini,anthropic/claude-haiku-4.5"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

type Decision = {
  thought: string;
  action: "click" | "type" | "press" | "goto" | "wait" | "finish";
  id?: number;
  text?: string;
  key?: string;
  url?: string;
  passed?: boolean;
  reason?: string;
};

type Interactive = {
  id: number;
  tag: string;
  type: string;
  text: string;
  name: string;
  placeholder: string;
  ariaLabel: string;
};

// ---------------------------------------------------------------------------
// Browser launch (local Chromium in dev, @sparticuz/chromium on serverless)
// ---------------------------------------------------------------------------
async function launchBrowser(): Promise<Browser> {
  const serverless = process.env.VERCEL === "1" || process.env.COMPUTAH_SERVERLESS === "1";
  if (serverless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: pwChromium } = await import("playwright-core");
    return pwChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  // Local dev: use the full `playwright` package's bundled browser.
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true }) as unknown as Promise<Browser>;
}

// ---------------------------------------------------------------------------
// Page inspection: tag every visible interactive element with a stable id
// ---------------------------------------------------------------------------
async function snapshot(page: Page): Promise<Interactive[]> {
  return page.evaluate(() => {
    const sel =
      "a,button,input,textarea,select,[role=button],[role=link],[role=tab],[onclick],[tabindex]";
    const els = Array.from(document.querySelectorAll(sel));
    const out: Array<Record<string, unknown>> = [];
    let id = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        r.width > 1 &&
        r.height > 1 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.opacity !== "0";
      if (!visible) continue;
      el.setAttribute("data-computah-id", String(id));
      const anyEl = el as HTMLInputElement;
      out.push({
        id,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        text: ((el as HTMLElement).innerText || anyEl.value || "").trim().slice(0, 80),
        name: el.getAttribute("name") || "",
        placeholder: el.getAttribute("placeholder") || "",
        ariaLabel: el.getAttribute("aria-label") || "",
      });
      id++;
      if (id >= 60) break;
    }
    return out as unknown as Interactive[];
  });
}

/** Visible text of the page, so the model can "read" it (the AI gateway is text-only). */
async function pageText(page: Page): Promise<{ title: string; text: string }> {
  return page.evaluate(() => {
    const title = document.title || "";
    const raw = (document.body?.innerText || "").replace(/\n{2,}/g, "\n").trim();
    return { title, text: raw.slice(0, 2500) };
  });
}

function describeElements(els: Interactive[]): string {
  if (!els.length) return "(no interactive elements found)";
  return els
    .map((e) => {
      const label = e.text || e.ariaLabel || e.placeholder || e.name || "";
      const meta = [e.tag, e.type].filter(Boolean).join("/");
      return `#${e.id} [${meta}] ${JSON.stringify(label)}`;
    })
    .join("\n");
}

// Build the user message prompt from page state
function buildUserPrompt(
  goal: string,
  pageUrl: string,
  title: string,
  text: string,
  els: Interactive[],
  consoleErrors: string[],
  history: string[],
  remaining: number
): string {
  return [
    `GOAL: ${goal}`,
    `CURRENT URL: ${pageUrl}`,
    `PAGE TITLE: ${title || "(none)"}`,
    `STEPS REMAINING: ${remaining}`,
    history.length
      ? `ACTIONS ALREADY TAKEN (do not repeat):\n${history.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : `ACTIONS ALREADY TAKEN: none yet`,
    consoleErrors.length
      ? `RECENT CONSOLE ERRORS:\n${consoleErrors.slice(-5).join("\n")}`
      : "RECENT CONSOLE ERRORS: none",
    `VISIBLE PAGE TEXT:\n${text || "(empty page)"}`,
    `INTERACTIVE ELEMENTS:\n${describeElements(els)}`,
    remaining <= 1
      ? `This is your LAST step — you must return a "finish" action with your verdict.`
      : `Decide the single best next action.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// InsForge AI: pick the next action from a screenshot + element list
// ---------------------------------------------------------------------------
async function chat(messages: unknown[]): Promise<string> {
  const insforge = getInsforge();
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await insforge.ai.chat.completions.create({
        model,
        messages: messages as never,
        temperature: 0,
        max_tokens: 700,
      } as never);
      const content = res?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) return content;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `InsForge AI call failed for all models [${MODELS.join(", ")}]: ${String(lastErr)}`
  );
}

function parseDecision(text: string): Decision {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Model returned no JSON action: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as Decision;
}

const SYSTEM_PROMPT = `You are Computah, an autonomous QA agent. You control a real web browser to verify whether an app meets a goal.

You are given a text snapshot of the current page: its title, the visible text, and a numbered list of interactive elements. Take ONE action at a time. Respond with ONLY a JSON object, no prose, no markdown fences.

Actions:
- {"thought": "...", "action": "click", "id": <n>}
- {"thought": "...", "action": "type", "id": <n>, "text": "<value>"}
- {"thought": "...", "action": "press", "key": "Enter"}
- {"thought": "...", "action": "goto", "url": "<url>"}
- {"thought": "...", "action": "wait"}
- {"thought": "...", "action": "finish", "passed": <true|false>, "reason": "<one sentence verdict>"}

Rules:
- Work efficiently toward the goal. Fill forms, click buttons, navigate as a user would.
- NEVER repeat an action you already took (see ACTIONS ALREADY TAKEN). The ELEMENTS list shows current input values — if a field already holds the right value, move on to the next field or submit.
- Typical flow for a form: fill each field once, then click the submit button, then read the resulting page to judge.
- Use realistic test values when the goal does not specify them.
- The moment you can judge whether the goal is met (success OR clear failure), use "finish".
- A page that errors, shows a blank screen, throws console errors that block the goal, or where an action has no effect is a FAILURE.
- Keep "thought" to one short sentence.`;

async function decide(
  goal: string,
  pageUrl: string,
  title: string,
  text: string,
  els: Interactive[],
  consoleErrors: string[],
  history: string[],
  remaining: number,
  customSystemPrompt?: string,
  customUserPrompt?: string
): Promise<Decision> {
  const userText = customUserPrompt || buildUserPrompt(goal, pageUrl, title, text, els, consoleErrors, history, remaining);
  const systemText = customSystemPrompt || SYSTEM_PROMPT;

  const content = await chat([
    { role: "system", content: systemText },
    { role: "user", content: userText },
  ]);
  return parseDecision(content);
}

// Build prompts without executing AI call (for review/editing)
function buildPrompts(
  goal: string,
  pageUrl: string,
  title: string,
  text: string,
  els: Interactive[],
  consoleErrors: string[],
  history: string[],
  remaining: number
): { systemPrompt: string; userPrompt: string } {
  const userPrompt = buildUserPrompt(goal, pageUrl, title, text, els, consoleErrors, history, remaining);
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  };
}

// Execute AI call with provided prompts (for edited prompts)
async function decideWithPrompts(
  systemPrompt: string,
  userPrompt: string
): Promise<Decision> {
  const content = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return parseDecision(content);
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------
async function settle(page: Page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 4000 });
  } catch {
    /* networkidle is best-effort */
  }
}

async function execute(page: Page, d: Decision): Promise<string> {
  const target = (id?: number) => `[data-computah-id="${id}"]`;
  switch (d.action) {
    case "click":
      await page.click(target(d.id), { timeout: 6000 });
      await settle(page);
      return `click #${d.id}`;
    case "type":
      await page.fill(target(d.id), d.text ?? "", { timeout: 6000 });
      return `type #${d.id} ${JSON.stringify(d.text ?? "")}`;
    case "press":
      await page.keyboard.press(d.key || "Enter");
      await settle(page);
      return `press ${d.key || "Enter"}`;
    case "goto":
      await page.goto(d.url || page.url(), { waitUntil: "domcontentloaded", timeout: 20000 });
      await settle(page);
      return `goto ${d.url}`;
    case "wait":
      await page.waitForTimeout(1200);
      return "wait";
    default:
      return d.action;
  }
}

// ---------------------------------------------------------------------------
// InsForge Storage: upload one screenshot, return its public URL
// ---------------------------------------------------------------------------
async function uploadShot(id: string, idx: number, buf: Buffer): Promise<string | null> {
  try {
    const insforge = getInsforge();
    const path = `${id}/${String(idx).padStart(2, "0")}.png`;
    const file = new File([new Uint8Array(buf)], `${idx}.png`, { type: "image/png" });
    const { error } = await insforge.storage.from(SHOTS_BUCKET).upload(path, file);
    if (error) {
      console.error("[computah] screenshot upload failed:", error);
      return null;
    }
    return insforge.storage.from(SHOTS_BUCKET).getPublicUrl(path);
  } catch (err) {
    console.error("[computah] screenshot upload threw:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------
async function persistStart(rec: VerificationRecord) {
  const insforge = getInsforge();
  const { error } = await insforge.database.from(VERIFICATIONS_TABLE).insert([
    {
      id: rec.id,
      url: rec.url,
      goal: rec.goal,
      status: rec.status,
      steps: rec.steps,
      console_errors: rec.console_errors,
    },
  ]);
  if (error) console.error("[computah] persistStart failed:", error);
}

async function savePromptForReview(
  verificationId: string,
  stepIdx: number,
  systemPrompt: string,
  userPrompt: string
) {
  const insforge = getInsforge();
  const { error } = await insforge.database.from("prompt_reviews").insert([
    {
      verification_id: verificationId,
      step_idx: stepIdx,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
    },
  ]);
  if (error) console.error("[computah] savePromptForReview failed:", error);
}

async function getPromptReview(verificationId: string, stepIdx: number) {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from("prompt_reviews")
    .select("*")
    .eq("verification_id", verificationId)
    .eq("step_idx", stepIdx)
    .single();
  if (error) {
    console.error("[computah] getPromptReview failed:", error);
    return null;
  }
  return data;
}

async function persistFinish(rec: VerificationRecord) {
  const insforge = getInsforge();
  const { error } = await insforge.database
    .from(VERIFICATIONS_TABLE)
    .update({
      status: rec.status,
      passed: rec.passed,
      reason: rec.reason,
      summary: rec.summary,
      steps: rec.steps,
      console_errors: rec.console_errors,
      duration_ms: rec.duration_ms,
    })
    .eq("id", rec.id);
  if (error) console.error("[computah] persistFinish failed:", error);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function runVerification(req: VerifyRequest): Promise<VerificationRecord> {
  const id = crypto.randomUUID();
  const maxSteps = Math.min(Math.max(req.maxSteps ?? 8, 1), 15);
  const started = Date.now();

  const rec: VerificationRecord = {
    id,
    url: req.url,
    goal: req.goal,
    status: "running",
    passed: null,
    reason: null,
    summary: null,
    steps: [],
    console_errors: [],
    duration_ms: null,
    created_at: new Date().toISOString(),
  };

  await persistStart(rec);

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    // Collect console + page errors as they happen.
    const allErrors: string[] = [];
    let drainMark = 0;
    page.on("console", (m) => {
      if (m.type() === "error") allErrors.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => allErrors.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => {
      const f = r.failure();
      if (f) allErrors.push(`requestfailed: ${r.url()} (${f.errorText})`);
    });
    const drain = () => {
      const fresh = allErrors.slice(drainMark);
      drainMark = allErrors.length;
      return fresh;
    };

    // Initial navigation.
    try {
      await page.goto(req.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await settle(page);
    } catch (err) {
      allErrors.push(`navigation: failed to load ${req.url} (${String(err)})`);
    }

    // Agentic action loop.
    for (let i = 0; i < maxSteps; i++) {
      const shot = (await page.screenshot({ fullPage: false })) as Buffer;
      const screenshotUrl = await uploadShot(id, i, shot);
      const els = await snapshot(page);
      const { title, text } = await pageText(page);
      const stepErrors = drain();

      const history = rec.steps.map((s) => s.action);

      // If reviewing prompts on first step, build and return them instead of executing
      if (req.reviewPrompts && i === 0) {
        const prompts = buildPrompts(
          req.goal,
          page.url(),
          title,
          text,
          els,
          stepErrors,
          history,
          maxSteps - i
        );
        await savePromptForReview(id, i, prompts.systemPrompt, prompts.userPrompt);
        rec.status = "review_pending";
        await persistFinish(rec);
        await context.close();
        // Return the record with a special status indicating review is pending
        // The prompts can be retrieved via getPromptReview
        return rec;
      }

      let decision: Decision;
      try {
        decision = await decide(
          req.goal,
          page.url(),
          title,
          text,
          els,
          stepErrors,
          history,
          maxSteps - i,
          i === 0 ? req.customSystemPrompt : undefined,
          i === 0 ? req.customUserPrompt : undefined
        );
      } catch (err) {
        rec.steps.push({
          idx: i,
          action: "error",
          thought: `Computah could not decide: ${String(err)}`,
          pageUrl: page.url(),
          screenshotUrl,
          consoleErrors: stepErrors,
        });
        rec.status = "error";
        rec.passed = false;
        rec.reason = `Verification engine error: ${String(err)}`;
        break;
      }

      const step: Step = {
        idx: i,
        action: decision.action,
        thought: decision.thought || "",
        pageUrl: page.url(),
        screenshotUrl,
        consoleErrors: stepErrors,
      };

      if (decision.action === "finish") {
        step.action = `finish → ${decision.passed ? "PASS" : "FAIL"}`;
        rec.steps.push(step);
        rec.passed = Boolean(decision.passed);
        rec.status = decision.passed ? "passed" : "failed";
        rec.reason = decision.reason || (decision.passed ? "Goal met." : "Goal not met.");
        break;
      }

      try {
        step.action = await execute(page, decision);
      } catch (err) {
        step.action = `${decision.action} (failed: ${String(err).slice(0, 120)})`;
        allErrors.push(`action: ${decision.action} failed — ${String(err)}`);
      }
      rec.steps.push(step);

      // Ran out of steps without a verdict.
      if (i === maxSteps - 1 && rec.status === "running") {
        rec.status = "failed";
        rec.passed = false;
        rec.reason = "Ran out of steps before the goal could be confirmed.";
      }
    }

    rec.console_errors = allErrors;
    await context.close();
  } catch (err) {
    rec.status = "error";
    rec.passed = false;
    rec.reason = `Verification crashed: ${String(err)}`;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  rec.duration_ms = Date.now() - started;
  rec.summary = buildSummary(rec);
  await persistFinish(rec);
  return rec;
}

function buildSummary(rec: VerificationRecord): string {
  const verdict = rec.passed ? "PASS" : "FAIL";
  const errs = rec.console_errors.length ? ` ${rec.console_errors.length} console/network error(s).` : "";
  return `${verdict} in ${rec.steps.length} step(s).${errs} ${rec.reason ?? ""}`.trim();
}

// Export functions for prompt review
export { buildPrompts, decideWithPrompts, SYSTEM_PROMPT };
