import Phaser from "phaser";
import farmUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-test.png";
import bush01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-01.png";
import bush02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-02.png";
import rocks01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-01.png";
import rocks02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-02.png";
import barleySown from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-sown.png";
import barleyGrowing from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-growing.png";
import barleyRipe from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-ripe.png";
import { FARM_SPRITES } from "../../../../assets/farmSprites";
import { prepareFarmerTexture } from "../farmerTexture";
import { FARMER_WALK_SOURCES, FARMER_WALK_BOUNDS, farmerWalkTexture } from "../farmerWalk";
import { FARMER_PLANT_SOURCES, farmerPlantBounds, farmerPlantTexture } from "../farmerPlant";
import { isoPoint, isoCell, isoBuilding, isoField, isoWalkable, isoPath, ISO_SCENERY, isoSceneryAt, isoBarleyStage, type IsoCell } from "../isometricTest";

const scenerySources = { bush01, bush02, rocks01, rocks02 } as const;
const barleySources = { sown: barleySown, growing: barleyGrowing, ripe: barleyRipe } as const;
// Barley-only sharpness trial; restore 0.15 for the previous presentation.
const BARLEY_SHARPEN_AMOUNT = 0.6;

/** Deliberately isolated from stores/API: experimenting cannot spend real resources. */
export class IsometricTestScene extends Phaser.Scene {
  private actor!: Phaser.GameObjects.Image;
  private building!: Phaser.GameObjects.Image;
  private selection!: Phaser.GameObjects.Graphics;
  private cell: IsoCell = { column: 3, row: 4 };
  private path: readonly IsoCell[] = [];
  private progress = 0;
  private distance = 0;
  private plantUntil = 0;
  private plantOnArrival = false;
  private baseZoom = 1;
  private readonly report: (message: string) => void;
  constructor(report: (message: string) => void) { super("isometric-test"); this.report = report; }

  preload() {
    for (const [key, url] of Object.entries(barleySources)) this.load.image(`iso-barley-source-${key}`, url);
    for (const [key, url] of Object.entries(scenerySources)) this.load.image(`iso-scenery-source-${key}`, url);
    this.load.image("iso-farm", farmUrl);
    this.load.image("iso-idle-source", FARM_SPRITES.farmerIdle0);
    FARMER_WALK_SOURCES.forEach((url, i) => this.load.image(`iso-walk-source-${i}`, url));
    FARMER_PLANT_SOURCES.forEach((url, i) => this.load.image(`iso-plant-source-${i}`, url));
  }

  create() {
    const prepare = (key: string, sourceKey: string, bounds?: ReturnType<typeof farmerPlantBounds>, sharpenAmount?: number) => {
      const source = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(key, prepareFarmerTexture(source, sharpenAmount, bounds))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    prepare("iso-idle", "iso-idle-source");
    for (const key of Object.keys(barleySources)) prepare(`iso-barley-${key}`, `iso-barley-source-${key}`, farmerPlantBounds(512), BARLEY_SHARPEN_AMOUNT);
    // Shared 512px framing preserves bushes/rocks' relative heights and crisp edges.
    for (const key of Object.keys(scenerySources)) prepare(`iso-scenery-${key}`, `iso-scenery-source-${key}`, { left: 0, top: 0, right: 511, bottom: 511 });
    FARMER_WALK_SOURCES.forEach((_, i) => prepare(`farmer-walk-v2-${i}`, `iso-walk-source-${i}`, FARMER_WALK_BOUNDS));
    FARMER_PLANT_SOURCES.forEach((_, i) => {
      const source = this.textures.get(`iso-plant-source-${i}`).getSourceImage() as HTMLImageElement;
      prepare(`farmer-plant-v2-${i}`, `iso-plant-source-${i}`, farmerPlantBounds(source.naturalWidth));
    });
    const ground = this.add.graphics().setDepth(-100);
    for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
      const cell = { column, row };
      const water = row >= 8 || (column === 9 && row >= 5);
      const road = row === 4 || column === 3;
      const colour = water ? 0x46a9b0 : road ? 0xd9ad69 : isoField(cell) ? 0xa37a46 : [0xc5bd75, 0xbcb56b, 0xc9c27c][(row + column * 3) % 3]!;
      this.diamond(ground, cell, colour);
      const stage = isoBarleyStage(cell);
      if (stage) {
        const p = isoPoint(cell);
        // Fixed footprint centre (256,336) maps to (64,84) after shared preparation.
        // Never trim each stage: growth must not shift its planting positions.
        // Give leafy stages a planting margin without clipping their raised foliage.
        // Scale around the ground centre, not the image centre, to preserve alignment.
        const cropSize = stage === "sown" ? 112 : 98;
        // Small ripe-only adjustment along the diamond's down-left ground axis.
        const cropX = p.x - (stage === "ripe" ? 4 : 0);
        const cropY = p.y + (stage === "ripe" ? 2 : 0);
        this.add.image(cropX, cropY, `iso-barley-${stage}`).setOrigin(0.5, 84 / 128)
          .setDisplaySize(cropSize, cropSize).setDepth(p.y);
      }
      if (water) {
        const p = isoPoint(cell);
        const ripple = this.add.ellipse(p.x, p.y, 24, 5, 0xa1d9cb, 0.4).setDepth(-50);
        this.tweens.add({ targets: ripple, alpha: 0.1, scaleX: 1.4, duration: 1600 + column * 80, yoyo: true, repeat: -1 });
      }
    }
    // Single 2×2 footprint; artwork extends upward from its front ground corner.
    const front = isoPoint({ column: 5.5, row: 3.5 });
    this.add.ellipse(front.x, front.y - 22, 158, 50, 0x624728, 0.18).setDepth(0);
    this.building = this.add.image(front.x, front.y + 19, "iso-farm").setOrigin(0.5, 1).setDisplaySize(232, 232).setDepth(front.y - 24);
    for (const cell of ISO_SCENERY) {
      const p = isoPoint(cell);
      this.add.ellipse(p.x, p.y, 36, 12, 0x654c2e, 0.12).setDepth(-40);
      // Source ground contact y=448 becomes y=106 in the prepared 128px texture.
      this.add.image(p.x, p.y, `iso-scenery-${cell.sprite}`)
        .setOrigin(0.5, 106 / 128).setDisplaySize(72, 72).setDepth(p.y);
    }
    this.selection = this.add.graphics().setDepth(-20);
    const position = isoPoint(this.cell);
    this.actor = this.add.image(position.x, position.y, "iso-idle").setOrigin(0.5, 0.9375).setDisplaySize(64, 64).setDepth(position.y);
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.path.length || this.plantUntil) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const target = isoCell(world.x, world.y);
      this.selection.clear();
      const scenery = isoSceneryAt(target);
      if (scenery) {
        this.diamond(this.selection, target, 0xffdf77, 0.5);
        this.report(scenery.sprite.startsWith("bush") ? "Bush · scenery preview" : "Rocks · scenery preview");
        return;
      }
      if (!isoWalkable(target) || (target.column === 9 && target.row >= 5)) {
        this.report(isoBuilding(target) ? "Farm building · walk around to test depth." : "Choose ground above the river."); return;
      }
      this.diamond(this.selection, target, 0xffdf77, 0.5);
      this.path = isoPath(this.cell, target);
      this.progress = 0;
      this.plantOnArrival = isoField(target);
      this.report(this.plantOnArrival ? "Walking to the field…" : "Walking…");
      if (!this.path.length) this.arrive();
    });
    this.fit();
    this.scale.on("resize", this.fit, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.fit, this));
  }

  private diamond(g: Phaser.GameObjects.Graphics, cell: IsoCell, colour: number, alpha = 1) {
    const p = isoPoint(cell);
    const points = [new Phaser.Math.Vector2(p.x, p.y - 24), new Phaser.Math.Vector2(p.x + 48, p.y), new Phaser.Math.Vector2(p.x, p.y + 24), new Phaser.Math.Vector2(p.x - 48, p.y)];
    g.fillStyle(colour, alpha).fillPoints(points, true);
    g.lineStyle(1, 0xffffff, 0.08).strokePoints(points, true);
  }

  private arrive() {
    if (this.plantOnArrival) { this.plantUntil = this.time.now + 2560; this.report("Planting · preview only"); }
    else { this.actor.setTexture("iso-idle").setDisplaySize(64, 64); this.report("Tap a field to preview planting."); }
  }

  update(_time: number, delta: number) {
    if (!this.actor) return;
    if (this.path.length) {
      this.progress = Math.min(1, this.progress + Math.min(delta, 80) / 900);
      const start = isoPoint(this.cell), end = isoPoint(this.path[0]!);
      const x = Phaser.Math.Linear(start.x, end.x, this.progress), y = Phaser.Math.Linear(start.y, end.y, this.progress);
      this.distance += Math.hypot(x - this.actor.x, y - this.actor.y);
      this.actor.setPosition(x, y).setDepth(y).setFlipX(end.x < start.x).setTexture(farmerWalkTexture(this.distance)).setDisplaySize(64, 64);
      // Preserve depth while keeping an occluded character discoverable.
      this.building.setAlpha(y < this.building.depth && Math.abs(x - this.building.x) < 105 ? 0.55 : 1);
      if (this.progress === 1) { this.cell = this.path[0]!; this.path = this.path.slice(1); this.progress = 0; if (!this.path.length) this.arrive(); }
    } else if (this.plantUntil) {
      this.actor.setTexture(farmerPlantTexture(this.time.now - (this.plantUntil - 2560))).setDisplaySize(64, 64);
      if (this.time.now >= this.plantUntil) {
        this.plantUntil = 0;
        this.actor.setTexture("iso-idle").setDisplaySize(64, 64);
        this.report("Planting preview complete · display stages stay unchanged.");
      }
    }
  }

  fit() {
    if (!this.cameras?.main) return;
    this.baseZoom = Math.min(this.scale.width / 1030, this.scale.height / 640);
    this.cameras.main.setZoom(this.baseZoom).centerOn(0, 220);
  }
  zoomBy(factor: number) {
    if (!this.cameras?.main) return;
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, this.baseZoom, this.baseZoom * 2.5));
    this.cameras.main.centerOn(isoPoint(this.cell).x, isoPoint(this.cell).y - 40);
  }
}
