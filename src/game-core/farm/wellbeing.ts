import type { SleepInterval } from "../../game-data/farmerSleep";
import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../game-data/household";
import { DATES_HAPPINESS_BOOST, DATES_TREAT_INTERVAL_MS } from "../../game-data/household";
export const datesTreatErrors = { no_dates: "Store a basket of dates in the warehouse first.", dates_cooldown: "The farmer can receive one basket of dates every 8 hours.", happiness_full: "The farmer's happiness is already full." } as const;
export const validateDatesTreat = (quantity: number, happiness: number, lastAt: number | null, now: number): keyof typeof datesTreatErrors | null =>
  lastAt !== null && now < lastAt + DATES_TREAT_INTERVAL_MS ? "dates_cooldown" : quantity < 1 ? "no_dates" : happiness >= 100 ? "happiness_full" : null;
export const happinessAfterDates = (happiness: number) => Math.min(100, happiness + DATES_HAPPINESS_BOOST);
import { SHRINE_DECAY_RATE, type ShrineBlessing } from "../../game-data/shrine";
import { BREAD_HAPPINESS_BOOST, BREAD_TREAT_INTERVAL_MS } from "../../game-data/household";

export const breadTreatErrors = {
  no_bread: "Store or buy bread first.",
  bread_cooldown: `The farmer can receive one bread every ${BREAD_TREAT_INTERVAL_MS / 3600000} hours.`,
  happiness_full: "The farmer's happiness is already full."
} as const;
export const validateBreadTreat = (quantity: number, happiness: number, lastAt: number | null, now: number): keyof typeof breadTreatErrors | null =>
  lastAt !== null && now < lastAt + BREAD_TREAT_INTERVAL_MS ? "bread_cooldown" : quantity < 1 ? "no_bread" : happiness >= 100 ? "happiness_full" : null;
export const happinessAfterBread = (happiness: number): number => Math.min(100, happiness + BREAD_HAPPINESS_BOOST);
import { HAPPINESS_MANAGEMENT_LEVEL, INTRODUCTORY_HAPPINESS_FLOOR } from "../../game-data/household";
import { HAPPY_DECAY_POINT_MS, CONTENT_DECAY_POINT_MS, ADVANCED_CONTENT_DECAY_POINT_MS, FASTER_HAPPINESS_DECAY_LEVEL, BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
import { BEER_HAPPINESS_BOOST, BEER_TREAT_INTERVAL_MS, FISH_HAPPINESS_BOOST, FISH_TREAT_INTERVAL_MS } from "../../game-data/household";

export const beerTreatErrors = {
  no_beer: "Collect or buy a beer jar first.",
  beer_cooldown: `The farmer can receive one beer every ${BEER_TREAT_INTERVAL_MS / 3600000} hours.`,
  happiness_full: "The farmer's happiness is already full."
} as const;
export const validateBeerTreat = (quantity: number, happiness: number, lastBeerAt: number | null, now: number): keyof typeof beerTreatErrors | null =>
  lastBeerAt !== null && now < lastBeerAt + BEER_TREAT_INTERVAL_MS ? "beer_cooldown" :
    quantity < 1 ? "no_beer" : happiness >= 100 ? "happiness_full" : null;
export const happinessAfterBeer = (happiness: number): number => Math.min(100, happiness + BEER_HAPPINESS_BOOST);
export const fishTreatErrors = { ...beerTreatErrors, no_fish: "Store a fish at the farm first.", fish_cooldown: "The farmer can receive one fish every 8 hours." } as const;
export const validateFishTreat = (quantity: number, happiness: number, lastFishAt: number | null, now: number) => {
  return lastFishAt !== null && now < lastFishAt + FISH_TREAT_INTERVAL_MS ? "fish_cooldown" :
    quantity < 1 ? "no_fish" : happiness >= 100 ? "happiness_full" : null;
};
export const happinessAfterFish = (happiness: number): number => Math.min(100, happiness + FISH_HAPPINESS_BOOST);

export type FarmerMood = "happy" | "content" | "unhappy";
export const INITIAL_HAPPINESS = 70;
export const CONTENT_HAPPINESS = 50;
export type HappinessClock = { readonly happiness: number; readonly checkedAt: number };

/** Piecewise rates preserve fractional decay across sleep and blessing boundaries. */
const decaySegments = (from: number, to: number, blessing?: ShrineBlessing | null, sleep: readonly SleepInterval[] = []) => {
  const start = blessing ? Date.parse(blessing.startedAt) : Infinity;
  const end = blessing ? Date.parse(blessing.expiresAt) : Infinity;
  const boundaries = [...new Set([from, to, start, end, ...sleep.flatMap(s => [s.start, s.end])].filter(t => t >= from && t <= to))].sort((a, b) => a - b);
  return boundaries.slice(1).map((b, i) => {
    const a = boundaries[i]!;
    const rate = (a >= start && a < end ? SHRINE_DECAY_RATE : 1) * (sleep.some(s => a >= s.start && a < s.end) ? 0.5 : 1);
    return { from: a, to: b, rate };
  });
};
export const happinessDecayElapsed = (from: number, to: number, blessing?: ShrineBlessing | null, sleep: readonly SleepInterval[] = []): number =>
  decaySegments(from, Math.max(from, to), blessing, sleep).reduce((sum, s) => sum + (s.to - s.from) * s.rate, 0);

/** Preserve accrued credit when replacing a blessing without counting sleep twice. */
export const happinessCreditStart = (now: number, credit: number, sleep: readonly SleepInterval[] = []): number => {
  let remaining = credit;
  for (const segment of decaySegments(now - credit * 2 - 1, now, null, sleep).reverse()) {
    const amount = (segment.to - segment.from) * segment.rate;
    if (remaining <= amount) return segment.to - remaining / segment.rate;
    remaining -= amount;
  }
  return now;
};

const decayDeadline = (from: number, elapsed: number, blessing?: ShrineBlessing | null, sleep: readonly SleepInterval[] = []): number => {
  if (elapsed <= 0) return from;
  // Both modifiers are positive; this horizon always contains the deadline.
  const horizon = from + elapsed / (0.5 * SHRINE_DECAY_RATE) + 1;
  let remaining = elapsed;
  for (const s of decaySegments(from, horizon, blessing, sleep)) {
    const amount = (s.to - s.from) * s.rate;
    if (remaining <= amount) return s.from + remaining / s.rate;
    remaining -= amount;
  }
  return horizon;
};

export const decayHappiness = (state: HappinessClock, now: number, blessing?: ShrineBlessing | null, sleep: readonly SleepInterval[] = [], level = HAPPINESS_MANAGEMENT_LEVEL): HappinessClock => {
  const contentInterval = level >= FASTER_HAPPINESS_DECAY_LEVEL ? ADVANCED_CONTENT_DECAY_POINT_MS : CONTENT_DECAY_POINT_MS;
  const elapsed = happinessDecayElapsed(state.checkedAt, now, blessing, sleep);
  const fastPoints = Math.min(Math.max(0, state.happiness - CONTENT_HAPPINESS), Math.floor(elapsed / HAPPY_DECAY_POINT_MS));
  const afterFast = state.happiness - fastPoints;
  const fastTime = fastPoints * HAPPY_DECAY_POINT_MS;
  const slowPoints = afterFast <= CONTENT_HAPPINESS
    ? Math.min(afterFast, Math.floor((elapsed - fastTime) / contentInterval)) : 0;
  const happiness = afterFast - slowPoints;
  return { happiness, checkedAt: happiness === 0 ? Math.max(now, state.checkedAt)
    : decayDeadline(state.checkedAt, fastTime + slowPoints * contentInterval, blessing, sleep) };
};

/** Replay rations at their actual deadlines, not all at login time. */
export const advanceHappiness = (initial: HappinessClock, now: number, firstRationAt: number, consumed: number, shortageAt: number | null, level = HAPPINESS_MANAGEMENT_LEVEL, blessing?: ShrineBlessing | null, sleep: readonly SleepInterval[] = [], followingRationDelay = 0): HappinessClock => {
  const protectedLevel = level < HAPPINESS_MANAGEMENT_LEVEL;
  const decay = (clock: HappinessClock, at: number): HappinessClock => {
    const decayed = decayHappiness(clock, at, blessing, sleep, level);
    // Discard elapsed time at the floor so it cannot become a later decay debt.
    return protectedLevel && decayed.happiness <= INTRODUCTORY_HAPPINESS_FLOOR
      ? { happiness: INTRODUCTORY_HAPPINESS_FLOOR, checkedAt: Math.max(at, decayed.checkedAt) }
      : decayed;
  };
  let state = protectedLevel ? { ...initial, happiness: Math.max(initial.happiness, INTRODUCTORY_HAPPINESS_FLOOR) } : initial;
  for (let index = 0; index < consumed; index++) {
    const at = Math.max(state.checkedAt, firstRationAt + index * BARLEY_CONSUMPTION_INTERVAL_MS + (index > 0 ? followingRationDelay : 0));
    const next = { happiness: happinessAfterFeeding(decay(state, at).happiness, false, true), checkedAt: at };
    // Once daily feeding reaches equilibrium, skip identical full-day cycles.
    if (!sleep.some(s => s.end > state.checkedAt) && index > 0 && next.happiness === state.happiness && (!blessing || state.checkedAt >= Date.parse(blessing.expiresAt))) {
      state = { ...next, checkedAt: at + (consumed - index - 1) * BARLEY_CONSUMPTION_INTERVAL_MS };
      break;
    }
    state = next;
  }
  if (shortageAt !== null && !protectedLevel) {
    const at = Math.max(state.checkedAt, shortageAt);
    state = { happiness: happinessAfterFeeding(decayHappiness(state, at, blessing, sleep, level).happiness, true, false), checkedAt: at };
  }
  return decay(state, now);
};
export const getFarmerMood = (happiness: number): FarmerMood =>
  happiness >= 70 ? "happy" : happiness >= 40 ? "content" : "unhappy";

// Food shortages never create unhappiness, nor repair an unrelated low mood.
export const happinessAfterFeeding = (happiness: number, hungry: boolean, ate: boolean): number =>
  hungry ? Math.min(happiness, CONTENT_HAPPINESS) :
    ate ? Math.min(100, happiness + 10) : happiness;

// Use the strongest slowdown, never compound hunger and mood penalties.
export const farmerMovementDurationMultiplier = (happiness: number, hungry: boolean, level = HAPPINESS_MANAGEMENT_LEVEL): number =>
  level < HAPPINESS_MANAGEMENT_LEVEL ? 1 : Math.max(hungry ? HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER : 1,
    getFarmerMood(happiness) === "unhappy" ? 1 / 0.9 : 1);
