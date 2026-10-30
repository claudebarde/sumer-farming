import { barleyHasExpired } from "../../../game-core/farm/barleyDecay";
import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { FARM_BUILDING_DEFINITIONS } from "../../../game-data/buildings";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { cropSprite } from "./cropPresentation";
import { isArableGround } from "../../../game-core/farm/land";
import { isIsometricRiverRow } from "./isometricRiver";

/** Player-approved anchor for every dropped ground item, including future goods. */
export const GROUND_ITEM_ORIGIN = { x: 0.5, y: 0.71875 } as const;

export const sameCell = (a: IsoCell, b: IsoCell) => a.column === b.column && a.row === b.row;
export const insideWorld = ({ column, row }: IsoCell) => column >= config.worldBounds.minimumColumn && column <= config.worldBounds.maximumColumn && row >= config.worldBounds.minimumRow && row <= config.worldBounds.maximumRow;
export const insidePlot = isArableGround;
export const farmOrigin = { column: config.buildingBounds.minimumColumn, row: config.buildingBounds.minimumRow };
export const buildingAt = (snapshot: FarmSnapshot, cell: IsoCell) => snapshot.buildings.find(building => {
  const size = FARM_BUILDING_DEFINITIONS[building.type].footprint;
  return footprintContains(building, size.columns, size.rows, cell);
});
export const presentCanals = (snapshot: FarmSnapshot, now: number) => snapshot.improvements.filter(i => !i.destroyCompletesAt || Date.parse(i.destroyCompletesAt) > now);
export const barleyStage = (crop: FarmSnapshot["crops"][number], now: number) => {
  if (crop.cropKey !== "barley") return null;
  if (barleyHasExpired(crop, now)) return null;
  const sprite = cropSprite(crop, now);
  if (sprite === "barleyWithering") return "withering";
  return sprite === "barleyReady" ? "ripe" : sprite === "barleyGrowing" ? "growing" : "sown";
};
/** Ripe stalks cover an actor at the same ground anchor (actor offsets are +1/+2).
 * Keep the bias below a tile step (24) so neighbouring ground anchors still sort normally. */
export const barleyDepth = (groundY: number, stage: "sown" | "growing" | "ripe" | "withering") =>
  groundY + (stage === "ripe" || stage === "withering" ? 3 : 0);
/** Ground materials cover the farmer at the same tile, including pickup/drop
 * poses (+2), without overriding depth ordering on neighbouring tiles. */
export const groundItemDepth = (groundY: number, itemKey: string) =>
  groundY + (itemKey === "reed" || itemKey === "clay" ? 3 : 1);
export const buildingNames = { granary: "Granary", warehouse: "Warehouse", brewery: "Brewery", breadOven: "Bread oven", smallShrine: "Small shrine", mill: "Mill" } as const;
export const tileInformation = (snapshot: FarmSnapshot, cell: IsoCell, now: number): string => {
  if (isIsometricRiverRow(cell.row)) return "River";
  const building = buildingAt(snapshot, cell);
  const crop = snapshot.crops.find(c => sameCell(c, cell) && !barleyHasExpired(c, now));
  const canal = presentCanals(snapshot, now).find(c => sameCell(c, cell));
  const object = snapshot.objects.find(o => sameCell(o, cell));
  const items = snapshot.groundItems.filter(i => sameCell(i, cell)).map(i => `${i.quantity} ${i.itemKey}`).join(" · ");
  const title = building ? `${buildingNames[building.type]} · ${Date.parse(building.completesAt) > now ? "Under construction" : `${building.storedBarley} barley stored`}`
    : footprintContains(farmOrigin, 2, 2, cell) ? "Farm"
    : crop ? `${crop.cropKey === "barley" ? "Barley" : crop.cropKey === "sesame" ? "Sesame" : "Date palm"} · ${crop.harvestCompletesAt ? "Harvest scheduled" : Date.parse(crop.plantedAt) > now ? "Planting scheduled" : Date.parse(crop.growthCompletesAt) <= now ? "Ready to harvest" : "Growing"}`
    : canal ? `Irrigation canal${Date.parse(canal.completesAt) > now ? " · Under construction" : ""}`
    : cell.row === config.roadRow || snapshot.farm.roads.some(r => sameCell(r, cell)) ? `Road${snapshot.farm.roads.some(r => sameCell(r, cell) && (r.completesAt ?? 0) > now) ? " · Under construction" : ""}`
    : object ? object.type === "miniatureZiggurat" ? "Miniature ziggurat" : object.type === "bush" ? "Bush" : object.type === "rock" ? "Rocks" : "Reeds"
    : insidePlot(cell) ? "Arable ground" : "Ground";
  return `${title}${items ? ` · ${items}` : ""}`;
};
