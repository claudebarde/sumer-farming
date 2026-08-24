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
} from "../stores/gridStore";
import {
  farmerCommandStore,
  type FarmerCommand
} from "../stores/farmerCommandStore";

const FARM_SPRITES_TEXTURE_KEY = "farm-sprites";
const INITIAL_FARM_SIZE = 8;
const FARM_BUILDING_SIZE = {
  columns: 2,
  rows: 2
} as const;
const GROUND_DEPTH = 0;
const RIVER_DEPTH = 1;
const FARM_DEPTH = 2;
const DECORATION_DEPTH = 2;
const CROP_DEPTH = 3;
const ACTOR_DEPTH = 4;
const FARMER_MOVE_DURATION_PER_TILE = 180;
const BOTTOM_DIALOG_DURATION = 2_000;
const gameplayWidth = INITIAL_FARM_SIZE * TILE_SIZE;
const gameplayHeight = INITIAL_FARM_SIZE * TILE_SIZE;
const FARM_DECORATION_COUNT = {
  minimum: 2,
  maximum: 4
} as const;
const FARM_DECORATION_SPRITES = [
  spriteName("rocks"),
  spriteName("bush")
] as const;

type LocalTilePosition = Pick<TilePosition, "column" | "row">;
type PixelPosition = {
  readonly x: number;
  readonly y: number;
};
type CardinalDirection = "up" | "down" | "left" | "right";
type InspectCommand = Extract<FarmerCommand, { readonly type: "inspect" }>;
type MovementCommand = Extract<
  FarmerCommand,
  { readonly type: "inspect" | "build" | "pickup" }
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

const isInsideFarm = (
  position: LocalTilePosition,
  farmPosition: TilePosition
): boolean =>
  position.column >= farmPosition.column &&
  position.column < farmPosition.column + INITIAL_FARM_SIZE &&
  position.row >= farmPosition.row &&
  position.row < farmPosition.row + INITIAL_FARM_SIZE;

const addRandomGroundDecorations = (
  scene: Phaser.Scene,
  decorations: Phaser.GameObjects.Group,
  gridSize: GridSize,
  farmPosition: TilePosition,
  riverRow: number
): void => {
  const availableTiles = Array.from(
    { length: gridSize.columns * gridSize.rows },
    (_, index): LocalTilePosition => ({
      column: index % gridSize.columns,
      row: Math.floor(index / gridSize.columns)
    })
  ).filter(
    position =>
      position.row !== riverRow && !isInsideFarm(position, farmPosition)
  );

  const maximumDecorationCount = Math.min(
    FARM_DECORATION_COUNT.maximum,
    availableTiles.length
  );

  if (maximumDecorationCount === 0) {
    return;
  }

  const decorationCount = Phaser.Math.Between(
    Math.min(FARM_DECORATION_COUNT.minimum, maximumDecorationCount),
    maximumDecorationCount
  );
  const selectedTiles = Phaser.Utils.Array.Shuffle([...availableTiles]).slice(
    0,
    decorationCount
  );
  const firstSprites = Phaser.Utils.Array.Shuffle([...FARM_DECORATION_SPRITES]);

  selectedTiles.forEach(({ column, row }, index) => {
    const sprite =
      firstSprites[index] ??
      FARM_DECORATION_SPRITES[
        Phaser.Math.Between(0, FARM_DECORATION_SPRITES.length - 1)
      ];

    decorations.add(
      scene.add
        .image(
          column * TILE_SIZE,
          row * TILE_SIZE,
          FARM_SPRITES_TEXTURE_KEY,
          sprite
        )
        .setOrigin(0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(DECORATION_DEPTH)
    );
  });
};

export class MainScene extends Phaser.Scene {
  constructor() {
    super("main-scene");
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

    // PLACES TWO HARVESTED BARLEY TILES TO THE LEFT OF THE FARM BUILDING
    const harvestedBarleyPositions: readonly LocalTilePosition[] = [0, 1].map(
      row => ({
        column: farmBuildingPosition.column - 1,
        row
      })
    );
    const getHarvestedBarleyTile = (localPosition: LocalTilePosition): Tile =>
      createTile(
        translateTilePosition(farmPosition, localPosition),
        "harvestedBarley"
      );
    const harvestedBarleyTiles = harvestedBarleyPositions.map(localPosition => {
      const harvestedBarley = this.add
        .image(0, 0, FARM_SPRITES_TEXTURE_KEY, spriteName("harvestedBarley"))
        .setOrigin(0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(CROP_DEPTH)
        .setInteractive();

      harvestedBarley.on(Phaser.Input.Events.POINTER_UP, () => {
        handlePointerUp(
          getHarvestedBarleyTile(localPosition),
          selectionHighlight
        );
      });

      return harvestedBarley;
    });

    const positionHarvestedBarley = (): void => {
      harvestedBarleyTiles.forEach((tile, index) => {
        const position = harvestedBarleyPositions[index];

        if (position !== undefined) {
          const posX = farmTiles.x + position.column * TILE_SIZE;
          const posY = farmTiles.y + position.row * TILE_SIZE;
          tile.setPosition(posX, posY);
        }
      });
    };

    positionHarvestedBarley();

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

    // DRAWS RANDOM ROCKS AND BUSHES ON GROUND OUTSIDE THE FARM AND RIVER
    const groundDecorations = this.add.group();

    const renderGroundDecorations = (): void => {
      groundDecorations.clear(true, true);

      addRandomGroundDecorations(
        this,
        groundDecorations,
        {
          columns: Math.ceil(this.scale.width / TILE_SIZE),
          rows: Math.ceil(this.scale.height / TILE_SIZE)
        },
        farmPosition,
        riverRow
      );
    };

    renderGroundDecorations();

    // DRAWS THE FARMER NEXT TO THE FARM
    const actorLayer = this.add.layer().setDepth(ACTOR_DEPTH);
    const farmer = this.add
      .image(0, 0, FARM_SPRITES_TEXTURE_KEY, spriteName("farmerIdle0"))
      .setOrigin(0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setInteractive();
    let farmerPosition = translateTilePosition(
      farmPosition,
      initialFarmerPosition
    );
    let farmerVisualOffset: PixelPosition = { x: 0, y: 0 };
    let farmerHasMoved = false;
    let activeFarmerMovement: Phaser.Tweens.TweenChain | null = null;
    let activeMovementCommand: MovementCommand | null = null;
    let activeBottomDialog: Phaser.GameObjects.DOMElement | null = null;
    let activeBottomDialogTimer: Phaser.Time.TimerEvent | null = null;
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

    actorLayer.add(farmer);

    const positionFarmer = (): void => {
      farmer.setPosition(
        farmerPosition.column * TILE_SIZE + farmerVisualOffset.x,
        farmerPosition.row * TILE_SIZE + farmerVisualOffset.y
      );
    };

    positionFarmer();

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

      for (const localPosition of harvestedBarleyPositions) {
        const harvestedBarleyTile = getHarvestedBarleyTile(localPosition);
        entries.push({
          tile: harvestedBarleyTile,
          coordinate: harvestedBarleyTile.position
        });
      }

      entries.push(
        ...waterTileData.map(tile => ({
          tile,
          coordinate: tile.position
        }))
      );

      const farmerTile = getFarmerTile();
      entries.push({ tile: farmerTile, coordinate: farmerTile.position });

      gridStore.getState().replaceGrid(entries);
    };

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
            duration: (distance / TILE_SIZE) * FARMER_MOVE_DURATION_PER_TILE,
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

    const getMovementTarget = (command: MovementCommand): TilePosition =>
      match(command)
        .with({ type: "inspect" }, ({ target }) => target.position)
        .with({ type: "build" }, ({ target }) => target)
        .with({ type: "pickup" }, ({ target }) => target)
        .exhaustive();

    const completeCommandMovement = (
      command: MovementCommand,
      outcome: FarmerMovementOutcome
    ): void => {
      match(outcome)
        .with({ type: "arrived" }, () => {
          match(command)
            .with({ type: "inspect" }, handleFarmerArrival)
            .with({ type: "build" }, () => console.log("build something"))
            .with({ type: "pickup" }, () => undefined)
            .exhaustive();
        })
        .with({ type: "blocked" }, ({ reason }) => {
          showBottomDialog(reason);
        })
        .exhaustive();

      completeMovementCommand(command.id);
    };

    const executeMovementCommand = (command: MovementCommand): void => {
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

      if (
        activeMovementCommand === null &&
        commandState.status.type === "idle" &&
        (nextCommand?.type === "inspect" ||
          nextCommand?.type === "build" ||
          nextCommand?.type === "pickup")
      ) {
        executeMovementCommand(nextCommand);
      }
    }

    const unsubscribeFromCommands = farmerCommandStore.subscribe(() => {
      processNextMovementCommand();
    });

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

      if (!farmerHasMoved) {
        farmerPosition = translateTilePosition(
          farmPosition,
          initialFarmerPosition
        );
      }

      positionHarvestedBarley();
      renderRiver();
      renderGroundDecorations();
      positionFarmer();
      rebuildGrid();

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

    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
      unsubscribeFromCommands();
      activeFarmerMovement?.stop();
      activeBottomDialogTimer?.remove(false);
      activeBottomDialog?.destroy();

      if (activeMovementCommand !== null) {
        farmerCommandStore.getState().setStatus({ type: "idle" });
      }

      gridStore.getState().replaceGrid([]);
    });
  }
}
