import Phaser from "phaser";
import { SUMER_CITIES, sumerMapFrame } from "../../../../game-data/sumer";
import { sumerMapStore } from "../../../stores/sumerMapStore";

/** Geography stays in Phaser; navigation and accessible city controls live in React. */
export class SumerScene extends Phaser.Scene {
  constructor() { super("sumer-scene"); }

  create(): void {
    let disposed = false;
    const draw = () => {
      if (disposed || !this.cameras?.main) return;
      this.children.removeAll(true);
      this.cameras.main.setBackgroundColor("#f4e4c4");
      const frame = sumerMapFrame(this.scale.width, this.scale.height);
      const point = (x: number, y: number) => new Phaser.Math.Vector2(frame.x + x * frame.width, frame.y + y * frame.height);
      const g = this.add.graphics();
      g.lineStyle(1, 0xb99b6a, 0.45).strokeRect(12, 12, this.scale.width - 24, this.scale.height - 24);
      // All players see the same landscape; no random terrain or political borders.
      for (let i = 0; i < 100; i++) {
        const p = point(((i * 37) % 101) / 101, ((i * 61) % 103) / 103);
        g.fillStyle(0xb99558, 0.12).fillEllipse(p.x, p.y, 20, 5);
      }
      const river = (coordinates: readonly (readonly [number, number])[]) => {
        const points = coordinates.map(([x, y]) => point(x, y));
        g.lineStyle(18, 0x8baf83, 0.25).strokePoints(points);
        g.lineStyle(5, 0x548f9b, 0.9).strokePoints(points);
      };
      river([[0.20, 0], [0.30, 0.12], [0.36, 0.23], [0.29, 0.38], [0.25, 0.54], [0.30, 0.69], [0.45, 0.81], [0.63, 0.94]]);
      river([[0.64, 0], [0.73, 0.15], [0.70, 0.32], [0.82, 0.49], [0.84, 0.66], [0.78, 0.78], [0.70, 0.94]]);
      const gulf = [[0.60, 0.87], [0.74, 0.82], [1, 0.91], [1, 1.06], [0.55, 1.06]].map(([x, y]) => point(x!, y!));
      g.fillStyle(0x90b9bb, 0.75).fillPoints(gulf, true);
      const label = (x: number, y: number, text: string, size = 16) => {
        const p = point(x, y);
        return this.add.text(p.x, p.y, text, { fontFamily: "Georgia, serif", fontSize: `${size}px`, color: "#675339" }).setOrigin(0.5);
      };
      label(0.16, 0.30, "Euphrates", 13).setAngle(-35);
      label(0.85, 0.25, "Tigris", 13).setAngle(45);
      label(0.79, 0.96, "Lower Sea", 14);
      label(0.08, 0.10, "N ↑", 18);
      const selected = sumerMapStore.getState().selectedCity;
      const home = sumerMapStore.getState().residence?.city;
      for (const city of SUMER_CITIES) {
        const p = point(city.x, city.y);
        if (city.id === home) g.lineStyle(3, 0x4c773e).strokeCircle(p.x, p.y, 15);
        g.fillStyle(city.id === selected ? 0xc08a32 : 0x69452e).fillCircle(p.x, p.y, city.id === selected ? 9 : 6);
        g.lineStyle(2, 0xfff7e6).strokeCircle(p.x, p.y, city.id === selected ? 9 : 6);
        const text = label(city.x, city.y, city.name, this.scale.width < 500 ? 13 : 18).setOrigin(0.5, 0).setY(p.y + 12);
        text.setInteractive({ useHandCursor: true }).on("pointerup", () => sumerMapStore.getState().selectCity(city.id));
        this.add.zone(p.x, p.y, 36, 36).setInteractive({ useHandCursor: true })
          .on("pointerup", () => sumerMapStore.getState().selectCity(city.id));
      }
    };
    draw();
    const unsubscribe = sumerMapStore.subscribe(draw);
    const scale = this.scale;
    const events = this.events;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      scale.off("resize", draw);
      events.off("shutdown", cleanup);
      events.off("destroy", cleanup);
    };
    scale.on("resize", draw);
    // Game destruction (including React remounts) can bypass scene shutdown.
    events.once("shutdown", cleanup);
    events.once("destroy", cleanup);
  }
}
