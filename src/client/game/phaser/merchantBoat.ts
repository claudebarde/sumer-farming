import type Phaser from "phaser";
import boat from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-boat/merchant-reed-boat-idle-no-pole.png";
import pole from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-boat/merchant-reed-boat-pole.png";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { isoPoint } from "./isometricProjection";
import type { MerchantVisit } from "./merchantVisit";
import { sharpenFarmerPixels } from "./farmerTexture";
import { MERCHANT_TRAVEL_MS } from "../../../game-data/npcRequests";

export const MERCHANT_BOAT_SOURCE = boat;
export const MERCHANT_POLE_SOURCE = pole;
export const MERCHANT_BOAT_SIZE = 205;
export const MERCHANT_BOAT_TEXTURE_SIZE = 512;
export const MERCHANT_BOAT_SHARPEN = 0.15;

/** Preserve full-frame registration while filtering fine detail before GPU scaling. */
export const prepareMerchantBoatTexture = (source: HTMLImageElement) => {
  let current = document.createElement("canvas");
  current.width = source.naturalWidth;
  current.height = source.naturalHeight;
  current.getContext("2d")!.drawImage(source, 0, 0);
  while (current.width > MERCHANT_BOAT_TEXTURE_SIZE * 2) {
    const reduced = document.createElement("canvas");
    reduced.width = Math.round(current.width / 2);
    reduced.height = Math.round(current.height / 2);
    const context = reduced.getContext("2d")!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(current, 0, 0, reduced.width, reduced.height);
    current = reduced;
  }
  const output = document.createElement("canvas");
  output.width = output.height = MERCHANT_BOAT_TEXTURE_SIZE;
  const context = output.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(current, 0, 0, output.width, output.height);
  const pixels = context.getImageData(0, 0, output.width, output.height);
  pixels.data.set(sharpenFarmerPixels(pixels.data, output.width, output.height, MERCHANT_BOAT_SHARPEN));
  context.putImageData(pixels, 0, 0);
  return output;
};
// Register the centre of the hull, not the bottom of the pole/canvas.
export const MERCHANT_BOAT_ORIGIN = { x: 0.53, y: 0.59 } as const;
export const MERCHANT_BOAT_CELL = { column: config.plotBounds.maximumColumn + 2.5, row: config.riverRow };

const BOAT_ENTRY = config.worldBounds.minimumColumn - 3;
const BOAT_EXIT = config.worldBounds.maximumColumn + 3;
/** Present the saved visit; animation never controls requests or their deadlines. */
export const merchantBoatTravel = (visit: MerchantVisit) => {
  const moving = visit.phase === "arriving" || visit.phase === "departing";
  const progress = moving ? Math.max(0, Math.min(1, visit.progress)) : 0;
  const column = visit.phase === "arriving"
    ? BOAT_ENTRY + (MERCHANT_BOAT_CELL.column - BOAT_ENTRY) * progress
    : visit.phase === "departing"
      ? MERCHANT_BOAT_CELL.column + (BOAT_EXIT - MERCHANT_BOAT_CELL.column) * progress
      : MERCHANT_BOAT_CELL.column;
  const edge = Math.max(0, Math.min(1, (column - BOAT_ENTRY) / 3, (BOAT_EXIT - column) / 3));
  return { ...isoPoint({ column, row: MERCHANT_BOAT_CELL.row }),
    moving,
    alpha: edge * edge * (3 - 2 * edge),
    visible: visit.phase !== "away" };
};

/** Short-lived strokes sampled from recent travel, so stops leave no new wake. */
export const merchantBoatRipples = (visit: MerchantVisit, reducedMotion = false) => {
  if (reducedMotion || (visit.phase !== "arriving" && visit.phase !== "departing")) return [];
  const elapsed = visit.progress * MERCHANT_TRAVEL_MS;
  const lifetime = 1000, interval = 280;
  const latest = Math.floor(Math.max(0, elapsed) / interval) * interval;
  return Array.from({ length: 4 }, (_, index) => latest - index * interval).flatMap(emittedAt => {
    const age = elapsed - emittedAt;
    if (emittedAt < 0 || age < 0 || age >= lifetime) return [];
    if (emittedAt >= MERCHANT_TRAVEL_MS) return [];
    const origin = merchantBoatTravel({ phase: visit.phase, progress: emittedAt / MERCHANT_TRAVEL_MS });
    if (!origin.moving || !origin.visible || origin.alpha === 0) return [];
    const phase = age / lifetime;
    const alpha = Math.sin(Math.PI * phase) * 0.35 * origin.alpha;
    const project = (along: number, across: number) => ({
      x: origin.x + along * 0.8944 - across * 0.4472,
      y: origin.y + along * 0.4472 + across * 0.8944,
    });
    const stern = Array.from({ length: 17 }, (_, i) => {
      const angle = -Math.PI / 2 + i / 16 * Math.PI;
      return project(-52 - Math.cos(angle) * (12 + phase * 18), Math.sin(angle) * (11 + phase * 8));
    });
    const sides = [-1, 1].map(side => Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      return project(-40 + t * 98, side * (8 + Math.sin(t * Math.PI) * (9 + phase * 6)));
    }));
    return [stern, ...sides].map(points => ({ alpha, points }));
  });
};

export const boatRippleInRiver = ({ x, y }: { x: number; y: number }) => {
  const column = x / 96 + y / 48, row = y / 48 - x / 96;
  return column >= config.worldBounds.minimumColumn - 0.5 && column <= config.worldBounds.maximumColumn + 0.5 &&
    row >= config.riverRow - 0.45 && row <= config.riverRow + 1.45;
};

export const merchantBoatBob = (elapsed: number, reducedMotion = false) => {
  if (reducedMotion) return { y: 0, angle: 0 };
  const phase = Math.max(0, elapsed) / 4800 * Math.PI * 2;
  return { y: Math.sin(phase) * 1.5, angle: Math.sin(phase) * 0.6 };
};

export const merchantPoleAngle = (elapsed: number, reducedMotion = false) =>
  5.3 + (reducedMotion ? 0 : Math.sin(Math.max(0, elapsed) / 3600 * Math.PI * 2) * 3);

/** Repaint only the gripping fingers above the pole; the arms remain in the base. */
export const prepareMerchantHandsTexture = (source: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.ellipse(294, 441, 19, 21, 0, 0, Math.PI * 2);
  context.ellipse(356, 374, 15, 20, 0, 0, Math.PI * 2);
  context.clip();
  context.drawImage(source, 0, 0, 1024, 1024);
  return canvas;
};

/** Saved visit travel with cosmetic bobbing, pole motion and wake. */
export const createMerchantBoat = (scene: Phaser.Scene) => {
  let lastMovingVisit: MerchantVisit = { phase: "away" };
  let lastMovingElapsed = -Infinity;
  const point = isoPoint(MERCHANT_BOAT_CELL);
  const wake = scene.add.graphics();
  const body = scene.add.image(0, 0, "merchant-boat")
    .setOrigin(MERCHANT_BOAT_ORIGIN.x, MERCHANT_BOAT_ORIGIN.y)
    .setDisplaySize(MERCHANT_BOAT_SIZE, MERCHANT_BOAT_SIZE);
  const pole = scene.add.image((326 / 1024 - MERCHANT_BOAT_ORIGIN.x) * MERCHANT_BOAT_SIZE,
    (407 / 1024 - MERCHANT_BOAT_ORIGIN.y) * MERCHANT_BOAT_SIZE, "merchant-pole")
    .setOrigin(332 / 1024, 407 / 1024).setDisplaySize(MERCHANT_BOAT_SIZE, MERCHANT_BOAT_SIZE);
  const hands = scene.add.image(0, 0, "merchant-boat-hands")
    .setOrigin(MERCHANT_BOAT_ORIGIN.x, MERCHANT_BOAT_ORIGIN.y).setDisplaySize(MERCHANT_BOAT_SIZE, MERCHANT_BOAT_SIZE);
  const group = scene.add.container(point.x, point.y, [body, pole, hands]).setDepth(point.y + 1);
  const name = scene.add.text(point.x, point.y - 85, "Merchant boat", { fontFamily: "Georgia, serif", fontSize: "14px", color: "#352015",
    backgroundColor: "#fff7e8", padding: { x: 8, y: 4 }, resolution: 2 }).setOrigin(0.5, 1).setDepth(9001).setVisible(false);
  return {
    render(visit: MerchantVisit, reducedMotion = false, showName = false, elapsed = 0) {
      const bob = merchantBoatBob(elapsed, reducedMotion);
      const travel = merchantBoatTravel(visit);
      if (travel.moving) { lastMovingVisit = visit; lastMovingElapsed = elapsed; }
      // Finish the last strokes on arrival, without generating new idle ripples.
      const wakeVisit: MerchantVisit = visit.phase === "stopped" && lastMovingVisit.phase === "arriving"
        ? { phase: "arriving", progress: 1 + (elapsed - lastMovingElapsed) / MERCHANT_TRAVEL_MS }
        : visit;
      wake.clear().setDepth(travel.y);
      for (const ripple of merchantBoatRipples(wakeVisit, reducedMotion)) {
        wake.lineStyle(2, 0xffffff, ripple.alpha).beginPath();
        let drawing = false;
        for (const point of ripple.points) {
          if (!boatRippleInRiver(point)) { drawing = false; continue; }
          if (drawing) wake.lineTo(point.x, point.y);
          else wake.moveTo(point.x, point.y);
          drawing = true;
        }
        wake.strokePath();
      }
      group.setPosition(travel.x, travel.y + bob.y).setAngle(bob.angle)
        .setDepth(travel.y + 1).setAlpha(travel.alpha).setVisible(travel.visible);
      pole.setAngle(merchantPoleAngle(elapsed, reducedMotion || !travel.moving));
      name.setPosition(travel.x, travel.y - 85 + bob.y).setAlpha(travel.alpha).setVisible(showName && travel.visible);
    },
    contains(x: number, y: number) { return group.visible && group.alpha > 0.05 && body.getBounds().contains(x, y); },
    destroy() { wake.destroy(); group.destroy(); name.destroy(); },
  };
};
