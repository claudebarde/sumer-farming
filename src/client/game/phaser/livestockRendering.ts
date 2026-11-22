import type Phaser from "phaser";
import type { FarmSnapshot } from "../../../schemas/farm";
import { sheepStage, livestockPathPose, fleeceRemaining, SHEAR_MS, type Livestock, type Sheep, type LambDelivery } from "../../../game-data/livestock";
import { isoPoint, footprintFront } from "./isometricProjection";
import { sheepFrame, prepareSheepTextures } from "./sheepAnimationPreview";
import { initialPreviewSheep, advancePreviewSheep } from "./sheepPreviewMotion";
import { gazelleGrazePose } from "./gazelleMotion";
import { sheepPenAppearance } from "./sheepPen";

export const createLambFollowers = (scene: Phaser.Scene) => {
  prepareSheepTextures(scene);
  const images = Array.from({ length: 3 }, () => scene.add.image(0, 0, sheepFrame("lamb", "walk", 0)).setOrigin(.5, .86).setVisible(false));
  return {
    destroy: () => images.forEach(image => image.destroy()),
    render(delivery: LambDelivery | null | undefined, phase: "market" | "farm", now: number, reduced: boolean) {
      images.forEach((image, i) => {
        const visible = !!delivery && i < delivery.quantity && now < delivery.completesAt && (phase === "market" ? now < delivery.farmStartsAt : now >= delivery.farmStartsAt);
        image.setVisible(visible && !(phase === "farm" && delivery && now < delivery.farmStartsAt + (i + 1) * delivery.stepMs));
        if (!visible || !delivery) return;
        const path = phase === "market" ? [...Array.from({ length: i + 1 }, (_, j) => ({ column: delivery.marketPath[0]!.column + i + 1 - j, row: delivery.marketPath[0]!.row })), ...delivery.marketPath] : delivery.farmPath;
        const elapsed = now - (phase === "market" ? delivery.startedAt : delivery.farmStartsAt) - (phase === "farm" ? (i + 1) * delivery.stepMs : 0);
        const pose = livestockPathPose(path, elapsed, delivery.stepMs), point = isoPoint(pose.position);
        image.setPosition(point.x, point.y).setDepth(point.y + .5).setFlipX(!pose.flipX)
          .setTexture(sheepFrame("lamb", pose.walking && !reduced ? "walk" : "lower", pose.walking && !reduced ? Math.floor(Math.max(0, elapsed) / 180) % 8 : 0)).setDisplaySize(30, 30);
      });
    }
  };
};

export const createPenAnimals = (scene: Phaser.Scene, pen: FarmSnapshot["buildings"][number]) => {
  prepareSheepTextures(scene);
  const point = isoPoint({ column: pen.column + .5, row: pen.row + .5 });
  // Keep animals between the rear fence and the foreground fence in all orientations.
  const appearance = sheepPenAppearance(pen, pen.loadingTile);
  const source = scene.textures.get(appearance.texture).getSourceImage() as HTMLCanvasElement;
  const key = `${appearance.texture}-animals-front`;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(0, source.height * .39); ctx.lineTo(source.width * .5, source.height * .595); ctx.lineTo(source.width, source.height * .39);
    ctx.lineTo(source.width, source.height); ctx.lineTo(0, source.height); ctx.closePath(); ctx.clip(); ctx.drawImage(source, 0, 0);
    scene.textures.addCanvas(key, canvas);
  }
  const depth = footprintFront(pen, 2, 2).y - 24;
  const root = scene.add.container(point.x, point.y).setDepth(depth + 1);
  const images = Array.from({ length: 3 }, () => scene.add.image(0, 0, sheepFrame("lamb", "lower", 0)).setOrigin(.5, .86).setDisplaySize(30, 30).setVisible(false));
  images.forEach(image => root.add(image));
  const front = scene.add.image(point.x, point.y, key).setOrigin(.5, .565).setDisplaySize(196, 196).setFlipX(appearance.flipX).setDepth(depth + 2);
  let herd = initialPreviewSheep();
  return { destroy() { root.destroy(true); front.destroy(); },
    update(animals: readonly Sheep[], delta: number, reduced: boolean, state?: Livestock) {
      if (!document.hidden && !reduced) herd = advancePreviewSheep(herd, delta);
      images.forEach((image, i) => {
        const now = Date.now(), job = state?.shearing;
        const working = job && now >= job.shearsAt && now < job.shearedAt;
        const activeId = working ? job.animalIds[Math.floor((now - job.shearsAt) / SHEAR_MS)] : undefined;
        image.setVisible(i < animals.length && animals[i]?.id !== activeId);
        const kind = animals[i] && sheepStage(animals[i]!, Date.now()) !== "Lamb" ? "adult" : "lamb";
        const animal = herd[i]!, action = animal.action;
        const pose = action.type === "graze" ? gazelleGrazePose(action.elapsed, action.duration) : { kind: "lower", index: 0 };
        image.setPosition(animal.position.x, animal.position.y).setDepth(animal.position.y).setFlipX(animal.flip)
          .setTexture(sheepFrame(kind, !reduced && action.type === "walk" ? "walk" : pose.kind, !reduced && action.type === "walk" ? Math.floor(action.elapsed / 180) % 8 : reduced ? 0 : pose.index)).setOrigin(.5, kind === "adult" ? .89 : .86).setDisplaySize(kind === "adult" ? 36 : 30, kind === "adult" ? 36 : 30);
        const shearIndex = job?.animalIds.indexOf(animals[i]?.id ?? "") ?? -1;
        const shorn = kind === "adult" && state && fleeceRemaining(state, now) > 0 && job && (shearIndex < 0 || now >= job.shearsAt + (shearIndex + 1) * SHEAR_MS);
        if (shorn) {
          const resting = initialPreviewSheep()[i]!;
          image.setTexture("sheep-shorn").setPosition(resting.position.x, resting.position.y).setDepth(resting.position.y).setFlipX(resting.flip);
        }
        if (working && shearIndex >= 0 && animals[i]?.id !== activeId && shearIndex > Math.floor((now - job.shearsAt) / SHEAR_MS)) {
          const gate = isoPoint(pen.loadingTile ?? pen);
          image.setPosition((gate.x - point.x) * .35 + (i - 1) * 17, (gate.y - point.y) * .35).setDepth((gate.y - point.y) * .35).setTexture(sheepFrame(kind, "lower", 0));
        }
      });
      root.sort("depth");
    }
  };
};
