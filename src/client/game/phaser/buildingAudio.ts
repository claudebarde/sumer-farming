import type { FarmSnapshot } from "../../../schemas/farm";

export const BUILDING_AUDIO = {
  grinding: "/audio/grinding.mp3",
  baking: "/audio/baking.mp3",
  stirring: "/audio/stirring.mp3",
  bubbling: "/audio/bubbling.mp3",
  construction: "/audio/construction.mp3"
} as const;
export type BuildingAudioKey = keyof typeof BUILDING_AUDIO;

const during = (start: string, end: string, now: number) => now >= Date.parse(start) && now < Date.parse(end);

/** Sound follows persisted work phases, never starts or completes production. */
export const buildingAudioActive = (farm: Pick<FarmSnapshot["farm"], "milling" | "production">, key: BuildingAudioKey, now: number,
  buildings: readonly Pick<FarmSnapshot["buildings"][number], "startedAt" | "completesAt">[] = []): boolean => {
  switch (key) {
    case "construction": return buildings.some(job => during(job.startedAt, job.completesAt, now)) ||
      Object.values(farm.production.buildingUpgrades ?? {}).some(jobs => jobs.some(job => during(job.startedAt, job.completesAt, now)));
    case "grinding": return !!farm.milling && during(farm.milling.startedAt, farm.milling.completesAt, now);
    case "baking": return Object.values(farm.production.baking).some(job => during(job.startedAt, job.completesAt, now));
    case "stirring": return Object.values(farm.production.brewing ?? {}).some(job => during(job.arrivedAt, job.startedAt, now));
    case "bubbling": return Object.values(farm.production.brewing ?? {}).some(job => during(job.startedAt, job.completesAt, now));
  }
};
