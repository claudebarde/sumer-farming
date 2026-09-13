import type { FarmSpriteName } from "../../../assets/farmSprites";
import type { CropKey } from "../../../game-data/crops";
import type { InventoryItemKey } from "../../../game-data/inventoryItems";

export type TileId = `${number}:${number}`;

export type GridSize = {
  readonly columns: number;
  readonly rows: number;
};

export type TilePosition = {
  readonly column: number;
  readonly row: number;
  readonly posX: number; // X position in pixels
  readonly posY: number; // Y position in pixels
};

export type Property = {
  readonly worldSize: GridSize;
  readonly unlockedTiles: ReadonlySet<TileId>;
};

type BasicTile = {
  readonly id: TileId;
  readonly position: TilePosition;
};

export interface Tile extends BasicTile {
  readonly type: FarmSpriteName;
}

export type Crop = CropKey;

export type Build = "irrigation" | "granary";

export type InteractiveObject = InventoryItemKey;
