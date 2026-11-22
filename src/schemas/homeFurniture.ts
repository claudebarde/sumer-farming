import { z } from "zod";
import { isTabletopItem } from "../game-core/home/furnitureSurfaces";
import { canRotateFurniture } from "../game-data/homeFurniture";
export const FurniturePlacementSchema = z.object({
  key: z.enum(["potted-myrtle", "golden-drinking-cup", "patterned-reed-chest", "fine-household-pottery-set", "painted-large-jar", "indoor-kitchen", "reed-mat", "wooden-stool", "wooden-table", "woven-basket", "woven-basket-2", "plain-jar", "clay-bowl", "clay-bowl-2"]),
  surface: z.literal("table").optional(),
  orientation: z.enum(["original", "mirrored"]).optional(),
  x: z.number().finite().min(0).max(1536), y: z.number().finite().min(0).max(1024),
}).refine(item => item.orientation !== "mirrored" || canRotateFurniture(item.key), { message: "This item cannot be rotated." }).refine(item => !item.surface || isTabletopItem(item.key), { message: "Only small tabletop items can go on the table." });
export const FurnitureLayoutSchema = z.array(FurniturePlacementSchema).max(13);
export const SaveFurnitureSchema = z.object({ revision: z.number().int().nonnegative(), items: FurnitureLayoutSchema });
