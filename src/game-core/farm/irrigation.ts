import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";

export type FarmCoordinate = {
  readonly column: number;
  readonly row: number;
};

export type IrrigationLocationValidation =
  | { readonly type: "valid" }
  | { readonly type: "outside_world" }
  | { readonly type: "river" };

export const areCardinallyAdjacent = (
  first: FarmCoordinate,
  second: FarmCoordinate
): boolean =>
  Math.abs(first.column - second.column) + Math.abs(first.row - second.row) ===
  1;

export const validateIrrigationLocation = (
  coordinate: FarmCoordinate
): IrrigationLocationValidation => {
  const { worldBounds, riverRow } = INITIAL_FARM_CONFIG;
  const isInsideWorld =
    coordinate.column >= worldBounds.minimumColumn &&
    coordinate.column <= worldBounds.maximumColumn &&
    coordinate.row >= worldBounds.minimumRow &&
    coordinate.row <= worldBounds.maximumRow;

  if (!isInsideWorld) {
    return { type: "outside_world" };
  }

  if (coordinate.row === riverRow) {
    return { type: "river" };
  }

  return { type: "valid" };
};

export const isConnectedToIrrigationSource = (
  coordinate: FarmCoordinate,
  completedCanals: readonly FarmCoordinate[]
): boolean =>
  Math.abs(coordinate.row - INITIAL_FARM_CONFIG.riverRow) === 1 ||
  completedCanals.some(canal => areCardinallyAdjacent(coordinate, canal));

const coordinateKey = (coordinate: FarmCoordinate): string =>
  `${coordinate.column}:${coordinate.row}`;

export const getRiverConnectedCanals = (
  canals: readonly FarmCoordinate[]
): readonly FarmCoordinate[] => {
  const connectedCanalKeys = new Set(
    canals
      .filter(
        canal =>
          Math.abs(canal.row - INITIAL_FARM_CONFIG.riverRow) === 1
      )
      .map(coordinateKey)
  );

  let foundConnection = true;

  while (foundConnection) {
    foundConnection = false;

    for (const canal of canals) {
      const key = coordinateKey(canal);

      if (
        !connectedCanalKeys.has(key) &&
        canals.some(
          connectedCanal =>
            connectedCanalKeys.has(coordinateKey(connectedCanal)) &&
            areCardinallyAdjacent(canal, connectedCanal)
        )
      ) {
        connectedCanalKeys.add(key);
        foundConnection = true;
      }
    }
  }

  return canals.filter(canal => connectedCanalKeys.has(coordinateKey(canal)));
};

export const areAllCanalsConnectedToRiver = (
  canals: readonly FarmCoordinate[]
): boolean => getRiverConnectedCanals(canals).length === canals.length;
