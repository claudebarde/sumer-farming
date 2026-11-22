import Phaser from "phaser";
import { createBuildingShadows } from "./buildingShadows";
import { clipShadow, daylightShadow, shadowEllipse, shadowHour, type ShadowPreset, type ShadowBounds } from "./daylightShadows";

type Anchor = { readonly x: number; readonly y: number; readonly visible?: boolean };
const circle = Array.from({ length: 32 }, (_, i) => ({ x: Math.cos(i * Math.PI / 16), y: Math.sin(i * Math.PI / 16) }));
const feather = [1, 0.96, 0.92];
type Entry = {
  anchor: () => Anchor; width: number; height: number;
  graphics: Phaser.GameObjects.Graphics;
  x: number; y: number; hour: number;
  polygons: { x: number; y: number }[][];
  vertices: Phaser.Math.Vector2[];
};

/** Retain each shadow's commands until its anchor or lighting actually changes. */
export const createShadowLayer = (scene: Phaser.Scene, bounds: ShadowBounds) => {
  const entries: Entry[] = [];
  const buildings = createBuildingShadows(scene, bounds);
  return {
    destroy() { buildings.destroy(); entries.forEach(entry => entry.graphics.destroy()); },
    addBuilding(building: Phaser.GameObjects.Image) { buildings.add(building); },
    add(anchor: () => Anchor, width: number, height: number) {
      entries.push({ anchor, width, height, graphics: scene.add.graphics().setDepth(-810),
        x: NaN, y: NaN, hour: NaN, polygons: [], vertices: [] });
    },
    render(preset: ShadowPreset, date = new Date()) {
      const hour = shadowHour(preset, date);
      buildings.render(hour);
      // Match the building layer's minute sampling; movement is still updated every frame.
      const sampledHour = Math.floor(hour * 60) / 60;
      for (const entry of entries) {
        const anchor = entry.anchor();
        entry.graphics.setVisible(anchor.visible !== false);
        if (anchor.visible === false) continue;
        const lightingChanged = entry.hour !== sampledHour;
        if (!lightingChanged && anchor.x === entry.x && anchor.y === entry.y) continue;
        const sun = daylightShadow(sampledHour);
        if (lightingChanged) {
          const oval = shadowEllipse(sun, entry.width, entry.height);
          const cos = Math.cos(oval.rotation), sin = Math.sin(oval.rotation);
          entry.polygons = feather.map(scale => circle.map(point => {
            const x = point.x * oval.width * scale / 2, y = point.y * oval.height * scale / 2;
            return { x: oval.x + x * cos - y * sin, y: oval.y + x * sin + y * cos };
          }));
          entry.hour = sampledHour;
        }
        entry.x = anchor.x; entry.y = anchor.y;
        entry.graphics.clear();
        for (const polygon of entry.polygons) {
          const clipped = clipShadow(polygon.map(p => ({ x: p.x + anchor.x, y: p.y + anchor.y })), bounds);
          if (clipped.length <= 2) continue;
          while (entry.vertices.length < clipped.length) entry.vertices.push(new Phaser.Math.Vector2());
          entry.vertices.length = clipped.length;
          clipped.forEach((point, i) => {
            entry.vertices[i]!.x = point.x; entry.vertices[i]!.y = point.y;
          });
          entry.graphics.fillStyle(0x504739, sun.alpha / 3).fillPoints(entry.vertices, true);
        }
      }
    },
  };
};
