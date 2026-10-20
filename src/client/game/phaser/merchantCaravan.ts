import type Phaser from "phaser";
import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-caravan-idle-no-wheels.png";
import walk1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-caravan-walk-01.png";
import walk2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-caravan-walk-02.png";
import walk3 from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-caravan-walk-03.png";
import walk4 from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-caravan-walk-04.png";
import wheel from "../../../assets/sprite_assets/pngs/v2/isometric-test/merchant-caravan/merchant-wheel.png";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { isoPoint } from "./isometricProjection";
import { MERCHANT_CHARIOT_WIDTH_TILES } from "./merchantChariotLayout";
import { scheduledMerchantVisit, type MerchantVisit } from "./merchantVisit";
import { MERCHANT_TRAVEL_MS } from "../../../game-data/npcRequests";

export const CARAVAN_SOURCES = { "caravan-idle": idle, "caravan-walk-0": walk1,
  "caravan-walk-1": walk2, "caravan-walk-2": walk3, "caravan-walk-3": walk4, "caravan-wheel": wheel } as const;
export const CARAVAN_SCALE = 0.18;
export const CARAVAN_ROAD_OFFSET_Y = 20;
// Above world buildings, below selection chips and interface overlays.
export const CARAVAN_DEPTH = 9000;
const start = config.worldBounds.minimumColumn - 3;
const end = config.worldBounds.maximumColumn + 3;
// Park just inside the western entrance, leaving the market and porter clear.
export const CARAVAN_STOP_COLUMN = config.worldBounds.minimumColumn + MERCHANT_CHARIOT_WIDTH_TILES / 2;
export const caravanVisitPose = (visit: MerchantVisit, reducedMotion = false) => {
  const moving = visit.phase === "arriving" || visit.phase === "departing";
  const progress = moving ? visit.progress : 0;
  const column = visit.phase === "arriving" ? start + (CARAVAN_STOP_COLUMN - start) * progress
    : visit.phase === "departing" ? CARAVAN_STOP_COLUMN + (end - CARAVAN_STOP_COLUMN) * progress : CARAVAN_STOP_COLUMN;
  const point = isoPoint({ column, row: config.roadRow });
  const distance = (column - start) * Math.hypot(48, 24);
  const edgeProgress = Math.max(0, Math.min(1,
    (column - start) / (config.worldBounds.minimumColumn - start),
    (end - column) / (end - config.worldBounds.maximumColumn)));
  const alpha = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
  return { x: point.x, y: point.y + CARAVAN_ROAD_OFFSET_Y, depth: CARAVAN_DEPTH, alpha, visible: visit.phase !== "away",
    texture: reducedMotion || !moving ? "caravan-idle" : `caravan-walk-${Math.floor(progress * MERCHANT_TRAVEL_MS / 225) % 4}`,
    // Parent is mirrored, so negative local rotation rolls clockwise on screen.
    rotation: reducedMotion ? 0 : -distance / (95 * CARAVAN_SCALE) };
};

export const scheduledCaravanVisit = scheduledMerchantVisit;

export const prepareCaravanTextures = (scene: Phaser.Scene) => {
  for (const key of Object.keys(CARAVAN_SOURCES)) {
    if (scene.textures.exists(key)) continue;
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = key === "caravan-wheel" ? 256 : 512;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    scene.textures.addCanvas(key, canvas);
  }
};

export const createMerchantCaravan = (scene: Phaser.Scene) => {
  // Shared original 1024px registration; mirror the whole assembly to face right.
  const body = scene.add.image(0, 0, "caravan-idle").setOrigin(0.5, 820 / 1024).setDisplaySize(1024, 1024);
  const wheel = scene.add.image(0, 0, "caravan-wheel").setDisplaySize(200, 200);
  // Rotate the circular child BEFORE the parent's fixed perspective squash.
  const wheelPlane = scene.add.container(786 - 512, 575 - 820, [wheel]).setScale(0.7, 1).setAngle(15);
  const group = scene.add.container(0, 0, [body, wheelPlane]).setScale(-CARAVAN_SCALE, CARAVAN_SCALE);
  const name = scene.add.text(0, 0, "Merchant chariot", { fontFamily: "Georgia, serif", fontSize: "14px", color: "#352015",
    backgroundColor: "#fff7e8", padding: { x: 8, y: 4 }, resolution: 2 }).setOrigin(0.5, 1).setDepth(CARAVAN_DEPTH + 1).setVisible(false);
  return {
    render(visit: MerchantVisit, reducedMotion = false, showName = false) {
      const pose = caravanVisitPose(visit, reducedMotion);
      group.setPosition(pose.x, pose.y).setDepth(pose.depth).setAlpha(pose.alpha).setVisible(pose.visible);
      body.setTexture(pose.texture);
      wheel.setRotation(pose.rotation);
      name.setPosition(pose.x, pose.y - 125).setVisible(showName && pose.visible);
    },
    contains(x: number, y: number) { return group.visible && group.alpha > 0.05 && group.getBounds().contains(x, y); },
    destroy() { group.destroy(); name.destroy(); }
  };
};
