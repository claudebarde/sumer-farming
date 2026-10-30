import Phaser from "phaser";
import { neighbourhoodMarketRoadLoop, neighbourhoodMarketCharacterDepth } from "./neighbourhoodLayout";
import { isoPoint } from "./isometricProjection";
import { DONKEY_STEP_MS } from "./isometricDonkey";
import { prepareFarmerTexture } from "./farmerTexture";
import front1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-front-01.png";
import front2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-front-02.png";
import front3 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-front-03.png";
import front4 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-front-04.png";
import back1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-back-01.png";
import back2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-back-02.png";
import back3 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-back-03.png";
import back4 from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/donkey-loaded-walk-back-04.png";

const sources = { front: [front1, front2, front3, front4], back: [back1, back2, back3, back4] };
// These full-canvas frames have padding beneath the hooves. Lower the artwork
// to put its ground contact on the road centre without changing the route.
const ROAD_CONTACT_OFFSET_Y = 8;
const keys = Object.entries(sources).flatMap(([direction, urls]) => urls.map((url, i) => ({
  key: `ziggurat-donkey-${direction}-${i}`, url,
})));
export const preloadZigguratDonkey = (scene: Phaser.Scene) => {
  for (const { key, url } of keys) if (!scene.textures.exists(key)) scene.load.image(`source-${key}`, url);
};

// Follow exactly the tiles rendered as the market perimeter road.
const route = neighbourhoodMarketRoadLoop.map(isoPoint);

/** Cosmetic preview only: no saved jobs, inventory or neighbourhood presence. */
export const prepareZigguratDonkey = (scene: Phaser.Scene) => {
  for (const { key } of keys) {
    if (scene.textures.exists(key)) continue;
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    scene.textures.addCanvas(key, prepareFarmerTexture(source, undefined,
      { left: 0, top: 0, right: source.width - 1, bottom: source.height - 1 }, 256))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
};
export const createZigguratDonkeyPreview = (scene: Phaser.Scene) => {
  prepareZigguratDonkey(scene);
  const actor = scene.add.image(0, 0, "ziggurat-donkey-front-0")
    .setOrigin(0.5, 120 / 128).setDisplaySize(76, 76);
  let elapsed = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const update = (delta: number) => {
    // Do not fast-forward the cosmetic loop after a hidden tab.
    elapsed += Math.min(delta, 100);
    const step = Math.floor(elapsed / DONKEY_STEP_MS) % route.length;
    const from = route[step]!, to = route[(step + 1) % route.length]!;
    const t = elapsed % DONKEY_STEP_MS / DONKEY_STEP_MS;
    const direction = to.y < from.y ? "back" : "front";
    const frame = reducedMotion ? 0 : Math.floor(elapsed / (DONKEY_STEP_MS / 4)) % 4;
    const fromTile = neighbourhoodMarketRoadLoop[step]!;
    const toTile = neighbourhoodMarketRoadLoop[(step + 1) % route.length]!;
    const position = {
      column: fromTile.column + (toTile.column - fromTile.column) * t,
      row: fromTile.row + (toTile.row - fromTile.row) * t,
    };
    actor.setTexture(`ziggurat-donkey-${direction}-${frame}`).setFlipX(to.x > from.x)
      .setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + ROAD_CONTACT_OFFSET_Y)
      .setDepth(neighbourhoodMarketCharacterDepth(position));
  };
  update(0);
  return { actor, update, destroy: () => actor.destroy() };
};
