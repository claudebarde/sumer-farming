import Phaser from "phaser";
import { colors } from "../../../styles/colorPalette";
import { FARM_SPRITES, spriteName } from "../../../../assets/farmSprites";
import farmSpritesUrl from "../../../../assets/sprites.png";
import { TILE_SIZE } from "../config";
import { calculateGameplayTilePosition, translateTilePosition } from "../grid";
import type { GridSize, Tile, TilePosition } from "../types";
import { handlePointerUp } from "../game";

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
  const firstSprites = Phaser.Utils.Array.Shuffle([
    ...FARM_DECORATION_SPRITES
  ]);

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

    const renderGround = (): void => {
      groundTiles.clear(true, true);

      const columns = Math.ceil(this.scale.width / TILE_SIZE);
      const rows = Math.ceil(this.scale.height / TILE_SIZE);

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
          const tile: Tile = {
            id: `${column}:${row}`,
            position: {
              column: column,
              row: row,
              posX: column * TILE_SIZE,
              posY: row * TILE_SIZE
            },
            type: "ground"
          };
          ground.on(Phaser.Input.Events.POINTER_UP, () => {
            handlePointerUp(tile, selectionHighlight);
          });

          groundTiles.add(ground);
        }
      }
    };

    renderGround();

    // LAYS THE INITIAL 8X8 GROUND VARIANT TILES
    const farmTiles = this.add.container(0, 0).setDepth(FARM_DEPTH);
    let farmPosition: TilePosition = { column: 0, row: 0, posX: 0, posY: 0 };

    for (let row = 0; row < INITIAL_FARM_SIZE; row++) {
      for (let column = 0; column < INITIAL_FARM_SIZE; column++) {
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
          const position = translateTilePosition(farmPosition, {
            column,
            row
          });
          const farmTileData: Tile = {
            id: `${position.column}:${position.row}`,
            position,
            type: "groundVariant"
          };
          handlePointerUp(farmTileData, selectionHighlight);
        });

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

    farmBuilding.on(Phaser.Input.Events.POINTER_UP, () => {
      const position = translateTilePosition(
        farmPosition,
        farmBuildingPosition
      );
      const farmBuildingTile: Tile = {
        id: `${position.column}:${position.row}`,
        position,
        type: "farm"
      };
      handlePointerUp(farmBuildingTile, selectionHighlight);
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
    const harvestedBarleyTiles = harvestedBarleyPositions.map(localPosition => {
      const harvestedBarley = this.add
        .image(
          0,
          0,
          FARM_SPRITES_TEXTURE_KEY,
          spriteName("harvestedBarley")
        )
        .setOrigin(0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(CROP_DEPTH)
        .setInteractive();

      harvestedBarley.on(Phaser.Input.Events.POINTER_UP, () => {
        const position = translateTilePosition(farmPosition, localPosition);
        const harvestedBarleyTile: Tile = {
          id: `${position.column}:${position.row}`,
          position,
          type: "harvestedBarley"
        };

        handlePointerUp(harvestedBarleyTile, selectionHighlight);
      });

      return harvestedBarley;
    });

    const positionHarvestedBarley = (): void => {
      harvestedBarleyTiles.forEach((tile, index) => {
        const position = harvestedBarleyPositions[index];

        if (position !== undefined) {
          tile.setPosition(
            farmTiles.x + position.column * TILE_SIZE,
            farmTiles.y + position.row * TILE_SIZE
          );
        }
      });
    };

    positionHarvestedBarley();

    // DRAWS A RIVER ON THE 11TH ROW
    const riverRow = 10; // 11th row (0-indexed)
    const riverTiles = this.add.group();

    const renderRiver = (): void => {
      riverTiles.clear(true, true);

      const columns = Math.ceil(this.scale.width / TILE_SIZE);

      for (let column = 0; column < columns; column++) {
        const riverTile = this.add
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
        // sets interaction for the river tile
        riverTile.on(Phaser.Input.Events.POINTER_UP, () => {
          handlePointerUp(
            {
              id: `${column}:${riverRow}`,
              position: {
                column: column,
                row: riverRow,
                posX: column * TILE_SIZE,
                posY: riverRow * TILE_SIZE
              },
              type: "water"
            },
            selectionHighlight
          );
        });

        riverTiles.add(riverTile);
      }
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
    farmer.on(Phaser.Input.Events.POINTER_UP, () => {
      const position = translateTilePosition(
        farmPosition,
        initialFarmerPosition
      );
      const farmerTile: Tile = {
        id: `${position.column}:${position.row}`,
        position,
        type: "farmerIdle0"
      };
      handlePointerUp(farmerTile, selectionHighlight);
    });

    actorLayer.add(farmer);

    const positionFarmer = (): void => {
      farmer.setPosition(
        farmTiles.x + initialFarmerPosition.column * TILE_SIZE,
        farmTiles.y + initialFarmerPosition.row * TILE_SIZE
      );
    };

    positionFarmer();

    const handleResize = (): void => {
      renderGround();
      positionFarm();
      positionHarvestedBarley();
      renderRiver();
      renderGroundDecorations();
      positionFarmer();
    };

    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
    });
  }
}
