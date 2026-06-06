// Screenshot BEFORE (production) vs AFTER (PR preview) for a set of routes and
// save them to OUT_DIR, plus a manifest the workflow uses to build the PR
// comment. The workflow publishes the PNGs to a `pr-previews` branch and links
// them via raw.githubusercontent.com (renders inline in the PR).
//
// Env: BEFORE_URL, AFTER_URL, ROUTES (default "/,/console"), OUT_DIR (default "shots")
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BEFORE = process.env.BEFORE_URL;
const AFTER = process.env.AFTER_URL;
const ROUTES = (process.env.ROUTES || "/,/console").split(",").map((r) => r.trim()).filter(Boolean);
const OUT = process.env.OUT_DIR || "shots";

const sanitize = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";

mkdirSync(OUT, { recursive: true });

async function shoot(page, baseUrl, route, file) {
  const url = baseUrl.replace(/\/$/, "") + route;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch {
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }); } catch { /* capture whatever rendered */ }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, file), fullPage: false });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const manifest = [];
for (const route of ROUTES) {
  const slug = sanitize(route);
  const beforeFile = `before-${slug}.png`;
  const afterFile = `after-${slug}.png`;
  await shoot(page, BEFORE, route, beforeFile);
  await shoot(page, AFTER, route, afterFile);
  manifest.push({ route, beforeFile, afterFile });
  console.log(`shot ${route} → ${beforeFile}, ${afterFile}`);
}

await browser.close();
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} route(s) to ${OUT}/`);
