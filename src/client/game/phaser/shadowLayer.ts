import Phaser from "phaser";
import { createBuildingShadows } from "./buildingShadows";
import { clipShadow, daylightShadow, shadowEllipse, shadowHour, type ShadowPreset, type ShadowBounds } from "./daylightShadows";

type Anchor = { readonly x: number; readonly y: number; readonly visible?: boolean };

/** Scene-owned, non-interactive shapes, recreated with the scene's artwork. */
export const createShadowLayer = (scene: Phaser.Scene, bounds: ShadowBounds) => {
  const entries: { anchor: () => Anchor; width: number; height: number }[] = [];
  const graphics = scene.add.graphics().setDepth(-810);
  const buildings = createBuildingShadows(scene, bounds);
  return {
    destroy() { buildings.destroy(); graphics.destroy(); },
    addBuilding(building: Phaser.GameObjects.Image) { buildings.add(building); },
    add(anchor: () => Anchor, width: number, height: number) {
      entries.push({ anchor, width, height });
    },
    render(preset: ShadowPreset, date = new Date()) {
      buildings.render(shadowHour(preset, date));
      const sun = daylightShadow(shadowHour(preset, date));
      graphics.clear();
      for (const entry of entries) {
        const anchor = entry.anchor();
        if (anchor.visible === false) continue;
        const oval = shadowEllipse(sun, entry.width, entry.height);
        // A narrow feather keeps the silhouette defined without a hard cutout edge.
        for (const scale of [1, 0.96, 0.92]) {
          const points = Array.from({ length: 32 }, (_, i) => {
            const angle = i * Math.PI / 16;
            const x = Math.cos(angle) * oval.width * scale / 2;
            const y = Math.sin(angle) * oval.height * scale / 2;
            return { x: anchor.x + oval.x + x * Math.cos(oval.rotation) - y * Math.sin(oval.rotation),
              y: anchor.y + oval.y + x * Math.sin(oval.rotation) + y * Math.cos(oval.rotation) };
          });
          const clipped = clipShadow(points, bounds);
          if (clipped.length > 2) graphics.fillStyle(0x504739, oval.alpha / 3)
            .fillPoints(clipped.map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
        }
      }
    },
  };
};
