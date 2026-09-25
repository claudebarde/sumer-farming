import { match } from "ts-pattern";
import { BEER_RECIPE } from "../../game-data/brewing";

export type BrewingState =
  | { readonly type: "idle" }
  | { readonly type: "brewing"; readonly readyAt: number }
  | { readonly type: "ready" };

export const readyBeerQuantity = (building: { readonly beerReadyAt: string | null; readonly beerServed: number }, now: number): number =>
  building.beerReadyAt !== null && Date.parse(building.beerReadyAt) <= now
    ? Math.max(0, BEER_RECIPE.output - building.beerServed) : 0;

export const getBrewingState = (readyAt: string | null, now: number): BrewingState =>
  readyAt === null ? { type: "idle" } :
    Date.parse(readyAt) > now ? { type: "brewing", readyAt: Date.parse(readyAt) } : { type: "ready" };

export const brewingErrors = {
  batch_active: "Collect the current batch before starting another.",
  missing_ingredients: "Brewing requires 2 barley, 2 water loads and 2 empty beer jars.",
  beer_not_ready: "The beer is not ready to collect.",
  no_batch: "There is no beer to collect.",
  beer_inventory_full: "The estate cannot hold more beer."
} as const;

export const validateBrewing = (action: "start_brewing" | "collect_beer", building: {
  readonly beerReadyAt: string | null;
  readonly brewingBarley: number;
  readonly brewingWater: number;
  readonly emptyBeerJars: number;
}, now: number): keyof typeof brewingErrors | null =>
  match(getBrewingState(building.beerReadyAt, now))
    .with({ type: "idle" }, () => action === "collect_beer" ? "no_batch" as const :
      building.brewingBarley < BEER_RECIPE.barley ||
      building.brewingWater < BEER_RECIPE.water ||
      building.emptyBeerJars < BEER_RECIPE.emptyJars ? "missing_ingredients" as const : null)
    .with({ type: "brewing" }, () => action === "start_brewing" ? "batch_active" as const : "beer_not_ready" as const)
    .with({ type: "ready" }, () => action === "start_brewing" ? "batch_active" as const : null)
    .exhaustive();
