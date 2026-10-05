import { beforeEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import type { Tile } from "../../src/client/game/phaser/types";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 128 }));
vi.mock("../../src/client/game/phaser/scenes/MarketScene", () => ({ MarketScene: class {} }));

import { handlePointerUp } from "../../src/client/game/phaser/game";
import { interactionStore } from "../../src/client/stores/interactionStore";

describe("finished product selection", () => {
  beforeEach(() => interactionStore.getState().clearSelection());

  it.each(["millBags", "breadBasket", "beerJars"] as const)("highlights and toggles a single %s tile", type => {
    const tile = { id: `product-${type}`, type, position: { column: 3, row: 4, posX: 384, posY: 512 } } as Tile;
    const highlight = {
      setPosition: vi.fn().mockReturnThis(),
      setSize: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis()
    };
    const rectangle = highlight as unknown as Phaser.GameObjects.Rectangle;

    handlePointerUp(tile, rectangle);
    expect(highlight.setPosition).toHaveBeenLastCalledWith(384, 512);
    expect(highlight.setSize).toHaveBeenLastCalledWith(128, 128);
    expect(highlight.setVisible).toHaveBeenLastCalledWith(true);
    expect(interactionStore.getState().selectedTile).toBe(tile);

    handlePointerUp(tile, rectangle);
    expect(highlight.setVisible).toHaveBeenLastCalledWith(false);
    expect(interactionStore.getState().selectedTile).toBeNull();
  });
});
