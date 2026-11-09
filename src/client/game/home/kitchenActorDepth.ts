import { furnitureDefinition, type FurniturePlacement } from "../../../game-data/homeFurniture";
import type { InteriorPoint } from "./interiorNavigation";

/** Ground-level front edge of the combined stove/table, in its local isometric axes. */
export const kitchenActorDepth = (feet: InteriorPoint, kitchen: FurniturePlacement, actorDepth: number, kitchenDepth: number) => {
  const { width, height } = furnitureDefinition(kitchen.key);
  const dx = feet.x - kitchen.x, dy = feet.y - kitchen.y;
  if (Math.abs(dx) > width / 2 + 16 || Math.abs(dy) > height / 2) return actorDepth;
  const localX = kitchen.orientation === "mirrored" ? -dx : dx;
  // The stove is left/back of the table in the original artwork. A single
  // anchor-y comparison wrongly hides people at its lower/front corner.
  return dy >= localX * .5
    ? Math.max(actorDepth, kitchenDepth + .002)
    : Math.min(actorDepth, kitchenDepth - .002);
};
