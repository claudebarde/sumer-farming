import { FurnitureLayoutSchema } from "./homeFurniture";
import { z } from "zod";
export const HomeAppearanceSchema = z.object({
  // Retire the former starter jar without discarding the rest of a saved room.
  furniture: z.preprocess(value => Array.isArray(value)
    ? value.filter(item => !(item && typeof item === "object" && item.key === "painted-jar"))
    : value, FurnitureLayoutSchema.optional()),
  furnitureRevision: z.number().int().nonnegative().optional(),
  style: z.enum(["farm-level-9", "farm-style-pale", "farm-style-reeds", "farm-style-clay"]),
  wallTablet: z.enum(["none", "home-tablet-barley", "home-tablet-sky", "home-tablet-beer", "home-tablet-cook"]).optional(),
  decoration: z.enum(["none", "home-pottery", "home-baskets", "home-stool", "home-mat"])
});
export type HomeAppearance = z.infer<typeof HomeAppearanceSchema>;
export const DEFAULT_HOME_APPEARANCE: HomeAppearance = { style: "farm-level-9", decoration: "none" };
