"use client";

import { useState, useEffect } from "react";

type DemoStep = {
  action: string;
  screenshot?: string;
};

type DemoState = "closed" | "minimized" | "expanded" | "running" | "complete";

const DEMO_STEPS: DemoStep[] = [
  { action: "Loading https://demo.realworld.io" },
  { action: "Reading page content and elements" },
  { action: 'Looking for "Browse Articles" heading' },
  { action: "Found article feed with 10 articles" },
  { action: "Checking for console errors..." },
  { action: "Verifying no JavaScript errors" },
];

export default function PreviewWidget() {
  const [state, setState] = useState<DemoState>("minimized");
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (state === "running" && stepIndex < DEMO_STEPS.length) {
      const timer = setTimeout(() => {
        setStepIndex(stepIndex + 1);
      }, 800);
      return () => clearTimeout(timer);
    }

    if (state === "running" && stepIndex >= DEMO_STEPS.length) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setState("complete");
        setIsAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state, stepIndex]);

  const handleRunDemo = () => {
    setState("running");
    setStepIndex(0);
  };

  const handleReset = () => {
    setState("expanded");
    setStepIndex(0);
  };

  const handleMinimize = () => {
    setState("minimized");
  };

  const handleMaximize = () => {
    setState("expanded");
    setStepIndex(0);
  };

  const handleClose = () => {
    setState("closed");
  };

  if (state === "closed") {
    return (
      <button
        onClick={() => setState("minimized")}
        className="fixed bottom-6 right-6 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 z-50"
        aria-label="Open preview"
      >
        Preview ▸
      </button>
    );
  }

  if (state === "minimized") {
    return (
      <button
        onClick={handleMaximize}
        className="fixed bottom-6 right-6 rounded-lg border border-border bg-panel px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent z-50"
        aria-label="Expand preview"
      >
        Computah Preview
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        state === "expanded" || state === "running" || state === "complete"
          ? "bottom-6 right-6 w-96 shadow-2xl rounded-2xl border border-border bg-panel overflow-hidden"
          : "bottom-20 right-6"
      }`}
    >
      {/* Header */}
      <div className="mono flex items-center justify-between border-b border-border bg-background/50 px-4 py-3 text-xs text-muted">
        <span>computah — interactive demo</span>
        <div className="flex gap-2">
          <button
            onClick={handleMinimize}
            className="hover:text-foreground transition"
            aria-label="Minimize"
          >
            _
          </button>
          <button
            onClick={handleClose}
            className="hover:text-foreground transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {state === "expanded" && (
          <>
            <div>
              <label className="mono block text-xs text-muted mb-2">
                EXAMPLE VERIFICATION
              </label>
              <div className="mono text-xs space-y-1 text-foreground/70 bg-background rounded px-3 py-2">
                <div>URL: https://demo.realworld.io</div>
                <div className="text-muted">Goal: Verify the article feed loads</div>
              </div>
            </div>
            <button
              onClick={handleRunDemo}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Run Demo ▸
            </button>
          </>
        )}

        {(state === "running" || state === "complete") && (
          <>
            <div className="mono text-xs space-y-2">
              {DEMO_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 transition-opacity duration-300 ${
                    i < stepIndex ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <span className="shrink-0 mt-0.5">
                    {i < stepIndex ? "✓" : "○"}
                  </span>
                  <span className="text-muted text-xs">{step.action}</span>
                </div>
              ))}
            </div>

            {state === "complete" && (
              <div
                className={`rounded-lg border transition-all duration-500 ${
                  isAnimating
                    ? "border-border bg-background/40 opacity-0"
                    : "border-pass/40 bg-pass/10 opacity-100"
                }`}
              >
                <div className="p-3 space-y-2">
                  <div className="mono text-pass text-sm font-semibold">
                    ✓ PASS
                  </div>
                  <div className="text-xs text-foreground/70">
                    Article feed loaded successfully with 10 articles and no console errors.
                  </div>
                  <div className="mono text-xs text-muted">
                    6 steps · 4200ms
                  </div>
                  <button
                    onClick={handleReset}
                    className="mono text-xs text-accent hover:underline"
                  >
                    ▸ run again
                  </button>
                </div>
              </div>
            )}

            {state === "running" && stepIndex === DEMO_STEPS.length && (
              <div className="animate-pulse mono text-xs text-accent">
                ● Processing results…
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer info */}
      <div className="mono border-t border-border bg-background/40 px-4 py-2 text-xs text-muted/70">
        Click &quot;Launch console&quot; to try it live
      </div>
    </div>
  );
}
