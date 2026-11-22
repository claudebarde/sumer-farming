import Phaser from "phaser";
import { prepareFarmerTexture } from "./farmerTexture";
import { prepareBuildingTexture } from "./buildingTexture";
import { gazelleGrazePose } from "./gazelleMotion";
import { advancePreviewSheep, initialPreviewSheep } from "./sheepPreviewMotion";
import { isoCell, isoPoint } from "./isometricProjection";
import penUrl from "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-pen-empty-test.png";

import grassUrl from "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-pen-grass.png";

const assets = import.meta.glob<string>(["../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-adult-animations/*.png", "../../../assets/sprite_assets/pngs/v2/isometric-test/sheep/sheep-lamb-animations/*.png"], { eager: true, query: "?url", import: "default" });
const frames = Object.entries(assets).map(([path, url]) => ({ key: path.split("/").at(-1)!.replace(".png", ""), url }));
export const preloadSheepPreview = (scene: Phaser.Scene) => {
  scene.load.image("sheep-preview-pen-source", penUrl);
  scene.load.image("sheep-preview-grass", grassUrl);
  frames.forEach(({ key, url }) => scene.load.image(`source-${key}`, url));
};
const previewAnimals = [
  { age: "lamb", size: 30, originY: .86 },
  { age: "adult", size: 36, originY: .89 },
  { age: "lamb", size: 30, originY: .86 },
] as const;
export const sheepFrame = (age: "adult" | "lamb", kind: string, index: number) => `sheep-${age}-${kind}-${String(index + 1).padStart(2, "0")}`;

/** Temporary visual-only review. No commands, farm mutation or worker assignment. */
export const prepareSheepTextures = (scene: Phaser.Scene) => {
  for (const { key } of frames) if (!scene.textures.exists(key)) {
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    scene.textures.addCanvas(key, prepareFarmerTexture(source, undefined,
      { left: 0, top: 0, right: source.width - 1, bottom: source.height - 1 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  if (!scene.textures.exists("sheep-preview-pen")) {
    const source = scene.textures.get("sheep-preview-pen-source").getSourceImage() as HTMLImageElement;
    const pen = prepareBuildingTexture(source);
    scene.textures.addCanvas("sheep-preview-pen", pen)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Split along the empty interior, retaining the gate and both near fences.
    const front = document.createElement("canvas");
    front.width = pen.width; front.height = pen.height;
    const ctx = front.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(0, pen.height * .39);
    ctx.lineTo(pen.width * .5, pen.height * .595);
    ctx.lineTo(pen.width, pen.height * .39);
    ctx.lineTo(pen.width, pen.height); ctx.lineTo(0, pen.height); ctx.closePath(); ctx.clip();
    ctx.drawImage(pen, 0, 0);
    scene.textures.addCanvas("sheep-preview-front", front)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
};

export const createSheepAnimationPreview = (scene: Phaser.Scene) => {
  prepareSheepTextures(scene);
  // Match the approved 2×2 placement: 196 world pixels, with no screen-size
  // multiplier or inverse zoom. Anchor once so panning does not move the pen.
  const camera = scene.cameras.main;
  const centre = camera.getWorldPoint(camera.width / 2, camera.height * .58);
  const cell = isoCell(centre.x, centre.y);
  const anchor = isoPoint({ column: cell.column + .5, row: cell.row + .5 });
  const root = scene.add.container(anchor.x, anchor.y).setDepth(100000);
  // Full-canvas grass artwork: flat top surface only, beneath the fence bases.
  root.add(scene.add.image(0, -1, "sheep-preview-grass").setDisplaySize(174, 174));
  root.add(scene.add.image(0, 0, "sheep-preview-pen").setOrigin(.5, .565).setDisplaySize(196, 196));
  const sheep = previewAnimals.map(({ age, size, originY }) => scene.add.image(0, 0, sheepFrame(age, "lower", 0)).setOrigin(.5, originY).setDisplaySize(size, size));
  const animals = scene.add.container(0, 0);
  root.add(animals);
  sheep.forEach(image => animals.add(image));
  root.add(scene.add.image(0, 0, "sheep-preview-front").setOrigin(.5, .565).setDisplaySize(196, 196));
  let herd = initialPreviewSheep();
  return {
    destroy: () => root.destroy(true),
    update(delta: number, reducedMotion: boolean) {
      if (!document.hidden && !reducedMotion) herd = advancePreviewSheep(herd, delta);
      sheep.forEach((image, i) => {
        const animal = herd[i]!;
        const { age, size } = previewAnimals[i]!;
        const action = animal.action;
        const pose = action.type === "graze" ? gazelleGrazePose(action.elapsed, action.duration) : { kind: "lower", index: 0 };
        const texture = reducedMotion ? sheepFrame(age, "lower", 0)
          : action.type === "walk" ? sheepFrame(age, "walk", Math.floor(action.elapsed / 180) % 8)
          : sheepFrame(age, pose.kind, pose.index);
        image.setPosition(animal.position.x, animal.position.y).setDepth(animal.position.y)
          .setFlipX(animal.flip).setTexture(texture).setDisplaySize(size, size);
      });
      animals.sort("depth");
    },
  };
};
