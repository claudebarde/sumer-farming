import type Phaser from "phaser";

/** Shared pot/doorway steam; the caller owns clearing and depth. */
export const drawCookingSteam = (graphics: Phaser.GameObjects.Graphics, origin: { x: number; y: number }, elapsed: number, reduced: boolean, scale = 1, riseScale = scale) => {
  if (reduced) return;
  for (let i = 0; i < 4; i++) {
    const t = ((elapsed + i * 650) % 2600) / 2600;
    graphics.fillStyle(0xfff7e8, Math.sin(t * Math.PI) * .4)
      .fillEllipse(origin.x + Math.sin(t * 5 + i) * 4 * scale, origin.y - t * 60 * riseScale,
        (7 + t * 11) * 1.5 * scale, (5 + t * 8) * 1.5 * scale);
  }
};
