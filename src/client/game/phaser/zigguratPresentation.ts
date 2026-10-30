import { match } from "ts-pattern";
import type { Ziggurat } from "../../../schemas/ziggurat";
const completed = ["foundations", "lower-terrace", "upper-terraces", "completed"] as const;
const working = ["worksite", "lower-terrace", "upper-terraces", "upper-terraces"] as const;
/** Saved deadlines drive artwork; no animation callback advances construction. */
export const zigguratPresentation = (state: Ziggurat["state"], now: number) => match(state)
 .with({ type: "interest" }, () => ({ stage: "site" as const, fraction: null }))
 .with({ type: "complete" }, () => ({ stage: "completed" as const, fraction: null }))
 .with({ type: "fundraising" }, job => ({ stage: job.stage === 0 ? "site" as const : completed[job.stage - 1]!, fraction: null }))
 .with({ type: "building" }, job => {
   const start = Date.parse(job.startedAt), end = Date.parse(job.completesAt);
   return now >= end ? { stage: completed[job.stage]!, fraction: null }
    : { stage: working[job.stage]!, fraction: Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start))) };
 }).exhaustive();
