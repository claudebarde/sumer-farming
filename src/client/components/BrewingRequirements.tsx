import type { FarmSnapshot } from "../../schemas/farm";
import { BEER_RECIPE } from "../../game-data/brewing";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";
import water from "../../assets/sprite_assets/pngs/water.webp";
import jars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.webp";
import MaterialRequirements from "./MaterialRequirements";

export default function BrewingRequirements({ snapshot, building }: {
  readonly snapshot: FarmSnapshot; readonly building: FarmSnapshot["buildings"][number];
}) {
  return <MaterialRequirements compact label="Brewing ingredients" items={[
    { name: "Brewer’s Groats", image: groats, quantity: Math.min(BEER_RECIPE.groats, snapshot.inventory.find(i => i.itemKey === "brewersGroats")?.quantity ?? 0), required: BEER_RECIPE.groats },
    { name: "Water", image: water, quantity: building.brewingWater, required: BEER_RECIPE.water },
    { name: "Empty beer jars", image: jars, quantity: building.emptyBeerJars, required: BEER_RECIPE.emptyJars }
  ]} />;
}
