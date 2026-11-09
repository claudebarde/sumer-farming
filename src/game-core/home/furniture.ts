import { furniturePosition, furnitureGroundAnchor, tabletopLayoutError } from "./furnitureSurfaces";
import { furnitureDefinition, type FurniturePlacement } from "../../game-data/homeFurniture";
import { INTERIOR_ENTRY, insideObstacle, interiorPath, type InteriorPoint } from "./interiorNavigation";
import { furnitureFloorContains, furnitureVisibleEnough, tableHasWallClearance } from "./furniturePlacement";
export const furnitureObstacles = (items: readonly FurniturePlacement[]) => items.filter(item => !item.surface).map(item => ({ ...item, ...furnitureDefinition(item.key) }));
export const furnitureLayoutError = (items: readonly FurniturePlacement[], farmer?: InteriorPoint): string | null => {
  if (new Set(items.map(i => i.key)).size !== items.length) return "This item is already placed.";
  const surfaceError = tabletopLayoutError(items);
  if (surfaceError) return surfaceError;
  for (const item of items) {
    if (!tableHasWallClearance(item)) return "Leave space between the table and the wall.";
    if (!furnitureVisibleEnough({ ...item, ...furniturePosition(item, items) }, furnitureGroundAnchor(item, items))) return "Keep enough of the item visible to select it.";
  }
  const obstacles = furnitureObstacles(items);
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]!;
    for (let step = 0; step < 24; step++) {
      const angle = step / 24 * Math.PI * 2;
      if (!furnitureFloorContains({ x: o.x + Math.cos(angle) * o.rx, y: o.y + Math.sin(angle) * o.ry })) return "Keep furniture on the floor, clear of walls and doors.";
    }
    if (obstacles.some((other, j) => j !== i && ((o.x - other.x) / (o.rx + other.rx + 8)) ** 2 + ((o.y - other.y) / (o.ry + other.ry + 8)) ** 2 < 1)) return "Leave space between items.";
    if (farmer && insideObstacle(farmer, o, 18)) return "Leave space for the farmer.";
  }
  for (const target of [{ x: 450, y: 380 }, { x: 1100, y: 460 }, { x: 750, y: 680 }, ...(farmer ? [farmer] : [])]) {
    if (!interiorPath(INTERIOR_ENTRY, target, obstacles).length) return "Keep the entrance and room walkways clear.";
  }
  return null;
};
