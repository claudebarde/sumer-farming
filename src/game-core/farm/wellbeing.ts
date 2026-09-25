import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../game-data/household";
import { BEER_HAPPINESS_BOOST, BEER_TREAT_INTERVAL_MS } from "../../game-data/household";

export const beerTreatErrors = {
  no_beer: "Collect or buy a beer jar first.",
  beer_cooldown: "The farmer can receive one beer every 24 hours.",
  happiness_full: "The farmer's happiness is already full."
} as const;
export const validateBeerTreat = (quantity: number, happiness: number, lastBeerAt: number | null, now: number): keyof typeof beerTreatErrors | null =>
  lastBeerAt !== null && now < lastBeerAt + BEER_TREAT_INTERVAL_MS ? "beer_cooldown" :
    quantity < 1 ? "no_beer" : happiness >= 100 ? "happiness_full" : null;
export const happinessAfterBeer = (happiness: number): number => Math.min(100, happiness + BEER_HAPPINESS_BOOST);

export type FarmerMood = "happy" | "content" | "unhappy";
export const INITIAL_HAPPINESS = 70;
export const CONTENT_HAPPINESS = 50;
export const getFarmerMood = (happiness: number): FarmerMood =>
  happiness >= 70 ? "happy" : happiness >= 40 ? "content" : "unhappy";

// Food shortages never create unhappiness, nor repair an unrelated low mood.
export const happinessAfterFeeding = (happiness: number, hungry: boolean, ate: boolean): number =>
  hungry ? Math.min(happiness, CONTENT_HAPPINESS) :
    ate ? Math.min(100, happiness + 10) : happiness;

// Use the strongest slowdown, never compound hunger and mood penalties.
export const farmerMovementDurationMultiplier = (happiness: number, hungry: boolean): number =>
  Math.max(hungry ? HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER : 1,
    getFarmerMood(happiness) === "unhappy" ? 1 / 0.9 : 1);
