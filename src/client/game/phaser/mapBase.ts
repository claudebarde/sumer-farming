import Phaser from "phaser";
import { isoPoint } from "./isometricProjection";

type MapBounds = {
  readonly minimumColumn: number;
  readonly maximumColumn: number;
  readonly minimumRow: number;
  readonly maximumRow: number;
};

/** Shared raised ground edge and soft shadow, owned and destroyed by the scene. */
export const drawMapBase = (scene: Phaser.Scene, bounds: MapBounds): void => {
    const mapThickness = 8;
    // A soft shadow under the whole landscape, not a vignette over its tiles.
    // World coordinates keep the edge attached to the grid while panning/zooming.
    const mapShadow = scene.add.graphics().setDepth(-1010);
    for (let layer = 16; layer >= 0; layer--) {
      const spread = layer / 64;
      const left = bounds.minimumColumn - 0.5 - spread;
      const right = bounds.maximumColumn + 0.5 + spread;
      const top = bounds.minimumRow - 0.5 - spread;
      const bottom = bounds.maximumRow + 0.5 + spread;
      const corners = [
        { column: left, row: top }, { column: right, row: top },
        { column: right, row: bottom }, { column: left, row: bottom }
      ].map(cell => { const p = isoPoint(cell); return new Phaser.Math.Vector2(p.x, p.y + mapThickness + 7); });
      mapShadow.fillStyle(0x604625, 0.018).fillPoints(corners, true);
    }
    // Two shallow earth faces below the front edges. These are decorative:
    // they do not extend the tile grid or take part in pointer hit testing.
    const mapSides = scene.add.graphics().setDepth(-1005);
    const leftCorner = isoPoint({ column: bounds.minimumColumn - 0.5, row: bounds.maximumRow + 0.5 });
    const frontCorner = isoPoint({ column: bounds.maximumColumn + 0.5, row: bounds.maximumRow + 0.5 });
    const rightCorner = isoPoint({ column: bounds.maximumColumn + 0.5, row: bounds.minimumRow - 0.5 });
    for (const [start, end, colour] of [
      [leftCorner, frontCorner, 0xc9944f],
      [frontCorner, rightCorner, 0xb58240]
    ] as const) {
      mapSides.fillStyle(colour, 1).fillPoints([
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2(end.x, end.y),
        new Phaser.Math.Vector2(end.x, end.y + mapThickness),
        new Phaser.Math.Vector2(start.x, start.y + mapThickness)
      ], true);
    }
};
