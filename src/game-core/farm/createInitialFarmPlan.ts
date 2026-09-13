import { farmDecorationTypes } from "../../game-data/farmObjects";
import {
  INITIAL_FARM_CONFIG,
  INITIAL_FARM_GROUND_ITEMS,
  INITIAL_FARM_INVENTORY,
  type InitialFarmObject,
  type InitialFarmPlan
} from "../../game-data/initialFarm";

type GridCoordinate = {
  readonly column: number;
  readonly row: number;
};

type RandomResult = {
  readonly value: number;
  readonly nextSeed: number;
};

const nextInteger = (
  seed: number,
  minimum: number,
  maximum: number
): RandomResult => {
  const nextSeed =
    (Math.imul(seed >>> 0, 1_664_525) + 1_013_904_223) >>> 0;

  return {
    value: minimum + (nextSeed % (maximum - minimum + 1)),
    nextSeed
  };
};

const isInsidePlot = ({ column, row }: GridCoordinate): boolean =>
  column >= INITIAL_FARM_CONFIG.plotBounds.minimumColumn &&
  column <= INITIAL_FARM_CONFIG.plotBounds.maximumColumn &&
  row >= INITIAL_FARM_CONFIG.plotBounds.minimumRow &&
  row <= INITIAL_FARM_CONFIG.plotBounds.maximumRow;

const availableObjectPositions = (): readonly GridCoordinate[] => {
  const { worldBounds, riverRow } = INITIAL_FARM_CONFIG;
  const columns =
    worldBounds.maximumColumn - worldBounds.minimumColumn + 1;
  const rows = worldBounds.maximumRow - worldBounds.minimumRow + 1;

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = worldBounds.minimumColumn + (index % columns);
    const row = worldBounds.minimumRow + Math.floor(index / columns);

    return { column, row };
  }).filter(position => position.row !== riverRow && !isInsidePlot(position));
};

const availableReedPositions = (): readonly GridCoordinate[] => {
  const { worldBounds, riverRow } = INITIAL_FARM_CONFIG;

  return Array.from(
    {
      length:
        worldBounds.maximumColumn - worldBounds.minimumColumn + 1
    },
    (_, index) => ({
      column: worldBounds.minimumColumn + index,
      row: riverRow - 1
    })
  );
};

export const createInitialFarmPlan = (seed: number): InitialFarmPlan => {
  let randomSeed = seed >>> 0;
  let remainingReedPositions = availableReedPositions();
  const objects: InitialFarmObject[] = [];

  for (
    let index = 0;
    index < INITIAL_FARM_CONFIG.reedSourceCount;
    index += 1
  ) {
    const positionResult = nextInteger(
      randomSeed,
      0,
      remainingReedPositions.length - 1
    );
    randomSeed = positionResult.nextSeed;
    const position = remainingReedPositions[positionResult.value];
    remainingReedPositions = remainingReedPositions.filter(
      (_, candidateIndex) => candidateIndex !== positionResult.value
    );

    objects.push({ type: "reeds", ...position });
  }

  let remainingPositions = availableObjectPositions().filter(
    position =>
      !objects.some(
        object =>
          object.column === position.column && object.row === position.row
      )
  );

  const countResult = nextInteger(
    randomSeed,
    INITIAL_FARM_CONFIG.objectCount.minimum,
    INITIAL_FARM_CONFIG.objectCount.maximum
  );
  randomSeed = countResult.nextSeed;

  const firstTypeResult = nextInteger(randomSeed, 0, 1);
  randomSeed = firstTypeResult.nextSeed;
  const firstTypes =
    firstTypeResult.value === 0
      ? farmDecorationTypes
      : ([farmDecorationTypes[1], farmDecorationTypes[0]] as const);

  for (let index = 0; index < countResult.value; index += 1) {
    const positionResult = nextInteger(
      randomSeed,
      0,
      remainingPositions.length - 1
    );
    randomSeed = positionResult.nextSeed;

    const position = remainingPositions[positionResult.value];
    remainingPositions = remainingPositions.filter(
      (_, candidateIndex) => candidateIndex !== positionResult.value
    );

    const guaranteedType = firstTypes[index];
    const typeResult = nextInteger(
      randomSeed,
      0,
      farmDecorationTypes.length - 1
    );
    randomSeed = typeResult.nextSeed;

    objects.push({
      type: guaranteedType ?? farmDecorationTypes[typeResult.value],
      column: position.column,
      row: position.row
    });
  }

  return {
    inventory: INITIAL_FARM_INVENTORY,
    groundItems: INITIAL_FARM_GROUND_ITEMS,
    objects
  };
};
