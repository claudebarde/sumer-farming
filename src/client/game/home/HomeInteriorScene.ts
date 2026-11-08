import { HOME_FURNITURE, canRotateFurniture, furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../../game-data/homeFurniture";
import { furnitureObstacles } from "../../../game-core/home/furniture";
import { FURNITURE_ARTWORK } from "./furnitureArtwork";
import { prepareBuildingTexture } from "../phaser/buildingTexture";
export type FurniturePreview = { readonly item: FurniturePlacement; readonly error: string | null };
import Phaser from "phaser";
import ground from "../../../assets/sprite_assets/pngs/v2/isometric-test/ground-non-arable.png";
import bush from "../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-01.png";
import { drawInteriorGround } from "./interiorGround";
import artwork from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/courtyard-empty.png";
import { FARM_SPRITES } from "../../../assets/farmSprites";
import { FARMER_SHARPEN_AMOUNT, prepareFarmerTexture } from "../phaser/farmerTexture";
import { FARMER_WALK_SOURCES, FARMER_WALK_BOUNDS, farmerWalkTexture } from "../phaser/farmerWalk";
import { INTERIOR_ENTRY, interiorPath, distance, type InteriorPoint } from "./interiorNavigation";

import { INTERIOR_WALLS, DOORWAY_HEADERS, insideDoorway, behindLeftInteriorWall, behindRightInteriorWall, type WallPolygon } from "./interiorWalls";

export class HomeInteriorScene extends Phaser.Scene {
  private furniture: readonly FurniturePlacement[] = [];
  private furnitureImages: Phaser.GameObjects.Image[] = [];
  private placing: FurnitureKey | null = null;
  private placementOrientation: "original" | "mirrored" = "original";
  private ghost?: Phaser.GameObjects.Image;
  private footprint?: Phaser.GameObjects.Image;
  private preview: FurniturePreview | null = null;
  private furnitureLocked = false;
  private validationWorker?: Worker;
  private validationBusy = false;
  private validationId = 0;
  private pendingValidation?: { id: number; items: FurniturePlacement[]; farmer: InteriorPoint };
  private actor?: Phaser.GameObjects.Image;
  private leftWall?: Phaser.GameObjects.Image;
  private rightWall?: Phaser.GameObjects.Image;
  private doorwayHeaders: Phaser.GameObjects.Image[] = [];
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private shadow?: Phaser.GameObjects.Ellipse;
  private marker?: Phaser.GameObjects.Ellipse;
  private path: readonly InteriorPoint[] = [];
  private travelled = 0;
  private exitComplete: (() => void) | null = null;
  private down?: { x: number; y: number };
  private dragged = false;
  private zoomFactor = 1;
  private readonly onReady: () => void;
  private readonly onPreview: (preview: FurniturePreview | null) => void;
  private readonly onSelect: (key: FurnitureKey) => void;
  constructor(onReady: () => void, onPreview: (preview: FurniturePreview | null) => void, onSelect: (key: FurnitureKey) => void) {
    super("home-interior");
    this.onReady = onReady; this.onPreview = onPreview; this.onSelect = onSelect;
  }
  preload() {
    HOME_FURNITURE.forEach(item => this.load.image(`furniture-source-${item.key}`, FURNITURE_ARTWORK[item.key]));
    this.load.image("house", artwork);
    this.load.image("interior-ground", ground);
    this.load.image("interior-bush", bush);
    this.load.image("idle-source", FARM_SPRITES.farmerIdle0);
    FARMER_WALK_SOURCES.forEach((url, i) => this.load.image(`walk-source-${i}`, url));
  }
  create() {
    HOME_FURNITURE.forEach(item => {
      const original = this.textures.get(`furniture-source-${item.key}`).getSourceImage() as HTMLImageElement;
      const cropped = document.createElement("canvas");
      cropped.width = original.naturalWidth; cropped.height = original.naturalHeight;
      const context = cropped.getContext("2d")!;
      context.drawImage(original, 0, 0);
      const pixels = context.getImageData(0, 0, cropped.width, cropped.height).data;
      let left = cropped.width, top = cropped.height, right = -1, bottom = -1;
      // Ignore the faint baked glow when measuring the usable object's silhouette.
      for (let y = 0; y < cropped.height; y++) for (let x = 0; x < cropped.width; x++) {
        if (pixels[(y * cropped.width + x) * 4 + 3]! > 200) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      const frame = document.createElement("canvas");
      frame.width = Math.max(1, right - left + 1); frame.height = Math.max(1, bottom - top + 1);
      frame.getContext("2d")!.drawImage(original, left, top, frame.width, frame.height, 0, 0, frame.width, frame.height);
      const source = prepareBuildingTexture(frame);
      const canvas = document.createElement("canvas"); canvas.width = item.width; canvas.height = item.height;
      const scale = Math.min(item.width / source.width, item.height / source.height);
      const width = source.width * scale, height = source.height * scale;
      // Preview and placed objects use exactly the same proportionate, normalized frame.
      canvas.getContext("2d")!.drawImage(source, (item.width - width) / 2, (item.height - height) / 2, width, height);
      this.textures.addCanvas(`furniture-${item.key}`, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
      // Cache a padded silhouette outline once; pointer movement only moves images.
      const mask = document.createElement("canvas"); mask.width = canvas.width; mask.height = canvas.height;
      const maskContext = mask.getContext("2d")!;
      const silhouette = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < silhouette.data.length; i += 4) {
        silhouette.data[i] = silhouette.data[i + 1] = silhouette.data[i + 2] = 255;
        silhouette.data[i + 3] = silhouette.data[i + 3]! > 160 ? 255 : 0;
      }
      maskContext.putImageData(silhouette, 0, 0);
      const halo = document.createElement("canvas"); halo.width = canvas.width + 12; halo.height = canvas.height + 12;
      const haloContext = halo.getContext("2d")!;
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        if (x * x + y * y <= 36) haloContext.drawImage(mask, x + 6, y + 6);
      }
      haloContext.globalCompositeOperation = "destination-out";
      haloContext.drawImage(mask, 6, 6);
      this.textures.addCanvas(`furniture-halo-${item.key}`, halo)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    this.validationWorker = new Worker(new URL("./furnitureValidation.worker.ts", import.meta.url), { type: "module" });
    this.validationWorker.onmessage = (event: MessageEvent<{ id: number; error: string | null }>) => {
      this.validationBusy = false;
      if (event.data.id === this.validationId && this.preview && this.placing) {
        this.preview = { item: this.preview.item, error: event.data.error };
        this.footprint?.setTint(event.data.error ? 0xb75038 : 0x80a743);
        this.onPreview(this.preview);
      }
      this.validatePending();
    };
    this.events.once("shutdown", () => { this.validationWorker?.terminate(); this.validationWorker = undefined; });
    drawInteriorGround(this);
    this.add.image(0, 0, "house").setOrigin(0);
    this.textures.addCanvas("farmer-idle", prepareFarmerTexture(this.textures.get("idle-source").getSourceImage() as HTMLImageElement, FARMER_SHARPEN_AMOUNT, undefined, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    FARMER_WALK_SOURCES.forEach((_, i) => this.textures.addCanvas(`farmer-walk-v2-${i}`, prepareFarmerTexture(this.textures.get(`walk-source-${i}`).getSourceImage() as HTMLImageElement, FARMER_SHARPEN_AMOUNT, FARMER_WALK_BOUNDS, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR));
    this.shadow = this.add.ellipse(INTERIOR_ENTRY.x, INTERIOR_ENTRY.y, 42, 13, 0x624728, .2).setDepth(1);
    this.marker = this.add.ellipse(0, 0, 25, 12).setStrokeStyle(2, 0xd9ad4d).setDepth(1).setVisible(false);
    this.actor = this.add.image(INTERIOR_ENTRY.x, INTERIOR_ENTRY.y, "farmer-idle").setOrigin(.5, 120 / 128).setDisplaySize(125, 125).setDepth(2);
    // Repaint the exact original wall pixels above the actor, leaving doorway openings clear.
    const source = this.textures.get("house").getSourceImage() as HTMLImageElement;
    
    const layer = (key: string, polygons: readonly WallPolygon[]) => {
      const wall = document.createElement("canvas"); wall.width = 1536; wall.height = 1024;
      const ctx = wall.getContext("2d")!;
      for (const points of polygons) {
        ctx.save(); ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)); ctx.closePath(); ctx.clip(); ctx.drawImage(source, 0, 0, 1536, 1024); ctx.restore();
      }
      this.textures.addCanvas(key, wall);
      return this.add.image(0, 0, key).setOrigin(0).setDepth(3);
    };
    this.leftWall = layer("left-wall", INTERIOR_WALLS.left);
    this.rightWall = layer("right-wall", INTERIOR_WALLS.right);
    layer("front-walls", INTERIOR_WALLS.front);
    this.doorwayHeaders = DOORWAY_HEADERS.map((door, i) =>
      layer(`doorway-header-${i}`, [door.silhouette]).setDepth(4).setVisible(false));
    this.fit();
    this.scale.on("resize", this.fit, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.fit, this));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y }; this.dragged = false;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.placing && !this.furnitureLocked) {
        this.previewAt(this.cameras.main.getWorldPoint(p.x, p.y));
      }
      if (!p.isDown || !this.down) return;
      if (Math.hypot(p.x - this.down.x, p.y - this.down.y) > 6) this.dragged = true;

    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.exitComplete && !this.furnitureLocked && this.down && !this.dragged && this.actor) {
        const target = this.cameras.main.getWorldPoint(p.x, p.y);
        if (this.placing) { this.previewAt(target); this.down = undefined; return; }
        const item = [...this.furniture].sort((a,b) => b.y-a.y).find(item => this.hitFurniture(item, target));
        if (item) { this.path = []; this.onSelect(item.key); this.down = undefined; return; }
        const route = interiorPath(this.actor, target, furnitureObstacles(this.furniture));
        if (route.length) { this.path = route; this.marker?.setPosition(target.x, target.y).setVisible(true); }
      }
      this.down = undefined;
    });
    this.input.on("gameout", () => { this.down = undefined; });
    // Scene plugins (including events) exist only after Phaser boots the scene.
    // Notify React here, once assets, rendering and input are ready.
    this.drawFurniture();
    this.onReady();
  }
  setFurniture(items: readonly FurniturePlacement[]) {
    if (JSON.stringify(items) === JSON.stringify(this.furniture)) return;
    this.furniture = items;
    if (this.actor) {
      const destination = this.path.at(-1);
      if (destination) this.path = interiorPath(this.actor, destination, furnitureObstacles(items));
      this.drawFurniture();
      const point = this.preview?.item;
      this.preview = null;
      if (point) this.previewAt(point);
    }
  }
  lockFurniture(locked: boolean) { this.furnitureLocked = locked; if (locked) this.path = []; }
  beginPlacement(key: FurnitureKey) {
    this.validationId++; this.pendingValidation = undefined;
    this.placementOrientation = this.furniture.find(item => item.key === key)?.orientation ?? "original";
    this.placing = key; this.path = []; this.preview = null; this.onPreview(null);
    this.drawFurniture();
    this.ghost?.destroy(); this.footprint?.destroy();
    const item = furnitureDefinition(key);
    this.footprint = this.add.image(0, 0, `furniture-halo-${key}`)
      .setOrigin(.5, (item.height * .78 + 6) / (item.height + 12))
      .setFlipX(this.placementOrientation === "mirrored").setTint(0x80a743).setAlpha(.65).setDepth(2.4).setVisible(false);
    this.ghost = this.add.image(0, 0, `furniture-${key}`).setOrigin(.5, .78).setDisplaySize(item.width, item.height).setFlipX(this.placementOrientation === "mirrored").setAlpha(.65).setDepth(2.5).setVisible(false);
  }
  rotatePlacement() {
    if (!this.placing || this.furnitureLocked || !canRotateFurniture(this.placing)) return;
    this.placementOrientation = this.placementOrientation === "original" ? "mirrored" : "original";
    this.ghost?.setFlipX(this.placementOrientation === "mirrored");
    this.footprint?.setFlipX(this.placementOrientation === "mirrored");
    const point = this.preview?.item;
    this.preview = null;
    this.validationId++; this.pendingValidation = undefined; this.onPreview(null);
    if (point) this.previewAt(point);
  }
  cancelPlacement() {
    this.validationId++; this.pendingValidation = undefined;
    this.placing = null; this.preview = null; this.ghost?.destroy(); this.ghost = undefined;
    this.footprint?.destroy(); this.footprint = undefined; this.onPreview(null); this.drawFurniture();
  }
  private previewAt(point: InteriorPoint) {
    if (!this.placing) return;
    const item = { key: this.placing, x: point.x, y: point.y, orientation: this.placementOrientation };
    if (this.preview?.item.x === item.x && this.preview.item.y === item.y) return;
    this.preview = { item, error: "Checking placement…" };
    this.ghost?.setPosition(item.x, item.y).setVisible(true);
    this.footprint?.setPosition(item.x, item.y).setVisible(true);
    // Disable confirmation until this exact position passes validation, without
    // putting path searches or React renders in the pointer's rendering loop.
    this.onPreview(null);
    this.pendingValidation = { id: ++this.validationId,
      items: [...this.furniture.filter(i => i.key !== item.key), item],
      farmer: { x: this.actor!.x, y: this.actor!.y } };
    this.validatePending();
  }
  private validatePending() {
    if (this.validationBusy || !this.pendingValidation || !this.validationWorker) return;
    this.validationBusy = true;
    this.validationWorker.postMessage(this.pendingValidation);
    this.pendingValidation = undefined;
  }
  private hitFurniture(item: FurniturePlacement, point: InteriorPoint) {
    const definition = furnitureDefinition(item.key);
    const x = Math.floor(point.x - item.x + definition.width / 2), y = Math.floor(point.y - item.y + definition.height * .78);
    if (x < 0 || y < 0 || x >= definition.width || y >= definition.height) return false;
    const canvas = this.textures.get(`placed-${item.key}`).getSourceImage() as HTMLCanvasElement;
    return (canvas.getContext("2d")?.getImageData(x,y,1,1).data[3] ?? 0) > 80;
  }
  private drawFurniture() {
    this.furnitureImages.forEach(image => image.destroy()); this.furnitureImages = [];
    for (const item of this.furniture) {
      if (item.key === this.placing) continue;
      const definition = furnitureDefinition(item.key);
      // Clip each item against its own room walls, independently of the farmer's room.
      const canvas = document.createElement("canvas"); canvas.width = definition.width; canvas.height = definition.height;
      const ctx = canvas.getContext("2d")!;
      ctx.save();
      if (item.orientation === "mirrored") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(this.textures.get(`furniture-${item.key}`).getSourceImage() as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.globalCompositeOperation = "destination-out";
      const walls = [...INTERIOR_WALLS.front, ...(behindLeftInteriorWall(item) ? INTERIOR_WALLS.left : []), ...(behindRightInteriorWall(item) ? INTERIOR_WALLS.right : [])];
      for (const points of walls) {
        ctx.beginPath(); points.forEach(([x,y], i) => { const px = x - item.x + canvas.width / 2, py = y - item.y + canvas.height * .78; if (i) ctx.lineTo(px,py); else ctx.moveTo(px,py); }); ctx.closePath(); ctx.fill();
      }
      const key = `placed-${item.key}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
      this.furnitureImages.push(this.add.image(item.x, item.y, key).setOrigin(.5,.78).setDepth(1 + item.y / 2000));
    }
  }
  /** Finish the local walk before React removes the interior. */
  leave(onComplete: () => void) {
    if (this.exitComplete) return;
    if (!this.actor) { onComplete(); return; }
    const route = interiorPath(this.actor, INTERIOR_ENTRY, furnitureObstacles(this.furniture));
    // Keep Back usable if artwork/navigation changes ever leave an actor stranded.
    if (!route.length) { onComplete(); return; }
    this.exitComplete = onComplete;
    this.path = route;
    this.marker?.setVisible(false);
  }
  fit() { this.zoomFactor = 1; this.applyZoom(); }
  zoomBy(factor: number) { this.zoomFactor = Phaser.Math.Clamp(this.zoomFactor * factor, 1, 2.5); this.applyZoom(); }
  private applyZoom() {
    // Frame the house with a small margin; decorative ground corners may crop.
    this.cameras.main.setZoom(Math.min(this.scale.width / 1552, this.scale.height / 1040) * this.zoomFactor).centerOn(768, 512);
  }
  update(_time: number, delta: number) {
    if (!this.actor) return;
    let remaining = Math.min(delta, 50) * .255; // 255 artwork pixels/s: 50% faster than the original 170.
    while (this.path.length && remaining > 0) {
      const next = this.path[0]!, length = distance(this.actor, next);
      if (length < .01) { this.path = this.path.slice(1); continue; }
      const step = Math.min(length, remaining), dx = next.x - this.actor.x;
      if (Math.abs(dx) > .2) this.actor.setFlipX(dx < 0);
      this.actor.setPosition(this.actor.x + dx / length * step, this.actor.y + (next.y - this.actor.y) / length * step);
      this.travelled += step * .5; remaining -= step;
      if (step >= length) this.path = this.path.slice(1);
    }
    this.actor.setDepth(1 + this.actor.y / 2000 + .001);
    this.leftWall?.setDepth(behindLeftInteriorWall(this.actor) ? 3 : .5);
    this.rightWall?.setDepth(behindRightInteriorWall(this.actor) ? 3 : .5);
    this.actor.setTexture(this.path.length && !this.reducedMotion ? farmerWalkTexture(this.travelled) : "farmer-idle");
    this.doorwayHeaders.forEach((header, i) => header.setVisible(insideDoorway(this.actor!, DOORWAY_HEADERS[i]!)));
    this.shadow?.setPosition(this.actor.x, this.actor.y);
    if (!this.path.length) {
      this.marker?.setVisible(false);
      const complete = this.exitComplete;
      this.exitComplete = null;
      complete?.();
    }
  }
}
