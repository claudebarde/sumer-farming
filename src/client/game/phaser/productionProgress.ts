/** Presentation only: never use this gate to submit or advance server jobs. */
export const productionVisualsReady = (
  job: { readonly startedAt: string } | null | undefined,
  now: number,
  awaitingArrival: boolean
): boolean => !!job && !awaitingArrival && Date.parse(job.startedAt) <= now;

export const productionProgress = (
  job: { readonly startedAt: string; readonly completesAt: string } | null | undefined,
  now: number
): number | null => {
  if (!job) return null;
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.completesAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || now >= end) return null;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
};
