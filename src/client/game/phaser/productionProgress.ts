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
