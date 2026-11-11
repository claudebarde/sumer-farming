import type { InteriorSleepPhase } from "./interiorSleep";
import sittingDogArtwork from "../../../assets/sprite_assets/pngs/v2/isometric-test/dog-idle-sitting.png";
import sleepingArtwork from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/farmer-sleeping.png";
import { sleepingFarmerTexture } from "./sleepingFarmer";
import { drawCookingSteam } from "../phaser/cookingSteam";
import type { Cooking } from "../../../game-data/kitchen";
import { indoorCookingPose } from "../../../game-core/home/indoorCooking";
import { furnitureAtPointer, furniturePosition, furnitureDepth, replaceFurniture } from "../../../game-core/home/furnitureSurfaces";
import { HOME_TABLETS, prepareWallTabletTexture, type HomeTabletKey } from "../phaser/homeTablets";
import { HOME_FURNITURE, canRotateFurniture, furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../../game-data/homeFurniture";
import { furnitureObstacles } from "../../../game-core/home/furniture";
import { FURNITURE_ARTWORK } from "./furnitureArtwork";
import { prepareFurnitureTexture, placedFurnitureTexture } from "./furnitureTexture";
import { kitchenActorDepth } from "./kitchenActorDepth";
export type FurniturePreview = { readonly item: FurniturePlacement; readonly error: string | null; readonly fixed: boolean };
import Phaser from "phaser";
import ground from "../../../assets/sprite_assets/pngs/v2/isometric-test/ground-non-arable.png";
import bush from "../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-01.png";
import { drawInteriorGround } from "./interiorGround";
import artwork from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-interior/courtyard-empty.png";
import { FARM_SPRITES } from "../../../assets/farmSprites";
import { FARMER_SHARPEN_AMOUNT, prepareFarmerTexture } from "../phaser/farmerTexture";
import { FARMER_WALK_SOURCES, FARMER_WALK_BOUNDS, farmerWalkTexture } from "../phaser/farmerWalk";
import { INTERIOR_ENTRY, interiorPath, distance, insideObstacle, type InteriorPoint } from "./interiorNavigation";

import { COOKING_FRAMES, COOKING_BOUNDS, cookingFrame } from "../phaser/cookingAnimation";
import { actorOccludingWalls } from "./interiorWalls";
import { interiorAudioStore } from "../../stores/interiorAudioStore";

export class HomeInteriorScene extends Phaser.Scene {
  private sleepPhase: InteriorSleepPhase = "awake";
  private readonly onWakeRequest: (point: InteriorPoint) => void;
  private sleepingDog?: Phaser.GameObjects.Image;
  private sleepingFarmer?: Phaser.GameObjects.Image;
  private sleepLetters: Phaser.GameObjects.Text[] = [];
  private sleepElapsed = 0;
  private sleepHead = { x: 0, y: 0 };
  private cookingJob: Cooking | null = null;
  private cookingVisual: { kitchen: FurniturePlacement; elapsed: number } | null = null;
  private cookingFire?: Phaser.GameObjects.Graphics;
  private cookingSteam?: Phaser.GameObjects.Graphics;
  private furniture: readonly FurniturePlacement[] = [];
  private wallTablet: HomeTabletKey = "none";
  private wallTabletImage?: Phaser.GameObjects.Image;
  private furnitureImages: Phaser.GameObjects.Image[] = [];
  private placing: FurnitureKey | null = null;
  private placementOrientation: "original" | "mirrored" = "original";
  private ghost?: Phaser.GameObjects.Image;
  private carriedPreviews: { item: FurniturePlacement; image: Phaser.GameObjects.Image }[] = [];
  private footprint?: Phaser.GameObjects.Image;
  private preview: FurniturePreview | null = null;
  private placementFixed = false;
  private clickedValidation: number | null = null;
  private furnitureLocked = false;
  private validationWorker?: Worker;
  private validationBusy = false;
  private validationId = 0;
  private pendingValidation?: { id: number; items: FurniturePlacement[]; farmer: InteriorPoint };
  private actor?: Phaser.GameObjects.Image;
  private actorCanvas?: HTMLCanvasElement;
  private actorTexture?: Phaser.Textures.CanvasTexture;
  private actorFrameState = "";
  private shadow?: Phaser.GameObjects.Image;
  private shadowCanvas?: HTMLCanvasElement;
  private shadowTexture?: Phaser.Textures.CanvasTexture;
  private shadowPosition = "";
  private facingLeft = false;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  constructor(onReady: () => void, onPreview: (preview: FurniturePreview | null) => void, onSelect: (key: FurnitureKey) => void, onWakeRequest: (point: InteriorPoint) => void) {
    super("home-interior");
    this.onWakeRequest = onWakeRequest;
    this.onReady = onReady; this.onPreview = onPreview; this.onSelect = onSelect;
  }
  preload() {
    this.load.image("sleeping-farmer-source", sleepingArtwork);
    this.load.image("sleeping-dog-source", sittingDogArtwork);
    COOKING_FRAMES.forEach((url, i) => this.load.image(`cooking-source-${i}`, url));
    HOME_TABLETS.forEach(tablet => this.load.image(`interior-tablet-source-${tablet.key}`, tablet.source));
    HOME_FURNITURE.forEach(item => this.load.image(`furniture-source-${item.key}`, FURNITURE_ARTWORK[item.key]));
    this.load.image("house", artwork);
    this.load.image("interior-ground", ground);
    this.load.image("interior-bush", bush);
    this.load.image("idle-source", FARM_SPRITES.farmerIdle0);
    FARMER_WALK_SOURCES.forEach((url, i) => this.load.image(`walk-source-${i}`, url));
  }
  create() {
    COOKING_FRAMES.forEach((_, i) => this.textures.addCanvas(`farmer-cooking-${i}`, prepareFarmerTexture(
      this.textures.get(`cooking-source-${i}`).getSourceImage() as HTMLImageElement, FARMER_SHARPEN_AMOUNT, COOKING_BOUNDS, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR));
    this.cookingFire = this.add.graphics();
    this.cookingSteam = this.add.graphics();
    HOME_TABLETS.forEach(tablet => this.textures.addCanvas(`interior-tablet-${tablet.key}`,
      prepareWallTabletTexture(this.textures.get(`interior-tablet-source-${tablet.key}`).getSourceImage() as HTMLImageElement))?.setFilter(Phaser.Textures.FilterMode.LINEAR));
    HOME_FURNITURE.forEach(item => {
      const original = this.textures.get(`furniture-source-${item.key}`).getSourceImage() as HTMLImageElement;
      const canvas = prepareFurnitureTexture(original, item.key);
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
        if (this.clickedValidation === event.data.id) {
          this.placementFixed = !event.data.error;
          this.clickedValidation = null;
        }
        this.preview = { item: this.preview.item, error: event.data.error, fixed: this.placementFixed };
        this.footprint?.setTint(event.data.error ? 0xb75038 : this.placementFixed ? 0xd9ad4d : 0x80a743);
        this.onPreview(this.preview);
      }
      this.validatePending();
    };
    this.events.once("shutdown", () => {
      this.validationWorker?.terminate(); this.validationWorker = undefined;
      interiorAudioStore.setState({ walking: false });
    });
    drawInteriorGround(this);
    this.add.image(0, 0, "house").setOrigin(0);
    this.textures.addCanvas("farmer-idle", prepareFarmerTexture(this.textures.get("idle-source").getSourceImage() as HTMLImageElement, FARMER_SHARPEN_AMOUNT, undefined, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    FARMER_WALK_SOURCES.forEach((_, i) => this.textures.addCanvas(`farmer-walk-v2-${i}`, prepareFarmerTexture(this.textures.get(`walk-source-${i}`).getSourceImage() as HTMLImageElement, FARMER_SHARPEN_AMOUNT, FARMER_WALK_BOUNDS, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR));
    this.marker = this.add.ellipse(0, 0, 25, 12).setStrokeStyle(2, 0xd9ad4d).setDepth(1).setVisible(false);
    this.actor = this.add.image(INTERIOR_ENTRY.x, INTERIOR_ENTRY.y, "farmer-idle").setOrigin(.5, 120 / 128).setDisplaySize(125, 125).setDepth(2);
    // Furniture is clipped against its own walls. Clip the actor independently too:
    // repainting whole walls above the actor also painted over unrelated furniture.
    this.actorCanvas = document.createElement("canvas");
    this.actorCanvas.width = this.actorCanvas.height = 256;
    this.actorTexture = this.textures.addCanvas("farmer-clipped", this.actorCanvas) ?? undefined;
    this.actorTexture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.shadowCanvas = document.createElement("canvas");
    this.shadowCanvas.width = 64; this.shadowCanvas.height = 32;
    this.shadowTexture = this.textures.addCanvas("farmer-shadow-clipped", this.shadowCanvas) ?? undefined;
    this.shadowTexture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.shadow = this.add.image(INTERIOR_ENTRY.x, INTERIOR_ENTRY.y, "farmer-shadow-clipped").setDepth(1);
    this.drawShadow();
    // Outer face of the entrance's right-hand wall; artwork already has this perspective.
    this.wallTabletImage = this.add.image(880, 900, "interior-tablet-home-tablet-sky")
      .setDisplaySize(80, 80).setDepth(3.1).setVisible(false);
    this.setWallTablet(this.wallTablet);
    this.fit();
    this.scale.on("resize", this.fit, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.fit, this));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y }; this.dragged = false;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.placing && !this.furnitureLocked && !this.placementFixed && this.clickedValidation === null) {
        this.previewAt(this.cameras.main.getWorldPoint(p.x, p.y));
      }
      if (!p.isDown || !this.down) return;
      if (Math.hypot(p.x - this.down.x, p.y - this.down.y) > 6) this.dragged = true;

    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.cookingJob && !this.exitComplete && !this.furnitureLocked && this.down && !this.dragged && this.actor) {
        const target = this.cameras.main.getWorldPoint(p.x, p.y);
        if (this.placing) {
          this.previewAt(target);
          if (this.preview?.error === null) {
            this.placementFixed = true;
            this.footprint?.setTint(0xd9ad4d);
            this.preview = { ...this.preview, fixed: true }; this.onPreview(this.preview);
          } else if (this.preview?.error === "Checking placement…") {
            // Freeze the clicked point until its exact worker validation returns.
            this.clickedValidation = this.validationId;
          }
          this.down = undefined; return;
        }
        const item = [...this.furniture].sort((a,b) => furnitureDepth(b, this.furniture)-furnitureDepth(a, this.furniture)).find(item => this.hitFurniture(item, target));
        if (item && this.sleepPhase === "awake") { this.path = []; this.onSelect(item.key); this.down = undefined; return; }
        if (this.sleepPhase !== "awake") {
          if (interiorPath(this.actor, target, this.walkingObstacles()).length) this.onWakeRequest(target);
          this.down = undefined; return;
        }
        const route = interiorPath(this.actor, target, this.walkingObstacles());
        if (route.length) { this.path = route; this.marker?.setPosition(target.x, target.y).setVisible(true); }
      }
      this.down = undefined;
    });
    this.input.on("gameout", () => { this.down = undefined; });
    // Scene plugins (including events) exist only after Phaser boots the scene.
    // Notify React here, once assets, rendering and input are ready.
    this.drawFurniture();
    this.onReady();
    if (this.sleepPhase !== "awake") this.renderSleepingFarmer();
  }
  setSleepPhase(phase: InteriorSleepPhase) {
    if (this.sleepPhase === phase) return;
    this.sleepPhase = phase;
    this.renderSleepingFarmer();
  }
  walkTo(point: InteriorPoint) {
    if (!this.actor || this.sleepPhase !== "awake") return;
    this.path = interiorPath(this.actor, point, this.walkingObstacles());
  }
  /** Presentation only: sleep starts/ends exclusively through server state. */
  private renderSleepingFarmer() {
    this.sleepingFarmer?.destroy(); this.sleepingFarmer = undefined;
    this.sleepingDog?.destroy(); this.sleepingDog = undefined;
    this.sleepLetters.forEach(letter => letter.destroy()); this.sleepLetters = [];
    this.actor?.setVisible(true); this.shadow?.setVisible(true);
    if (this.sleepPhase === "awake" || !this.actor) return;
    this.path = []; this.marker?.setVisible(false);
    interiorAudioStore.setState({ walking: false });
    this.actor.setVisible(false); this.shadow?.setVisible(false);
    if (this.sleepPhase !== "sleeping") return;
    const mat = this.furniture.find(item => item.key === "reed-mat");
    if (!mat) return;
    this.cancelPlacement(); this.path = []; this.marker?.setVisible(false);
    interiorAudioStore.setState({ walking: false });
    const key = "sleeping-farmer";
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, sleepingFarmerTexture(this.textures.get("sleeping-farmer-source").getSourceImage() as HTMLImageElement, mat))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.sleepingFarmer = this.add.image(mat.x, mat.y - 30, key).setDisplaySize(140, 100).setDepth(furnitureDepth(mat, this.furniture) + .001);
    // Guard the entrance, facing outward. Clip against the same walls as the actor.
    const dogKey = "sleeping-dog-clipped";
    if (this.textures.exists(dogKey)) this.textures.remove(dogKey);
    // Supersample first, then average down near the on-screen size. Strong
    // sharpening and GPU-only minification made the dark outline look jagged.
    const dogSource = prepareFarmerTexture(this.textures.get("sleeping-dog-source").getSourceImage() as HTMLImageElement, .05, undefined, 512);
    const dogResolution = 160;
    const dogCanvas = document.createElement("canvas"); dogCanvas.width = dogCanvas.height = dogResolution;
    const ctx = dogCanvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.save(); ctx.translate(dogResolution, 0); ctx.scale(-1, 1);
    ctx.drawImage(dogSource, 0, 0, dogResolution, dogResolution); ctx.restore();
    ctx.globalCompositeOperation = "destination-out";
    for (const polygon of actorOccludingWalls(INTERIOR_ENTRY)) {
      ctx.beginPath(); polygon.forEach(([x, y], i) => {
        const px = (x - INTERIOR_ENTRY.x) * dogResolution / 80 + dogResolution / 2;
        const py = (y - INTERIOR_ENTRY.y) * dogResolution / 80 + dogResolution * 120 / 128;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }); ctx.closePath(); ctx.fill();
    }
    this.textures.addCanvas(dogKey, dogCanvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.sleepingDog = this.add.image(INTERIOR_ENTRY.x, INTERIOR_ENTRY.y, dogKey)
      .setOrigin(.5, 120 / 128).setDisplaySize(80, 80).setDepth(1 + INTERIOR_ENTRY.y / 2000 + .001);
    this.actor.setVisible(false); this.shadow?.setVisible(false);
    this.sleepElapsed = 0;
    this.sleepHead = { x: mat.x + (mat.orientation === "mirrored" ? -37 : 37), y: mat.y - 62 };
    this.sleepLetters = [0, 1, 2].map(() => this.add.text(0, 0, "Z", { fontFamily: "Georgia", fontSize: "18px", fontStyle: "bold", color: "#73502f", stroke: "#fff5df", strokeThickness: 2 }).setOrigin(.5).setDepth(4).setAlpha(0));
  }
  setWallTablet(tablet: HomeTabletKey) {
    this.wallTablet = tablet;
    if (!this.wallTabletImage) return;
    this.wallTabletImage.setVisible(tablet !== "none");
    if (tablet !== "none") this.wallTabletImage.setTexture(`interior-tablet-${tablet}`).setDisplaySize(80, 80);
  }
  setFurniture(items: readonly FurniturePlacement[]) {
    if (JSON.stringify(items) === JSON.stringify(this.furniture)) return;
    this.furniture = items;
    if (this.actor) {
      const destination = this.path.at(-1);
      if (destination) this.path = interiorPath(this.actor, destination, furnitureObstacles(items));
      this.drawFurniture();
      if (this.sleepPhase !== "awake") this.renderSleepingFarmer();
      const point = this.preview ? furniturePosition(this.preview.item, replaceFurniture(this.furniture, this.preview.item)) : undefined;
      this.preview = null;
      if (point) this.previewAt(point);
    }
  }
  lockFurniture(locked: boolean) { this.furnitureLocked = locked; if (locked) this.path = []; }
  beginPlacement(key: FurnitureKey) {
    this.placementFixed = false; this.clickedValidation = null;
    this.validationId++; this.pendingValidation = undefined;
    this.placementOrientation = this.furniture.find(item => item.key === key)?.orientation ?? "original";
    this.placing = key; this.path = []; this.preview = null; this.onPreview(null);
    this.drawFurniture();
    this.ghost?.destroy(); this.footprint?.destroy();
    this.carriedPreviews.forEach(({image}) => image.destroy());
    this.carriedPreviews = key === "wooden-table" ? this.furniture.filter(i => i.surface === "table").map(item => {
      const d = furnitureDefinition(item.key);
      return { item, image: this.add.image(0, 0, `furniture-${item.key}`).setOrigin(.5, .78).setDisplaySize(d.width, d.height).setAlpha(.65).setDepth(2.6).setVisible(false) };
    }) : [];
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
    const point = this.preview ? furniturePosition(this.preview.item, replaceFurniture(this.furniture, this.preview.item)) : undefined;
    this.preview = null;
    this.validationId++; this.pendingValidation = undefined;
    if (point) this.previewAt(point);
  }
  cancelPlacement() {
    this.placementFixed = false; this.clickedValidation = null;
    this.validationId++; this.pendingValidation = undefined;
    this.carriedPreviews.forEach(({image}) => image.destroy()); this.carriedPreviews = [];
    this.placing = null; this.preview = null; this.ghost?.destroy(); this.ghost = undefined;
    this.footprint?.destroy(); this.footprint = undefined; this.onPreview(null); this.drawFurniture();
  }
  private previewAt(point: InteriorPoint) {
    if (!this.placing) return;
    const item = furnitureAtPointer(this.placing, point, this.placementOrientation, this.furniture);
    const layout = replaceFurniture(this.furniture, item);
    const position = furniturePosition(item, layout);
    if (this.preview?.item.x === item.x && this.preview.item.y === item.y && this.preview.item.surface === item.surface && this.preview.item.orientation === item.orientation) return;
    this.preview = { item, error: "Checking placement…", fixed: this.placementFixed };
    this.ghost?.setPosition(position.x, position.y).setVisible(true);
    this.footprint?.setPosition(position.x, position.y).setVisible(true);
    this.carriedPreviews.forEach(({item: child, image}) => {
      const p = furniturePosition(child, layout); image.setPosition(p.x, p.y).setVisible(true);
    });
    // Disable confirmation until this exact position passes validation, without
    // putting path searches or React renders in the pointer's rendering loop.
    this.onPreview(this.placementFixed ? this.preview : null);
    this.pendingValidation = { id: ++this.validationId,
      items: [...layout],
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
    const position = furniturePosition(item, this.furniture);
    const x = Math.floor(point.x - position.x + definition.width / 2), y = Math.floor(point.y - position.y + definition.height * .78);
    if (x < 0 || y < 0 || x >= definition.width || y >= definition.height) return false;
    const canvas = this.textures.get(`placed-${item.key}`).getSourceImage() as HTMLCanvasElement;
    return (canvas.getContext("2d")?.getImageData(x,y,1,1).data[3] ?? 0) > 80;
  }
  private drawFurniture() {
    this.furnitureImages.forEach(image => image.destroy()); this.furnitureImages = [];
    for (const item of this.furniture) {
      if (item.key === this.placing || (this.placing === "wooden-table" && item.surface)) continue;
      const position = furniturePosition(item, this.furniture);
      const canvas = placedFurnitureTexture(this.textures.get(`furniture-${item.key}`).getSourceImage() as HTMLCanvasElement, item, this.furniture);
      const key = `placed-${item.key}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
      this.furnitureImages.push(this.add.image(position.x, position.y, key).setOrigin(.5,.78).setDepth(furnitureDepth(item, this.furniture)));
    }
  }
  private drawShadow() {
    if (!this.actor || !this.shadow || !this.shadowCanvas || !this.shadowTexture) return;
    const { x, y } = this.actor;
    const position = `${x}:${y}`;
    if (position === this.shadowPosition) return;
    this.shadowPosition = position;
    this.shadow.setPosition(x, y);
    const ctx = this.shadowCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 32);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(98,71,40,0.2)";
    ctx.beginPath(); ctx.ellipse(32, 16, 21, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    // The background artwork already contains the walls. Remove shadow pixels
    // over their silhouettes instead of repainting walls over other furniture.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    for (const polygon of actorOccludingWalls({ x, y })) {
      ctx.beginPath();
      polygon.forEach(([px, py], i) => {
        if (i) ctx.lineTo(px - x + 32, py - y + 16);
        else ctx.moveTo(px - x + 32, py - y + 16);
      });
      ctx.closePath(); ctx.fill();
    }
    this.shadowTexture.refresh();
  }
  private drawActor(frame: string) {
    if (!this.actor || !this.actorCanvas || !this.actorTexture) return;
    const { x, y } = this.actor;
    const state = `${frame}:${x}:${y}:${this.facingLeft}`;
    if (state === this.actorFrameState) return;
    this.actorFrameState = state;
    const ctx = this.actorCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    if (this.facingLeft) { ctx.translate(256, 0); ctx.scale(-1, 1); }
    ctx.drawImage(this.textures.get(frame).getSourceImage() as HTMLCanvasElement, 0, 0, 256, 256);
    ctx.restore();
    ctx.globalCompositeOperation = "destination-out";
    const walls = actorOccludingWalls({ x, y });
    for (const polygon of walls) {
      ctx.beginPath();
      polygon.forEach(([px, py], i) => {
        const tx = (px - x) * 256 / 125 + 128;
        const ty = (py - y) * 256 / 125 + 240;
        if (i) ctx.lineTo(tx, ty); else ctx.moveTo(tx, ty);
      });
      ctx.closePath(); ctx.fill();
    }
    this.actorTexture.refresh();
    this.actor.setTexture("farmer-clipped").setFlipX(false).setDisplaySize(125, 125);
  }
  farmerPosition() { return this.actor ? { x: this.actor.x, y: this.actor.y } : INTERIOR_ENTRY; }
  setCookingJob(job: Cooking | null) {
    if (this.cookingJob?.id !== job?.id) {
      this.path = [];
      this.cookingFire?.clear(); this.cookingSteam?.clear();
      this.cookingVisual = null;
    }
    this.cookingJob = job?.interior ? job : null;
  }
  private drawCooking(delta: number) {
    const preview = this.cookingVisual;
    if (!preview || !this.actor || !this.cookingFire || !this.cookingSteam) return;
    preview.elapsed += Math.min(delta, 50);
    const sign = preview.kitchen.orientation === "mirrored" ? -1 : 1;
    const pot = { x: preview.kitchen.x - sign * 58, y: preview.kitchen.y - 78 };
    this.facingLeft = sign < 0;
    this.drawActor(cookingFrame(preview.elapsed, this.reducedMotion));
    const depth = Math.max(this.actor.depth, furnitureDepth(preview.kitchen, this.furniture) + .002);
    this.actor.setDepth(depth);
    this.cookingFire.clear().setDepth(depth - .0005);
    this.cookingSteam.clear().setDepth(depth + .0005);
    for (const side of [-1, 1]) {
      const x = pot.x + side * 17;
      const flicker = this.reducedMotion ? 0 : Math.sin(preview.elapsed / 110 + side) * 3;
      // Anchor both flames at the pot's underside, above the stone supports.
      // Ellipses are centre-positioned: subtract half their height so flicker
      // grows upward without pushing the flame base down onto the stove.
      const baseY = pot.y - 6;
      const outerHeight = (14 + flicker) * 1.4;
      const innerHeight = (8 + flicker) * 1.4;
      this.cookingFire.fillStyle(0xed7a20, .85).fillEllipse(x, baseY - outerHeight / 2, 20, outerHeight);
      this.cookingFire.fillStyle(0xffd468, .95).fillEllipse(x, baseY - innerHeight / 2, 8, innerHeight);
    }
    drawCookingSteam(this.cookingSteam, { x: pot.x, y: pot.y - 37 }, preview.elapsed, this.reducedMotion);
  }

  private walkingObstacles() {
    return furnitureObstacles(this.furniture).filter(obstacle =>
      obstacle.key !== "indoor-kitchen" || !this.actor || !insideObstacle(this.actor, obstacle, 12));
  }
  /** Finish the local walk before React removes the interior. */
  leave(onComplete: () => void) {
    if (this.sleepPhase !== "awake") { onComplete(); return; }
    if (this.cookingJob) { onComplete(); return; }
    if (this.exitComplete) return;
    if (!this.actor) { onComplete(); return; }
    const route = interiorPath(this.actor, INTERIOR_ENTRY, this.walkingObstacles());
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
    if (this.sleepPhase !== "awake") {
      this.sleepElapsed += Math.min(delta, 50);
      this.sleepLetters.forEach((letter, i) => {
        const t = ((this.sleepElapsed + i * 900) % 2700) / 2700;
        letter.setPosition(this.sleepHead.x + (this.reducedMotion ? 0 : t * 12), this.sleepHead.y - (this.reducedMotion ? 14 : t * 55))
          .setAlpha(this.reducedMotion ? (i === 0 ? .8 : 0) : Math.sin(t * Math.PI) * .85);
      });
      return;
    }
    const activeJob = this.cookingJob;
    const pose = activeJob ? indoorCookingPose(activeJob, Date.now()) : null;
    if (pose && activeJob?.interior) {
      this.path = [];
      this.actor.setPosition(pose.x, pose.y);
      this.facingLeft = pose.facingLeft;
      this.travelled = pose.distance * .5;
      this.cookingVisual = !pose.walking && Date.now() < Date.parse(activeJob.completesAt)
        ? { kitchen: activeJob.interior.kitchen, elapsed: Math.max(0, Date.now() - Date.parse(activeJob.startedAt)) } : null;
      if (!this.cookingVisual) { this.cookingFire?.clear(); this.cookingSteam?.clear(); }
    }
    let remaining = Math.min(delta, 50) * .255; // 255 artwork pixels/s: 50% faster than the original 170.
    while (this.path.length && remaining > 0) {
      const next = this.path[0]!, length = distance(this.actor, next);
      if (length < .01) { this.path = this.path.slice(1); continue; }
      const step = Math.min(length, remaining), dx = next.x - this.actor.x;
      if (Math.abs(dx) > .2) this.facingLeft = dx < 0;
      this.actor.setPosition(this.actor.x + dx / length * step, this.actor.y + (next.y - this.actor.y) / length * step);
      this.travelled += step * .5; remaining -= step;
      if (step >= length) this.path = this.path.slice(1);
    }
    const walking = pose?.walking ?? this.path.length > 0;
    this.drawShadow();
    if (interiorAudioStore.getState().walking !== walking) interiorAudioStore.setState({ walking });
    this.actor.setDepth(1 + this.actor.y / 2000 + .001);
    // Use the full sloping front edge, including the stove, in either orientation.
    const kitchen = this.furniture.find(item => item.key === "indoor-kitchen");
    if (kitchen) {
      this.actor.setDepth(kitchenActorDepth(this.actor, kitchen, this.actor.depth, furnitureDepth(kitchen, this.furniture)));
    }
    this.drawActor(walking && !this.reducedMotion ? farmerWalkTexture(this.travelled) : "farmer-idle");
    if (!this.path.length) {
      if (this.cookingVisual) this.drawCooking(delta);
      this.marker?.setVisible(false);
      const complete = this.exitComplete;
      this.exitComplete = null;
      complete?.();
    }
  }
}
