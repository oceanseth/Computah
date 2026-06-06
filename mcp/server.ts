#!/usr/bin/env node
/**
 * Computah MCP server.
 *
 * Exposes a single tool, `computah_verify`, that any MCP-capable coding agent
 * (Claude Code, Cursor, Devin, Windsurf, ...) can call to have Computah open a
 * URL in a real browser, drive it toward a plain-English goal, and return a
 * pass/fail verdict the agent can act on.
 *
 * It is a thin client over the Computah HTTP API (`/api/verify`), so the heavy
 * lifting (Playwright + InsForge Storage/DB/AI) stays in the Next.js app.
 *
 * Config (env):
 *   COMPUTAH_URL  Base URL of the running Computah app. Default http://localhost:3000
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.COMPUTAH_URL || "http://localhost:3000").replace(/\/$/, "");

const server = new McpServer({ name: "computah", version: "0.1.0" });

server.registerTool(
  "computah_verify",
  {
    title: "Verify a web app in a real browser",
    description:
      "Open a URL in a real browser and verify a plain-English goal actually works (e.g. 'log in with test@test.com / password and reach the dashboard'). Computah drives the page like a QA tester, captures screenshots, watches for console errors, and returns a PASS/FAIL verdict with reasoning. Call this after building or changing a web app to confirm it works before reporting done.",
    inputSchema: {
      url: z.string().url().describe("The URL of the app/page to verify."),
      goal: z
        .string()
        .describe("Plain-English description of what should work and how to test it."),
      maxSteps: z
        .number()
        .int()
        .min(1)
        .max(15)
        .optional()
        .describe("Max browser actions Computah may take (default 8)."),
    },
  },
  async ({ url, goal, maxSteps }) => {
    try {
      const res = await fetch(`${BASE}/api/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, goal, maxSteps }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Computah error: ${data.error ?? res.statusText}` }],
        };
      }

      const verdict = data.passed ? "PASS ✅" : "FAIL ❌";
      const lines = [
        `Verdict: ${verdict}`,
        `Reason: ${data.reason ?? "(none)"}`,
        `Steps taken: ${data.steps?.length ?? 0}`,
        data.console_errors?.length
          ? `Console/network errors:\n- ${data.console_errors.slice(0, 8).join("\n- ")}`
          : "Console/network errors: none",
        `Replay: ${BASE}/sessions/${data.id}`,
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          passed: data.passed,
          reason: data.reason,
          status: data.status,
          sessionId: data.id,
          replayUrl: `${BASE}/sessions/${data.id}`,
          consoleErrors: data.console_errors ?? [],
        },
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Could not reach Computah at ${BASE}. Is the app running? (${String(err)})`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[computah] MCP server ready → ${BASE}`);
}

main().catch((err) => {
  console.error("[computah] fatal:", err);
  process.exit(1);
});
