import type { IsoCell } from "./isometricProjection";

export const merchantGreetings = {
  barley: "Buying or selling barley?",
  baking: "Fresh bread today!",
  beer: "Care for a beer?",
  produce: "Fresh produce for your farm!",
} as const;
export type MerchantKind = keyof typeof merchantGreetings;
export type GreetingState = Readonly<{
  active: { readonly merchant: MerchantKind; readonly startedAt: number } | null;
  greeted: readonly MerchantKind[];
  nextAt: Readonly<Partial<Record<MerchantKind, number>>>;
}>;
export const initialGreetingState = (): GreetingState => ({ active: null, greeted: [], nextAt: {} });
export const GREETING_DURATION = 4000;

/** Local presentation only. Leaving the radius rearms a merchant, subject to cooldown. */
export const advanceGreeting = (
  state: GreetingState,
  merchants: readonly { readonly scope: MerchantKind; readonly merchant: IsoCell }[],
  farmer: IsoCell,
  now: number,
  blocked: boolean,
): GreetingState => {
  const nearby = merchants.map(merchant => ({ ...merchant,
    distance: Math.hypot(merchant.merchant.column - farmer.column, merchant.merchant.row - farmer.row),
  })).sort((a, b) => a.distance - b.distance);
  // Wider exit radius prevents repeated entries near the edge.
  const greeted = state.greeted.filter(scope => nearby.some(m => m.scope === scope && m.distance <= 3.5));
  const nearest = nearby.find(m => m.distance <= 3);
  const active = !blocked && state.active && now - state.active.startedAt < GREETING_DURATION &&
    nearest?.scope === state.active.merchant ? state.active : null;
  if (blocked || active || !nearest || greeted.includes(nearest.scope) || now < (state.nextAt[nearest.scope] ?? 0)) {
    return { ...state, active, greeted };
  }
  return { active: { merchant: nearest.scope, startedAt: now },
    greeted: [...greeted, nearest.scope], nextAt: { ...state.nextAt, [nearest.scope]: now + 8000 } };
};

export const greetingAppearance = (age: number, reducedMotion: boolean) => {
  const t = Math.min(1, Math.max(0, age / 300));
  const backOut = 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
  return { scale: reducedMotion ? 1 : 0.8 + 0.2 * backOut,
    alpha: Math.max(0, Math.min(1, age / 100, (GREETING_DURATION - age) / 250)) };
};
