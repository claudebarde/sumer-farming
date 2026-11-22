// Sizes frame the visible artwork, excluding its transparent source margins.
// The interior farmer is approximately 110 world pixels tall.
export const HOME_FURNITURE = [
  { key: "potted-myrtle", name: "Flowering myrtle", width: 110, height: 135, rx: 38, ry: 24 },
  { key: "golden-drinking-cup", name: "Golden drinking cup", width: 38, height: 34, rx: 16, ry: 10 },
  { key: "patterned-reed-chest", name: "Patterned reed chest", width: 145, height: 110, rx: 60, ry: 30 },
  { key: "fine-household-pottery-set", name: "Fine household pottery set", width: 118, height: 140, rx: 48, ry: 28 },
  { key: "painted-large-jar", name: "Painted large jar", width: 104, height: 132, rx: 42, ry: 25 },
  { key: "indoor-kitchen", name: "Kitchen", width: 250, height: 195, rx: 98, ry: 48 },
  { key: "reed-mat", name: "Sleeping mat", width: 150, height: 85, rx: 60, ry: 28 },
  { key: "wooden-stool", name: "Wooden stool", width: 68, height: 68, rx: 28, ry: 19 },
  { key: "wooden-table", name: "Wooden table", width: 190, height: 138, rx: 80, ry: 38 },
  { key: "woven-basket", name: "Woven basket", width: 65, height: 74, rx: 28, ry: 19 },
  { key: "woven-basket-2", name: "Woven basket", width: 65, height: 74, rx: 28, ry: 19 },
  { key: "plain-jar", name: "Large clay jar", width: 104, height: 132, rx: 42, ry: 25 },
  { key: "clay-bowl", name: "Small clay bowl", width: 36, height: 27, rx: 16, ry: 10 },
  { key: "clay-bowl-2", name: "Small clay bowl", width: 36, height: 27, rx: 16, ry: 10 },
] as const;
export type FurnitureKey = typeof HOME_FURNITURE[number]["key"];
export type FurniturePlacement = { readonly key: FurnitureKey; readonly x: number; readonly y: number; readonly orientation?: "original" | "mirrored"; readonly surface?: "table" };
export const furnitureDefinition = (key: FurnitureKey) => HOME_FURNITURE.find(item => item.key === key)!;

export const canRotateFurniture = (key: FurnitureKey) => key === "reed-mat" || key === "wooden-table" || key === "indoor-kitchen" || key === "patterned-reed-chest" || key === "fine-household-pottery-set";
