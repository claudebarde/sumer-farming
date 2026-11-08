import { z } from "zod";
export const FurniturePlacementSchema = z.object({
  key: z.enum(["reed-mat", "wooden-stool", "wooden-table", "woven-basket", "woven-basket-2", "plain-jar", "clay-bowl", "clay-bowl-2"]),
  orientation: z.enum(["original", "mirrored"]).optional(),
  x: z.number().finite().min(0).max(1536), y: z.number().finite().min(0).max(1024),
}).refine(item => item.orientation !== "mirrored" || item.key === "reed-mat" || item.key === "wooden-table", { message: "Only mats and tables can be rotated." });
export const FurnitureLayoutSchema = z.array(FurniturePlacementSchema).max(8);
export const SaveFurnitureSchema = z.object({ revision: z.number().int().nonnegative(), items: FurnitureLayoutSchema });
