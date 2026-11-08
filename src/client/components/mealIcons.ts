import type { MealKey } from "../../game-data/kitchen";
import barleyCakes from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/meals/barley-cakes.png";
import dateCakes from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/meals/date-cakes.png";
import sesameCakes from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/meals/sesame-cakes.png";
import porridge from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/meals/date-sesame-porridge.png";

export const MEAL_ICONS = { barleyCakes, dateCakes, sesameCakes, porridge } satisfies Record<MealKey, string>;

