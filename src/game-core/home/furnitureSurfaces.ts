import { furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../game-data/homeFurniture";
import { containsPoint, type InteriorPoint } from "./interiorNavigation";

export const isTabletopItem = (key: FurnitureKey) => key === "clay-bowl" || key === "clay-bowl-2";
// Top face in the table's normalized 190×138 display frame, before mirroring.
export const TABLE_TOP = [{ x: 68, y: 3 }, { x: 188, y: 65 }, { x: 128, y: 100 }, { x: 2, y: 41 }] as const;
const tableIn = (items: readonly FurniturePlacement[]) => items.find(item => item.key === "wooden-table" && !item.surface);
export const furniturePosition = (item: FurniturePlacement, items: readonly FurniturePlacement[]): InteriorPoint => {
  if (!item.surface) return item;
  const table = tableIn(items);
  if (!table) return item; // Invalid orphan layouts are rejected before saving.
  const { width, height } = furnitureDefinition("wooden-table");
  return { x: table.x + (table.orientation === "mirrored" ? width - item.x : item.x) - width / 2,
    y: table.y + item.y - height * .78 };
};
export const furnitureGroundAnchor = (item: FurniturePlacement, items: readonly FurniturePlacement[]): InteriorPoint =>
  item.surface ? tableIn(items) ?? item : item;
export const furnitureDepth = (item: FurniturePlacement, items: readonly FurniturePlacement[]) =>
  1 + furnitureGroundAnchor(item, items).y / 2000 + (item.surface ? .0005 : 0);

/** The stored bowl coordinates are local to the original table face. */
export const furnitureAtPointer = (key: FurnitureKey, point: InteriorPoint, orientation: FurniturePlacement["orientation"], items: readonly FurniturePlacement[]): FurniturePlacement => {
  const table = tableIn(items);
  if (isTabletopItem(key) && table) {
    const { width, height } = furnitureDefinition("wooden-table");
    const x = point.x - table.x + width / 2;
    const local = { x: table.orientation === "mirrored" ? width - x : x, y: point.y - table.y + height * .78 };
    if (containsPoint(local, TABLE_TOP)) return { key, ...local, surface: "table" };
  }
  return { key, ...point, orientation };
};
export const tabletopLayoutError = (items: readonly FurniturePlacement[]): string | null => {
  const bowls = items.filter(item => item.surface);
  if (bowls.length && !tableIn(items)) return "Place the table first.";
  for (const bowl of bowls) {
    if (!isTabletopItem(bowl.key)) return "Only clay bowls can go on the table.";
    const { rx, ry } = furnitureDefinition(bowl.key);
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI * 2 / 32;
      if (!containsPoint({ x: bowl.x + Math.cos(angle) * rx, y: bowl.y + Math.sin(angle) * ry }, TABLE_TOP)) return "Keep the whole bowl on the tabletop.";
    }
    if (bowls.some(other => other.key !== bowl.key &&
      ((other.x - bowl.x) / (rx + furnitureDefinition(other.key).rx + 4)) ** 2 +
      ((other.y - bowl.y) / (ry + furnitureDefinition(other.key).ry + 4)) ** 2 < 1)) return "Leave space between bowls.";
  }
  return null;
};
export const replaceFurniture = (items: readonly FurniturePlacement[], item: FurniturePlacement): readonly FurniturePlacement[] =>
  [...items.filter(existing => existing.key !== item.key), item];
export const removeFurniture = (items: readonly FurniturePlacement[], key: FurnitureKey): readonly FurniturePlacement[] =>
  items.filter(item => item.key !== key && !(key === "wooden-table" && item.surface === "table"));
