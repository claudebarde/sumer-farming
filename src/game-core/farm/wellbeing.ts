import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../game-data/household";
import { SHRINE_DECAY_RATE, type ShrineBlessing } from "../../game-data/shrine";
import { BREAD_HAPPINESS_BOOST, BREAD_TREAT_INTERVAL_MS } from "../../game-data/household";

export const breadTreatErrors = {
  no_bread: "Store or buy bread first.",
  bread_cooldown: "The farmer can receive one bread every 12 hours.",
  happiness_full: "The farmer's happiness is already full."
} as const;
export const validateBreadTreat = (quantity: number, happiness: number, lastAt: number | null, now: number): keyof typeof breadTreatErrors | null =>
  lastAt !== null && now < lastAt + BREAD_TREAT_INTERVAL_MS ? "bread_cooldown" : quantity < 1 ? "no_bread" : happiness >= 100 ? "happiness_full" : null;
export const happinessAfterBread = (happiness: number): number => Math.min(100, happiness + BREAD_HAPPINESS_BOOST);
import { HAPPINESS_MANAGEMENT_LEVEL, INTRODUCTORY_HAPPINESS_FLOOR } from "../../game-data/household";
import { HAPPY_DECAY_POINT_MS, CONTENT_DECAY_POINT_MS, BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
import { BEER_HAPPINESS_BOOST, BEER_TREAT_INTERVAL_MS, FISH_HAPPINESS_BOOST, FISH_TREAT_INTERVAL_MS } from "../../game-data/household";

export const beerTreatErrors = {
  no_beer: "Collect or buy a beer jar first.",
  beer_cooldown: "The farmer can receive one beer every 24 hours.",
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

/** Keep partial intervals, so repeated polling cannot delay the next lost point. */
export const happinessDecayElapsed = (from: number, to: number, blessing?: ShrineBlessing | null): number => {
  const overlap = blessing ? Math.max(0, Math.min(to, Date.parse(blessing.expiresAt)) - Math.max(from, Date.parse(blessing.startedAt))) : 0;
  return Math.max(0, to - from) - overlap * (1 - SHRINE_DECAY_RATE);
};

/** Convert consumed decay-time back into a wall-clock deadline, retaining partial points. */
const decayDeadline = (from: number, elapsed: number, blessing?: ShrineBlessing | null): number => {
  if (!blessing) return from + elapsed;
  const start = Date.parse(blessing.startedAt);
  const end = Date.parse(blessing.expiresAt);
  const before = Math.max(0, start - from);
  if (elapsed <= before) return from + elapsed;
  const during = Math.max(0, end - Math.max(from, start)) * SHRINE_DECAY_RATE;
  if (elapsed <= before + during) return Math.max(from, start) + (elapsed - before) / SHRINE_DECAY_RATE;
  return Math.max(from, end) + elapsed - before - during;
};

export const decayHappiness = (state: HappinessClock, now: number, blessing?: ShrineBlessing | null): HappinessClock => {
  const elapsed = happinessDecayElapsed(state.checkedAt, now, blessing);
  const fastPoints = Math.min(Math.max(0, state.happiness - CONTENT_HAPPINESS), Math.floor(elapsed / HAPPY_DECAY_POINT_MS));
  const afterFast = state.happiness - fastPoints;
  const fastTime = fastPoints * HAPPY_DECAY_POINT_MS;
  const slowPoints = afterFast <= CONTENT_HAPPINESS
    ? Math.min(afterFast, Math.floor((elapsed - fastTime) / CONTENT_DECAY_POINT_MS)) : 0;
  const happiness = afterFast - slowPoints;
  return { happiness, checkedAt: happiness === 0 ? Math.max(now, state.checkedAt)
    : decayDeadline(state.checkedAt, fastTime + slowPoints * CONTENT_DECAY_POINT_MS, blessing) };
};

/** Replay rations at their actual deadlines, not all at login time. */
export const advanceHappiness = (initial: HappinessClock, now: number, firstRationAt: number, consumed: number, shortageAt: number | null, level = HAPPINESS_MANAGEMENT_LEVEL, blessing?: ShrineBlessing | null): HappinessClock => {
  const protectedLevel = level < HAPPINESS_MANAGEMENT_LEVEL;
  const decay = (clock: HappinessClock, at: number): HappinessClock => {
    const decayed = decayHappiness(clock, at, blessing);
    // Discard elapsed time at the floor so it cannot become a later decay debt.
    return protectedLevel && decayed.happiness <= INTRODUCTORY_HAPPINESS_FLOOR
      ? { happiness: INTRODUCTORY_HAPPINESS_FLOOR, checkedAt: Math.max(at, decayed.checkedAt) }
      : decayed;
  };
  let state = protectedLevel ? { ...initial, happiness: Math.max(initial.happiness, INTRODUCTORY_HAPPINESS_FLOOR) } : initial;
  for (let index = 0; index < consumed; index++) {
    const at = Math.max(state.checkedAt, firstRationAt + index * BARLEY_CONSUMPTION_INTERVAL_MS);
    const next = { happiness: happinessAfterFeeding(decay(state, at).happiness, false, true), checkedAt: at };
    // Once daily feeding reaches equilibrium, skip identical full-day cycles.
    if (index > 0 && next.happiness === state.happiness && (!blessing || state.checkedAt >= Date.parse(blessing.expiresAt))) {
      state = { ...next, checkedAt: at + (consumed - index - 1) * BARLEY_CONSUMPTION_INTERVAL_MS };
      break;
    }
    state = next;
  }
  if (shortageAt !== null && !protectedLevel) {
    const at = Math.max(state.checkedAt, shortageAt);
    state = { happiness: happinessAfterFeeding(decayHappiness(state, at, blessing).happiness, true, false), checkedAt: at };
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
