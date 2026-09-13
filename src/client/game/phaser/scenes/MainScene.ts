import Phaser from "phaser";
import { match } from "ts-pattern";
import { colors } from "../../../styles/colorPalette";
import { FARM_SPRITES, spriteName } from "../../../../assets/farmSprites";
import farmSpritesUrl from "../../../../assets/sprites.png";
import { TILE_SIZE } from "../config";
import { calculateGameplayTilePosition, translateTilePosition } from "../grid";
import type { GridSize, Tile, TilePosition } from "../types";
import { handlePointerUp } from "../game";
import {
  gridStore,
  type GridCoordinate,
  type GridEntry
} from "../../../stores/gridStore";
import {
  farmerCommandStore,
  type FarmerCommand,
  type FarmerStatus
} from "../../../stores/farmerCommandStore";
import type { FarmSnapshot } from "../../../../schemas/farm";
import { executeGameCommand } from "../../../api/gameActions";
import { farmStore } from "../../../stores/farmStore";
import { interactionStore } from "../../../stores/interactionStore";
import { buildingPlacementStore } from "../../../stores/buildingPlacementStore";
import { marketUiStore } from "../../../stores/marketUiStore";
import {
  FARMER_CARRY_CAPACITY,
  FARM_STORAGE_CAPACITY
} from "../../../../game-data/storage";
import type { GatherableResourceKey } from "../../../../game-data/resources";
import type { InventoryItemKey } from "../../../../game-data/inventoryItems";
import { FARM_BUILDING_DEFINITIONS } from "../../../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../../../game-data/initialFarm";
import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../../../game-data/household";
import {
  describeBuildingPlacementRule,
  getBuildingFootprint,
  validateBuildingPlacement,
  type BuildingPlacementRule
} from "../../../../game-core/farm/buildings";

const FARM_SPRITES_TEXTURE_KEY = "farm-sprites";
const INITIAL_FARM_SIZE = 8;
const FARM_BUILDING_SIZE = {
  columns: 2,
  rows: 2
} as const;
const GROUND_DEPTH = 0;
const RIVER_DEPTH = 1;
const IRRIGATION_DEPTH = 2;
const FARM_DEPTH = 2;
const DECORATION_DEPTH = 2;
const CROP_DEPTH = 3;
const BUILDING_DEPTH = 3;
const ACTOR_DEPTH = 4;
const MARKET_SIGN_ROW = 2;
const FARMER_MOVE_DURATION_PER_TILE = 180;
const BOTTOM_DIALOG_DURATION = 2_000;
const gameplayWidth = INITIAL_FARM_SIZE * TILE_SIZE;
const gameplayHeight = INITIAL_FARM_SIZE * TILE_SIZE;

type LocalTilePosition = Pick<TilePosition, "column" | "row">;
type PixelPosition = {
  readonly x: number;
  readonly y: number;
};
type CardinalDirection = "up" | "down" | "left" | "right";
type InspectCommand = Extract<FarmerCommand, { readonly type: "inspect" }>;
type BuildCommand = Extract<FarmerCommand, { readonly type: "build" }>;
type GranaryBuildCommand = BuildCommand & { readonly build: "granary" };
type DestroyCommand = Extract<FarmerCommand, { readonly type: "destroy" }>;
type PlantCommand = Extract<FarmerCommand, { readonly type: "plant" }>;
type HarvestCommand = Extract<FarmerCommand, { readonly type: "harvest" }>;
type GatherCommand = Extract<FarmerCommand, { readonly type: "gather" }>;
type FarmItemCommand = Extract<
  FarmerCommand,
  { readonly type: "pickup" | "drop" | "deposit" | "withdraw" }
>;
type MovementCommand = Extract<
  FarmerCommand,
  {
    readonly type:
      | "inspect"
      | "build"
      | "destroy"
      | "pickup"
      | "drop"
      | "deposit"
      | "withdraw"
      | "plant"
      | "harvest"
      | "gather";
  }
>;
type FarmerMovementOutcome =
  | { readonly type: "arrived" }
  | { readonly type: "blocked"; readonly reason: string };
const CARDINAL_STEPS: readonly GridCoordinate[] = [
  { column: 1, row: 0 },
  { column: -1, row: 0 },
  { column: 0, row: 1 },
  { column: 0, row: -1 }
];

const createTile = (position: TilePosition, type: Tile["type"]): Tile => ({
  id: `${position.column}:${position.row}`,
  position,
  type
});

const toCoordinateKey = ({ column, row }: GridCoordinate): string =>
  `${column}:${row}`;

const toTilePosition = ({ column, row }: GridCoordinate): TilePosition => ({
  column,
  row,
  posX: column * TILE_SIZE,
  posY: row * TILE_SIZE
});

const constrainTargetToRiverBank = (
  start: TilePosition,
  target: TilePosition,
  riverRow: number
):
  | { readonly type: "reachable"; readonly position: TilePosition }
  | { readonly type: "blocked"; readonly position: TilePosition } => {
  const crossesRiverDownward = start.row < riverRow && target.row > riverRow;
  const crossesRiverUpward = start.row > riverRow && target.row < riverRow;

  if (!crossesRiverDownward && !crossesRiverUpward) {
    return { type: "reachable", position: target };
  }

  const bankRow = crossesRiverDownward ? riverRow - 1 : riverRow + 1;

  return {
    type: "blocked",
    position: toTilePosition({ column: target.column, row: bankRow })
  };
};

const getCardinalDirection = (
  currentPosition: GridCoordinate,
  targetPosition: GridCoordinate
): CardinalDirection | null => {
  const rowDifference = targetPosition.row - currentPosition.row;

  if (rowDifference !== 0) {
    return rowDifference > 0 ? "down" : "up";
  }

  const columnDifference = targetPosition.column - currentPosition.column;

  if (columnDifference !== 0) {
    return columnDifference > 0 ? "right" : "left";
  }

  return null;
};

const findCardinalPath = (
  start: GridCoordinate,
  target: GridCoordinate,
  gridSize: GridSize,
  blockedCoordinates: ReadonlySet<string>
): readonly GridCoordinate[] | null => {
  const startKey = toCoordinateKey(start);
  const targetKey = toCoordinateKey(target);

  if (blockedCoordinates.has(targetKey)) {
    return null;
  }

  const queue: GridCoordinate[] = [start];
  const previousByCoordinate = new Map<string, GridCoordinate | null>([
    [startKey, null]
  ]);

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
    const current = queue[queueIndex];

    if (current === undefined) {
      continue;
    }

    if (toCoordinateKey(current) === targetKey) {
      const reversedPath: GridCoordinate[] = [];
      let cursor: GridCoordinate | null = current;

      while (cursor !== null) {
        reversedPath.push(cursor);
        cursor = previousByCoordinate.get(toCoordinateKey(cursor)) ?? null;
      }

      return reversedPath.reverse();
    }

    for (const step of CARDINAL_STEPS) {
      const neighbor = {
        column: current.column + step.column,
        row: current.row + step.row
      };
      const neighborKey = toCoordinateKey(neighbor);
      const isInsideGrid =
        neighbor.column >= 0 &&
        neighbor.column < gridSize.columns &&
        neighbor.row >= 0 &&
        neighbor.row < gridSize.rows;

      if (
        isInsideGrid &&
        !blockedCoordinates.has(neighborKey) &&
        !previousByCoordinate.has(neighborKey)
      ) {
        previousByCoordinate.set(neighborKey, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
};

const findNearestAvailableTile = (
  start: GridCoordinate,
  gridSize: GridSize,
  isAvailable: (coordinate: GridCoordinate) => boolean
): TilePosition | null => {
  const queue: GridCoordinate[] = [start];
  const visited = new Set<string>([toCoordinateKey(start)]);

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];

    if (current === undefined) {
      continue;
    }

    if (isAvailable(current)) {
      return toTilePosition(current);
    }

    for (const step of CARDINAL_STEPS) {
      const neighbor = {
        column: current.column + step.column,
        row: current.row + step.row
      };
      const neighborKey = toCoordinateKey(neighbor);
      const isInsideGrid =
        neighbor.column >= 0 &&
        neighbor.column < gridSize.columns &&
        neighbor.row >= 0 &&
        neighbor.row < gridSize.rows;

      if (isInsideGrid && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }
  }

  return null;
};

const getFarmerDestination = (
  targetPosition: TilePosition,
  direction: CardinalDirection
): PixelPosition => {
  const tileX = targetPosition.column * TILE_SIZE;
  const tileY = targetPosition.row * TILE_SIZE;
  const halfTile = TILE_SIZE / 2;

  return match(direction)
    .with("up", () => ({ x: tileX, y: tileY + halfTile }))
    .with("down", () => ({ x: tileX, y: tileY - halfTile }))
    .with("left", () => ({ x: tileX + halfTile, y: tileY }))
    .with("right", () => ({ x: tileX - halfTile, y: tileY }))
    .exhaustive();
};

type FarmerWaypoint = PixelPosition & {
  readonly gridPosition?: GridCoordinate;
};

const createMovementWaypoints = (
  start: PixelPosition,
  path: readonly GridCoordinate[],
  destination: PixelPosition
): readonly FarmerWaypoint[] => {
  const candidates: readonly FarmerWaypoint[] = [
    ...path.slice(0, -1).map(position => ({
      x: position.column * TILE_SIZE,
      y: position.row * TILE_SIZE,
      gridPosition: position
    })),
    destination
  ];

  return candidates.filter((waypoint, index) => {
    const previous = candidates[index - 1] ?? start;
    return waypoint.x !== previous.x || waypoint.y !== previous.y;
  });
};

const getFarmObjectSprite = (
  type: FarmSnapshot["objects"][number]["type"]
): "rocks" | "bush" | "reeds" =>
  match(type)
    .with("rock", () => spriteName("rocks"))
    .with("bush", () => spriteName("bush"))
    .with("reeds", () => spriteName("reeds"))
    .exhaustive();

const getCropSprite = (
  crop: FarmSnapshot["crops"][number],
  currentTime: number
): "barleySeeded" | "barleyGrowing" | "barleyReady" | null => {
  const plantedAt = Date.parse(crop.plantedAt);
  const growthCompletesAt = Date.parse(crop.growthCompletesAt);
  const growingAt = plantedAt + (growthCompletesAt - plantedAt) / 3;

  if (currentTime < plantedAt) {
    return null;
  }

  return match(crop.cropKey)
    .with("barley", () =>
      currentTime >= growthCompletesAt
        ? "barleyReady"
        : currentTime >= growingAt
          ? "barleyGrowing"
          : "barleySeeded"
    )
    .exhaustive();
};

const getNextCropTransition = (
  crop: FarmSnapshot["crops"][number],
  currentTime: number
): number | null => {
  const plantedAt = Date.parse(crop.plantedAt);
  const growthCompletesAt = Date.parse(crop.growthCompletesAt);
  const growingAt = plantedAt + (growthCompletesAt - plantedAt) / 3;

  if (currentTime < plantedAt) {
    return plantedAt;
  }

  if (currentTime < growingAt) {
    return growingAt;
  }

  return currentTime < growthCompletesAt ? growthCompletesAt : null;
};

const getIrrigationSprite = (
  improvement: FarmSnapshot["improvements"][number],
  improvements: FarmSnapshot["improvements"],
  riverRow: number
): "canalHorizontal" | "canalVertical" | "canalCross" => {
  const connectedCoordinates = [
    ...improvements.map(({ column, row }) => ({ column, row })),
    { column: improvement.column, row: riverRow }
  ];
  const hasHorizontalConnection = connectedCoordinates.some(
    coordinate =>
      coordinate.row === improvement.row &&
      Math.abs(coordinate.column - improvement.column) === 1
  );
  const hasVerticalConnection = connectedCoordinates.some(
    coordinate =>
      coordinate.column === improvement.column &&
      Math.abs(coordinate.row - improvement.row) === 1
  );

  if (hasHorizontalConnection && hasVerticalConnection) {
    return "canalCross";
  }

  return hasHorizontalConnection ? "canalHorizontal" : "canalVertical";
};

const isIrrigationVisible = (
  improvement: FarmSnapshot["improvements"][number],
  currentTime: number
): boolean =>
  improvement.destroyCompletesAt === null ||
  Date.parse(improvement.destroyCompletesAt) > currentTime;

export class MainScene extends Phaser.Scene {
  private farmSnapshot: FarmSnapshot;

  constructor(farmSnapshot: FarmSnapshot) {
    super("main-scene");
    this.farmSnapshot = farmSnapshot;
  }

  preload(): void {
    this.load.image(FARM_SPRITES_TEXTURE_KEY, farmSpritesUrl);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(colors.soil);

    // CREATES THE SELECTION HIGHLIGHT
    const selectionHighlight = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xe6a11b, 0.25)
      .setOrigin(0)
      .setStrokeStyle(3, 0xffd45a)
      .setDepth(ACTOR_DEPTH + 1)
      .setVisible(false);

    // LAYS THE GROUND TILES
    const texture = this.textures.get(FARM_SPRITES_TEXTURE_KEY);

    for (const [name, frame] of Object.entries(FARM_SPRITES)) {
      texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
    }

    const groundTiles = this.add.group();
    let groundTileData: readonly Tile[] = [];

    const renderGround = (): void => {
      groundTiles.clear(true, true);

      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const rows = Math.ceil(this.scale.height / TILE_SIZE);
      const nextGroundTileData: Tile[] = [];

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const ground = this.add
            .image(
              column * TILE_SIZE,
              row * TILE_SIZE,
              FARM_SPRITES_TEXTURE_KEY,
              spriteName("ground")
            )
            .setOrigin(0)
            .setDisplaySize(TILE_SIZE, TILE_SIZE)
            .setDepth(GROUND_DEPTH)
            .setInteractive();
          // sets interaction with ground tiles
          const tile = createTile(
            {
              column: column,
              row: row,
              posX: column * TILE_SIZE,
              posY: row * TILE_SIZE
            },
            "ground"
          );
          ground.on(Phaser.Input.Events.POINTER_UP, () => {
            handlePointerUp(tile, selectionHighlight);
          });

          nextGroundTileData.push(tile);
          groundTiles.add(ground);
        }
      }

      groundTileData = nextGroundTileData;
    };

    renderGround();

    // LAYS THE INITIAL 8X8 GROUND VARIANT TILES
    const farmTiles = this.add.container(0, 0).setDepth(FARM_DEPTH);
    let farmPosition = calculateGameplayTilePosition(
      Math.ceil(this.scale.width / TILE_SIZE),
      INITIAL_FARM_SIZE
    );
    const farmTilePositions: LocalTilePosition[] = [];

    for (let row = 0; row < INITIAL_FARM_SIZE; row++) {
      for (let column = 0; column < INITIAL_FARM_SIZE; column++) {
        const localPosition = { column, row } as const;
        const farmTile = this.add
          .image(
            column * TILE_SIZE,
            row * TILE_SIZE,
            FARM_SPRITES_TEXTURE_KEY,
            spriteName("groundVariant")
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setInteractive();

        // set interaction with farm tiles
        farmTile.on(Phaser.Input.Events.POINTER_UP, () => {
          const position = translateTilePosition(farmPosition, localPosition);
          const farmTileData = createTile(position, "groundVariant");
          handlePointerUp(farmTileData, selectionHighlight);
        });

        farmTilePositions.push(localPosition);
        farmTiles.add(farmTile);
      }
    }

    const farmBuildingPosition = calculateGameplayTilePosition(
      INITIAL_FARM_SIZE,
      FARM_BUILDING_SIZE.columns
    );
    const initialFarmerPosition: TilePosition = {
      column: farmBuildingPosition.column + FARM_BUILDING_SIZE.columns,
      row: farmBuildingPosition.row,
      posX:
        (farmBuildingPosition.column + FARM_BUILDING_SIZE.columns) * TILE_SIZE,
      posY: farmBuildingPosition.row * TILE_SIZE
    };

    const farmBuilding = this.add
      .image(
        farmBuildingPosition.column * TILE_SIZE,
        farmBuildingPosition.row * TILE_SIZE,
        FARM_SPRITES_TEXTURE_KEY,
        spriteName("farm")
      )
      .setOrigin(0)
      .setDisplaySize(
        FARM_BUILDING_SIZE.columns * TILE_SIZE,
        FARM_BUILDING_SIZE.rows * TILE_SIZE
      )
      .setInteractive();

    const getFarmBuildingTile = (): Tile =>
      createTile(
        translateTilePosition(farmPosition, farmBuildingPosition),
        "farm"
      );

    farmBuilding.on(Phaser.Input.Events.POINTER_UP, () => {
      handlePointerUp(getFarmBuildingTile(), selectionHighlight);
    });

    farmTiles.add(farmBuilding);

    const positionFarm = (): void => {
      const containerColumns = Math.ceil(this.scale.width / TILE_SIZE);
      farmPosition = calculateGameplayTilePosition(
        containerColumns,
        INITIAL_FARM_SIZE
      );

      farmTiles.setPosition(
        farmPosition.column * TILE_SIZE,
        farmPosition.row * TILE_SIZE
      );
    };

    const boundary = this.add.graphics();

    boundary
      .lineStyle(4, 0xe6a11b, 1)
      .strokeRect(0, 0, gameplayWidth, gameplayHeight);

    farmTiles.add(boundary);

    positionFarm();

    // PLACES THE MARKET SIGN ON THE RIGHT EDGE OF THE VISIBLE GRID
    const marketSign = this.add
      .image(0, 0, FARM_SPRITES_TEXTURE_KEY, spriteName("signpost"))
      .setDisplaySize(TILE_SIZE * 0.8, TILE_SIZE * 1.5)
      .setDepth(ACTOR_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    const marketSignLabel = this.add
      .text(0, 0, "Market", {
        color: colors.ink,
        fontFamily: '"Bree Serif", Georgia, serif',
        fontSize: "11px"
      })
      .setOrigin(0.5)
      .setDepth(ACTOR_DEPTH + 2);

    const positionMarketSign = (): void => {
      const rows = Math.max(1, Math.ceil(this.scale.height / TILE_SIZE));
      const maximumRow = Math.max(0, rows - 2);
      const preferredRow = Math.min(MARKET_SIGN_ROW, maximumRow);
      const tileCenterX = Math.max(
        TILE_SIZE / 2,
        this.scale.width - TILE_SIZE / 2
      );
      const signColumn = Math.floor(tileCenterX / TILE_SIZE);
      const occupiedRows = new Set(
        this.farmSnapshot.objects
          .filter(object => object.type === "rock" || object.type === "bush")
          .filter(object => farmPosition.column + object.column === signColumn)
          .map(object => farmPosition.row + object.row)
      );
      const row =
        Array.from(
          { length: maximumRow - preferredRow + 1 },
          (_, offset) => preferredRow + offset
        ).find(candidateRow => !occupiedRows.has(candidateRow)) ?? preferredRow;
      const tileCenterY = row * TILE_SIZE + TILE_SIZE / 2;

      marketSign.setPosition(tileCenterX, tileCenterY);
      marketSignLabel.setPosition(tileCenterX, tileCenterY - TILE_SIZE * 0.2);
    };

    marketSign.on(
      Phaser.Input.Events.POINTER_UP,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        selectionHighlight.setVisible(false);
        interactionStore.getState().clearSelection();
        marketUiStore.getState().openMarket();
      }
    );

    positionMarketSign();

    // DISPLAYS THE QUANTITY STORED INSIDE THE FARM BUILDING
    const farmInventoryChipElement = document.createElement("div");
    farmInventoryChipElement.className = "farm-inventory-chip";
    farmInventoryChipElement.setAttribute("aria-label", "Farm barley storage");
    const farmInventoryChip = this.add
      .dom(0, 0, farmInventoryChipElement)
      .setOrigin(0.5, 0)
      .setDepth(ACTOR_DEPTH + 1);

    const getStoredBarleyQuantity = (): number =>
      this.farmSnapshot.inventory.find(item => item.itemKey === "barley")
        ?.quantity ?? 0;

    const updateFarmInventoryChip = (): void => {
      const quantity = getStoredBarleyQuantity();
      const capacity = FARM_STORAGE_CAPACITY;
      farmInventoryChipElement.textContent = `${quantity} barley`;
      farmInventoryChipElement.title = `${quantity} of ${capacity} farm storage slots used`;
      farmInventoryChipElement.classList.toggle(
        "is-full",
        quantity >= capacity
      );
      farmInventoryChip
        .setPosition(
          (farmPosition.column + farmBuildingPosition.column + 1) * TILE_SIZE,
          (farmPosition.row + farmBuildingPosition.row) * TILE_SIZE + 6
        )
        .setVisible(quantity > 0)
        .updateSize();
    };

    updateFarmInventoryChip();

    // DRAWS SERVER-PERSISTED ITEMS LYING ON FARM TILES
    const groundItemTiles = this.add.group();
    let groundItemTileData: readonly Tile[] = [];

    const renderGroundItems = (): void => {
      groundItemTiles.clear(true, true);
      const nextGroundItemTileData: Tile[] = [];

      this.farmSnapshot.groundItems.forEach(item => {
        const position = translateTilePosition(farmPosition, item);
        const tileType = match(item.itemKey)
          .with("barley", () => spriteName("harvestedBarley"))
          .with("reed", () => spriteName("reedBundle"))
          .with("clay", () => spriteName("brickPile"))
          .exhaustive();
        const tile = createTile(position, tileType);
        const image = this.add
          .image(
            position.posX,
            position.posY,
            FARM_SPRITES_TEXTURE_KEY,
            tileType
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(CROP_DEPTH)
          .setInteractive();

        image.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(tile, selectionHighlight);
        });

        groundItemTiles.add(image);
        nextGroundItemTileData.push(tile);
      });

      groundItemTileData = nextGroundItemTileData;
    };

    renderGroundItems();

    // DRAWS SERVER-PERSISTED CROPS AND DERIVES THEIR VISUAL GROWTH STAGE
    const cropTiles = this.add.group();
    let cropTileData: readonly Tile[] = [];
    let cropGrowthTimers: number[] = [];
    let rebuildGridAfterCropChange = (): void => undefined;

    const renderCrops = (): void => {
      cropTiles.clear(true, true);
      cropGrowthTimers.forEach(timer => window.clearTimeout(timer));
      cropGrowthTimers = [];
      const currentTime = Date.now();
      const nextCropTileData: Tile[] = [];

      this.farmSnapshot.crops.forEach(crop => {
        const position = translateTilePosition(farmPosition, crop);
        const tileType = getCropSprite(crop, currentTime);
        const nextTransition = getNextCropTransition(crop, currentTime);

        if (nextTransition !== null) {
          cropGrowthTimers.push(
            window.setTimeout(() => {
              renderCrops();
              rebuildGridAfterCropChange();
            }, Math.max(0, nextTransition - currentTime))
          );
        }

        if (tileType === null) {
          return;
        }

        const tile = createTile(position, tileType);
        const image = this.add
          .image(
            position.posX,
            position.posY,
            FARM_SPRITES_TEXTURE_KEY,
            spriteName(tileType)
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(CROP_DEPTH)
          .setInteractive();

        image.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(tile, selectionHighlight);
        });

        cropTiles.add(image);
        nextCropTileData.push(tile);
        interactionStore.getState().refreshSelectedTile(tile);
      });

      cropTileData = nextCropTileData;
    };

    renderCrops();

    // DRAWS A RIVER ON THE 11TH ROW
    const riverRow: number = 10; // 11th row (0-indexed)
    const riverTiles = this.add.group();
    let waterTileData: readonly Tile[] = [];

    const renderRiver = (): void => {
      riverTiles.clear(true, true);

      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const nextWaterTileData: Tile[] = [];

      for (let column = 0; column < columns; column++) {
        const waterImage = this.add
          .image(
            column * TILE_SIZE,
            riverRow * TILE_SIZE,
            FARM_SPRITES_TEXTURE_KEY,
            spriteName("water")
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(RIVER_DEPTH)
          .setInteractive();

        const waterTile = createTile(
          {
            column: column,
            row: riverRow,
            posX: column * TILE_SIZE,
            posY: riverRow * TILE_SIZE
          },
          "water"
        );
        // sets interaction for the river tile
        waterImage.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(waterTile, selectionHighlight);
        });

        nextWaterTileData.push(waterTile);
        riverTiles.add(waterImage);
      }

      waterTileData = nextWaterTileData;
    };

    renderRiver();

    // DRAWS SERVER-PERSISTED IRRIGATION CANALS
    const irrigationTiles = this.add.group();
    let irrigationCompletionTimers: Phaser.Time.TimerEvent[] = [];
    let rebuildGridAfterIrrigationChange = (): void => undefined;

    const renderIrrigation = (): void => {
      irrigationTiles.clear(true, true);
      irrigationCompletionTimers.forEach(timer => timer.remove(false));
      irrigationCompletionTimers = [];

      const currentTime = Date.now();

      const visibleImprovements = this.farmSnapshot.improvements.filter(
        improvement => isIrrigationVisible(improvement, currentTime)
      );

      visibleImprovements.forEach(improvement => {
        const sprite = getIrrigationSprite(
          improvement,
          visibleImprovements,
          riverRow
        );
        const position = translateTilePosition(farmPosition, improvement);
        const completesAt = Date.parse(improvement.completesAt);
        const isComplete = completesAt <= currentTime;
        const destroyCompletesAt =
          improvement.destroyCompletesAt === null
            ? null
            : Date.parse(improvement.destroyCompletesAt);
        const isBeingDestroyed = destroyCompletesAt !== null;
        const irrigationTile = this.add
          .image(
            position.posX,
            position.posY,
            FARM_SPRITES_TEXTURE_KEY,
            spriteName(sprite)
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(IRRIGATION_DEPTH)
          .setAlpha(isComplete && !isBeingDestroyed ? 1 : 0.55)
          .setInteractive();

        irrigationTile.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(createTile(position, sprite), selectionHighlight);
        });

        irrigationTiles.add(irrigationTile);

        const nextTransitionAt = isBeingDestroyed
          ? destroyCompletesAt
          : isComplete
            ? null
            : completesAt;

        if (nextTransitionAt !== null) {
          irrigationCompletionTimers.push(
            this.time.delayedCall(nextTransitionAt - currentTime, () => {
              renderIrrigation();
              rebuildGridAfterIrrigationChange();
            })
          );
        }
      });
    };

    renderIrrigation();

    // DRAWS SERVER-PERSISTED PLAYER BUILDINGS
    const buildingTiles = this.add.group();
    let buildingTileData: readonly Tile[] = [];
    let buildingCompletionTimers: number[] = [];
    let rebuildGridAfterBuildingChange = (): void => undefined;

    const renderBuildings = (): void => {
      buildingTiles.clear(true, true);
      buildingCompletionTimers.forEach(timer => window.clearTimeout(timer));
      buildingCompletionTimers = [];
      const currentTime = Date.now();
      const nextBuildingTileData: Tile[] = [];

      this.farmSnapshot.buildings.forEach(building => {
        const position = translateTilePosition(farmPosition, building);
        const completesAt = Date.parse(building.completesAt);
        const isComplete = completesAt <= currentTime;
        const tile = createTile(position, spriteName(building.type));
        const image = this.add
          .image(
            position.posX,
            position.posY,
            FARM_SPRITES_TEXTURE_KEY,
            spriteName(building.type)
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
          .setDepth(BUILDING_DEPTH)
          .setAlpha(isComplete ? 1 : 0.55)
          .setInteractive();

        image.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(tile, selectionHighlight);
        });

        const inventoryChipElement = document.createElement("div");
        inventoryChipElement.className = "farm-inventory-chip";
        inventoryChipElement.setAttribute(
          "aria-label",
          "Granary barley storage"
        );
        inventoryChipElement.textContent = `${building.storedBarley} barley`;
        inventoryChipElement.title = `${building.storedBarley} of ${FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus} granary storage slots used`;
        inventoryChipElement.classList.toggle(
          "is-full",
          building.storedBarley >=
            FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus
        );
        const inventoryChip = this.add
          .dom(
            position.posX + TILE_SIZE,
            position.posY + 6,
            inventoryChipElement
          )
          .setOrigin(0.5, 0)
          .setDepth(ACTOR_DEPTH + 1)
          .setVisible(isComplete && building.storedBarley > 0)
          .updateSize();

        if (!isComplete) {
          buildingCompletionTimers.push(
            window.setTimeout(() => {
              renderBuildings();
              rebuildGridAfterBuildingChange();
              updateFarmInventoryChip();
              farmStore.getState().setReady(this.farmSnapshot);
            }, Math.max(0, completesAt - currentTime))
          );
        }

        buildingTiles.addMultiple([image, inventoryChip]);
        nextBuildingTileData.push(tile);
        interactionStore.getState().refreshSelectedTile(tile);
      });

      buildingTileData = nextBuildingTileData;
    };

    renderBuildings();

    // DRAWS RANDOM ROCKS AND BUSHES ON GROUND OUTSIDE THE FARM AND RIVER
    const groundDecorations = this.add.group();
    let farmObjectTileData: readonly Tile[] = [];

    const renderGroundDecorations = (): void => {
      groundDecorations.clear(true, true);
      const nextFarmObjectTileData: Tile[] = [];

      this.farmSnapshot.objects.forEach(object => {
        const position = translateTilePosition(farmPosition, object);
        const sprite = getFarmObjectSprite(object.type);
        const image = this.add
          .image(
            position.posX,
            position.posY,
            FARM_SPRITES_TEXTURE_KEY,
            sprite
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(DECORATION_DEPTH);
        const tile = createTile(position, sprite);

        if (object.type === "reeds") {
          image.setInteractive();
          image.on(Phaser.Input.Events.POINTER_UP, () => {
            handlePointerUp(tile, selectionHighlight);
          });
        }

        groundDecorations.add(image);
        nextFarmObjectTileData.push(tile);
      });

      farmObjectTileData = nextFarmObjectTileData;
    };

    renderGroundDecorations();

    const resolveInitialFarmerPosition = (): TilePosition => {
      const preferredPosition = translateTilePosition(
        farmPosition,
        initialFarmerPosition
      );
      const blockedCoordinates = new Set<string>();
      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const rows = Math.ceil(this.scale.height / TILE_SIZE);

      for (let column = 0; column < columns; column += 1) {
        blockedCoordinates.add(toCoordinateKey({ column, row: riverRow }));
      }

      const farmBuildingTile = getFarmBuildingTile();
      for (
        let rowOffset = 0;
        rowOffset < FARM_BUILDING_SIZE.rows;
        rowOffset += 1
      ) {
        for (
          let columnOffset = 0;
          columnOffset < FARM_BUILDING_SIZE.columns;
          columnOffset += 1
        ) {
          blockedCoordinates.add(
            toCoordinateKey({
              column: farmBuildingTile.position.column + columnOffset,
              row: farmBuildingTile.position.row + rowOffset
            })
          );
        }
      }

      const persistedOccupants = [
        ...this.farmSnapshot.groundItems,
        ...this.farmSnapshot.crops,
        ...this.farmSnapshot.objects,
        ...this.farmSnapshot.improvements.filter(improvement =>
          isIrrigationVisible(improvement, Date.now())
        ),
        ...this.farmSnapshot.buildings.flatMap(building =>
          getBuildingFootprint(building.type, building)
        )
      ];

      persistedOccupants.forEach(occupant => {
        blockedCoordinates.add(
          toCoordinateKey({
            column: farmPosition.column + occupant.column,
            row: farmPosition.row + occupant.row
          })
        );
      });

      return (
        findNearestAvailableTile(
          preferredPosition,
          { columns, rows },
          coordinate =>
            coordinate.row < riverRow &&
            !blockedCoordinates.has(toCoordinateKey(coordinate))
        ) ?? preferredPosition
      );
    };

    // DRAWS THE FARMER NEXT TO THE FARM
    farmerCommandStore
      .getState()
      .setCarriedItem(this.farmSnapshot.farm.carriedItem);
    const actorLayer = this.add.layer().setDepth(ACTOR_DEPTH);
    const farmer = this.add
      .image(
        0,
        0,
        FARM_SPRITES_TEXTURE_KEY,
        spriteName(
          farmerCommandStore.getState().carriedItem === null
            ? "farmerIdle0"
            : "farmerHarvest3"
        )
      )
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setInteractive();
    let farmerPosition = resolveInitialFarmerPosition();
    let farmerVisualOffset: PixelPosition = { x: 0, y: 0 };
    let farmerHasMoved = false;
    let activeFarmerMovement: Phaser.Tweens.TweenChain | null = null;
    let activeMovementCommand: MovementCommand | null = null;
    let activeImprovementActionTimer: Phaser.Time.TimerEvent | null = null;
    let activeBuildingActionTimer: number | null = null;
    let activeCropActionTimer: Phaser.Time.TimerEvent | null = null;
    let activeHarvestTimer: number | null = null;
    let activeGatherTimer: number | null = null;
    let activeBottomDialog: Phaser.GameObjects.DOMElement | null = null;
    let activeBottomDialogTimer: Phaser.Time.TimerEvent | null = null;
    let sceneIsActive = true;
    const reconcileCropStages = (): void => {
      if (!sceneIsActive) {
        return;
      }

      renderCrops();
      rebuildGridAfterCropChange();
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        reconcileCropStages();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", reconcileCropStages);
    const getFarmerTile = (): Tile =>
      createTile(
        {
          ...farmerPosition,
          posX: farmer.x,
          posY: farmer.y
        },
        "farmerIdle0"
      );

    farmer.on(Phaser.Input.Events.POINTER_UP, () => {
      handlePointerUp(getFarmerTile(), selectionHighlight);
    });

    const farmerCarryBubble = this.add
      .circle(0, 0, 12, 0xffd45a, 1)
      .setStrokeStyle(2, 0x4b2f20)
      .setVisible(false);
    const farmerCarryBubbleText = this.add
      .text(0, 0, "", {
        color: "#4b2f20",
        fontFamily: "Bree Serif, Georgia, serif",
        fontSize: "16px"
      })
      .setOrigin(0.5)
      .setVisible(false);

    actorLayer.add([farmer, farmerCarryBubble, farmerCarryBubbleText]);

    const updateFarmerCarryBubblePosition = (): void => {
      const x = farmer.x + TILE_SIZE * 0.78;
      const y = farmer.y + TILE_SIZE * 0.08;
      farmerCarryBubble.setPosition(x, y);
      farmerCarryBubbleText.setPosition(x, y);
    };

    const updateFarmerCarryVisual = (): void => {
      const carriedItem = farmerCommandStore.getState().carriedItem;
      const isCarrying = carriedItem !== null;
      farmer
        .setFrame(
          spriteName(isCarrying ? "farmerHarvest3" : "farmerIdle0")
        )
        .setDisplaySize(TILE_SIZE, TILE_SIZE);
      farmerCarryBubble.setVisible(isCarrying);
      farmerCarryBubbleText
        .setText(isCarrying ? String(carriedItem.quantity) : "")
        .setVisible(isCarrying);
      updateFarmerCarryBubblePosition();
    };

    const positionFarmer = (): void => {
      farmer.setPosition(
        farmerPosition.column * TILE_SIZE + farmerVisualOffset.x,
        farmerPosition.row * TILE_SIZE + farmerVisualOffset.y
      );
      updateFarmerCarryBubblePosition();
    };

    positionFarmer();
    updateFarmerCarryVisual();

    const handleSceneUpdate = (): void => {
      updateFarmerCarryBubblePosition();
    };

    this.events.on(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);

    const rebuildGrid = (): void => {
      const entries: GridEntry[] = groundTileData.map(tile => ({
        tile,
        coordinate: tile.position
      }));

      for (const localPosition of farmTilePositions) {
        const farmTile = createTile(
          translateTilePosition(farmPosition, localPosition),
          "groundVariant"
        );
        entries.push({ tile: farmTile, coordinate: farmTile.position });
      }

      const farmBuildingTile = getFarmBuildingTile();
      for (
        let rowOffset = 0;
        rowOffset < FARM_BUILDING_SIZE.rows;
        rowOffset++
      ) {
        for (
          let columnOffset = 0;
          columnOffset < FARM_BUILDING_SIZE.columns;
          columnOffset++
        ) {
          entries.push({
            tile: farmBuildingTile,
            coordinate: {
              row: farmBuildingTile.position.row + rowOffset,
              column: farmBuildingTile.position.column + columnOffset
            }
          });
        }
      }

      for (const groundItemTile of groundItemTileData) {
        entries.push({
          tile: groundItemTile,
          coordinate: groundItemTile.position
        });
      }

      entries.push(
        ...waterTileData.map(tile => ({
          tile,
          coordinate: tile.position
        }))
      );

      const currentTime = Date.now();
      for (const improvement of this.farmSnapshot.improvements) {
        if (
          Date.parse(improvement.completesAt) > currentTime ||
          !isIrrigationVisible(improvement, currentTime)
        ) {
          continue;
        }

        const position = translateTilePosition(farmPosition, improvement);
        const tile = createTile(
          position,
          getIrrigationSprite(
            improvement,
            this.farmSnapshot.improvements,
            riverRow
          )
        );
        entries.push({ tile, coordinate: position });
      }

      for (const cropTile of cropTileData) {
        entries.push({ tile: cropTile, coordinate: cropTile.position });
      }

      for (const objectTile of farmObjectTileData) {
        entries.push({ tile: objectTile, coordinate: objectTile.position });
      }

      for (const buildingTile of buildingTileData) {
        for (const coordinate of getBuildingFootprint("granary", {
          column: buildingTile.position.column,
          row: buildingTile.position.row
        })) {
          entries.push({ tile: buildingTile, coordinate });
        }
      }

      gridStore.getState().replaceGrid(entries);
    };

    rebuildGridAfterIrrigationChange = rebuildGrid;
    rebuildGridAfterCropChange = rebuildGrid;
    rebuildGridAfterBuildingChange = rebuildGrid;

    rebuildGrid();

    const moveFarmerTo = (
      targetPosition: TilePosition,
      onComplete: (outcome: FarmerMovementOutcome) => void,
      onFailure: (reason: string) => void
    ): void => {
      const movementTarget = constrainTargetToRiverBank(
        farmerPosition,
        targetPosition,
        riverRow
      );
      const destinationPosition = movementTarget.position;

      if (
        farmerPosition.column === destinationPosition.column &&
        farmerPosition.row === destinationPosition.row
      ) {
        onComplete(
          movementTarget.type === "blocked"
            ? { type: "blocked", reason: "The river blocks the way." }
            : { type: "arrived" }
        );
        return;
      }

      activeFarmerMovement?.stop();
      activeFarmerMovement = null;

      const farmBuildingTile = getFarmBuildingTile();
      const blockedCoordinates = new Set<string>();
      const gridColumns = Math.ceil(this.scale.width / TILE_SIZE);

      for (let column = 0; column < gridColumns; column++) {
        blockedCoordinates.add(toCoordinateKey({ column, row: riverRow }));
      }

      for (
        let rowOffset = 0;
        rowOffset < FARM_BUILDING_SIZE.rows;
        rowOffset++
      ) {
        for (
          let columnOffset = 0;
          columnOffset < FARM_BUILDING_SIZE.columns;
          columnOffset++
        ) {
          blockedCoordinates.add(
            toCoordinateKey({
              column: farmBuildingTile.position.column + columnOffset,
              row: farmBuildingTile.position.row + rowOffset
            })
          );
        }
      }

      for (const building of this.farmSnapshot.buildings) {
        for (const coordinate of getBuildingFootprint(
          building.type,
          building
        )) {
          blockedCoordinates.add(
            toCoordinateKey({
              column: farmPosition.column + coordinate.column,
              row: farmPosition.row + coordinate.row
            })
          );
        }
      }

      const path = findCardinalPath(
        farmerPosition,
        destinationPosition,
        {
          columns: gridColumns,
          rows: Math.ceil(this.scale.height / TILE_SIZE)
        },
        blockedCoordinates
      );

      if (path === null) {
        onFailure("The selected tile cannot be reached.");
        return;
      }

      if (path.length < 2) {
        onComplete(
          movementTarget.type === "blocked"
            ? { type: "blocked", reason: "The river blocks the way." }
            : { type: "arrived" }
        );
        return;
      }

      const penultimatePosition = path.at(-2);
      const finalPosition = path.at(-1);

      if (penultimatePosition === undefined || finalPosition === undefined) {
        return;
      }

      const finalDirection = getCardinalDirection(
        penultimatePosition,
        finalPosition
      );

      if (finalDirection === null) {
        return;
      }

      const destination =
        movementTarget.type === "blocked"
          ? {
              x: destinationPosition.column * TILE_SIZE,
              y: destinationPosition.row * TILE_SIZE
            }
          : getFarmerDestination(destinationPosition, finalDirection);
      const route = createMovementWaypoints(
        { x: farmer.x, y: farmer.y },
        path,
        destination
      );
      const completeMovement = (): void => {
        farmerPosition = destinationPosition;
        farmerVisualOffset = {
          x: destination.x - destinationPosition.column * TILE_SIZE,
          y: destination.y - destinationPosition.row * TILE_SIZE
        };
        farmerHasMoved = true;
        activeFarmerMovement = null;
        rebuildGrid();
        onComplete(
          movementTarget.type === "blocked"
            ? { type: "blocked", reason: "The river blocks the way." }
            : { type: "arrived" }
        );
      };
      let previousWaypoint: PixelPosition = { x: farmer.x, y: farmer.y };
      const movementDurationPerTile =
        this.farmSnapshot.farm.household.hungrySince === null
          ? FARMER_MOVE_DURATION_PER_TILE
          : FARMER_MOVE_DURATION_PER_TILE *
            HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER;
      const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = route.map(
        waypoint => {
          const distance =
            Math.abs(waypoint.x - previousWaypoint.x) +
            Math.abs(waypoint.y - previousWaypoint.y);
          previousWaypoint = waypoint;

          return {
            targets: farmer,
            x: waypoint.x,
            y: waypoint.y,
            duration: (distance / TILE_SIZE) * movementDurationPerTile,
            ease: "Linear",
            onComplete: () => {
              if (waypoint.gridPosition !== undefined) {
                farmerPosition = toTilePosition(waypoint.gridPosition);
                farmerVisualOffset = { x: 0, y: 0 };
              }
            }
          };
        }
      );

      if (tweens.length === 0) {
        completeMovement();
        return;
      }

      activeFarmerMovement = this.tweens.chain({
        tweens,
        onComplete: completeMovement
      });
    };

    const completeMovementCommand = (commandId: string): void => {
      const commandState = farmerCommandStore.getState();
      commandState.removeCommand(commandId);
      commandState.setStatus({ type: "idle" });
      activeMovementCommand = null;
      processNextMovementCommand();
    };

    const failMovementCommand = (commandId: string, reason: string): void => {
      const commandState = farmerCommandStore.getState();
      const failedCommand = commandState.commands.find(
        command => command.id === commandId
      );

      if (
        failedCommand?.type === "build" &&
        failedCommand.build === "granary"
      ) {
        buildingPlacementStore.getState().cancelPlacement();
      }

      commandState.removeCommand(commandId);
      commandState.setStatus({ type: "failed", commandId, reason });
      activeMovementCommand = null;
    };

    const showBottomDialog = (message: string): void => {
      activeBottomDialogTimer?.remove(false);
      activeBottomDialog?.destroy();

      const element = document.createElement("div");
      element.className =
        "dialog-bottom-container nes-container is-centered is-rounded";
      element.textContent = message;
      element.setAttribute("role", "status");

      const bottomDialog = this.add
        .dom(this.scale.width / 2, this.scale.height * 0.96, element)
        .setOrigin(0.5, 1)
        .setScrollFactor(0);

      bottomDialog.updateSize();

      void document.fonts.ready.then(() => {
        if (activeBottomDialog === bottomDialog) {
          bottomDialog.updateSize();
        }
      });

      activeBottomDialog = bottomDialog;
      activeBottomDialogTimer = this.time.delayedCall(
        BOTTOM_DIALOG_DURATION,
        () => {
          bottomDialog.destroy();
          activeBottomDialog = null;
          activeBottomDialogTimer = null;
        }
      );
    };

    const granaryPlacementPreview = this.add
      .image(0, 0, FARM_SPRITES_TEXTURE_KEY, spriteName("granary"))
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
      .setDepth(ACTOR_DEPTH + 2)
      .setAlpha(0.55)
      .setVisible(false);
    let placementTarget: TilePosition | null = null;
    let placementRule: BuildingPlacementRule | null = null;

    const getOccupiedFarmCoordinates = (): ReadonlySet<string> => {
      const occupied = new Set<string>();
      const { buildingBounds } = INITIAL_FARM_CONFIG;

      for (
        let row = buildingBounds.minimumRow;
        row <= buildingBounds.maximumRow;
        row += 1
      ) {
        for (
          let column = buildingBounds.minimumColumn;
          column <= buildingBounds.maximumColumn;
          column += 1
        ) {
          occupied.add(toCoordinateKey({ column, row }));
        }
      }

      for (const occupant of [
        ...this.farmSnapshot.groundItems,
        ...this.farmSnapshot.crops,
        ...this.farmSnapshot.improvements.filter(improvement =>
          isIrrigationVisible(improvement, Date.now())
        ),
        ...this.farmSnapshot.objects
      ]) {
        occupied.add(toCoordinateKey(occupant));
      }

      for (const building of this.farmSnapshot.buildings) {
        for (const coordinate of getBuildingFootprint(
          building.type,
          building
        )) {
          occupied.add(toCoordinateKey(coordinate));
        }
      }

      occupied.add(
        toCoordinateKey({
          column: farmerPosition.column - farmPosition.column,
          row: farmerPosition.row - farmPosition.row
        })
      );

      return occupied;
    };

    const getAvailableGroundMaterials = (): Readonly<
      Partial<Record<InventoryItemKey, number>>
    > =>
      this.farmSnapshot.groundItems.reduce<
        Partial<Record<InventoryItemKey, number>>
      >(
        (quantities, item) => ({
          ...quantities,
          [item.itemKey]: (quantities[item.itemKey] ?? 0) + item.quantity
        }),
        {}
      );

    const updateGranaryPlacementPreview = (
      pointer: Phaser.Input.Pointer
    ): void => {
      const placement = buildingPlacementStore.getState().placement;

      if (placement.type !== "placing") {
        granaryPlacementPreview.setVisible(false);
        placementTarget = null;
        placementRule = null;
        return;
      }

      const globalCoordinate = {
        column: Math.floor(pointer.worldX / TILE_SIZE),
        row: Math.floor(pointer.worldY / TILE_SIZE)
      };
      const localCoordinate = {
        column: globalCoordinate.column - farmPosition.column,
        row: globalCoordinate.row - farmPosition.row
      };
      const rule = validateBuildingPlacement({
        building: placement.building,
        target: localCoordinate,
        occupiedCoordinates: getOccupiedFarmCoordinates(),
        carriedItem:
          farmerCommandStore.getState().carriedItem?.itemKey ?? null,
        availableMaterials: getAvailableGroundMaterials()
      });

      placementTarget = toTilePosition(globalCoordinate);
      placementRule = rule;
      granaryPlacementPreview
        .setPosition(
          globalCoordinate.column * TILE_SIZE,
          globalCoordinate.row * TILE_SIZE
        )
        .setTint(rule.type === "valid" ? 0x72c472 : 0xd65c5c)
        .setVisible(true);
    };

    const handlePlacementPointerMove = (
      pointer: Phaser.Input.Pointer
    ): void => {
      updateGranaryPlacementPreview(pointer);
    };

    const handlePlacementPointerUp = (
      pointer: Phaser.Input.Pointer
    ): void => {
      const placement = buildingPlacementStore.getState().placement;

      if (
        placement.type === "placing" &&
        pointer.rightButtonReleased()
      ) {
        buildingPlacementStore.getState().cancelPlacement();
        return;
      }

      if (
        placement.type !== "placing" ||
        placementTarget === null ||
        placementRule === null
      ) {
        return;
      }

      if (placementRule.type !== "valid") {
        showBottomDialog(describeBuildingPlacementRule(placementRule));
        buildingPlacementStore.getState().cancelPlacement();
        return;
      }

      const confirmedTarget = placementTarget;
      buildingPlacementStore
        .getState()
        .setSubmitting(placement.building);
      farmerCommandStore.getState().addCommand({
        type: "build",
        build: "granary",
        target: confirmedTarget
      });
    };

    const handlePlacementEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        buildingPlacementStore.getState().cancelPlacement();
      }
    };

    const unsubscribeFromBuildingPlacement = buildingPlacementStore.subscribe(
      state => {
        if (state.placement.type === "placing") {
          updateGranaryPlacementPreview(this.input.activePointer);
        } else {
          granaryPlacementPreview.setVisible(false);
          placementTarget = null;
          placementRule = null;
        }
      }
    );

    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      handlePlacementPointerMove
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, handlePlacementPointerUp);
    this.input.keyboard?.on("keydown", handlePlacementEscape);

    const handleFarmerArrival = (command: InspectCommand): void => {
      match(command.target.type)
        .with("ground", () => {
          // checks if there is a water tile adjacent to the ground tile
          const adjacentTiles = gridStore
            .getState()
            .findAdjacentTiles(command.target.position);
          const waterTile: Tile | undefined = Object.entries(
            adjacentTiles
          ).find(([, tile]) => tile.type === "water")?.[1];

          if (waterTile) {
            showBottomDialog("Build an irrigation canal here.");
          } else {
            showBottomDialog("There is nothing here.");
          }
        })
        .with("groundVariant", () => {
          showBottomDialog("This soil can be cultivated.");
        })
        .with("harvestedBarley", () => {
          console.log("This barley has been harvested.");
        })
        .otherwise(tileType => {
          console.log(`The farmer inspected ${tileType}.`);
        });
    };

    const getFarmDepositTarget = (): TilePosition => {
      const building = getFarmBuildingTile().position;
      const candidates: readonly GridCoordinate[] = [
        { column: building.column - 1, row: building.row },
        { column: building.column - 1, row: building.row + 1 },
        {
          column: building.column + FARM_BUILDING_SIZE.columns,
          row: building.row
        },
        {
          column: building.column + FARM_BUILDING_SIZE.columns,
          row: building.row + 1
        },
        { column: building.column, row: building.row - 1 },
        { column: building.column + 1, row: building.row - 1 },
        {
          column: building.column,
          row: building.row + FARM_BUILDING_SIZE.rows
        },
        {
          column: building.column + 1,
          row: building.row + FARM_BUILDING_SIZE.rows
        }
      ];
      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const rows = Math.ceil(this.scale.height / TILE_SIZE);
      const grid = gridStore.getState().grid;
      const nearest = candidates
        .filter(candidate => {
          const tile = grid[candidate.row]?.[candidate.column];

          return (
            candidate.column >= 0 &&
            candidate.column < columns &&
            candidate.row >= 0 &&
            candidate.row < rows &&
            candidate.row !== riverRow &&
            tile?.type !== "farm" &&
            tile?.type !== "granary" &&
            tile?.type !== "water"
          );
        })
        .toSorted(
          (first, second) =>
            Math.abs(first.column - farmerPosition.column) +
            Math.abs(first.row - farmerPosition.row) -
            (Math.abs(second.column - farmerPosition.column) +
              Math.abs(second.row - farmerPosition.row))
        )[0];

      return toTilePosition(nearest ?? candidates[0]);
    };

    const getGranaryInteractionTarget = (
      target: TilePosition
    ): TilePosition => {
      const { columns, rows } =
        FARM_BUILDING_DEFINITIONS.granary.footprint;
      const candidates: readonly GridCoordinate[] = [
        ...Array.from({ length: rows }, (_, rowOffset) => ({
          column: target.column - 1,
          row: target.row + rowOffset
        })),
        ...Array.from({ length: rows }, (_, rowOffset) => ({
          column: target.column + columns,
          row: target.row + rowOffset
        })),
        ...Array.from({ length: columns }, (_, columnOffset) => ({
          column: target.column + columnOffset,
          row: target.row - 1
        })),
        ...Array.from({ length: columns }, (_, columnOffset) => ({
          column: target.column + columnOffset,
          row: target.row + rows
        }))
      ];
      const grid = gridStore.getState().grid;
      const nearestAvailable = candidates
        .filter(candidate => {
          const tile = grid[candidate.row]?.[candidate.column];

          return (
            candidate.column >= 0 &&
            candidate.column < Math.ceil(this.scale.width / TILE_SIZE) &&
            candidate.row >= 0 &&
            candidate.row < Math.ceil(this.scale.height / TILE_SIZE) &&
            candidate.row !== riverRow &&
            tile?.type !== "farm" &&
            tile?.type !== "granary" &&
            tile?.type !== "water"
          );
        })
        .toSorted(
          (first, second) =>
            Math.abs(first.column - farmerPosition.column) +
            Math.abs(first.row - farmerPosition.row) -
            (Math.abs(second.column - farmerPosition.column) +
              Math.abs(second.row - farmerPosition.row))
        )[0];

      return toTilePosition(nearestAvailable ?? candidates[0]);
    };

    const getMovementTarget = (command: MovementCommand): TilePosition =>
      match(command)
        .with({ type: "inspect" }, ({ target }) => target.position)
        .with({ type: "build", build: "irrigation" }, ({ target }) => target)
        .with({ type: "build", build: "granary" }, buildCommand =>
          getGranaryInteractionTarget(buildCommand.target)
        )
        .with({ type: "destroy" }, ({ target }) => target)
        .with({ type: "pickup" }, ({ target }) => target)
        .with({ type: "drop" }, ({ target }) => target)
        .with({ type: "deposit", storage: "farm" }, () =>
          getFarmDepositTarget()
        )
        .with({ type: "deposit", storage: "granary" }, ({ target }) =>
          getGranaryInteractionTarget(target)
        )
        .with({ type: "withdraw", storage: "farm" }, () =>
          getFarmDepositTarget()
        )
        .with({ type: "withdraw", storage: "granary" }, ({ target }) =>
          getGranaryInteractionTarget(target)
        )
        .with({ type: "plant" }, ({ target }) => target)
        .with({ type: "harvest" }, ({ target }) => target)
        .with({ type: "gather" }, ({ target }) => target)
        .exhaustive();

    const startIrrigationConstruction = (command: BuildCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "building",
        commandId: command.id
      });

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const relativeTarget = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };

      void executeGameCommand({
        type: "build_irrigation",
        target: relativeTarget,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (!sceneIsActive) {
            return;
          }

          const improvement = snapshot.improvements.find(
            candidate =>
              candidate.type === "irrigation" &&
              candidate.column === relativeTarget.column &&
              candidate.row === relativeTarget.row
          );

          if (improvement === undefined) {
            failMovementCommand(
              command.id,
              "The irrigation canal was not returned by the server."
            );
            return;
          }

          showBottomDialog("Building the irrigation canal...");
          const remainingDuration = Math.max(
            0,
            Date.parse(improvement.completesAt) - Date.now()
          );
          const finishConstruction = (): void => {
            activeImprovementActionTimer = null;
            renderIrrigation();
            rebuildGrid();
            showBottomDialog("The irrigation canal is complete.");
            completeMovementCommand(command.id);
          };

          if (remainingDuration === 0) {
            finishConstruction();
            return;
          }

          activeImprovementActionTimer = this.time.delayedCall(
            remainingDuration,
            finishConstruction
          );
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The irrigation canal could not be built.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const startGranaryConstruction = (
      command: GranaryBuildCommand
    ): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "building",
        commandId: command.id
      });

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        buildingPlacementStore.getState().cancelPlacement();
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const relativeTarget = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };

      void executeGameCommand({
        type: "build_granary",
        target: relativeTarget,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);
          buildingPlacementStore.getState().cancelPlacement();

          if (!sceneIsActive) {
            return;
          }

          const building = snapshot.buildings.find(
            candidate =>
              candidate.type === "granary" &&
              candidate.column === relativeTarget.column &&
              candidate.row === relativeTarget.row
          );

          if (building === undefined) {
            failMovementCommand(
              command.id,
              "The granary was not returned by the server."
            );
            return;
          }

          showBottomDialog("Building the granary...");
          const finishConstruction = (): void => {
            activeBuildingActionTimer = null;
            renderBuildings();
            rebuildGrid();
            updateFarmInventoryChip();
            farmStore.getState().setReady(this.farmSnapshot);
            showBottomDialog("The granary is complete.");
            completeMovementCommand(command.id);
          };
          const remainingDuration = Math.max(
            0,
            Date.parse(building.completesAt) - Date.now()
          );

          if (remainingDuration === 0) {
            finishConstruction();
            return;
          }

          activeBuildingActionTimer = window.setTimeout(
            finishConstruction,
            remainingDuration
          );
        })
        .catch(error => {
          buildingPlacementStore.getState().cancelPlacement();

          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The granary could not be built.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const startIrrigationDestruction = (command: DestroyCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "destroying",
        commandId: command.id
      });

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const relativeTarget = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };

      void executeGameCommand({
        type: "destroy_irrigation",
        target: relativeTarget,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (!sceneIsActive) {
            return;
          }

          const improvement = snapshot.improvements.find(
            candidate =>
              candidate.type === "irrigation" &&
              candidate.column === relativeTarget.column &&
              candidate.row === relativeTarget.row
          );

          if (
            improvement === undefined ||
            improvement.destroyCompletesAt === null
          ) {
            failMovementCommand(
              command.id,
              "The irrigation destruction was not returned by the server."
            );
            return;
          }

          showBottomDialog("Destroying the irrigation canal...");
          const remainingDuration = Math.max(
            0,
            Date.parse(improvement.destroyCompletesAt) - Date.now()
          );
          const finishDestruction = (): void => {
            activeImprovementActionTimer = null;
            renderIrrigation();
            rebuildGrid();
            showBottomDialog("The irrigation canal has been removed.");
            completeMovementCommand(command.id);
          };

          if (remainingDuration === 0) {
            finishDestruction();
            return;
          }

          activeImprovementActionTimer = this.time.delayedCall(
            remainingDuration,
            finishDestruction
          );
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The irrigation canal could not be destroyed.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const startFarmItemAction = (command: FarmItemCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus(
        match(command)
          .returnType<FarmerStatus>()
          .with({ type: "pickup" }, () => ({
            type: "pickingUp",
            commandId: command.id
          }))
          .with({ type: "drop" }, () => ({
            type: "dropping",
            commandId: command.id
          }))
          .with({ type: "deposit" }, () => ({
            type: "depositing",
            commandId: command.id
          }))
          .with({ type: "withdraw" }, () => ({
            type: "withdrawing",
            commandId: command.id
          }))
          .exhaustive()
      );

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const request = match(command)
        .with({ type: "pickup" }, pickupCommand =>
          executeGameCommand({
            type: "pickup_ground_item",
            target: {
              column: pickupCommand.target.column - farmPosition.column,
              row: pickupCommand.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "drop" }, dropCommand =>
          executeGameCommand({
            type: "drop_carried_item",
            target: {
              column: dropCommand.target.column - farmPosition.column,
              row: dropCommand.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "deposit", storage: "farm" }, () =>
          executeGameCommand({
            type: "deposit_carried_item",
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "deposit", storage: "granary" }, depositCommand =>
          executeGameCommand({
            type: "deposit_carried_item_in_granary",
            target: {
              column: depositCommand.target.column - farmPosition.column,
              row: depositCommand.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "withdraw", storage: "farm" }, withdrawCommand =>
          executeGameCommand({
            type: "withdraw_inventory_item",
            itemKey: withdrawCommand.item,
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "withdraw", storage: "granary" }, withdrawCommand =>
          executeGameCommand({
            type: "withdraw_barley_from_granary",
            target: {
              column: withdrawCommand.target.column - farmPosition.column,
              row: withdrawCommand.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .exhaustive();

      void request
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (!sceneIsActive) {
            return;
          }

          showBottomDialog(
            match(command)
              .with(
                { type: "pickup" },
                pickupCommand =>
                  `The farmer picked up one ${pickupCommand.item}.`
              )
              .with(
                { type: "drop" },
                () => "The farmer left one item on the ground."
              )
              .with(
                { type: "deposit", storage: "farm" },
                () => "The barley was stored inside the farm."
              )
              .with(
                { type: "deposit", storage: "granary" },
                () => "The barley was stored inside the granary."
              )
              .with(
                { type: "withdraw", storage: "farm" },
                () => "The farmer took one barley from the farm."
              )
              .with(
                { type: "withdraw", storage: "granary" },
                () => "The farmer took one barley from the granary."
              )
              .exhaustive()
          );
          completeMovementCommand(command.id);
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The item action could not be completed.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const getResourceLabel = (item: GatherableResourceKey): string =>
      item === "reed" ? "reeds" : "clay";

    const startResourceGathering = (command: GatherCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "gathering",
        commandId: command.id
      });

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const relativeTarget = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };

      void executeGameCommand({
        type: "start_gather_resource",
        itemKey: command.item,
        target: relativeTarget,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (!sceneIsActive) {
            return;
          }

          const gathering = snapshot.farm.gathering;

          if (gathering === null) {
            failMovementCommand(
              command.id,
              "The gathering action was not returned by the server."
            );
            return;
          }

          farmer
            .setFrame(spriteName("farmerHarvest0"))
            .setDisplaySize(TILE_SIZE, TILE_SIZE);
          showBottomDialog(`Collecting ${getResourceLabel(command.item)}...`);

          const finishGathering = (): void => {
            activeGatherTimer = null;
            void executeGameCommand({
              type: "complete_gather_resource",
              expectedFarmVersion: snapshot.farm.version
            })
              .then(completedSnapshot => {
                farmStore.getState().setReady(completedSnapshot);

                if (!sceneIsActive) {
                  return;
                }

                showBottomDialog(
                  `The farmer collected ${getResourceLabel(command.item)}.`
                );
                completeMovementCommand(command.id);
              })
              .catch(error => {
                if (!sceneIsActive) {
                  return;
                }

                updateFarmerCarryVisual();
                const reason =
                  error instanceof Error
                    ? error.message
                    : "The resource could not be collected.";
                failMovementCommand(command.id, reason);
                showBottomDialog(reason);
              });
          };

          const remainingDuration = Math.max(
            0,
            Date.parse(gathering.completesAt) - Date.now()
          );

          if (remainingDuration === 0) {
            finishGathering();
            return;
          }

          activeGatherTimer = window.setTimeout(
            finishGathering,
            remainingDuration + 25
          );
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          updateFarmerCarryVisual();
          const reason =
            error instanceof Error
              ? error.message
              : "The resource gathering could not be started.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const startCropPlanting = (command: PlantCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "planting",
        commandId: command.id
      });

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const target = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };

      void executeGameCommand({
        type: "plant_crop",
        crop: command.crop,
        target,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (!sceneIsActive) {
            return;
          }

          const plantedCrop = snapshot.crops.find(
            crop =>
              crop.cropKey === command.crop &&
              crop.column === target.column &&
              crop.row === target.row
          );

          if (plantedCrop === undefined) {
            failMovementCommand(
              command.id,
              "The planted crop was not returned by the server."
            );
            return;
          }

          farmer
            .setFrame(spriteName("farmerPlant0"))
            .setDisplaySize(TILE_SIZE, TILE_SIZE);
          showBottomDialog("Sowing the barley...");

          const remainingSowingDuration = Math.max(
            0,
            Date.parse(plantedCrop.plantedAt) - Date.now()
          );
          const finishSowing = (): void => {
            activeCropActionTimer = null;
            updateFarmerCarryVisual();
            renderCrops();
            rebuildGrid();
            showBottomDialog("The barley has been planted.");
            completeMovementCommand(command.id);
          };

          if (remainingSowingDuration === 0) {
            finishSowing();
            return;
          }

          activeCropActionTimer = this.time.delayedCall(
            remainingSowingDuration,
            finishSowing
          );
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The crop could not be planted.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const startCropHarvesting = (command: HarvestCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore.getState().setStatus({
        type: "harvesting",
        commandId: command.id
      });

      const target = {
        column: command.target.column - farmPosition.column,
        row: command.target.row - farmPosition.row
      };
      const findTargetCrop = (snapshot: FarmSnapshot) =>
        snapshot.crops.find(
          crop =>
            crop.column === target.column && crop.row === target.row
        );

      const scheduleHarvestCompletion = (snapshot: FarmSnapshot): void => {
        const crop = findTargetCrop(snapshot);

        if (crop === undefined || crop.harvestCompletesAt === null) {
          failMovementCommand(
            command.id,
            "The pending harvest was not returned by the server."
          );
          return;
        }

        farmer
          .setFrame(spriteName("farmerHarvest0"))
          .setDisplaySize(TILE_SIZE, TILE_SIZE);
        showBottomDialog("Harvesting the barley...");

        const finishHarvest = (): void => {
          activeHarvestTimer = null;
          const latestFarmState = farmStore.getState().farm;

          if (latestFarmState.type !== "ready") {
            failMovementCommand(command.id, "The farm is not ready.");
            showBottomDialog("The farm is not ready.");
            return;
          }

          void executeGameCommand({
            type: "complete_harvest_crop",
            target,
            expectedFarmVersion: latestFarmState.snapshot.farm.version
          })
            .then(completedSnapshot => {
              farmStore.getState().setReady(completedSnapshot);

              if (!sceneIsActive) {
                return;
              }

              showBottomDialog(
                "The farmer harvested 2 barley. Store it in the farm or leave it on arable ground."
              );
              completeMovementCommand(command.id);
            })
            .catch(error => {
              if (!sceneIsActive) {
                return;
              }

              const reason =
                error instanceof Error
                  ? error.message
                  : "The harvest could not be completed.";
              updateFarmerCarryVisual();
              failMovementCommand(command.id, reason);
              showBottomDialog(reason);
            });
        };

        const remainingDuration = Math.max(
          0,
          Date.parse(crop.harvestCompletesAt) - Date.now()
        );

        if (remainingDuration === 0) {
          finishHarvest();
          return;
        }

        activeHarvestTimer = window.setTimeout(
          finishHarvest,
          remainingDuration
        );
      };

      const farmState = farmStore.getState().farm;

      if (farmState.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        showBottomDialog("The farm is not ready.");
        return;
      }

      const existingCrop = findTargetCrop(farmState.snapshot);

      if (
        existingCrop !== undefined &&
        existingCrop.harvestCompletesAt !== null
      ) {
        scheduleHarvestCompletion(farmState.snapshot);
        return;
      }

      void executeGameCommand({
        type: "start_harvest_crop",
        target,
        expectedFarmVersion: farmState.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);

          if (sceneIsActive) {
            scheduleHarvestCompletion(snapshot);
          }
        })
        .catch(error => {
          if (!sceneIsActive) {
            return;
          }

          const reason =
            error instanceof Error
              ? error.message
              : "The harvest could not be started.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const completeCommandMovement = (
      command: MovementCommand,
      outcome: FarmerMovementOutcome
    ): void => {
      match(outcome)
        .with({ type: "arrived" }, () => {
          match(command)
            .with({ type: "inspect" }, inspectCommand => {
              handleFarmerArrival(inspectCommand);
              completeMovementCommand(inspectCommand.id);
            })
            .with({ type: "build", build: "irrigation" }, buildCommand => {
              startIrrigationConstruction(buildCommand);
            })
            .with({ type: "build", build: "granary" }, buildCommand => {
              startGranaryConstruction(buildCommand);
            })
            .with(
              { type: "destroy", build: "irrigation" },
              destroyCommand => {
                startIrrigationDestruction(destroyCommand);
              }
            )
            .with({ type: "pickup" }, pickupCommand => {
              startFarmItemAction(pickupCommand);
            })
            .with({ type: "drop" }, dropCommand => {
              startFarmItemAction(dropCommand);
            })
            .with({ type: "deposit" }, depositCommand => {
              startFarmItemAction(depositCommand);
            })
            .with({ type: "withdraw" }, withdrawCommand => {
              startFarmItemAction(withdrawCommand);
            })
            .with({ type: "plant" }, plantCommand => {
              startCropPlanting(plantCommand);
            })
            .with({ type: "harvest" }, harvestCommand => {
              startCropHarvesting(harvestCommand);
            })
            .with({ type: "gather" }, gatherCommand => {
              startResourceGathering(gatherCommand);
            })
            .exhaustive();
        })
        .with({ type: "blocked" }, ({ reason }) => {
          showBottomDialog(reason);
          completeMovementCommand(command.id);
        })
        .exhaustive();
    };

    const executeMovementCommand = (command: MovementCommand): void => {
      const carriedItem = farmerCommandStore.getState().carriedItem;

      if (
        command.type === "pickup" &&
        carriedItem !== null &&
        (carriedItem.itemKey !== command.item ||
          carriedItem.quantity >= FARMER_CARRY_CAPACITY)
      ) {
        showBottomDialog("The farmer cannot carry another item.");
        completeMovementCommand(command.id);
        return;
      }

      if (
        (command.type === "drop" || command.type === "deposit") &&
        carriedItem === null
      ) {
        showBottomDialog("The farmer is not carrying an item.");
        completeMovementCommand(command.id);
        return;
      }

      if (command.type === "withdraw" && carriedItem !== null) {
        showBottomDialog("The farmer must empty their hands first.");
        completeMovementCommand(command.id);
        return;
      }

      if (
        command.type === "plant" &&
        carriedItem?.itemKey !== command.crop
      ) {
        showBottomDialog(`The farmer is not carrying ${command.crop}.`);
        completeMovementCommand(command.id);
        return;
      }

      if (command.type === "harvest" && carriedItem !== null) {
        showBottomDialog("The farmer must have empty hands to harvest.");
        completeMovementCommand(command.id);
        return;
      }

      if (command.type === "gather" && carriedItem !== null) {
        showBottomDialog("The farmer must have empty hands to gather.");
        completeMovementCommand(command.id);
        return;
      }

      activeMovementCommand = command;
      farmerCommandStore.getState().setStatus({
        type: "moving",
        commandId: command.id
      });
      moveFarmerTo(
        getMovementTarget(command),
        outcome => completeCommandMovement(command, outcome),
        reason => failMovementCommand(command.id, reason)
      );
    };

    function processNextMovementCommand(): void {
      const commandState = farmerCommandStore.getState();
      const nextCommand = commandState.commands[0];
      const canStartCommand =
        commandState.status.type === "idle" ||
        commandState.status.type === "failed";

      if (
        activeMovementCommand === null &&
        canStartCommand &&
        (nextCommand?.type === "inspect" ||
          nextCommand?.type === "build" ||
          nextCommand?.type === "destroy" ||
          nextCommand?.type === "pickup" ||
          nextCommand?.type === "drop" ||
          nextCommand?.type === "deposit" ||
          nextCommand?.type === "withdraw" ||
          nextCommand?.type === "plant" ||
          nextCommand?.type === "harvest" ||
          nextCommand?.type === "gather")
      ) {
        executeMovementCommand(nextCommand);
      }
    }

    let renderedCarriedItem = farmerCommandStore.getState().carriedItem;
    const unsubscribeFromCommands = farmerCommandStore.subscribe(state => {
      if (state.carriedItem !== renderedCarriedItem) {
        renderedCarriedItem = state.carriedItem;
        updateFarmerCarryVisual();
      }

      processNextMovementCommand();
    });
    const unsubscribeFromFarm = farmStore.subscribe(state => {
      if (state.farm.type === "ready") {
        this.farmSnapshot = state.farm.snapshot;
        farmerCommandStore
          .getState()
          .setCarriedItem(state.farm.snapshot.farm.carriedItem);
        updateFarmInventoryChip();
        renderGroundItems();
        renderIrrigation();
        renderCrops();
        renderBuildings();
        renderGroundDecorations();
        positionMarketSign();
        rebuildGrid();

        if (buildingPlacementStore.getState().placement.type === "placing") {
          updateGranaryPlacementPreview(this.input.activePointer);
        }
      }
    });

    const pendingHarvest = this.farmSnapshot.crops.find(
      crop => crop.harvestCompletesAt !== null
    );

    const pendingGathering = this.farmSnapshot.farm.gathering;

    if (
      pendingGathering !== null &&
      farmerCommandStore.getState().carriedItem === null
    ) {
      farmerCommandStore.getState().addCommand({
        type: "gather",
        item: pendingGathering.itemKey,
        target: translateTilePosition(
          farmPosition,
          pendingGathering.target
        )
      });
    } else if (
      pendingHarvest !== undefined &&
      farmerCommandStore.getState().carriedItem === null
    ) {
      farmerCommandStore.getState().addCommand({
        type: "harvest",
        target: translateTilePosition(farmPosition, pendingHarvest)
      });
    }

    processNextMovementCommand();

    let renderedSceneWidth = this.scale.width;
    let renderedSceneHeight = this.scale.height;

    const handleResize = (): void => {
      if (
        this.scale.width === renderedSceneWidth &&
        this.scale.height === renderedSceneHeight
      ) {
        return;
      }

      renderedSceneWidth = this.scale.width;
      renderedSceneHeight = this.scale.height;
      activeFarmerMovement?.stop();
      activeFarmerMovement = null;
      renderGround();
      positionFarm();
      positionMarketSign();
      updateFarmInventoryChip();

      if (!farmerHasMoved) {
        farmerPosition = resolveInitialFarmerPosition();
      }

      renderGroundItems();
      renderRiver();
      renderIrrigation();
      renderCrops();
      renderBuildings();
      renderGroundDecorations();
      positionFarmer();
      rebuildGrid();

      if (buildingPlacementStore.getState().placement.type === "placing") {
        updateGranaryPlacementPreview(this.input.activePointer);
      }

      if (activeBottomDialog !== null) {
        activeBottomDialog
          .updateSize()
          .setPosition(this.scale.width / 2, this.scale.height);
      }

      if (activeMovementCommand !== null) {
        const command = activeMovementCommand;
        moveFarmerTo(
          getMovementTarget(command),
          outcome => completeCommandMovement(command, outcome),
          reason => failMovementCommand(command.id, reason)
        );
      }
    };

    const cleanupScene = (): void => {
      if (!sceneIsActive) {
        return;
      }

      sceneIsActive = false;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanupScene);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanupScene);
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
      this.events.off(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", reconcileCropStages);
      unsubscribeFromCommands();
      unsubscribeFromFarm();
      unsubscribeFromBuildingPlacement();
      this.input.off(
        Phaser.Input.Events.POINTER_MOVE,
        handlePlacementPointerMove
      );
      this.input.off(
        Phaser.Input.Events.POINTER_UP,
        handlePlacementPointerUp
      );
      this.input.keyboard?.off("keydown", handlePlacementEscape);
      activeFarmerMovement?.stop();
      activeImprovementActionTimer?.remove(false);
      activeCropActionTimer?.remove(false);
      if (activeBuildingActionTimer !== null) {
        window.clearTimeout(activeBuildingActionTimer);
      }
      if (activeHarvestTimer !== null) {
        window.clearTimeout(activeHarvestTimer);
      }
      if (activeGatherTimer !== null) {
        window.clearTimeout(activeGatherTimer);
      }
      irrigationCompletionTimers.forEach(timer => timer.remove(false));
      cropGrowthTimers.forEach(timer => window.clearTimeout(timer));
      buildingCompletionTimers.forEach(timer => window.clearTimeout(timer));
      activeBottomDialogTimer?.remove(false);
      activeBottomDialog?.destroy();

      if (activeMovementCommand !== null) {
        farmerCommandStore.getState().setStatus({ type: "idle" });
      }

      gridStore.getState().replaceGrid([]);
      buildingPlacementStore.getState().cancelPlacement();
    };

    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupScene);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupScene);
  }
}
