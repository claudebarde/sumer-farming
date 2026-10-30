export const ZIGGURAT_FOUNDATIONS = {
  clay: 30, reed: 15, durationMs: 6 * 60 * 60 * 1000, pointsPerMaterial: 2
} as const;

export const ZIGGURAT_RESOURCES = ["clay", "reed", "barley", "bread", "beer", "dates", "shekels"] as const;
export type ZigguratResource = typeof ZIGGURAT_RESOURCES[number];
export type ZigguratMaterials = Record<ZigguratResource, number>;
export const emptyMaterials = (): ZigguratMaterials => ({ clay: 0, reed: 0, barley: 0, bread: 0, beer: 0, dates: 0, shekels: 0 });
export const ZIGGURAT_POINTS: ZigguratMaterials = { clay: 2, reed: 2, barley: 3, bread: 6, beer: 8, dates: 10, shekels: 1 };
export const ZIGGURAT_LABELS = { clay: "Clay", reed: "Reeds", barley: "Barley", bread: "Bread", beer: "Beer", dates: "Dates", shekels: "Shekels" } as const;
export const ZIGGURAT_STAGES = [
  { name: "Foundations", hours: 6, materials: { ...emptyMaterials(), clay: 30, reed: 15 } },
  { name: "Lower terrace", hours: 12, materials: { ...emptyMaterials(), clay: 45, barley: 30, bread: 15 } },
  { name: "Upper terraces", hours: 18, materials: { ...emptyMaterials(), clay: 60, bread: 24, beer: 18 } },
  { name: "Summit sanctuary", hours: 24, materials: { ...emptyMaterials(), clay: 30, dates: 12, shekels: 250 } }
] as const;
export type SavedZigguratStage = { funded: ZigguratMaterials; startedAt?: string; completesAt?: string };
