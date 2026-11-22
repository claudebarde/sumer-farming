import { FEED_GRACE_MS, FEED_PERIOD_MS, sheepGrowth, fleeceRemaining, type Livestock } from "../../game-data/livestock";

/** Pure catch-up: no animation callbacks, no retroactive neglect for legacy saves. */
export function advanceLivestock(state: Livestock, now: number): Livestock {
  const initialized = state.animals.map(a => a.care ? a : { ...a, care: {
    growthMs: a.age === "adult" ? FEED_PERIOD_MS * 2 : 0, fedAt: null,
    needsFeedAt: Math.max(now, a.arrivesAt, state.feeding?.completesAt ? state.feeding.completesAt + FEED_PERIOD_MS : 0)
  } });
  const lost = initialized.filter(a => now >= a.care!.needsFeedAt + FEED_GRACE_MS);
  const animals = initialized.filter(a => !lost.includes(a)).map(a => sheepGrowth(a, now) >= FEED_PERIOD_MS * 2 && a.age !== "adult" ? { ...a, age: "adult" as const } : a);
  if (!lost.length && animals.every((a, i) => a === state.animals[i])) return state;
  return { ...state, animals, losses: [...(state.losses ?? []), ...lost.map(a => ({ id: a.id, lostAt: a.care!.needsFeedAt + FEED_GRACE_MS }))].slice(-30) };
}

export function feedLivestock(state: Livestock, completesAt: number, now: number): Livestock {
  return { ...state, ...(state.fleece ? { fleece: { remainingMs: fleeceRemaining(state, now), updatedAt: completesAt } } : {}), animals: state.animals.map(a => ({ ...a, care: {
    growthMs: sheepGrowth(a, now), fedAt: completesAt, needsFeedAt: completesAt + FEED_PERIOD_MS
  } })) };
}
