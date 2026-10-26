import Phaser from "phaser";
import rest from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-rest.webp";
import pickup from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-pickup.webp";
import lift from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-lift.webp";
import place from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-place.webp";
import bend from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-bend.webp";
import beginLift from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-begin-lift.webp";
import reach from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-reach.webp";
import release from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-release.webp";
import lower from "../../../assets/sprite_assets/pngs/v2/isometric-test/renovation-builder/farmer-style/builder-lower.webp";
import { prepareBuildingTexture } from "./buildingTexture";
import { FARMER_SHARPEN_AMOUNT } from "./farmerTexture";
import { renovationBuilderPose } from "./renovationBuilderMotion";

export const RENOVATION_BUILDER_SOURCES = [rest, bend, pickup, beginLift, lift, reach, place, release, lower];
// Match the farmer's 128px texture and sharpening baseline. Preparing near
// display resolution keeps the sharpening visible after GPU minification,
// while LINEAR filtering preserves soft silhouettes.
// The new artwork fills more of its canvas: 70px preserves roughly farmer-sized
// visible height without enlarging the worker inside the renovation site.
const BUILDER_DISPLAY_SIZE = 70;
const BUILDER_TEXTURE_OPTIONS = { maxSize: 128, sharpen: FARMER_SHARPEN_AMOUNT } as const;
const footOrigins: { x: number; y: number }[] = [];

// Inner skyline of the front wall in the 1254 × 1254 renovation artwork.
// Follow each raised brick and the low sections between them, rather than a
// diagonal across the open interior (which visibly slices off the legs).
const FRONT_WALL_RIDGE = [
  [0, 500], [122, 500], [172, 477], [222, 503], [250, 544],
  [298, 568], [335, 560], [381, 535], [400, 543], [443, 568],
  [447, 589], [471, 590], [523, 616], [540, 632], [540, 651],
  [550, 651], [599, 674], [614, 688], [615, 708], [626, 706],
  [682, 736], [700, 753], [701, 783], [731, 796], [738, 786],
  [797, 754], [806, 757], [816, 737], [871, 704], [897, 713],
  [895, 689], [907, 666], [962, 635], [1005, 638], [1008, 614],
  [966, 583], [960, 543], [965, 477], [1040, 434], [1254, 434]
] as const;

export const prepareRenovationBuilder = (scene: Phaser.Scene) => {
  RENOVATION_BUILDER_SOURCES.forEach((_, index) => {
    const source = scene.textures.get(`source-builder-${index}`).getSourceImage() as HTMLImageElement;
    const canvas = prepareBuildingTexture(source, BUILDER_TEXTURE_OPTIONS);
    // Register generated frames by the feet, not their varying transparent margins.
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, right = 0, bottom = 0;
    for (let y = Math.floor(canvas.height * 0.7); y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3]! > 32) {
        left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    footOrigins[index] = bottom ? { x: (left + right) / 2 / canvas.width, y: bottom / canvas.height } : { x: 0.5, y: 0.8 };
    scene.textures.addCanvas(`builder-${index}`, canvas)
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  });
};

/** Upgrade decoration only: the worker never owns or advances a production job. */
export const createRenovationBuilder = (scene: Phaser.Scene, building: Phaser.GameObjects.Image) => {
  const worker = scene.add.image(0, 0, "builder-0").setOrigin(0.5, 0.8).setDisplaySize(BUILDER_DISPLAY_SIZE, BUILDER_DISPLAY_SIZE).setVisible(false);
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  // Phaser 4's legacy geometry masks only render in Canvas. WebGL requires
  // a filter mask; otherwise the feet are drawn over the wall despite setMask.
  const canvasMask = scene.game.renderer.type === Phaser.CANVAS
    ? maskShape.createGeometryMask() : null;
  if (canvasMask) worker.setMask(canvasMask);
  else {
    worker.enableFilters();
    worker.filters!.external.addMask(maskShape, false, scene.cameras.main);
  }
  let startedAt: number | null = null;
  return {
    render(active: boolean, now: number, reduced: boolean) {
      worker.setVisible(active);
      if (!active) { startedAt = null; return; }
      startedAt ??= now;
      const pose = renovationBuilderPose(now - startedAt, reduced);
      const origin = footOrigins[pose.frame] ?? { x: 0.5, y: 0.8 };
      worker.setTexture(`builder-${pose.frame}`)
        .setDisplaySize(BUILDER_DISPLAY_SIZE, BUILDER_DISPLAY_SIZE)
        .setOrigin(origin.x, origin.y)
        .setPosition(building.x + 12, building.y - 48).setDepth(building.depth + 0.6);
      const left = building.x - building.displayWidth * building.originX;
      const top = building.y - building.displayHeight * building.originY;
      const points = [[0, 0], [1254, 0], ...FRONT_WALL_RIDGE.toReversed()].map(([x, y]) =>
        new Phaser.Math.Vector2(left + x! / 1254 * building.displayWidth, top + y! / 1254 * building.displayHeight));
      maskShape.clear().fillStyle(0xffffff).fillPoints(points, true);
    },
    destroy() {
      worker.clearMask();
      // Destroying the worker also releases its WebGL filter and mask texture.
      worker.destroy();
      canvasMask?.destroy();
      maskShape.destroy();
    }
  };
};
