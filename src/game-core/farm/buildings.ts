import { match } from "ts-pattern";

import {
  FARM_BUILDING_DEFINITIONS,
  type FarmBuildingType
} from "../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { InventoryItemKey } from "../../game-data/inventoryItems";

export type BuildingCoordinate = {
  readonly column: number;
  readonly row: number;
};

export type BuildingPlacementRule =
  | { readonly type: "valid" }
  | { readonly type: "outside_arable_plot" }
  | { readonly type: "footprint_occupied" }
  | { readonly type: "hands_not_empty" }
  | { readonly type: "access_blocked" }
  | {
      readonly type: "missing_material";
      readonly itemKey: InventoryItemKey;
      readonly required: number;
      readonly available: number;
    };

export const getBuildingFootprint = (
  building: FarmBuildingType,
  target: BuildingCoordinate
): readonly BuildingCoordinate[] => {
  const { columns, rows } = FARM_BUILDING_DEFINITIONS[building].footprint;

  return Array.from({ length: columns * rows }, (_, index) => ({
    column: target.column + (index % columns),
    row: target.row + Math.floor(index / columns)
  }));
};

const isInsideArablePlot = ({
  column,
  row
}: BuildingCoordinate): boolean => {
  const { plotBounds } = INITIAL_FARM_CONFIG;

  return (
    column >= plotBounds.minimumColumn &&
    column <= plotBounds.maximumColumn &&
    row >= plotBounds.minimumRow &&
    row <= plotBounds.maximumRow
  );
};

const coordinateKey = ({ column, row }: BuildingCoordinate): string =>
  `${column}:${row}`;

export const validateBuildingPlacement = (context: {
  readonly building: FarmBuildingType;
  readonly target: BuildingCoordinate;
  readonly occupiedCoordinates: ReadonlySet<string>;
  readonly carriedItem: InventoryItemKey | null;
  readonly availableMaterials: Readonly<Partial<Record<InventoryItemKey, number>>>;
}): BuildingPlacementRule => {
  const footprint = getBuildingFootprint(context.building, context.target);

  if (!footprint.every(isInsideArablePlot)) {
    return { type: "outside_arable_plot" };
  }

  if (
    footprint.some(coordinate =>
      context.occupiedCoordinates.has(coordinateKey(coordinate))
    )
  ) {
    return { type: "footprint_occupied" };
  }

  if (context.carriedItem !== null) {
    return { type: "hands_not_empty" };
  }

  const materials = FARM_BUILDING_DEFINITIONS[context.building].materials;

  for (const [itemKey, required] of Object.entries(materials) as [
    InventoryItemKey,
    number
  ][]) {
    const available = context.availableMaterials[itemKey] ?? 0;

    if (available < required) {
      return { type: "missing_material", itemKey, required, available };
    }
  }

  return { type: "valid" };
};

export const describeBuildingPlacementRule = (
  rule: Exclude<BuildingPlacementRule, { readonly type: "valid" }>
): string =>
  match(rule)
    .with({ type: "access_blocked" }, () => "Keep a clear path for the farmer and access to every building.")
    .with(
      { type: "outside_arable_plot" },
      () => "The building must fit entirely inside the 8×8 arable plot."
    )
    .with(
      { type: "footprint_occupied" },
      () => "All four arable tiles must be empty."
    )
    .with(
      { type: "hands_not_empty" },
      () => "The farmer must have empty hands before construction."
    )
    .with(
      { type: "missing_material" },
      ({ itemKey, required, available }) =>
        `The building needs ${required} ${itemKey === "brewingVessels" ? (required === 1 ? "brewing jar" : "brewing jars") : itemKey}; only ${available} available.`
    )
    .exhaustive();
