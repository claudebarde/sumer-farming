import Phaser from "phaser";

/** Decorative platform registered to the interior artwork; never a walking surface. */
export const drawInteriorGround = (scene: Phaser.Scene): void => {
  const cx = 760, cy = 630, halfWidth = 880, halfHeight = 480, thickness = 8;
  const corners = [[cx, cy - halfHeight], [cx + halfWidth, cy], [cx, cy + halfHeight], [cx - halfWidth, cy]] as const;
  const shadow = scene.add.graphics().setDepth(-20);
  for (let layer = 16; layer >= 0; layer--) {
    shadow.fillStyle(0x604625, .018).fillPoints(corners.map(([x, y]) => new Phaser.Math.Vector2(
      cx + (x - cx) * (1 + layer / 900), cy + (y - cy) * (1 + layer / 900) + thickness + 7)), true);
  }
  const sides = scene.add.graphics().setDepth(-19);
  for (const [a, b, colour] of [[3, 2, 0xc9944f], [2, 1, 0xb58240]] as const) {
    const start = corners[a], end = corners[b];
    sides.fillStyle(colour).fillPoints([start, end, [end[0], end[1] + thickness], [start[0], start[1] + thickness]]
      .map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
  }
  // Ten by ten diamonds tile seamlessly beneath the original house image.
  for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
    scene.add.image(cx + (column - row) * 88, cy + (column + row - 9) * 48, "interior-ground")
      .setDisplaySize(176.5, 96.5).setDepth(-18);
  }
  scene.add.image(100, 716, "interior-bush").setOrigin(.5, 1).setDisplaySize(110, 100).setDepth(-1);
  scene.add.image(1455, 716, "interior-bush").setOrigin(.5, 1).setDisplaySize(85, 78).setFlipX(true).setDepth(-1);
  const grass = scene.add.graphics().setDepth(-1);
  for (const [x, y] of [[240, 812], [320, 864], [1135, 880], [1300, 810], [900, 1015]]) {
    for (const [dx, height, colour] of [[-12, 18, 0x7d8844], [-4, 27, 0x909951], [5, 23, 0x687a3d], [13, 15, 0x9ba35d]]) {
      grass.fillStyle(colour).fillPoints([new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(x + dx, y - height), new Phaser.Math.Vector2(x + 4, y)], true);
    }
  }
};
