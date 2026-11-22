import Phaser from "phaser";
import { prepareFarmerTexture } from "./farmerTexture";
const assets = import.meta.glob<string>("../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/farmer-shearing-animations/*.png", { eager: true, query: "?url", import: "default" });
const names = [...Array.from({ length: 8 }, (_, i) => `shear-${String(i + 1).padStart(2, "0")}`), "head-01", "head-02", "head-03"];
import woolIdle from "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/farmer-carry-wool-idle.png";
import woolWalk from "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/farmer-carry-wool-walk01.png";
import shorn from "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-shorn-idle.png";
const frames = [...names.map((name, index) => ({ key: `shearing-${index}`, url: assets[`../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/farmer-shearing-animations/${name}.png`]! })), { key: "wool-idle", url: woolIdle }, { key: "wool-walk", url: woolWalk }, { key: "sheep-shorn", url: shorn }];
export const preloadShearing = (scene: Phaser.Scene) => frames.forEach(({ key, url }) => scene.load.image(`${key}-source`, url));
export const prepareShearing = (scene: Phaser.Scene) => frames.forEach(({ key }) => {
  if (scene.textures.exists(key)) return;
  const source = scene.textures.get(`${key}-source`).getSourceImage() as HTMLImageElement;
  scene.textures.addCanvas(key, prepareFarmerTexture(source, undefined, { left: 0, top: 0, right: source.width - 1, bottom: source.height - 1 }, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
});
const stroke: readonly (readonly [number, number])[] = [[0, 320], [1, 100], [2, 90], [3, 90], [4, 150], [5, 100], [6, 100], [7, 110]];
const sequence: readonly (readonly [number, number])[] = [...stroke, [0, 480], ...stroke, [0, 650], [8, 150], [9, 180], [10, 140], [9, 180], [8, 150], [0, 600], ...stroke, [0, 900]];

export const shearingTexture = (elapsed: number, reduced: boolean) => {
  if (reduced) return "shearing-0";
  let phase = Math.max(0, elapsed) % sequence.reduce((sum, frame) => sum + frame[1], 0);
  for (const [frame, duration] of sequence) { if (phase < duration) return `shearing-${frame}`; phase -= duration; }
  return "shearing-0";
};

export const woolCarryingTexture = (elapsed: number, walking: boolean, reduced: boolean) =>
  walking && !reduced && Math.floor(elapsed / 180) % 2 ? "wool-walk" : "wool-idle";
