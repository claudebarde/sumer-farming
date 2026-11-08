import { match } from "ts-pattern";
import type { Ziggurat } from "../../../schemas/ziggurat";
import { deliveryPlan } from "../../../game-data/zigguratDelivery";

/** Only defer transitions witnessed in this view; reloads show saved progress. */
export const constructionRevealAt = (previous: Ziggurat["state"] | undefined, next: Pick<Ziggurat, "state" | "deliveries">): number | null => {
  if (previous?.type !== "fundraising" || next.state.type !== "building" || previous.stage !== next.state.stage) return null;
  const delivery = [...next.deliveries].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0];
  if (!delivery) return null;
  return Date.parse(delivery.startsAt) + deliveryPlan(delivery.slot).legs.slice(0, 4).reduce((sum, leg) => sum + leg.duration, 0);
};
const completed = ["foundations", "lower-terrace", "upper-terraces", "completed"] as const;
const working = ["worksite", "lower-terrace", "upper-terraces", "upper-terraces"] as const;
/** Persistent map cue, including deadlines reached while the player was away. */
export const zigguratStatusLabel = (state: Ziggurat["state"], now: number): string | null => match(state)
 .with({ type: "interest" }, () => null)
 .with({ type: "fundraising" }, () => "Materials needed")
 .with({ type: "complete" }, () => "Ziggurat complete")
 .with({ type: "building" }, job => now < Date.parse(job.completesAt) ? null
   : job.stage === completed.length - 1 ? "Ziggurat complete" : "Materials needed")
 .exhaustive();
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
