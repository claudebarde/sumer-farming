import {
  CROP_DEFINITIONS,
  type CropKey
} from "../../game-data/crops";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import {
  areCardinallyAdjacent,
  getRiverConnectedCanals,
  type FarmCoordinate
} from "./irrigation";

export type CultivationValidation =
  | { readonly type: "valid" }
  | { readonly type: "outside_arable_plot" }
  | { readonly type: "tile_occupied" }
  | {
      readonly type: "missing_seed";
      readonly requiredItem: InventoryItemKey;
    }
  | { readonly type: "not_irrigated" };

export type CultivationContext = {
  readonly target: FarmCoordinate;
  readonly crop: CropKey;
  readonly carriedItem: InventoryItemKey | null;
  readonly occupiedCoordinates: readonly FarmCoordinate[];
  readonly activeCanals: readonly FarmCoordinate[];
};

export const isInsideArablePlot = (coordinate: FarmCoordinate): boolean => {
  const { plotBounds } = INITIAL_FARM_CONFIG;

  return (
    coordinate.column >= plotBounds.minimumColumn &&
    coordinate.column <= plotBounds.maximumColumn &&
    coordinate.row >= plotBounds.minimumRow &&
    coordinate.row <= plotBounds.maximumRow
  );
};

const isSameCoordinate = (
  first: FarmCoordinate,
  second: FarmCoordinate
): boolean => first.column === second.column && first.row === second.row;

export const validateCultivation = (
  context: CultivationContext
): CultivationValidation => {
  if (!isInsideArablePlot(context.target)) {
    return { type: "outside_arable_plot" };
  }

  if (
    context.occupiedCoordinates.some(coordinate =>
      isSameCoordinate(context.target, coordinate)
    )
  ) {
    return { type: "tile_occupied" };
  }

  const requiredItem = CROP_DEFINITIONS[context.crop].seedItemKey;

  if (context.carriedItem !== requiredItem) {
    return { type: "missing_seed", requiredItem };
  }

  if (!isIrrigatedByCanals(context.target, context.activeCanals)) {
    return { type: "not_irrigated" };
  }

  return { type: "valid" };
};

export const isIrrigatedByCanals = (
  coordinate: FarmCoordinate,
  activeCanals: readonly FarmCoordinate[]
): boolean =>
  getRiverConnectedCanals(activeCanals).some(canal =>
    areCardinallyAdjacent(coordinate, canal)
  );
