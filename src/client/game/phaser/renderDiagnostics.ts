/** Development-only timings; no farm state or player information is logged. */
export const renderDiagnostic = (event: string, startedAt = performance.now(), details: Record<string, string | number | boolean> = {}) => {
  if (import.meta.env.DEV) console.debug("[farm-render]", event, JSON.stringify({
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10, ...details
  }));
};
