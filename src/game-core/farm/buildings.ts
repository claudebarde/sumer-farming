import { match } from "ts-pattern";
import { findLoadingTile, isRoad, type RoadCoordinate } from "./roads";

import {
  FARM_BUILDING_DEFINITIONS,
  FARM_BUILDING_LIMITS,
  type FarmBuildingType
} from "../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { isProgressionSignpost } from "../../game-data/progression";
import type { InventoryItemKey } from "../../game-data/inventoryItems";

export type BuildingCoordinate = {
  readonly column: number;
  readonly row: number;
};

export type BuildingPlacementRule =
  | { readonly type: "building_limit"; readonly limit: number }
  | { readonly type: "valid" }
  | { readonly type: "outside_arable_plot" }
  | { readonly type: "footprint_occupied"; readonly occupant?: "farm" }
  | { readonly type: "hands_not_empty" }
  | { readonly type: "access_blocked" }
  | { readonly type: "road_access_required" }
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

export const isInsideBuildingPlot = ({
  column,
  row
}: BuildingCoordinate): boolean => {
  const { plotBounds } = INITIAL_FARM_CONFIG;

  return (
    row !== INITIAL_FARM_CONFIG.roadRow &&
    column >= plotBounds.minimumColumn &&
    column <= plotBounds.maximumColumn &&
    row >= plotBounds.minimumRow &&
    row <= plotBounds.maximumRow
  );
};

const coordinateKey = ({ column, row }: BuildingCoordinate): string =>
  `${column}:${row}`;

export const validateBuildingPlacement = (context: {
  readonly granaryLimit?: number;
  readonly building: FarmBuildingType;
  readonly existingBuildings: readonly { readonly type: FarmBuildingType }[];
  readonly target: BuildingCoordinate;
  readonly occupiedCoordinates: ReadonlySet<string>;
  readonly carriedItem: InventoryItemKey | null;
  readonly availableMaterials: Readonly<Partial<Record<InventoryItemKey, number>>>;
  readonly roads?: readonly RoadCoordinate[];
  readonly reservedLoadingTiles?: readonly RoadCoordinate[];
}): BuildingPlacementRule => {
  const limit = context.building === "granary" ? (context.granaryLimit ?? FARM_BUILDING_LIMITS.granary) : FARM_BUILDING_LIMITS[context.building];
  if (limit !== undefined && context.existingBuildings.filter(building => building.type === context.building).length >= limit) {
    return { type: "building_limit", limit };
  }
  const footprint = getBuildingFootprint(context.building, context.target);

  if (footprint.some(isProgressionSignpost)) {
    return { type: "footprint_occupied" };
  }

  if (!footprint.every(isInsideBuildingPlot)) {
    return { type: "outside_arable_plot" };
  }

  const farm = INITIAL_FARM_CONFIG.buildingBounds;
  if (footprint.some(p => p.column >= farm.minimumColumn && p.column <= farm.maximumColumn &&
    p.row >= farm.minimumRow && p.row <= farm.maximumRow)) {
    return { type: "footprint_occupied", occupant: "farm" };
  }

  if (
    footprint.some(coordinate =>
      context.occupiedCoordinates.has(coordinateKey(coordinate)) || isRoad(coordinate, context.roads ?? []) || context.roads?.some(r => coordinateKey(r) === coordinateKey(coordinate))
    )
  ) {
    return { type: "footprint_occupied" };
  }

  if (context.carriedItem !== null) {
    return { type: "hands_not_empty" };
  }

  if (!findLoadingTile(footprint, context.roads ?? [], context.reservedLoadingTiles ?? [], context.occupiedCoordinates)) {
    return { type: "road_access_required" };
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
    .with({ type: "building_limit" }, ({ limit }) => `Building limit reached (${limit}), including buildings under construction.`)
    .with({ type: "access_blocked" }, () => "Keep a clear path for the farmer and access to every building.")
    .with({ type: "road_access_required" }, () => "Build beside a connected road, with a free road tile for this building's loading point.")
    .with(
      { type: "outside_arable_plot" },
      () => "The building must fit entirely inside the 8×9 arable plot."
    )
    .with(
      { type: "footprint_occupied" },
      rule => rule.occupant === "farm"
        ? "This placement overlaps the Farm's 2×2 footprint. Move the building to four empty arable tiles."
        : "All four arable tiles must be empty."
    )
    .with(
      { type: "hands_not_empty" },
      () => "The farmer must have empty hands before construction."
    )
    .with(
      { type: "missing_material" },
      ({ itemKey, required, available }) =>
        `The building needs ${required} ${itemKey === "bakingTools" ? "baking tools" : itemKey === "brewingVessels" ? (required === 1 ? "brewing jar" : "brewing jars") : itemKey}; only ${available} available.`
    )
    .exhaustive();
