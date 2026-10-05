export const SHRINE_UNLOCK_LEVEL = 8;
export const SHRINE_OFFERING_QUANTITY = 2;
export const SHRINE_BLESSING_DURATION_MS = 12 * 60 * 60_000;
export const SHRINE_DECAY_RATE = 0.75;
export type ShrineBlessing = { readonly buildingId: string; readonly startedAt: string; readonly expiresAt: string };
export const shrineBlessingActive = (blessing: ShrineBlessing | null | undefined, now: number): boolean =>
  !!blessing && Date.parse(blessing.startedAt) <= now && now < Date.parse(blessing.expiresAt);
export const shrineSprite = (buildingId: string, blessing: ShrineBlessing | null | undefined, now: number) =>
  blessing?.buildingId === buildingId && shrineBlessingActive(blessing, now) ? "smallShrineWithOfferings" as const : "smallShrine" as const;
