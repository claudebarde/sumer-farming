export const productionIsPreparing = (job: { readonly startedAt?: string } | null | undefined, now: number) =>
  !!job?.startedAt && Date.parse(job.startedAt) > now;
