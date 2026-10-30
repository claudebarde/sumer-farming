import Phaser from "phaser";
import donationSite from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-site-test.png";
import worksite from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-stage-0-worksite-tools-test.png";
import foundations from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-stage-1-foundations-tools-test.png";
import lowerTerrace from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-stage-2-lower-terrace-tools-test.png";
import upperTerraces from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-stage-3-upper-terraces-tools-test.png";
import completed from "../../../assets/sprite_assets/pngs/v2/isometric-test/ziggurat/ziggurat-completed.png";
import { prepareBuildingTexture } from "./buildingTexture";
import { footprintFront, ISO_WIDTH } from "./isometricProjection";

// Player-approved October 27 placement; shared across all neighbourhood views.
export const zigguratPreviewSite = { column: -5, row: -2, columns: 4, rows: 4 } as const;
export const zigguratPreviewStages = [
  { id: "site", label: "Ziggurat site", source: donationSite },
  { id: "worksite", label: "Worksite", source: worksite },
  { id: "foundations", label: "Foundations", source: foundations },
  { id: "lower-terrace", label: "Lower terrace", source: lowerTerrace },
  { id: "upper-terraces", label: "Upper terraces", source: upperTerraces },
  { id: "completed", label: "Completed", source: completed },
] as const;
export type ZigguratPreviewStage = typeof zigguratPreviewStages[number]["id"];
const textureKey = (stage: ZigguratPreviewStage) => `ziggurat-${stage}-preview`;
// The lower-terrace source's matching base contour is 127px lower on its
// 1254px canvas. Compensate in the anchor, preserving the approved world site
// and scale rather than independently cropping/resizing the construction stages.
const stageOriginY = (stage: ZigguratPreviewStage) => 0.84 + (stage === "lower-terrace" ? 127 / 1254 : 0);
export const preloadZigguratPlacement = (scene: Phaser.Scene) => {
  for (const stage of zigguratPreviewStages) {
    const key = textureKey(stage.id);
    if (!scene.textures.exists(key)) scene.load.image(`source-${key}`, stage.source);
  }
};
export const createZigguratPlacementPreview = (scene: Phaser.Scene, stage: ZigguratPreviewStage = "site") => {
  for (const entry of zigguratPreviewStages) {
    const key = textureKey(entry.id);
    if (scene.textures.exists(key)) continue;
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    scene.textures.addCanvas(key, prepareBuildingTexture(source, { maxSize: 512 }))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  const site = zigguratPreviewSite;
  const front = footprintFront(site, site.columns, site.rows);
  const building = scene.add.image(front.x, front.y, textureKey(stage)).setOrigin(0.5, stageOriginY(stage))
    .setDisplaySize(ISO_WIDTH * 4, ISO_WIDTH * 4).setDepth(front.y - 48);
  return { building, setStage: (next: ZigguratPreviewStage) => building.setTexture(textureKey(next))
    .setOrigin(0.5, stageOriginY(next)), destroy: () => building.destroy() };
};
