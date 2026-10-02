import Phaser from "phaser";
import { batchPlantingCarriedBarley } from "../../../../game-core/farm/batchPlanting";
import { FARMER_MOVE_DURATION_PER_TILE } from "../../../../game-core/farm/batchPlantingTravel";
import { installBatchPlantingOverlay } from "../batchPlantingOverlay";
import { batchPlantingStore } from "../../../stores/batchPlantingStore";
import { fetchDevelopmentFarm } from "../../../api/developmentPlayer";
import { farmerProductionJob, breadOvenSprite } from "../../../../game-core/farm/farmerProduction";
import { match, P } from "ts-pattern";
import { colors } from "../../../styles/colorPalette";
import { FARM_SPRITES, spriteName } from "../../../../assets/farmSprites";
import { TILE_SIZE } from "../config";
import {
  CARRY_BUBBLE_RADIUS,
  getCarryBubblePosition
} from "../carryBubblePosition";
import { CAST_COOLDOWN_MS, CAST_DELAY_MS } from "../../../../game-data/fishing";
import { fishPosition } from "../../../../game-core/farm/fishing";
import { blendFishPosition, riverFishY } from "../riverFishMotion";
import { findCentralFarmerTile } from "../farmerSpawn";
import { findMillBagTile } from "../millBagPlacement";
import { isCarryingForMarket, MARKET_UNLOAD_MESSAGE } from "../marketEntry";
import { getMarketPosition, MARKET_SIZE } from "../marketPlacement";
import { preservesBuildingAccess } from "../../../../game-core/farm/buildingAccess";
import { scheduleActionDeadline, type ActionDeadline } from "../actionDeadline";
import {
  getFarmerArrivalAlignment,
  getFarmerDestination,
  getFarmerRoadOffset,
  getGroundArrivalMessage,
  type CardinalDirection,
  type FarmerArrivalAlignment
} from "../farmerArrival";
import { calculateGameplayTilePosition, translateTilePosition } from "../grid";
import { BREAD_RECIPE } from "../../../../game-data/production";
import { productionProgress } from "../productionProgress";
import { createBuildingProductionBar } from "../buildingProductionBar";
import { productionStandingTile } from "../productionStandingTile";
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
import { installSceneDomIsolation } from "../sceneDomIsolation";
import { installMerchantChariot } from "../merchantChariot";
import { merchantStopColumn } from "../merchantChariotLayout";
import { installDogFetch } from "../dogFetch";
import {
  PROGRESSION_SIGNPOST,
  isProgressionSignpost,
  granaryLimitForLevel,
  canEnterMarket,
  MARKET_UNLOCK_LEVEL
} from "../../../../game-data/progression";
import { levelUiStore } from "../../../stores/levelUiStore";
import { evaluateProgression } from "../../../../game-core/farm/progression";
import {
  FARMER_CARRY_CAPACITY,
  granaryCapacityForLevel,
  FARM_STORAGE_CAPACITY
} from "../../../../game-data/storage";
import type { GatherableResourceKey } from "../../../../game-data/resources";
import type { InventoryItemKey } from "../../../../game-data/inventoryItems";
import {
  FARM_BUILDING_DEFINITIONS,
  type FarmBuildingType
} from "../../../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../../../game-data/initialFarm";
import { farmerMovementDurationMultiplier } from "../../../../game-core/farm/wellbeing";
import {
  describeBuildingPlacementRule,
  getBuildingFootprint,
  isInsideBuildingPlot,
  validateBuildingPlacement,
  type BuildingPlacementRule
} from "../../../../game-core/farm/buildings";

const INITIAL_FARM_SIZE = 8;
const INITIAL_FARM_ROWS =
  INITIAL_FARM_CONFIG.plotBounds.maximumRow -
  INITIAL_FARM_CONFIG.plotBounds.minimumRow +
  1;
import { findRoadPreferredPath } from "../../../../game-core/farm/roadPath";
import {
  findLoadingTile,
  isRoad,
  roadNeighbors
} from "../../../../game-core/farm/roads";
import { roadIsComplete, type FarmRoad } from "../../../../game-data/roads";
const FARM_BUILDING_SIZE = {
  columns: 2,
  rows: 2
} as const;
import {
  millSprite,
  millingCollectionSource,
  millingUnavailableReason
} from "../../../../game-core/farm/milling";
import { MILL_RECIPES } from "../../../../game-data/milling";
import { adjacentGrazingTiles, createDonkey } from "../donkey";

const GROUND_DEPTH = 0;
const RIVER_DEPTH = 1;
const IRRIGATION_DEPTH = 2;
const FARM_DEPTH = 2;
const DECORATION_DEPTH = 2;
const CROP_DEPTH = 3;
const BUILDING_DEPTH = 3;
const BOUNDARY_DEPTH = 3.5;
const ACTOR_DEPTH = 4;
const RIVER_ROW = 10;
const BOTTOM_DIALOG_DURATION = 2_000;
const gameplayWidth = INITIAL_FARM_SIZE * TILE_SIZE;
const gameplayHeight = INITIAL_FARM_ROWS * TILE_SIZE;

type LocalTilePosition = Pick<TilePosition, "column" | "row">;
type PixelPosition = {
  readonly x: number;
  readonly y: number;
};
type InspectCommand = Extract<FarmerCommand, { readonly type: "inspect" }>;
type BuildCommand = Extract<FarmerCommand, { readonly type: "build" }>;
type BuildingBuildCommand = BuildCommand & {
  readonly build: "granary" | "brewery" | "mill" | "breadOven";
};
type DestroyCommand = Extract<FarmerCommand, { readonly type: "destroy" }>;
type PlantCommand = Extract<FarmerCommand, { readonly type: "plant" }>;
type HarvestCommand = Extract<FarmerCommand, { readonly type: "harvest" }>;
type GatherCommand = Extract<FarmerCommand, { readonly type: "gather" }>;
type FarmItemCommand = Extract<
  FarmerCommand,
  {
    readonly type:
      | "pickup"
      | "drop"
      | "deposit"
      | "withdraw"
      | "brewery_supply"
      | "mill"
      | "fishing";
  }
>;
const MOVEMENT_COMMAND_TYPES = [
  "move",
  "inspect",
  "build",
  "destroy",
  "pickup",
  "drop",
  "deposit",
  "withdraw",
  "plant",
  "harvest",
  "gather",
  "brewery_supply",
  "mill",
  "store_mill_goods",
  "fishing",
  "production"
] as const satisfies readonly FarmerCommand["type"][];
type MovementCommand = Extract<
  FarmerCommand,
  { readonly type: (typeof MOVEMENT_COMMAND_TYPES)[number] }
>;
const isMovementCommand = (
  command: FarmerCommand | undefined
): command is MovementCommand =>
  command !== undefined &&
  (MOVEMENT_COMMAND_TYPES as readonly FarmerCommand["type"][]).includes(
    command.type
  );
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

type FarmerWaypoint = PixelPosition & {
  readonly gridPosition?: GridCoordinate;
};

const createMovementWaypoints = (
  start: PixelPosition,
  path: readonly GridCoordinate[],
  destination: PixelPosition,
  roadOffset: (position: GridCoordinate) => number
): readonly FarmerWaypoint[] => {
  const candidates: readonly FarmerWaypoint[] = [
    ...path.slice(0, -1).map(position => ({
      x: position.column * TILE_SIZE,
      y: position.row * TILE_SIZE + roadOffset(position),
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
): "canalHorizontal" | "canalVertical" | "canalCross" | "canalBridge" => {
  if (improvement.row === INITIAL_FARM_CONFIG.roadRow) return "canalBridge";
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
    for (const [name, url] of Object.entries(FARM_SPRITES)) {
      this.load.image(name, url);
    }
  }

  create(): void {
    installSceneDomIsolation(this);
    marketUiStore.getState().setLocation("farm");
    this.cameras.main.setBackgroundColor(colors.soil);

    // CREATES THE SELECTION HIGHLIGHT
    const selectionHighlight = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xe6a11b, 0.25)
      .setOrigin(0)
      .setStrokeStyle(3, 0xffd45a)
      .setDepth(ACTOR_DEPTH + 1)
      .setVisible(false);

    // LAYS THE GROUND TILES
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
              spriteName(
                row === INITIAL_FARM_CONFIG.roadRow
                  ? "groundPathHorizontal"
                  : "ground"
              )
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
            row === INITIAL_FARM_CONFIG.roadRow
              ? "groundPathHorizontal"
              : "ground"
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

    // LAYS THE ARABLE GROUND VARIANT TILES
    const farmTiles = this.add.container(0, 0).setDepth(FARM_DEPTH);
    let farmPosition = calculateGameplayTilePosition(
      Math.ceil(this.scale.width / TILE_SIZE),
      INITIAL_FARM_SIZE
    );
    const farmTilePositions: LocalTilePosition[] = [];

    for (let row = 0; row < INITIAL_FARM_ROWS; row++) {
      for (let column = 0; column < INITIAL_FARM_SIZE; column++) {
        const localPosition = { column, row } as const;
        const farmTile = this.add
          .image(
            column * TILE_SIZE,
            row * TILE_SIZE,
            spriteName(
              row === INITIAL_FARM_CONFIG.roadRow
                ? "groundPathHorizontal"
                : "groundVariant"
            )
          )
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setInteractive();

        // set interaction with farm tiles
        farmTile.on(Phaser.Input.Events.POINTER_UP, () => {
          const position = translateTilePosition(farmPosition, localPosition);
          const farmTileData = createTile(
            position,
            row === INITIAL_FARM_CONFIG.roadRow
              ? "groundPathHorizontal"
              : "groundVariant"
          );
          handlePointerUp(farmTileData, selectionHighlight);
        });

        farmTilePositions.push(localPosition);
        farmTiles.add(farmTile);
      }
    }

    const roadImages = this.add.group();
    let roadTileData: readonly Tile[] = [];
    const renderRoads = (): void => {
      roadImages.clear(true, true);
      const roads = this.farmSnapshot.farm.roads.filter(r =>
        roadIsComplete(r, Date.now())
      );
      const main = Array.from(
        { length: Math.ceil(this.scale.width / TILE_SIZE) },
        (_, column) => ({
          column: column - farmPosition.column,
          row: INITIAL_FARM_CONFIG.roadRow
        })
      );
      roadTileData = [...main, ...roads].map(p => {
        const position = translateTilePosition(farmPosition, p);
        const tile = createTile(position, "groundPathHorizontal");
        if (
          this.farmSnapshot.improvements.some(
            i => i.column === p.column && i.row === p.row
          )
        )
          return tile;
        // Ground-sized hit area; decorative arms never intercept clicks.
        const base = this.add
          .image(position.posX, position.posY, spriteName("groundVariant"))
          .setOrigin(0)
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(FARM_DEPTH + 0.1)
          .setInteractive();
        base.on(Phaser.Input.Events.POINTER_UP, () =>
          handlePointerUp(tile, selectionHighlight)
        );
        roadImages.add(base);
        const directions = roadNeighbors(p).flatMap((neighbor, index) =>
          isRoad(neighbor, roads) ? [index] : []
        );
        const straight =
          directions.length === 1 ||
          (directions.length === 2 &&
            (directions.every(d => d === 0 || d === 3) ||
              directions.every(d => d === 1 || d === 2)));
        if (straight) {
          roadImages.add(
            this.add
              .image(
                position.posX + TILE_SIZE / 2,
                position.posY + TILE_SIZE / 2,
                spriteName("groundPathHorizontal")
              )
              .setDisplaySize(TILE_SIZE, TILE_SIZE)
              .setAngle(directions[0] === 0 || directions[0] === 3 ? 90 : 0)
              .setDepth(FARM_DEPTH + 0.15)
          );
        } else
          directions.forEach(index => {
            const arm = this.add
              .image(
                position.posX + TILE_SIZE / 2,
                position.posY + TILE_SIZE / 2,
                spriteName("groundPathHorizontal")
              )
              .setDisplaySize(TILE_SIZE, TILE_SIZE)
              .setAngle([90, 180, 0, 270][index]!)
              .setDepth(FARM_DEPTH + 0.15);
            arm.setCrop(
              arm.width * 0.35,
              arm.height * 0.35,
              arm.width * 0.65,
              arm.height * 0.3
            );
            roadImages.add(arm);
          });
        return tile;
      });
    };
    renderRoads();

    const farmBuildingPosition = toTilePosition({
      column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn,
      row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow
    });
    const initialFarmerPosition = toTilePosition(
      INITIAL_FARM_CONFIG.farmerSpawn
    );

    const farmBuilding = this.add
      .image(
        farmBuildingPosition.column * TILE_SIZE,
        farmBuildingPosition.row * TILE_SIZE,
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

    // Keep the outline outside the ground container so tiles cannot cover it.
    const boundary = this.add
      .graphics()
      .setDepth(BOUNDARY_DEPTH)
      .lineStyle(4, 0xe6a11b, 1)
      .strokeRect(0, 0, gameplayWidth, gameplayHeight);

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
      boundary.setPosition(farmTiles.x, farmTiles.y);
    };

    const levelSignpost = this.add
      .image(0, PROGRESSION_SIGNPOST.row * TILE_SIZE, spriteName("signpost"))
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(ACTOR_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    const levelReadyMark = this.add
      .text(0, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        fontStyle: "bold",
        color: colors.barleyLight,
        stroke: colors.soilDark,
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(ACTOR_DEPTH + 2);
    const positionLevelSignpost = () => {
      levelSignpost.setX(
        (farmPosition.column + PROGRESSION_SIGNPOST.column) * TILE_SIZE
      );
      levelReadyMark.setPosition(
        levelSignpost.x + TILE_SIZE * 0.5,
        levelSignpost.y + TILE_SIZE * 0.32
      );
    };
    let nextLevelReadyCheck = 0;
    const updateLevelReadyMark = () => {
      const now = Date.now();
      const progress = evaluateProgression(this.farmSnapshot, now);
      levelReadyMark.setText(progress.canClaim ? "+" : String(progress.level));
      nextLevelReadyCheck = now + 1_000;
    };
    updateLevelReadyMark();
    positionLevelSignpost();
    levelSignpost.on(
      Phaser.Input.Events.POINTER_UP,
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        interactionStore.getState().clearSelection();
        selectionHighlight.setVisible(false);
        buildingPlacementStore.getState().cancelPlacement();
        levelUiStore.getState().setOpen(true);
      }
    );

    positionFarm();
    positionLevelSignpost();

    // Keep the public market near the visible right edge, outside the estate.
    const marketBuilding = this.add
      .image(0, 0, spriteName("market"))
      .setOrigin(0)
      .setDisplaySize(MARKET_SIZE * TILE_SIZE, MARKET_SIZE * TILE_SIZE)
      // Buildings stay behind the farmer's actor layer, including on arrival.
      .setDepth(BUILDING_DEPTH)
      .setInteractive({ useHandCursor: true });

    const positionMarket = (): void => {
      const position = getMarketPosition(
        this.scale.width,
        this.scale.height,
        TILE_SIZE,
        [
          {
            x: farmPosition.column * TILE_SIZE,
            y: farmPosition.row * TILE_SIZE,
            width: gameplayWidth,
            height: gameplayHeight
          },
          {
            x: 0,
            y: RIVER_ROW * TILE_SIZE,
            width: this.scale.width,
            height: TILE_SIZE
          },
          {
            x: 0,
            y: INITIAL_FARM_CONFIG.roadRow * TILE_SIZE,
            width: this.scale.width,
            height: TILE_SIZE
          },
          ...this.farmSnapshot.objects.map(object => ({
            x: (farmPosition.column + object.column) * TILE_SIZE,
            y: (farmPosition.row + object.row) * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE
          }))
        ]
      );
      marketBuilding.setPosition(position.x, position.y);
    };

    marketBuilding.on(
      Phaser.Input.Events.POINTER_UP,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        if (visitingMarket) return;
        selectionHighlight.setVisible(false);
        interactionStore.getState().clearSelection();
        buildingPlacementStore.getState().cancelPlacement();
        activeBottomDialog?.destroy();
        activeBottomDialog = null;
        visitMarket();
      }
    );

    positionMarket();

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
        // Purchased equipment belongs to estate inventory, never a ground sprite.
        if (
          item.itemKey === "brewingVessels" ||
          item.itemKey === "donkey" ||
          item.itemKey === "bakingTools" ||
          item.itemKey === "emptyBeerJar" ||
          item.itemKey === "water" ||
          item.itemKey === "beer" ||
          item.itemKey === "bread" ||
          item.itemKey === "flour" ||
          item.itemKey === "brewersGroats" ||
          item.itemKey === "fish"
        )
          return;
        const position = translateTilePosition(farmPosition, item);
        const tileType = match(item.itemKey)
          .with("barley", () => spriteName("harvestedBarley"))
          .with("reed", () => spriteName("reedBundle"))
          .with("clay", () => spriteName("brickPile"))
          .exhaustive();
        const tile = createTile(position, tileType);
        const image = this.add
          .image(position.posX, position.posY, tileType)
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
            window.setTimeout(
              () => {
                renderCrops();
                rebuildGridAfterCropChange();
              },
              Math.max(0, nextTransition - currentTime)
            )
          );
        }

        if (tileType === null) {
          return;
        }

        const tile = createTile(position, tileType);
        const image = this.add
          .image(position.posX, position.posY, spriteName(tileType))
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
    const riverRow: number = RIVER_ROW; // 11th row (0-indexed)
    const riverTiles = this.add.group();
    let waterTileData: readonly Tile[] = [];

    const renderRiver = (): void => {
      riverTiles.clear(true, true);

      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const nextWaterTileData: Tile[] = [];

      for (let column = 0; column < columns; column++) {
        const waterImage = this.add
          .image(column * TILE_SIZE, riverRow * TILE_SIZE, spriteName("water"))
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
        waterImage.on(
          Phaser.Input.Events.POINTER_UP,
          (pointer: Phaser.Input.Pointer) => {
            if (this.farmSnapshot.farm.fishing) {
              void castFishing(pointer.worldX);
              return;
            }
            handlePointerUp(waterTile, selectionHighlight);
          }
        );

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
          .image(position.posX, position.posY, spriteName(sprite))
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
    let millBagTiles: readonly Tile[] = [];
    let buildingCompletionTimers: number[] = [];
    let buildingCountdownTimers: number[] = [];
    let rebuildGridAfterBuildingChange = (): void => undefined;

    const renderBuildings = (): void => {
      buildingCountdownTimers.forEach(timer => window.clearInterval(timer));
      buildingCountdownTimers = [];
      buildingTiles.clear(true, true);
      buildingCompletionTimers.forEach(timer => window.clearTimeout(timer));
      buildingCompletionTimers = [];
      const currentTime = Date.now();
      const nextBuildingTileData: Tile[] = [];
      const nextBagTiles: Tile[] = [];
      const occupied = new Set<string>();
      const block = (coordinate: GridCoordinate) =>
        occupied.add(toCoordinateKey(coordinate));
      [
        ...this.farmSnapshot.groundItems,
        ...this.farmSnapshot.crops,
        ...this.farmSnapshot.objects,
        ...this.farmSnapshot.improvements.filter(i =>
          isIrrigationVisible(i, currentTime)
        ),
        ...this.farmSnapshot.buildings.flatMap(b =>
          getBuildingFootprint(b.type, b)
        ),
        PROGRESSION_SIGNPOST
      ].forEach(p =>
        block({
          column: farmPosition.column + p.column,
          row: farmPosition.row + p.row
        })
      );
      const farmTile = getFarmBuildingTile();
      for (let row = 0; row < FARM_BUILDING_SIZE.rows; row++) {
        for (let column = 0; column < FARM_BUILDING_SIZE.columns; column++) {
          block({
            column: farmTile.position.column + column,
            row: farmTile.position.row + row
          });
        }
      }
      for (
        let row = Math.floor(marketBuilding.y / TILE_SIZE);
        row <
        Math.ceil(
          (marketBuilding.y + marketBuilding.displayHeight) / TILE_SIZE
        );
        row++
      ) {
        for (
          let column = Math.floor(marketBuilding.x / TILE_SIZE);
          column <
          Math.ceil(
            (marketBuilding.x + marketBuilding.displayWidth) / TILE_SIZE
          );
          column++
        )
          block({ column, row });
      }

      this.farmSnapshot.buildings.forEach(building => {
        const position = translateTilePosition(farmPosition, building);
        const completesAt = Date.parse(building.completesAt);
        const isComplete = completesAt <= currentTime;
        const tile: Tile = {
          ...createTile(position, spriteName(building.type)),
          buildingId: building.id
        };
        const image = this.add
          .image(
            position.posX,
            position.posY,
            spriteName(
              building.type === "mill"
                ? millSprite(building.id, this.farmSnapshot.farm.milling)
                : building.type === "breadOven" ? breadOvenSprite(building.id, this.farmSnapshot.farm.production)
                : building.type
            )
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
        const granaryCapacity = granaryCapacityForLevel(this.farmSnapshot.farm.progression?.level ?? 1);
        inventoryChipElement.title = `${building.storedBarley} of ${granaryCapacity} granary storage slots used`;
        inventoryChipElement.classList.toggle(
          "is-full",
          building.storedBarley >=
            granaryCapacity
        );
        const inventoryChip = this.add
          .dom(
            position.posX + TILE_SIZE,
            position.posY + 6,
            inventoryChipElement
          )
          .setOrigin(0.5, 0)
          .setDepth(ACTOR_DEPTH + 1)
          .setVisible(
            building.type === "granary" &&
              isComplete &&
              building.storedBarley > 0
          )
          .updateSize();

        if (
          building.type === "brewery" &&
          (!isComplete || building.beerReadyAt !== null)
        ) {
          inventoryChipElement.classList.remove("is-full");
          const updateCountdown = (): void => {
            const deadline = !isComplete
              ? completesAt
              : Date.parse(building.beerReadyAt!);
            const remainingSeconds = Math.max(
              0,
              Math.ceil((deadline - Date.now()) / 1_000)
            );
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = String(remainingSeconds % 60).padStart(2, "0");
            const label = !isComplete
              ? `Brewery construction: ${minutes}:${seconds} remaining`
              : remainingSeconds > 0
                ? `Brewing: ${minutes}:${seconds} remaining`
                : "2 beer jars ready to collect";
            inventoryChipElement.textContent = `${minutes}:${seconds}`;
            inventoryChipElement.title = label;
            inventoryChipElement.setAttribute("aria-label", label);
            inventoryChip.setVisible(remainingSeconds > 0).updateSize();
          };
          updateCountdown();
          buildingCountdownTimers.push(
            window.setInterval(updateCountdown, 1_000)
          );
        }

        if (!isComplete) {
          buildingCompletionTimers.push(
            window.setTimeout(
              () => {
                renderBuildings();
                rebuildGridAfterBuildingChange();
                updateFarmInventoryChip();
                farmStore.getState().setReady(this.farmSnapshot);
              },
              Math.max(0, completesAt - currentTime)
            )
          );
        }

        buildingTiles.addMultiple([image, inventoryChip]);
        const productionJob = building.type === "mill"
          ? (this.farmSnapshot.farm.milling?.buildingId === building.id ? this.farmSnapshot.farm.milling : null)
          : building.type === "breadOven" ? this.farmSnapshot.farm.production.baking[building.id] : null;
        if (isComplete && productionProgress(productionJob, currentTime) !== null) {
          const bar = createBuildingProductionBar(this,
            position.posX + TILE_SIZE, position.posY + TILE_SIZE * 1.82,
            TILE_SIZE * 1.2, ACTOR_DEPTH);
          const updateProgress = () => bar.update(productionProgress(productionJob, Date.now()));
          updateProgress();
          buildingTiles.add(bar.graphic);
          buildingCountdownTimers.push(window.setInterval(updateProgress, 250));
        }
        const bags = this.farmSnapshot.farm.millGoods.pending[building.id];
        const output = this.farmSnapshot.farm.production.pending[building.id];
        const quantity =
          output?.quantity ?? (bags ? bags.flour + bags.brewersGroats : 0);
        if (quantity > 0) {
          const freePosition = building.loadingTile
            ? translateTilePosition(farmPosition, building.loadingTile)
            : findMillBagTile(
                position,
                {
                  columns: Math.floor(this.scale.width / TILE_SIZE),
                  rows: Math.min(
                    Math.floor(this.scale.height / TILE_SIZE),
                    riverRow
                  )
                },
                p =>
                  !occupied.has(toCoordinateKey(p)) &&
                  !this.farmSnapshot.buildings.some(
                    b =>
                      b.loadingTile &&
                      toCoordinateKey(
                        translateTilePosition(farmPosition, b.loadingTile)
                      ) === toCoordinateKey(p)
                  )
              );
          if (freePosition) {
            block(freePosition);
            const bagPosition = toTilePosition(freePosition);
            const outputSprite = output
              ? output.itemKey === "beer"
                ? "beerJars"
                : "breadBasket"
              : "millBags";
            const bagTile: Tile = {
              ...createTile(bagPosition, outputSprite),
              millId: building.id,
              buildingId: building.id
            };
            nextBagTiles.push(bagTile);
            const bag = this.add
              .image(
                bagPosition.posX + TILE_SIZE / 2,
                bagPosition.posY + TILE_SIZE / 2,
                spriteName(outputSprite)
              )
              .setDisplaySize(TILE_SIZE, TILE_SIZE)
              .setDepth(BUILDING_DEPTH + 0.25)
              .setInteractive();
            bag.on(Phaser.Input.Events.POINTER_UP, () =>
              interactionStore.getState().selectTile(bagTile)
            );
            const chipElement = document.createElement("div");
            chipElement.className = "farm-inventory-chip";
            chipElement.textContent = output
              ? `${quantity} ${output.itemKey}`
              : `${quantity} ${quantity === 1 ? "bag" : "bags"}`;
            chipElement.title = output
              ? `${quantity} ${output.itemKey} ready to store`
              : `${bags!.flour} Flour, ${bags!.brewersGroats} Brewer's Groats`;
            const chip = this.add
              .dom(
                bagPosition.posX + TILE_SIZE / 2,
                bagPosition.posY,
                chipElement
              )
              .setOrigin(0.5, 1)
              .setDepth(ACTOR_DEPTH + 1)
              .updateSize();
            buildingTiles.addMultiple([bag, chip]);
          }
        }
        nextBuildingTileData.push(tile);
        interactionStore.getState().refreshSelectedTile(tile);
      });

      buildingTileData = nextBuildingTileData;
      millBagTiles = nextBagTiles;
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
          .image(position.posX, position.posY, sprite)
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

      const isAvailable = (coordinate: GridCoordinate) =>
        coordinate.column >= 0 &&
        coordinate.column < columns &&
        coordinate.row >= 0 &&
        coordinate.row < Math.min(rows, riverRow) &&
        !blockedCoordinates.has(toCoordinateKey(coordinate));
      const centralTile = findCentralFarmerTile(
        farmPosition,
        INITIAL_FARM_SIZE,
        isAvailable
      );
      if (isAvailable(preferredPosition)) return preferredPosition;
      const roadTile = Array.from({ length: columns }, (_, column) => ({
        column,
        row: preferredPosition.row
      }))
        .filter(isAvailable)
        .sort(
          (a, b) =>
            Math.abs(a.column - preferredPosition.column) -
            Math.abs(b.column - preferredPosition.column)
        )[0];
      if (roadTile) return toTilePosition(roadTile);
      if (centralTile !== null) return toTilePosition(centralTile);

      // A fully occupied plot may still have a free tile on the surrounding bank.
      return (
        findNearestAvailableTile(
          preferredPosition,
          { columns, rows },
          isAvailable
        ) ?? preferredPosition
      );
    };

    // Start on the road outside the farm, unless resuming an active task.
    farmerCommandStore
      .getState()
      .setCarriedItem(this.farmSnapshot.farm.carriedItem);
    const actorLayer = this.add.layer().setDepth(ACTOR_DEPTH);
    const farmer = this.add
      .image(
        0,
        0,
        spriteName(
          farmerCommandStore.getState().carriedItem === null
            ? "farmerIdle0"
            : "farmerHarvest3"
        )
      )
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setInteractive();
    let farmerPosition = this.farmSnapshot.farm.fishing
      ? toTilePosition({
          column: farmPosition.column + this.farmSnapshot.farm.fishing.column,
          row: riverRow - 1
        })
      : resolveInitialFarmerPosition();
    let farmerVisualOffset: PixelPosition = { x: 0, y: 0 };
    let farmerHasMoved = this.farmSnapshot.farm.fishing !== null;
    let activeFarmerMovement: Phaser.Tweens.TweenChain | null = null;
    let visitingMarket = false;
    let activeMovementCommand: MovementCommand | null = null;
    let bakingTrip: { readonly commandId: string; readonly phase: "collecting" | "delivering" } | null = null;
    let millingTrip: {
      readonly commandId: string;
      readonly source: ReturnType<typeof millingCollectionSource>;
      readonly worker: "farmer" | "donkey";
      readonly phase: "fetching_donkey" | "leading_donkey" | "entering_mill" | "collecting" | "delivering";
    } | null = null;
    let activeImprovementActionTimer: ActionDeadline | null = null;
    let roadWorkAnimation: ReturnType<typeof setInterval> | null = null;
    let activeBuildingActionTimer: ActionDeadline | null = null;
    let activeCropActionTimer: ActionDeadline | null = null;
    let activeHarvestTimer: ActionDeadline | null = null;
    let activeGatherTimer: ActionDeadline | null = null;
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
      if (!sceneIsActive) return;
      if (document.visibilityState === "visible") {
        activeCropActionTimer?.reconcile();
        activeImprovementActionTimer?.reconcile();
        activeBuildingActionTimer?.reconcile();
        activeHarvestTimer?.reconcile();
        activeGatherTimer?.reconcile();
        batchTimer?.reconcile();
        runPlantingBatch();
        reconcileCropStages();
        renderIrrigation();
        renderBuildings();
        rebuildGridAfterIrrigationChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
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
      .circle(0, 0, CARRY_BUBBLE_RADIUS, 0xffd45a, 1)
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

    const productionCargo = this.add
      .image(0, 0, spriteName("beerJars"))
      .setDisplaySize(TILE_SIZE * 0.45, TILE_SIZE * 0.45)
      .setVisible(false);
    actorLayer.add([
      farmer,
      productionCargo,
      farmerCarryBubble,
      farmerCarryBubbleText
    ]);

    const updateFarmerCarryBubblePosition = (): void => {
      const { x, y } = getCarryBubblePosition(
        farmer.x,
        farmer.y,
        TILE_SIZE,
        this.scale.width,
        this.scale.height
      );
      farmerCarryBubble.setPosition(x, y);
      farmerCarryBubbleText.setPosition(x, y);
      productionCargo.setPosition(
        farmer.x + TILE_SIZE * 0.6,
        farmer.y + TILE_SIZE * 0.65
      );
    };

    const updateFarmerCarryVisual = (): void => {
      const workingInside = !!farmerProductionJob(this.farmSnapshot.farm);
      farmer.setVisible(!workingInside);
      const delivery = this.farmSnapshot.farm.millGoods.delivery;
      const batchBarley = batchPlantingCarriedBarley(this.farmSnapshot, Date.now());
      const carriedItem =
        (this.farmSnapshot.farm.production.planting && batchBarley > 0
          ? { itemKey: "barley", quantity: batchBarley } : null) ??
        (bakingTrip?.phase === "delivering" ? { itemKey: "flour", quantity: BREAD_RECIPE.flour } : null) ??
        this.farmSnapshot.farm.production.delivery ??
        (delivery
          ? {
              itemKey: "flour",
              quantity: delivery.bags.flour + delivery.bags.brewersGroats
            }
          : millingTrip?.phase === "delivering"
            ? { itemKey: "barley", quantity: millingTrip.worker === "donkey" ? 6 : 2 }
            : farmerCommandStore.getState().carriedItem);
      const isCarrying = carriedItem !== null;
      const cargo = bakingTrip?.phase === "delivering" ? { itemKey: "flour" } : this.farmSnapshot.farm.production.delivery;
      productionCargo.setVisible(cargo !== null && !workingInside);
      if (cargo)
        productionCargo.setTexture(
          spriteName(cargo.itemKey === "flour" ? "millBags" : cargo.itemKey === "beer" ? "beerJars" : "breadBasket")
        );
      farmer
        .setTexture(
          spriteName(
            this.farmSnapshot.farm.production.planting?.phase.type === "harvesting"
              ? "farmerHarvest0"
              : this.farmSnapshot.farm.production.planting?.phase.type === "sowing"
              ? "farmerPlant0"
              : carriedItem?.itemKey === "fish"
              ? "farmerWithFish"
              : this.farmSnapshot.farm.fishing
                ? "farmerFishing"
                : isCarrying
                  ? "farmerHarvest3"
                  : activeFarmerMovement !== null
                    ? "farmerWalk0"
                    : "farmerIdle0"
          )
        )
        .setDisplaySize(TILE_SIZE, TILE_SIZE);
      farmerCarryBubble.setVisible(isCarrying && !workingInside);
      farmerCarryBubbleText
        .setText(isCarrying ? String(carriedItem.quantity) : "")
        .setVisible(isCarrying && !workingInside);
      updateFarmerCarryBubblePosition();
    };

    // Fishing stays in the Phaser world; React only supplies instructions/cancel.
    const swimmingFish = this.add
      .image(0, 0, spriteName("fish"))
      .setDisplaySize(TILE_SIZE * 0.6, TILE_SIZE * 0.6)
      .setDepth(ACTOR_DEPTH + 2)
      .setVisible(false);
    const fishingArea = this.add
      .rectangle(0, 0, 1, TILE_SIZE, 0xffffff, 0.08)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffd45a)
      .setDepth(ACTOR_DEPTH + 1)
      .setVisible(false);
    const hook = this.add
      .circle(0, 0, 7, 0xffd45a)
      .setDepth(ACTOR_DEPTH + 3)
      .setVisible(false);
    let fishingClockOffset =
      (this.farmSnapshot.farm.fishing?.serverNow ?? Date.now()) - Date.now();
    let casting = false;
    let nextCastAt = 0;
    let keyboardAim = 0.5;
    const roamingSeed = Math.floor(Math.random() * 4294967296);
    const roamingStartedAt = Date.now();
    const fishYAt = (now: number) =>
      riverFishY(
        riverRow * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE * 0.6,
        now - roamingStartedAt
      );
    let fishMode = "roaming";
    let transitionStartedAt = roamingStartedAt;
    let transitionFrom = this.scale.width / 2;
    let transitionDuration = 0;
    let respawnAt = 0;
    let fishReadyToCatch = false;
    swimmingFish
      .setPosition(transitionFrom, riverRow * TILE_SIZE + TILE_SIZE / 2)
      .setVisible(true);
    const fishingBounds = (
      column = this.farmSnapshot.farm.fishing?.column ?? 0
    ) => {
      const width = Math.min(TILE_SIZE * 4, this.scale.width);
      const x = Math.max(
        0,
        Math.min(
          this.scale.width - width,
          (farmPosition.column + column + 0.5) * TILE_SIZE - width / 2
        )
      );
      return { x, width, y: riverRow * TILE_SIZE };
    };
    const castFishing = async (worldX: number): Promise<void> => {
      const session = this.farmSnapshot.farm.fishing;
      if (!session || casting || Date.now() < nextCastAt) return;
      if (!fishReadyToCatch) {
        showBottomDialog("The fish is swimming into range. Get ready to cast!");
        return;
      }
      const bounds = fishingBounds();
      const aim = (worldX - bounds.x) / bounds.width;
      if (aim < 0 || aim > 1) return;
      casting = true;
      nextCastAt = Date.now() + CAST_COOLDOWN_MS;
      hook.setPosition(worldX, bounds.y).setVisible(true);
      this.tweens.add({
        targets: hook,
        y: fishYAt(Date.now() + CAST_DELAY_MS),
        duration: CAST_DELAY_MS
      });
      try {
        const snapshot = await executeGameCommand({
          type: "cast_fishing",
          sessionId: session.id,
          aim
        });
        if (!sceneIsActive) return;
        farmStore.getState().setReady(snapshot);
        updateFarmerCarryVisual();
        showBottomDialog(
          snapshot.farm.carriedItem?.itemKey === "fish"
            ? "Caught one fish! Store it at the farm or release it at the river."
            : "Missed! Watch its movement and cast ahead."
        );
      } catch (error) {
        if (sceneIsActive)
          showBottomDialog(
            error instanceof Error ? error.message : "The cast failed."
          );
      } finally {
        casting = false;
        if (sceneIsActive) hook.setVisible(false);
      }
    };
    const updateFishing = () => {
      const now = Date.now();
      const session = this.farmSnapshot.farm.fishing;
      const command = farmerCommandStore.getState().commands[0];
      const approaching =
        command?.type === "fishing" && command.action === "start"
          ? command
          : null;
      const mode = session
        ? `fishing:${session.id}`
        : approaching
          ? `approaching:${approaching.id}`
          : "roaming";
      if (mode !== fishMode) {
        transitionFrom = swimmingFish.x;
        transitionStartedAt = now;
        transitionDuration = session ? 1200 : 2500;
        fishMode = mode;
      }
      swimmingFish.setVisible(now >= respawnAt);
      fishingArea.setVisible(session !== null);
      fishReadyToCatch =
        session !== null &&
        now >= respawnAt &&
        now - transitionStartedAt >= transitionDuration;
      if (now < respawnAt) return;
      const bounds = fishingBounds(
        approaching && !session
          ? approaching.target.column - farmPosition.column
          : session?.column
      );
      const targetX = session
        ? bounds.x +
          fishPosition(
            session.seed,
            now + fishingClockOffset - session.startedAt
          ) *
            bounds.width
        : approaching
          ? bounds.x + bounds.width / 2
          : TILE_SIZE * 0.3 +
            fishPosition(roamingSeed, (now - roamingStartedAt) / 7) *
              Math.max(0, this.scale.width - TILE_SIZE * 0.6);
      const x = blendFishPosition(
        transitionFrom,
        targetX,
        now - transitionStartedAt,
        transitionDuration || 1
      );
      if (Math.abs(x - swimmingFish.x) > 0.01)
        swimmingFish.setFlipX(x < swimmingFish.x);
      swimmingFish.setPosition(x, fishYAt(now));
      if (session) {
        fishingArea
          .setPosition(bounds.x, bounds.y)
          .setSize(bounds.width, TILE_SIZE);
        farmer
          .setTexture(spriteName("farmerFishing"))
          .setDisplaySize(TILE_SIZE, TILE_SIZE);
      } else {
        hook.setVisible(false);
      }
    };
    const fishingKey = (event: KeyboardEvent) => {
      if (marketUiStore.getState().location !== "farm") return;
      if (
        !this.farmSnapshot.farm.fishing ||
        (event.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName))
      )
        return;
      const bounds = fishingBounds();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        keyboardAim = Math.max(
          0,
          Math.min(1, keyboardAim + (event.key === "ArrowLeft" ? -0.04 : 0.04))
        );
        if (!casting)
          hook
            .setPosition(
              bounds.x + keyboardAim * bounds.width,
              fishYAt(Date.now())
            )
            .setVisible(true);
      } else if (event.code === "Space") {
        event.preventDefault();
        void castFishing(bounds.x + keyboardAim * bounds.width);
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, updateFishing);
    window.addEventListener("keydown", fishingKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, updateFishing);
      window.removeEventListener("keydown", fishingKey);
    });

    const farmerRoadOffset = (position: GridCoordinate): number =>
      getFarmerRoadOffset(
        roadTileData.some(
          tile =>
            tile.position.column === position.column &&
            tile.position.row === position.row
        ),
        TILE_SIZE
      );

    const donkey = createDonkey(this);
    actorLayer.add(donkey.image);
    let donkeyTile: GridCoordinate | null = null;
    let nextGrazingAt = 0;
    const donkeyGrazingRestMs = 30_000;
    const donkeyFoot = (tile: GridCoordinate) => ({
      x: (tile.column + 0.5) * TILE_SIZE,
      y: (tile.row + 1) * TILE_SIZE + farmerRoadOffset(tile)
    });
    const grazingTiles = (): GridCoordinate[] => {
      const occupied = new Set([
        ...farmObjectTileData, ...groundItemTileData, ...millBagTiles
      ].map(tile => toCoordinateKey(tile.position)));
      for (const b of this.farmSnapshot.buildings) {
        for (const tile of getBuildingFootprint(b.type, b)) occupied.add(toCoordinateKey(translateTilePosition(farmPosition, tile)));
      }
      for (const improvement of this.farmSnapshot.improvements) occupied.add(toCoordinateKey(translateTilePosition(farmPosition, improvement)));
      const marketColumn = Math.floor(marketBuilding.x / TILE_SIZE);
      const marketRow = Math.floor(marketBuilding.y / TILE_SIZE);
      return groundTileData.map(tile => tile.position).filter(tile => {
        const localColumn = tile.column - farmPosition.column;
        const localRow = tile.row - farmPosition.row;
        const plot = INITIAL_FARM_CONFIG.plotBounds;
        return tile.row < riverRow && tile.column < Math.floor(this.scale.width / TILE_SIZE) &&
          (localColumn < plot.minimumColumn || localColumn > plot.maximumColumn || localRow < plot.minimumRow || localRow > plot.maximumRow) &&
          !(tile.column >= marketColumn && tile.column < marketColumn + 2 && tile.row >= marketRow && tile.row < marketRow + 2) &&
          !occupied.has(toCoordinateKey(tile)) &&
          !(tile.column === farmerPosition.column && tile.row === farmerPosition.row);
      });
    };
    const resetDonkey = () => { donkey.stop(); donkeyTile = null; nextGrazingAt = 0; };
    const updateDonkey = () => {
      const owned = this.farmSnapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0);
      const trip = millingTrip?.worker === "donkey" ? millingTrip : null;
      const inside = this.farmSnapshot.farm.milling?.worker === "donkey" || trip?.phase === "collecting" || trip?.phase === "delivering";
      donkey.image.setVisible(owned && !inside && !visitingMarket);
      if (!owned || inside || visitingMarket || trip) return;
      const candidates = grazingTiles();
      if (!donkeyTile || !candidates.some(t => t.column === donkeyTile!.column && t.row === donkeyTile!.row)) {
        donkey.stop();
        donkeyTile = candidates[0] ?? null;
        if (!donkeyTile) { donkey.image.setVisible(false); return; }
        const foot = donkeyFoot(donkeyTile);
        donkey.image.setPosition(foot.x, foot.y);
        nextGrazingAt = this.time.now + donkeyGrazingRestMs;
      }
      if (donkey.isMoving() || this.time.now < nextGrazingAt) return;
      nextGrazingAt = this.time.now + donkeyGrazingRestMs;
      const adjacent = adjacentGrazingTiles(donkeyTile, candidates);
      const next = adjacent[Math.floor(Math.random() * adjacent.length)];
      if (next) {
        donkeyTile = next;
        donkey.move(donkeyFoot(next), 900, () => {
          nextGrazingAt = this.time.now + donkeyGrazingRestMs;
        });
      }
    };

    const standingBesideGoods = (target: TilePosition): TilePosition => toTilePosition(productionStandingTile(
      target, roadTileData.map(tile => tile.position), millBagTiles.map(tile => tile.position)
    ));
    const avoidStandingOnGoods = (): void => {
      const next = standingBesideGoods(farmerPosition);
      if (next.column === farmerPosition.column && next.row === farmerPosition.row) return;
      farmerPosition = next;
      farmerVisualOffset = { x: 0, y: 0 };
      positionFarmer();
    };
    const positionFarmer = (): void => {
      farmer.setPosition(
        farmerPosition.column * TILE_SIZE + farmerVisualOffset.x,
        farmerPosition.row * TILE_SIZE +
          farmerRoadOffset(farmerPosition) +
          farmerVisualOffset.y
      );
      updateFarmerCarryBubblePosition();
    };

    positionFarmer();
    avoidStandingOnGoods();
    updateFarmerCarryVisual();

    const handleSceneUpdate = (): void => {
      updateDonkey();
      updateFarmerCarryBubblePosition();
      if (Date.now() >= nextLevelReadyCheck) updateLevelReadyMark();
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
          localPosition.row === INITIAL_FARM_CONFIG.roadRow
            ? "groundPathHorizontal"
            : "groundVariant"
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
        for (const coordinate of getBuildingFootprint(
          buildingTile.type === "breadOven"
            ? "breadOven"
            : buildingTile.type === "mill"
              ? "mill"
              : buildingTile.type === "brewery"
                ? "brewery"
                : "granary",
          {
            column: buildingTile.position.column,
            row: buildingTile.position.row
          }
        )) {
          entries.push({ tile: buildingTile, coordinate });
        }
      }

      for (const tile of roadTileData) {
        if (
          !this.farmSnapshot.improvements.some(
            i =>
              toCoordinateKey(translateTilePosition(farmPosition, i)) ===
              toCoordinateKey(tile.position)
          )
        )
          entries.push({ tile, coordinate: tile.position });
      }
      for (const tile of millBagTiles)
        entries.push({ tile, coordinate: tile.position });
      gridStore.getState().replaceGrid(entries);
    };

    rebuildGridAfterIrrigationChange = rebuildGrid;
    rebuildGridAfterCropChange = rebuildGrid;
    rebuildGridAfterBuildingChange = rebuildGrid;

    rebuildGrid();

    const moveFarmerTo = (
      targetPosition: TilePosition,
      onComplete: (outcome: FarmerMovementOutcome) => void,
      onFailure: (reason: string) => void,
      arrivalAlignment: FarmerArrivalAlignment = "overlap"
    ): void => {
      if (farmerProductionJob(this.farmSnapshot.farm)) {
        onFailure("The farmer is busy milling or baking. Wait for the job to finish.");
        return;
      }
      const movementTarget = constrainTargetToRiverBank(
        farmerPosition,
        standingBesideGoods(targetPosition),
        riverRow
      );
      const destinationPosition = movementTarget.position;

      if (
        arrivalAlignment === "overlap" &&
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
      updateFarmerCarryVisual();
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

      const roadCoordinates = new Set(
        roadTileData.map(t => toCoordinateKey(t.position))
      );
      const path = findRoadPreferredPath(
        farmerPosition,
        destinationPosition,
        {
          columns: gridColumns,
          rows: Math.ceil(this.scale.height / TILE_SIZE)
        },
        blockedCoordinates,
        roadCoordinates
      );

      if (path === null) {
        onFailure("The selected tile cannot be reached.");
        return;
      }

      if (path.length < 2 && arrivalAlignment === "overlap") {
        onComplete(
          movementTarget.type === "blocked"
            ? { type: "blocked", reason: "The river blocks the way." }
            : { type: "arrived" }
        );
        return;
      }

      const penultimatePosition = path.at(-2);
      const finalPosition = path.at(-1);

      if (finalPosition === undefined) {
        return;
      }

      const finalDirection =
        penultimatePosition === undefined
          ? null
          : getCardinalDirection(penultimatePosition, finalPosition);

      if (finalDirection === null && arrivalAlignment === "overlap") {
        return;
      }

      const unadjustedDestination =
        movementTarget.type === "blocked"
          ? {
              x: destinationPosition.column * TILE_SIZE,
              y: destinationPosition.row * TILE_SIZE
            }
          : getFarmerDestination(
              destinationPosition,
              finalDirection,
              TILE_SIZE,
              roadCoordinates.has(toCoordinateKey(destinationPosition))
                ? "tile"
                : arrivalAlignment
            );
      const destination = {
        ...unadjustedDestination,
        y: unadjustedDestination.y + farmerRoadOffset(destinationPosition)
      };
      const route = createMovementWaypoints(
        { x: farmer.x, y: farmer.y },
        path,
        destination,
        farmerRoadOffset
      );
      const completeMovement = (): void => {
        farmerPosition = destinationPosition;
        farmerVisualOffset = {
          x: destination.x - destinationPosition.column * TILE_SIZE,
          y:
            destination.y -
            destinationPosition.row * TILE_SIZE -
            farmerRoadOffset(destinationPosition)
        };
        farmerHasMoved = true;
        activeFarmerMovement = null;
        avoidStandingOnGoods();
        updateFarmerCarryVisual();
        rebuildGrid();
        onComplete(
          movementTarget.type === "blocked"
            ? { type: "blocked", reason: "The river blocks the way." }
            : { type: "arrived" }
        );
      };
      let previousWaypoint: PixelPosition = { x: farmer.x, y: farmer.y };
      const movementDurationPerTile =
        FARMER_MOVE_DURATION_PER_TILE *
        farmerMovementDurationMultiplier(
          this.farmSnapshot.farm.household.happiness,
          this.farmSnapshot.farm.household.hungrySince !== null,
          this.farmSnapshot.farm.progression?.level ?? 1
        );
      const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = route.map(
        waypoint => {
          const horizontalDistance = waypoint.x - previousWaypoint.x;
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
            onStart: () => {
              if (millingTrip?.phase === "leading_donkey") {
                donkey.move({ x: farmer.x + TILE_SIZE / 2, y: farmer.y + TILE_SIZE }, (distance / TILE_SIZE) * movementDurationPerTile);
              }
              if (horizontalDistance !== 0) {
                farmer.setFlipX(horizontalDistance < 0);
              }
            },
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
      updateFarmerCarryVisual();
    };

    const completeMovementCommand = (commandId: string): void => {
      if (bakingTrip?.commandId === commandId) {
        bakingTrip = null;
        updateFarmerCarryVisual();
      }
      if (millingTrip?.commandId === commandId) {
        if (millingTrip.worker === "donkey") resetDonkey();
        millingTrip = null;
        updateFarmerCarryVisual();
      }
      const commandState = farmerCommandStore.getState();
      commandState.removeCommand(commandId);
      commandState.setStatus({ type: "idle" });
      activeMovementCommand = null;
      processNextMovementCommand();
    };

    const marketRoadPosition = (): TilePosition =>
      toTilePosition({
        column: Math.max(
          0,
          Math.min(
            Math.floor((this.scale.width - TILE_SIZE) / TILE_SIZE),
            Math.floor((marketBuilding.x + TILE_SIZE) / TILE_SIZE)
          )
        ),
        row: INITIAL_FARM_CONFIG.roadRow
      });
    const farmerIsCarryingForMarket = (): boolean =>
      isCarryingForMarket(
        this.farmSnapshot.farm.carriedItem ??
          farmerCommandStore.getState().carriedItem,
        this.farmSnapshot.farm.millGoods.delivery !== null ||
          this.farmSnapshot.farm.production.delivery !== null,
        millingTrip?.phase === "delivering" || bakingTrip?.phase === "delivering"
      );
    const visitMarket = (): void => {
      if (millingTrip?.worker === "donkey") {
        showBottomDialog("Bring the donkey and barley to the Mill first.");
        return;
      }
      if (
        this.farmSnapshot.farm.roads.some(r => !roadIsComplete(r, Date.now()))
      ) {
        showBottomDialog("Finish building the road first.");
        return;
      }
      if (this.farmSnapshot.farm.production.planting || batchPlantingStore.getState().active) {
        showBottomDialog("Finish or stop working on the selected fields first.");
        return;
      }
      if (farmerIsCarryingForMarket()) {
        showBottomDialog(MARKET_UNLOAD_MESSAGE);
        return;
      }
      if (farmerProductionJob(this.farmSnapshot.farm)) {
        showBottomDialog("The farmer is busy milling or baking. Wait for the job to finish.");
        return;
      }
      if (!canEnterMarket(this.farmSnapshot.farm.progression?.level)) {
        showBottomDialog(
          `The market unlocks at farm level ${MARKET_UNLOCK_LEVEL}.`
        );
        return;
      }
      visitingMarket = true;
      showBottomDialog("Going to the market...");
      activeBottomDialogTimer?.remove(false);
      activeBottomDialogTimer = null;
      this.input.enabled = false;
      activeFarmerMovement?.stop();
      activeFarmerMovement = null;
      updateFarmerCarryVisual();
      const travelFailed = (reason: string) => {
        visitingMarket = false;
        this.input.enabled = true;
        showBottomDialog(reason);
        resumeInterruptedMovement();
      };
      moveFarmerTo(
        marketRoadPosition(),
        outcome => {
          if (!sceneIsActive) return;
          if (outcome.type !== "arrived") {
            travelFailed(outcome.reason);
            return;
          }
          if (farmerIsCarryingForMarket()) {
            travelFailed(MARKET_UNLOAD_MESSAGE);
            return;
          }
          activeBottomDialogTimer?.remove(false);
          activeBottomDialogTimer = null;
          activeBottomDialog?.destroy();
          activeBottomDialog = null;
          marketUiStore.getState().setLocation("market");
          this.scene.setVisible(false);
          this.scene.launch("market-scene");
        },
        travelFailed
      );
    };
    const returnFromMarket = (): void => {
      activeFarmerMovement?.stop();
      activeFarmerMovement = null;
      farmerPosition = marketRoadPosition();
      farmerVisualOffset = { x: 0, y: 0 };
      farmerHasMoved = true;
      positionFarmer();
      updateFarmerCarryVisual();
      rebuildGrid();
      visitingMarket = false;
      resumeInterruptedMovement();
    };
    const resumeInterruptedMovement = (): void => {
      // Resume interrupted travel without re-running work already in progress.
      if (
        activeMovementCommand !== null &&
        farmerCommandStore.getState().status.type === "moving"
      ) {
        const command = activeMovementCommand;
        moveFarmerTo(
          getMovementTarget(command),
          outcome => completeCommandMovement(command, outcome),
          reason => failMovementCommand(command.id, reason),
          getFarmerArrivalAlignment(command)
        );
      } else {
        processNextMovementCommand();
      }
    };
    this.events.on("return-from-market", returnFromMarket);

    const failMovementCommand = (commandId: string, reason: string): void => {
      if (bakingTrip?.commandId === commandId) {
        bakingTrip = null;
        updateFarmerCarryVisual();
      }
      if (millingTrip?.commandId === commandId) {
        if (millingTrip.worker === "donkey") resetDonkey();
        millingTrip = null;
        updateFarmerCarryVisual();
      }
      const commandState = farmerCommandStore.getState();
      const failedCommand = commandState.commands.find(
        command => command.id === commandId
      );

      if (
        failedCommand?.type === "build" &&
        failedCommand.build !== "irrigation"
      ) {
        buildingPlacementStore.getState().cancelPlacement();
      }

      commandState.removeCommand(commandId);
      commandState.setStatus({ type: "failed", commandId, reason });
      activeMovementCommand = null;
    };

    const showBottomDialog = (message: string): void => {
      if (marketUiStore.getState().location !== "farm") return;
      activeBottomDialogTimer?.remove(false);
      activeBottomDialog?.destroy();

      const element = document.createElement("div");
      element.className =
        "dialog-bottom-container nes-container is-centered is-rounded";
      element.textContent = message;
      element.setAttribute("role", "status");
      element.style.maxWidth = `${Math.max(0, Math.min(560, this.scale.width - 32))}px`;

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

    installDogFetch(
      this,
      () => ({ x: farmer.x + TILE_SIZE / 2, y: farmer.y + TILE_SIZE / 2 }),
      (column, row) =>
        column * TILE_SIZE < marketBuilding.x + TILE_SIZE * 2 &&
        (column + 1) * TILE_SIZE > marketBuilding.x &&
        row * TILE_SIZE < marketBuilding.y + TILE_SIZE * 2 &&
        (row + 1) * TILE_SIZE > marketBuilding.y,
      () => farmPosition,
      () =>
        activeFarmerMovement === null &&
        activeMovementCommand === null &&
        activeBuildingActionTimer === null &&
        activeCropActionTimer === null &&
        activeHarvestTimer === null &&
        activeGatherTimer === null &&
        activeImprovementActionTimer === null &&
        farmerCommandStore.getState().commands.length === 0 &&
        buildingPlacementStore.getState().placement.type === "idle" &&
        !visitingMarket &&
        !this.farmSnapshot.farm.production.planting &&
        !batchPlantingStore.getState().active &&
        !farmerProductionJob(this.farmSnapshot.farm) &&
        !this.farmSnapshot.farm.millGoods.delivery &&
        !this.farmSnapshot.farm.production.delivery &&
        this.farmSnapshot.farm.fishing === null,
      showBottomDialog
    );

    installMerchantChariot(
      this,
      () => merchantStopColumn(farmPosition.column),
      () => {
        interactionStore.getState().clearSelection();
        showBottomDialog("Merchant chariot");
      },
      () => {
        interactionStore.getState().clearSelection();
        selectionHighlight.setVisible(false);
        activeBottomDialogTimer?.remove(false);
        activeBottomDialogTimer = null;
        activeBottomDialog?.destroy();
        activeBottomDialog = null;
      }
    );

    const buildingPlacementPreview = this.add
      .image(0, 0, spriteName("granary"))
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
      .setDepth(ACTOR_DEPTH + 2)
      .setAlpha(0.55)
      .setVisible(false);
    let placementTarget: TilePosition | null = null;
    const footprintPreviews = Array.from({ length: 4 }, () => this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0x72c472, 0.15)
      .setOrigin(0)
      .setDepth(ACTOR_DEPTH + 3)
      .setVisible(false));
    const loadingPreview = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffd45a, 0.2)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffd45a)
      .setDepth(ACTOR_DEPTH + 2)
      .setVisible(false);
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
      [
        ...this.farmSnapshot.groundItems,
        ...this.farmSnapshot.inventory.filter(
          item => item.itemKey === "brewingVessels" || item.itemKey === "bakingTools"
        )
      ].reduce<Partial<Record<InventoryItemKey, number>>>(
        (quantities, item) => ({
          ...quantities,
          [item.itemKey]: (quantities[item.itemKey] ?? 0) + item.quantity
        }),
        {}
      );

    const updateBuildingPlacementPreview = (
      pointer: Phaser.Input.Pointer
    ): void => {
      const placement = buildingPlacementStore.getState().placement;

      if (placement.type !== "placing") {
        footprintPreviews.forEach(preview => preview.setVisible(false));
        loadingPreview.setVisible(false);
        buildingPlacementPreview.setVisible(false);
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
      const placementValidation = validateBuildingPlacement({
        roads: this.farmSnapshot.farm.roads,
        reservedLoadingTiles: this.farmSnapshot.buildings.flatMap(b =>
          b.loadingTile ? [b.loadingTile] : []
        ),
        granaryLimit: granaryLimitForLevel(
          this.farmSnapshot.farm.progression?.level ?? 1
        ),
        existingBuildings: this.farmSnapshot.buildings,
        building: placement.building,
        target: localCoordinate,
        occupiedCoordinates: getOccupiedFarmCoordinates(),
        carriedItem: farmerCommandStore.getState().carriedItem?.itemKey ?? null,
        availableMaterials: getAvailableGroundMaterials()
      });
      const rule: BuildingPlacementRule =
        placementValidation.type === "valid" &&
        !preservesBuildingAccess({
          buildings: [
            ...this.farmSnapshot.buildings,
            { ...localCoordinate, type: placement.building }
          ],
          columnBounds: {
            minimumColumn: -farmPosition.column,
            maximumColumn:
              Math.ceil(this.scale.width / TILE_SIZE) - 1 - farmPosition.column
          }
        })
          ? { type: "access_blocked" }
          : placementValidation;

      placementTarget = toTilePosition(globalCoordinate);
      const loading = findLoadingTile(
        getBuildingFootprint(placement.building, localCoordinate),
        this.farmSnapshot.farm.roads,
        this.farmSnapshot.buildings.flatMap(b =>
          b.loadingTile ? [b.loadingTile] : []
        ),
        getOccupiedFarmCoordinates()
      );
      loadingPreview.setVisible(rule.type === "valid" && loading !== null);
      if (loading) {
        const p = translateTilePosition(farmPosition, loading);
        loadingPreview.setPosition(p.posX, p.posY);
      }
      placementRule = rule;
      const occupied = getOccupiedFarmCoordinates();
      getBuildingFootprint(placement.building, localCoordinate).forEach((coordinate, index) => {
        const blocked = !isInsideBuildingPlot(coordinate) || occupied.has(toCoordinateKey(coordinate)) ||
          isProgressionSignpost(coordinate) ||
          coordinate.row === INITIAL_FARM_CONFIG.roadRow ||
          this.farmSnapshot.farm.roads.some(road => road.column === coordinate.column && road.row === coordinate.row);
        const position = translateTilePosition(farmPosition, coordinate);
        footprintPreviews[index]?.setPosition(position.posX, position.posY)
          .setFillStyle(blocked ? 0xd65c5c : 0x72c472, blocked ? 0.4 : 0.1)
          .setStrokeStyle(2, blocked ? 0xd65c5c : 0x72c472)
          .setVisible(true);
      });
      buildingPlacementPreview
        .setTexture(placement.building)
        .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
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
      updateBuildingPlacementPreview(pointer);
    };

    const handlePlacementPointerUp = (pointer: Phaser.Input.Pointer): void => {
      const placement = buildingPlacementStore.getState().placement;

      if (placement.type === "placing" && pointer.rightButtonReleased()) {
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

      // Recheck at click time in case the farmer or world changed while hovering.
      updateBuildingPlacementPreview(pointer);
      if (placementRule.type !== "valid") {
        showBottomDialog(describeBuildingPlacementRule(placementRule));
        buildingPlacementStore.getState().cancelPlacement();
        return;
      }

      const confirmedTarget = placementTarget;
      buildingPlacementStore.getState().setSubmitting(placement.building);
      farmerCommandStore.getState().addCommand({
        type: "build",
        build: placement.building,
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
          updateBuildingPlacementPreview(this.input.activePointer);
        } else {
          buildingPlacementPreview.setVisible(false);
          footprintPreviews.forEach(preview => preview.setVisible(false));
          loadingPreview.setVisible(false);
          placementTarget = null;
          placementRule = null;
        }
      }
    );

    this.input.on(Phaser.Input.Events.POINTER_MOVE, handlePlacementPointerMove);
    this.input.on(Phaser.Input.Events.POINTER_UP, handlePlacementPointerUp);
    this.input.keyboard?.on("keydown", handlePlacementEscape);

    const handleFarmerArrival = (command: InspectCommand): void => {
      match(command.target.type)
        .with("ground", () => {
          // checks if there is a water tile adjacent to the ground tile
          const adjacentTiles = gridStore
            .getState()
            .findAdjacentTiles(command.target.position);
          showBottomDialog(
            getGroundArrivalMessage(Object.values(adjacentTiles))
          );
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
      return translateTilePosition(
        farmPosition,
        INITIAL_FARM_CONFIG.farmerSpawn
      );
    };

    const getBuildingInteractionTarget = (
      target: TilePosition,
      building: FarmBuildingType = "granary"
    ): TilePosition => {
      const existing = this.farmSnapshot.buildings.find(
        b =>
          b.column === target.column - farmPosition.column &&
          b.row === target.row - farmPosition.row
      );
      if (existing?.loadingTile)
        return translateTilePosition(farmPosition, existing.loadingTile);
      const { columns, rows } = FARM_BUILDING_DEFINITIONS[building].footprint;
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
            tile?.type !== "brewery" &&
            tile?.type !== "mill" &&
            tile?.type !== "breadOven" &&
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
        .with({ type: "move" }, ({ target }) => target)
        .with({ type: "production" }, command => {
          if (command.action === "bake" && bakingTrip?.commandId === command.id && bakingTrip.phase === "collecting") return getFarmDepositTarget();
          if (command.action === "store")
            return this.farmSnapshot.farm.production.delivery
              ? getFarmDepositTarget()
              : (millBagTiles.find(t => t.buildingId === command.buildingId)
                  ?.position ?? command.target);
          return getBuildingInteractionTarget(command.target, "breadOven");
        })
        .with({ type: "store_mill_goods" }, command => {
          const delivery = this.farmSnapshot.farm.millGoods.delivery;
          if (!delivery)
            return (
              millBagTiles.find(tile => tile.millId === command.millId)
                ?.position ?? command.target
            );
          return getFarmDepositTarget();
        })
        .with({ type: "mill" }, ({ target, id }) => {
          const trip = millingTrip?.commandId === id ? millingTrip : null;
          if (trip?.phase === "fetching_donkey" && donkeyTile) return toTilePosition(donkeyTile);
          if (trip?.phase === "collecting" && trip.source) {
            return trip.source.type === "farm"
              ? getFarmDepositTarget()
              : getBuildingInteractionTarget(
                  translateTilePosition(farmPosition, trip.source),
                  "granary"
                );
          }
          return getBuildingInteractionTarget(target, "mill");
        })
        .with({ type: "fishing" }, ({ action, target }) =>
          action === "store"
            ? getFarmDepositTarget()
            : toTilePosition({ column: target.column, row: riverRow - 1 })
        )
        .with({ type: "brewery_supply" }, ({ action, target }) =>
          action === "deliver" ||
          action === "stock_jars" ||
          action === "start_brewing" ||
          action === "collect_beer" ||
          action === "give_beer"
            ? getBuildingInteractionTarget(target, "brewery")
            : target.row === riverRow
              ? toTilePosition({ column: target.column, row: riverRow - 1 })
              : target
        )
        .with({ type: "inspect" }, ({ target }) => target.position)
        .with(
          { type: "build", build: P.union("irrigation", "road") },
          ({ target }) => target
        )
        .with(
          {
            type: "build",
            build: P.union("granary", "brewery", "mill", "breadOven")
          },
          buildCommand =>
            getBuildingInteractionTarget(
              buildCommand.target,
              buildCommand.build
            )
        )
        .with({ type: "destroy" }, ({ target }) => target)
        .with({ type: "pickup" }, ({ target }) => target)
        .with({ type: "drop" }, ({ target }) => target)
        .with({ type: "deposit", storage: "farm" }, () =>
          getFarmDepositTarget()
        )
        .with({ type: "deposit", storage: "granary" }, ({ target }) =>
          getBuildingInteractionTarget(target)
        )
        .with({ type: "withdraw", storage: "farm" }, () =>
          getFarmDepositTarget()
        )
        .with({ type: "withdraw", storage: "granary" }, ({ target }) =>
          getBuildingInteractionTarget(target)
        )
        .with({ type: "plant" }, ({ target }) => target)
        .with({ type: "harvest" }, ({ target }) => target)
        .with({ type: "gather" }, ({ target }) => target)
        .exhaustive();

    const waitForRoadConstruction = (
      road: FarmRoad,
      commandId: string,
      resuming = false
    ): void => {
      farmerCommandStore.getState().setStatus({ type: "building", commandId });
      if (resuming) {
        farmerPosition = translateTilePosition(farmPosition, road);
        farmerVisualOffset = { x: 0, y: 0 };
        farmerHasMoved = true;
        positionFarmer();
      }
      showBottomDialog("Building the road...");
      let frame = 0;
      const animate = () => {
        farmer
          .setTexture(
            spriteName(frame++ % 2 === 0 ? "farmerPlant0" : "farmerPlant1")
          )
          .setDisplaySize(TILE_SIZE, TILE_SIZE);
      };
      animate();
      roadWorkAnimation = setInterval(animate, 400);
      activeImprovementActionTimer = scheduleActionDeadline(
        road.completesAt ?? Date.now(),
        () => {
          if (roadWorkAnimation !== null) clearInterval(roadWorkAnimation);
          roadWorkAnimation = null;
          activeImprovementActionTimer = null;
          if (!sceneIsActive) return;
          renderRoads();
          rebuildGrid();
          updateFarmerCarryVisual();
          showBottomDialog(
            "Road complete. Extend it from any adjacent empty tile."
          );
          completeMovementCommand(commandId);
        }
      );
    };

    const startRoadConstruction = (command: BuildCommand): void => {
      activeMovementCommand = null;
      farmerCommandStore
        .getState()
        .setStatus({ type: "building", commandId: command.id });
      void executeGameCommand({
        type: "build_road",
        target: {
          column: command.target.column - farmPosition.column,
          row: command.target.row - farmPosition.row
        },
        expectedFarmVersion: this.farmSnapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);
          if (!sceneIsActive) return;
          const road = snapshot.farm.roads.find(
            r =>
              r.column === command.target.column - farmPosition.column &&
              r.row === command.target.row - farmPosition.row
          );
          if (road) waitForRoadConstruction(road, command.id);
          else failMovementCommand(command.id, "The road could not be found.");
        })
        .catch(error => {
          if (!sceneIsActive) return;
          const reason =
            error instanceof Error
              ? error.message
              : "The road could not be built.";
          showBottomDialog(reason);
          failMovementCommand(command.id, reason);
        });
    };

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

          activeImprovementActionTimer = scheduleActionDeadline(
            Date.parse(improvement.completesAt),
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

    const startBuildingConstruction = (command: BuildingBuildCommand): void => {
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
        type:
          command.build === "breadOven"
            ? "build_bread_oven"
            : command.build === "mill"
              ? "build_mill"
              : command.build === "brewery"
                ? "build_brewery"
                : "build_granary",
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
              candidate.type === command.build &&
              candidate.column === relativeTarget.column &&
              candidate.row === relativeTarget.row
          );

          if (building === undefined) {
            failMovementCommand(
              command.id,
              `The ${command.build} was not returned by the server.`
            );
            return;
          }

          showBottomDialog(`Building the ${command.build}...`);
          const finishConstruction = (): void => {
            activeBuildingActionTimer = null;
            renderBuildings();
            rebuildGrid();
            updateFarmInventoryChip();
            farmStore.getState().setReady(this.farmSnapshot);
            showBottomDialog(`The ${command.build} is complete.`);
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

          activeBuildingActionTimer = scheduleActionDeadline(
            Date.parse(building.completesAt),
            finishConstruction
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
              : `The ${command.build} could not be built.`;
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

          activeImprovementActionTimer = scheduleActionDeadline(
            Date.parse(improvement.destroyCompletesAt),
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
          .with({ type: "mill" }, () => ({
            type: "milling",
            commandId: command.id
          }))
          .with({ type: "fishing" }, () => ({
            type: "depositing",
            commandId: command.id
          }))
          .with({ type: "brewery_supply" }, () => ({
            type: "depositing",
            commandId: command.id
          }))
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
        .with({ type: "mill" }, command =>
          executeGameCommand({
            type: "start_milling",
            recipe: command.recipe,
            worker: command.worker,
            target: {
              column: command.target.column - farmPosition.column,
              row: command.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "fishing" }, fishing =>
          executeGameCommand({
            type: "fishing",
            action: fishing.action,
            target: {
              column: fishing.target.column - farmPosition.column,
              row: fishing.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
        .with({ type: "brewery_supply" }, supply =>
          executeGameCommand({
            type: "brewery_supply",
            action: supply.action,
            target: {
              column: supply.target.column - farmPosition.column,
              row: supply.target.row - farmPosition.row
            },
            expectedFarmVersion: farmState.snapshot.farm.version
          })
        )
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
                { type: "mill" },
                command =>
                  command.worker === "donkey" ? `The donkey is milling ${MILL_RECIPES[command.recipe].label}. The farmer is free to work.` : `The farmer is milling ${MILL_RECIPES[command.recipe].label}.`
              )
              .with({ type: "fishing" }, ({ action }) =>
                action === "start"
                  ? "Cast ahead of the fish: click or tap the highlighted river."
                  : action === "store"
                    ? "Fish stored at the farm."
                    : "Fish released into the river."
              )
              .with({ type: "brewery_supply" }, ({ action }) =>
                match(action)
                  .with(
                    "collect_water",
                    () => "The farmer collected one load of water."
                  )
                  .with("pour_water", () => "The water was poured out.")
                  .with("deliver", () => "Supplies delivered to the brewery.")
                  .with(
                    "stock_jars",
                    () => "Empty beer jars transferred to the brewery."
                  )
                  .with(
                    "start_brewing",
                    () => "Brewing started. \nThe farmer is free to work."
                  )
                  .with(
                    "collect_beer",
                    () => "Collected beer added to estate inventory."
                  )
                  .with(
                    "give_beer",
                    () => "A beer for the farmer! Happiness increased."
                  )
                  .exhaustive()
              )
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
            .setTexture(spriteName("farmerHarvest0"))
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

          activeGatherTimer = scheduleActionDeadline(
            Date.parse(gathering.completesAt) + 25,
            finishGathering
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
            .setTexture(spriteName("farmerPlant0"))
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

          activeCropActionTimer = scheduleActionDeadline(
            Date.parse(plantedCrop.plantedAt),
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
          crop => crop.column === target.column && crop.row === target.row
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
          .setTexture(spriteName("farmerHarvest0"))
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
                "Harvested 2 barley. \nStore it or drop it on arable land."
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

        activeHarvestTimer = scheduleActionDeadline(
          Date.parse(crop.harvestCompletesAt),
          finishHarvest
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

    const advanceMillDelivery = (
      command: Extract<FarmerCommand, { type: "store_mill_goods" }>
    ): void => {
      const state = farmStore.getState().farm;
      if (state.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        return;
      }
      const action = state.snapshot.farm.millGoods.delivery
        ? "store"
        : "pickup";
      farmerCommandStore
        .getState()
        .setStatus({ type: "pickingUp", commandId: command.id });
      void executeGameCommand({
        type: "mill_delivery",
        action,
        millId: command.millId,
        expectedFarmVersion: state.snapshot.farm.version
      })
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);
          if (!sceneIsActive) return;
          if (action === "store") {
            showBottomDialog("Processed grain stored in Resources.");
            completeMovementCommand(command.id);
          } else {
            showBottomDialog("Carrying the bags to the farm.");
            farmerCommandStore
              .getState()
              .setStatus({ type: "moving", commandId: command.id });
            moveFarmerTo(
              getMovementTarget(command),
              outcome => completeCommandMovement(command, outcome),
              reason => failMovementCommand(command.id, reason),
              "tile"
            );
          }
        })
        .catch(error => {
          if (!sceneIsActive) return;
          const reason =
            error instanceof Error
              ? error.message
              : "Could not store the bags.";
          failMovementCommand(command.id, reason);
          showBottomDialog(reason);
        });
    };

    const advanceProduction = (
      command: Extract<FarmerCommand, { type: "production" }>
    ): void => {
      const state = farmStore.getState().farm;
      if (state.type !== "ready") {
        failMovementCommand(command.id, "The farm is not ready.");
        return;
      }
      if (command.action === "bake" && bakingTrip?.commandId === command.id && bakingTrip.phase === "collecting") {
        if ((state.snapshot.inventory.find(item => item.itemKey === "flour")?.quantity ?? 0) < BREAD_RECIPE.flour) {
          failMovementCommand(command.id, "Store 2 Flour before baking.");
          showBottomDialog("Store 2 Flour before baking.");
          return;
        }
        bakingTrip = { commandId: command.id, phase: "delivering" };
        updateFarmerCarryVisual();
        showBottomDialog("Carrying flour from the farm to the Bread Oven.");
        moveFarmerTo(getMovementTarget(command), result => completeCommandMovement(command, result),
          reason => failMovementCommand(command.id, reason), "tile");
        return;
      }
      const action = state.snapshot.farm.production.delivery
        ? "store"
        : "pickup";
      farmerCommandStore
        .getState()
        .setStatus({ type: "pickingUp", commandId: command.id });
      const request =
        command.action === "bake"
          ? executeGameCommand({
              type: "start_baking",
              buildingId: command.buildingId,
              expectedFarmVersion: state.snapshot.farm.version
            })
          : executeGameCommand({
              type: "production_delivery",
              action,
              buildingId: command.buildingId,
              expectedFarmVersion: state.snapshot.farm.version
            });
      void request
        .then(snapshot => {
          farmStore.getState().setReady(snapshot);
          if (!sceneIsActive) return;
          if (command.action === "bake" || action === "store") {
            showBottomDialog(
              command.action === "bake"
                ? "Baking started. Bread will be ready beside the oven."
                : "Goods delivered to the farm and added to Resources."
            );
            completeMovementCommand(command.id);
          } else {
            showBottomDialog("Carrying the finished goods to the farm.");
            farmerCommandStore
              .getState()
              .setStatus({ type: "moving", commandId: command.id });
            moveFarmerTo(
              getMovementTarget(command),
              result => completeCommandMovement(command, result),
              reason => failMovementCommand(command.id, reason),
              "tile"
            );
          }
        })
        .catch(error => {
          if (!sceneIsActive) return;
          const reason =
            error instanceof Error
              ? error.message
              : "Could not complete this task.";
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
            .with({ type: "move" }, moveCommand =>
              completeMovementCommand(moveCommand.id)
            )
            .with({ type: "production" }, advanceProduction)
            .with({ type: "store_mill_goods" }, advanceMillDelivery)
            .with({ type: "mill" }, millCommand => {
              const trip = millingTrip?.commandId === millCommand.id ? millingTrip : null;
              const continueTrip = () => moveFarmerTo(
                getMovementTarget(millCommand),
                result => completeCommandMovement(millCommand, result),
                reason => failMovementCommand(millCommand.id, reason),
                getFarmerArrivalAlignment(millCommand)
              );
              if (trip?.phase === "fetching_donkey") {
                millingTrip = { ...trip, phase: "leading_donkey" };
                showBottomDialog("Leading the donkey to the Mill.");
                continueTrip();
                return;
              }
              if (trip?.phase === "leading_donkey" || trip?.phase === "entering_mill") {
                millingTrip = { ...trip, phase: "entering_mill" };
                donkey.move({ x: farmer.x + TILE_SIZE / 2, y: farmer.y + TILE_SIZE }, 300, () => {
                  if (millingTrip?.commandId !== millCommand.id || !sceneIsActive) return;
                  millingTrip = { ...trip, phase: trip.source ? "collecting" : "delivering" };
                  donkey.image.setVisible(false);
                  updateFarmerCarryVisual();
                  showBottomDialog(trip.source ? `Collecting barley from the ${trip.source.type}.` : "Bringing barley to the Mill.");
                  continueTrip();
                });
                return;
              }
              if (
                millingTrip?.commandId === millCommand.id &&
                millingTrip.phase === "collecting"
              ) {
                millingTrip = { ...millingTrip, phase: "delivering" };
                updateFarmerCarryVisual();
                showBottomDialog("Bringing barley to the Mill.");
                moveFarmerTo(
                  getMovementTarget(millCommand),
                  result => completeCommandMovement(millCommand, result),
                  reason => failMovementCommand(millCommand.id, reason),
                  getFarmerArrivalAlignment(millCommand)
                );
                return;
              }
              startFarmItemAction(millCommand);
            })
            .with({ type: "fishing" }, startFarmItemAction)
            .with({ type: "inspect" }, inspectCommand => {
              handleFarmerArrival(inspectCommand);
              completeMovementCommand(inspectCommand.id);
            })
            .with({ type: "build", build: "irrigation" }, buildCommand => {
              startIrrigationConstruction(buildCommand);
            })
            .with({ type: "build", build: "road" }, startRoadConstruction)
            .with(
              {
                type: "build",
                build: P.union("granary", "brewery", "mill", "breadOven")
              },
              buildCommand => {
                startBuildingConstruction(buildCommand);
              }
            )
            .with({ type: "destroy", build: "irrigation" }, destroyCommand => {
              startIrrigationDestruction(destroyCommand);
            })
            .with({ type: "pickup" }, pickupCommand => {
              startFarmItemAction(pickupCommand);
            })
            .with({ type: "brewery_supply" }, supplyCommand => {
              startFarmItemAction(supplyCommand);
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
      if (
        farmerCommandStore.getState().carriedItem?.itemKey === "fish" &&
        command.type !== "fishing"
      ) {
        completeMovementCommand(command.id);
        return;
      }
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

      if (command.type === "plant" && carriedItem?.itemKey !== command.crop) {
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

      if (command.type === "production" && command.action === "bake") {
        if (carriedItem !== null) {
          failMovementCommand(command.id, "Empty your hands before collecting flour.");
          return;
        }
        bakingTrip = { commandId: command.id, phase: "collecting" };
        showBottomDialog("Collecting flour from the farm.");
      }

      if (command.type === "mill") {
        const state = farmStore.getState().farm;
        const reason =
          state.type === "ready"
            ? millingUnavailableReason(
                state.snapshot,
                command.recipe,
                Date.now(),
                command.worker
              )
            : "The farm is not ready.";
        if (reason || state.type !== "ready") {
          failMovementCommand(command.id, reason ?? "The farm is not ready.");
          showBottomDialog(reason ?? "The farm is not ready.");
          return;
        }
        const source = millingCollectionSource(state.snapshot, Date.now());
        if (command.worker === "donkey") {
          updateDonkey();
          if (!donkeyTile) {
            failMovementCommand(command.id, "There is no free ground for the donkey to stand on.");
            return;
          }
          donkey.stop();
          const foot = donkeyFoot(donkeyTile);
          donkey.image.setPosition(foot.x, foot.y);
        }
        millingTrip = {
          commandId: command.id,
          source,
          worker: command.worker ?? "farmer",
          phase: command.worker === "donkey" ? "fetching_donkey" : source ? "collecting" : "delivering"
        };
        showBottomDialog(
          command.worker === "donkey" ? "Going to fetch the donkey." : source
            ? `Collecting barley from the ${source.type}.`
            : "Bringing barley to the Mill."
        );
      }
      activeMovementCommand = command;
      farmerCommandStore.getState().setStatus({
        type: "moving",
        commandId: command.id
      });
      moveFarmerTo(
        getMovementTarget(command),
        outcome => completeCommandMovement(command, outcome),
        reason => failMovementCommand(command.id, reason),
        getFarmerArrivalAlignment(command)
      );
    };

    const removeBatchOverlay = installBatchPlantingOverlay(this, () => farmPosition);
    let batchExecuting = false;
    let batchGeneration = 0;
    let batchFailed = false;
    let batchTimer: ReturnType<typeof scheduleActionDeadline> | null = null;
    const runPlantingBatch = (): void => {
      const state = farmStore.getState().farm;
      const batch = state.type === "ready" ? state.snapshot.farm.production.planting : null;
      if (!sceneIsActive || !batch || batchExecuting || batchFailed || visitingMarket || document.visibilityState === "hidden") return;
      batchExecuting = true;
      const generation = ++batchGeneration;
      let requestPending = false;
      const fail = (cause: unknown) => {
        if (generation !== batchGeneration) return;
        batchExecuting = false; batchFailed = true;
        const reason = cause instanceof Error ? cause.message : String(cause);
        farmerCommandStore.getState().setStatus({ type: "failed", commandId: batch.id, reason });
        showBottomDialog(reason);
      };
      const advance = (action: "collect" | "plant" | "harvest" | "finish") => {
        if (generation !== batchGeneration || requestPending) return;
        const current = farmStore.getState().farm;
        if (!sceneIsActive || current.type !== "ready" || current.snapshot.farm.production.planting?.id !== batch.id) { batchExecuting = false; return; }
        requestPending = true;
        batchTimer?.cancel(); batchTimer = null;
        void executeGameCommand({ type: "advance_batch_planting", batchId: batch.id, action, expectedFarmVersion: current.snapshot.farm.version })
          .then(snapshot => {
            if (!sceneIsActive || generation !== batchGeneration) return;
            batchExecuting = false;
            const latest = farmStore.getState().farm;
            if (latest.type === "ready" && latest.snapshot.farm.version > snapshot.farm.version) { runPlantingBatch(); return; }
            farmStore.getState().setReady(snapshot);
            if (!snapshot.farm.production.planting) farmerCommandStore.getState().setStatus({ type: "idle" });
            else runPlantingBatch();
          }).catch(async cause => {
            if (generation !== batchGeneration) return;
            // Refresh on conflicts without blindly retrying an economic action.
            try {
              const fresh = await fetchDevelopmentFarm();
              if (sceneIsActive && generation === batchGeneration) {
                farmStore.getState().setReady(fresh);
                if (!fresh.farm.production.planting) {
                  batchExecuting = false; batchFailed = false;
                  farmerCommandStore.getState().setStatus({ type: "idle" });
                  return;
                }
              }
            } catch { /* Keep the saved batch for retry. */ }
            if (sceneIsActive && generation === batchGeneration) fail(cause);
          });
      };
      if (batch.phase.type === "sowing" || batch.phase.type === "harvesting") {
        farmerPosition = translateTilePosition(farmPosition, batch.phase.target);
        farmerVisualOffset = { x: 0, y: 0 };
        farmerHasMoved = true;
        positionFarmer();
        farmer.setTexture(spriteName(batch.phase.type === "harvesting" ? "farmerHarvest0" : "farmerPlant0")).setDisplaySize(TILE_SIZE, TILE_SIZE);
        farmerCommandStore.getState().setStatus({ type: batch.phase.type === "harvesting" ? "harvesting" : "planting", commandId: batch.id });
        batchTimer = scheduleActionDeadline(Date.parse(batch.phase.completesAt), () => {
          batchTimer = null;
          advance("finish");
        });
      } else {
        const target = batch.phase.type === "collecting"
          ? batch.source.type === "farm" ? getFarmDepositTarget()
            : getBuildingInteractionTarget(translateTilePosition(farmPosition, batch.source), "granary")
          : translateTilePosition(farmPosition, batch.remaining[0]!);
        farmerCommandStore.getState().setStatus({ type: "moving", commandId: batch.id });
        if (batch.nextStepAt) batchTimer = scheduleActionDeadline(Date.parse(batch.nextStepAt),
          () => advance(batch.phase.type === "collecting" ? "collect" : batch.mode === "harvest" ? "harvest" : "plant"));
        moveFarmerTo(target, () => advance(batch.phase.type === "collecting" ? "collect" : batch.mode === "harvest" ? "harvest" : "plant"), fail, "tile");
      }
    };

    const unsubscribeBatchRetry = batchPlantingStore.subscribe((state, previous) => {
      if (state.retry !== previous.retry) { batchFailed = false; runPlantingBatch(); }
    });

    function processNextMovementCommand(): void {
      if (visitingMarket) return;
      const current = farmStore.getState().farm;
      if (current.type === "ready" && current.snapshot.farm.production.planting) { runPlantingBatch(); return; }
      if (
        current.type === "ready" &&
        current.snapshot.farm.roads.some(r => !roadIsComplete(r, Date.now()))
      )
        return;
      const productionJob = current.type === "ready" ? farmerProductionJob(current.snapshot.farm) : null;
      if (productionJob) {
        if (farmerCommandStore.getState().status.type !== productionJob.type)
          farmerCommandStore.getState().setStatus({
            type: productionJob.type,
            commandId: productionJob.buildingId
          });
        return;
      }
      if (current.type === "ready" && current.snapshot.farm.fishing) return;
      const commandState = farmerCommandStore.getState();
      const delivery =
        current.type === "ready"
          ? current.snapshot.farm.millGoods.delivery
          : null;
      const productionDelivery =
        current.type === "ready"
          ? current.snapshot.farm.production.delivery
          : null;
      const nextCommand = productionDelivery
        ? (commandState.commands.find(
            c => c.type === "production" && c.action === "store"
          ) ??
          (commandState.status.type === "failed"
            ? undefined
            : {
                type: "production" as const,
                action: "store" as const,
                id: `resume-production-${productionDelivery.buildingId}`,
                buildingId: productionDelivery.buildingId,
                target: farmerPosition
              }))
        : delivery
          ? (commandState.commands.find(c => c.type === "store_mill_goods") ??
            (commandState.status.type === "failed"
              ? undefined
              : {
                  type: "store_mill_goods" as const,
                  id: `resume-${delivery.millId}`,
                  millId: delivery.millId,
                  target: farmerPosition
                }))
          : commandState.commands[0];
      const canStartCommand =
        commandState.status.type === "idle" ||
        commandState.status.type === "failed";

      if (
        activeMovementCommand === null &&
        canStartCommand &&
        isMovementCommand(nextCommand)
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
        const previousJob = farmerProductionJob(this.farmSnapshot.farm);
        const previousBatch = this.farmSnapshot.farm.production.planting;
        const wasFishing = this.farmSnapshot.farm.fishing !== null;
        this.farmSnapshot = state.farm.snapshot;
        const allBatchFieldsPlanted = previousBatch?.mode !== "harvest" && previousBatch?.remaining.every(
          target => this.farmSnapshot.crops.some(crop => crop.column === target.column && crop.row === target.row)
        );
        if (previousBatch && JSON.stringify(previousBatch) !== JSON.stringify(this.farmSnapshot.farm.production.planting)) {
          ++batchGeneration;
          activeFarmerMovement?.stop(); activeFarmerMovement = null;
          batchTimer?.cancel(); batchTimer = null;
          batchExecuting = false; batchFailed = false;
          if (!this.farmSnapshot.farm.production.planting && !previousBatch.stopRequested && (previousBatch.mode === "harvest" || allBatchFieldsPlanted)) {
            const last = previousBatch.remaining.at(-1) ?? (previousBatch.phase.type === "sowing" || previousBatch.phase.type === "harvesting" ? previousBatch.phase.target : null);
            if (last) { farmerPosition = translateTilePosition(farmPosition, last); farmerVisualOffset = { x: 0, y: 0 }; farmerHasMoved = true; positionFarmer(); }
          }
        }
        if (previousBatch && !this.farmSnapshot.farm.production.planting) {
          activeFarmerMovement?.stop(); activeFarmerMovement = null;
          batchTimer?.cancel(); batchTimer = null;
          batchExecuting = false; batchFailed = false;
          farmerCommandStore.getState().setStatus({ type: "idle" });
          showBottomDialog(previousBatch.mode === "harvest"
            ? "Harvesting finished. Store the carried barley at the farm or granary."
            : previousBatch.stopRequested || !allBatchFieldsPlanted ? "Planting stopped. Unused seeds returned." : "All selected fields have been planted.");
        }
        const finishedWorking = previousJob !== null && !farmerProductionJob(this.farmSnapshot.farm);
        if (finishedWorking) {
          showBottomDialog(
            previousJob.type === "baking"
              ? "Baking complete! Collect the bread beside the oven and store it at the farm."
              : "Milling complete! \nCollect the bags beside the Mill and store them at the farm."
          );
        }
        updateLevelReadyMark();
        if (
          wasFishing &&
          !this.farmSnapshot.farm.fishing &&
          this.farmSnapshot.farm.carriedItem?.itemKey === "fish"
        ) {
          respawnAt = Date.now() + 3000;
          swimmingFish
            .setVisible(false)
            .setPosition(
              Math.random() < 0.5
                ? -TILE_SIZE * 0.3
                : this.scale.width + TILE_SIZE * 0.3,
              riverRow * TILE_SIZE + TILE_SIZE / 2
            );
          fishMode = "roaming";
          transitionFrom = swimmingFish.x;
          transitionStartedAt = respawnAt;
          transitionDuration = 4000;
        }
        fishingClockOffset =
          (this.farmSnapshot.farm.fishing?.serverNow ?? Date.now()) -
          Date.now();
        farmerCommandStore
          .getState()
          .setCarriedItem(state.farm.snapshot.farm.carriedItem);
        updateFarmInventoryChip();
        renderRoads();
        renderGroundItems();
        renderIrrigation();
        renderCrops();
        renderBuildings();
        if (!activeFarmerMovement && !farmerProductionJob(this.farmSnapshot.farm)) avoidStandingOnGoods();
        updateFarmerCarryVisual();
        if (finishedWorking) farmerCommandStore.getState().setStatus({ type: "idle" });
        if (this.farmSnapshot.farm.production.planting) runPlantingBatch();
        renderGroundDecorations();
        positionMarket();
        rebuildGrid();
        if (wasFishing && !this.farmSnapshot.farm.fishing) {
          updateFarmerCarryVisual();
          processNextMovementCommand();
        }

        if (buildingPlacementStore.getState().placement.type === "placing") {
          updateBuildingPlacementPreview(this.input.activePointer);
        }
      }
    });

    const restoredProductionJob = farmerProductionJob(this.farmSnapshot.farm);
    if (restoredProductionJob) {
      const mill = this.farmSnapshot.buildings.find(
        b => b.id === restoredProductionJob.buildingId
      );
      if (mill) {
        farmerPosition = getBuildingInteractionTarget(
          translateTilePosition(farmPosition, mill),
          mill.type
        );
        farmerVisualOffset = { x: 0, y: 0 };
        farmerHasMoved = true;
        positionFarmer();
      }
    }

    const pendingHarvest = this.farmSnapshot.crops.find(
      crop => crop.harvestCompletesAt !== null
    );

    const pendingGathering = this.farmSnapshot.farm.gathering;
    const pendingRoad = this.farmSnapshot.farm.roads.find(
      r => !roadIsComplete(r, Date.now())
    );
    if (pendingRoad)
      waitForRoadConstruction(pendingRoad, "resume-road-construction", true);

    if (
      pendingGathering !== null &&
      farmerCommandStore.getState().carriedItem === null
    ) {
      farmerCommandStore.getState().addCommand({
        type: "gather",
        item: pendingGathering.itemKey,
        target: translateTilePosition(farmPosition, pendingGathering.target)
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
      const batchWasMoving = activeFarmerMovement !== null;
      activeFarmerMovement?.stop();
      activeFarmerMovement = null;
      updateFarmerCarryVisual();
      renderGround();
      positionFarm();
      renderRoads();
      positionMarket();
      positionLevelSignpost();
      updateFarmInventoryChip();
      batchPlantingStore.setState({ origin: farmPosition });

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
        updateBuildingPlacementPreview(this.input.activePointer);
      }

      if (activeBottomDialog !== null) {
        if (activeBottomDialog.node instanceof HTMLElement) {
          activeBottomDialog.node.style.maxWidth = `${Math.max(0, Math.min(560, this.scale.width - 32))}px`;
        }
        activeBottomDialog
          .updateSize()
          .setPosition(this.scale.width / 2, this.scale.height * 0.96);
      }

      if (this.farmSnapshot.farm.production.planting && batchWasMoving) {
        batchExecuting = false;
        runPlantingBatch();
      }
      if (visitingMarket && marketUiStore.getState().location === "farm") {
        visitMarket();
      } else if (activeMovementCommand !== null && !visitingMarket) {
        const command = activeMovementCommand;
        moveFarmerTo(
          getMovementTarget(command),
          outcome => completeCommandMovement(command, outcome),
          reason => failMovementCommand(command.id, reason),
          getFarmerArrivalAlignment(command)
        );
      }
    };

    const cleanupScene = (): void => {
      if (!sceneIsActive) {
        return;
      }

      sceneIsActive = false;
      donkey.destroy();
      this.events.off("return-from-market", returnFromMarket);
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanupScene);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanupScene);
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
      this.events.off(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      unsubscribeFromCommands();
      unsubscribeFromFarm();
      batchTimer?.cancel();
      removeBatchOverlay();
      unsubscribeBatchRetry();
      unsubscribeFromBuildingPlacement();
      this.input.off(
        Phaser.Input.Events.POINTER_MOVE,
        handlePlacementPointerMove
      );
      this.input.off(Phaser.Input.Events.POINTER_UP, handlePlacementPointerUp);
      this.input.keyboard?.off("keydown", handlePlacementEscape);
      activeFarmerMovement?.stop();
      activeImprovementActionTimer?.cancel();
      if (roadWorkAnimation !== null) clearInterval(roadWorkAnimation);
      activeCropActionTimer?.cancel();
      if (activeBuildingActionTimer !== null) {
        activeBuildingActionTimer.cancel();
      }
      if (activeHarvestTimer !== null) {
        activeHarvestTimer.cancel();
      }
      if (activeGatherTimer !== null) {
        activeGatherTimer.cancel();
      }
      irrigationCompletionTimers.forEach(timer => timer.remove(false));
      cropGrowthTimers.forEach(timer => window.clearTimeout(timer));
      buildingCompletionTimers.forEach(timer => window.clearTimeout(timer));
      buildingCountdownTimers.forEach(timer => window.clearInterval(timer));
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
