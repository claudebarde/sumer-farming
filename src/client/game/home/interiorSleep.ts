import { sleepEnd, type FarmerSleep } from "../../../game-data/farmerSleep";

/** Server timestamps remain authoritative, including after reload/offline catch-up. */
export const interiorSleepPhase = (sleep: FarmerSleep | undefined, now: number, visiting: boolean) => {
  const session = sleep?.session;
  if (visiting || !session || now >= sleepEnd(session)) return "awake" as const;
  return now < session.sleepsAt ? "entering" as const : "sleeping" as const;
};
export type InteriorSleepPhase = ReturnType<typeof interiorSleepPhase>;
