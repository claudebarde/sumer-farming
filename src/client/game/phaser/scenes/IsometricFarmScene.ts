import Phaser from "phaser";
import type { FarmSnapshot } from "../../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../../game-data/movement";
import { FARM_BUILDING_DEFINITIONS } from "../../../../game-data/buildings";
import { FARM_SPRITES } from "../../../../assets/farmSprites";
import { FARM_EVOLUTION_SOURCES, farmAppearance } from "../farmEvolution";
import { LYRE_SOURCES, PROCESSION_COUNT, PROCESSION_DURATION_MS, processionPose } from "../lyreProcession";
import { DOG_SOURCES, initialDog, stepDog, dogTexture, type DogState } from "../isometricDog";
import granaryUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/granary-isometric-test.png";
import { mockGranaryPlacement, granaryPlacement, granaryBuildBlocker } from "../isometricBuildingPlacement";
import marketUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/market-isometric-test.png";
import groundUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/ground-non-arable.png";
import arableGroundUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/ground-arable.png";
import riverWaterUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/river-water-isometric.png";
import { riverRipples } from "../riverRipples";
import roadUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import roadCornerUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-nw-ne.png";
import roadJunctionUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-nw-ne-se.png";
import canalStraightUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import canalCornerUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-nw-ne.png";
import canalJunctionUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-nw-ne-se.png";
import { canalConnectionMask } from "../isometricIrrigation";
import { roadTextures } from "../roadTextures";
import { roadConnectionMask } from "../isometricRoads";
import { ROAD_CONSTRUCTION_DURATION_MS } from "../../../../game-data/roads";
import { FARMER_BUILD_SOURCES, FARMER_BUILD_BOUNDS, farmerBuildTexture } from "../farmerBuild";
import { activeConstruction, isometricConstructionPose } from "../isometricConstruction";
import bush01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-01.png";
import bush02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-02.png";
import rocks01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-01.png";
import rocks02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-02.png";
import sown from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-sown.png";
import growing from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-growing.png";
import ripe from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-ripe.png";
import { isoPoint, isoCell, footprintFront, ISO_WIDTH, ISO_HEIGHT, type IsoCell } from "../isometricProjection";
import { barleyDepth, barleyStage, farmOrigin, GROUND_ITEM_ORIGIN, insideWorld, insidePlot, presentCanals, sameCell } from "../isometricFarm";
import { prepareFarmerTexture } from "../farmerTexture";
import { FARMER_PLANT_SOURCES, farmerPlantBounds, farmerPlantTexture } from "../farmerPlant";
import { cropSprite } from "../cropPresentation";
import { prepareBuildingTexture } from "../buildingTexture";
import { FARMER_WALK_SOURCES, FARMER_WALK_BOUNDS } from "../farmerWalk";
import { FARMER_CARRY_SOURCES, FARMER_CARRY_BOUNDS, farmerTravelTexture } from "../farmerCarry";
import { previewWalkPath, previewWalkable } from "../isometricWalking";
import { isometricPlantingPose } from "../isometricPlanting";
import { isometricHarvestPose } from "../isometricHarvesting";
import { FARMER_HARVEST_SOURCES, FARMER_HARVEST_BOUNDS, farmerHarvestTexture } from "../farmerHarvest";
import { fieldKey, plantableFields, harvestableFields, plantingSelectionLimit } from "../../../../game-core/farm/batchPlanting";
import { harvestFieldLimit } from "../../../../game-core/farm/harvestCapacity";
import { pickupDuration, pickupPose, transferGroundItems, type GroundTransfer } from "../isometricPickup";
import { buildingFacingLeft } from "../buildingFacing";
import { hasFarmerPopup } from "../isometricTilePopup";
import { storageChipBounce, updateStorageChip, type StorageChipState } from "../storageChipBounce";
import { farmerObscured, hiddenFarmerBounce, type OcclusionSprite } from "../farmerOcclusion";
import { canVisitIsometricMarket, isMarketTile, marketOrigin, marketEntrance } from "../isometricMarket";
import { gatheringOffsetY, gatheringPose, materialCarry, materialLabel, transferBlocker } from "../isometricGathering";

export type IsometricTileAnchor = { cell: IsoCell; x: number; y: number; kind?: "farmer" | "tile" | "market" | "farmReturn" | "barleyMarket" | "beerMarket" | "bakingMarket" };

const scenery = { bush01, bush02, rocks01, rocks02 };
const crops = { sown, growing, ripe };
const fallback = { reeds: FARM_SPRITES.reeds, barley: FARM_SPRITES.harvestedBarley, reed: FARM_SPRITES.reedBundle, clay: FARM_SPRITES.brickPile,
  datePalmSapling: FARM_SPRITES.datePalmSapling, datePalmGrowing: FARM_SPRITES.datePalmGrowing, datePalmReady: FARM_SPRITES.datePalmReady,
  mill: FARM_SPRITES.mill, brewery: FARM_SPRITES.brewery, breadOven: FARM_SPRITES.breadOven, warehouse: FARM_SPRITES.warehouse, smallShrine: FARM_SPRITES.smallShrine };

/** Saved-world presentation and selection. Economic commands stay in React/server. */
export class IsometricFarmScene extends Phaser.Scene {
  private snapshot: FarmSnapshot;
  private selected: IsoCell | null = null;
  private mockPlacement: IsoCell | null = null;
  private realPlacement = false;
  private placementLocked = false;
  private placementSelected: (cell: IsoCell) => void = () => {};
  private mockFootprint?: Phaser.GameObjects.Graphics;
  private mockBuilding?: Phaser.GameObjects.Image;
  private selectedFarmer = false;
  private baseZoom = 1;
  private drawnAt = 0;
  private ready = false;
  private riverWaves!: Phaser.GameObjects.Graphics;
  private riverElapsed = 0;
  private reducedMotion: MediaQueryList | undefined;
  private farmerCell: IsoCell = config.farmerSpawn;
  private dogState: DogState | null = null;
  private dog!: Phaser.GameObjects.Image;
  private processionStartedAt: number | null = null;
  private musicians: Phaser.GameObjects.Image[] = [];
  private walkPath: readonly IsoCell[] = [];
  private walkProgress = 0;
  private walkDistance = 0;
  private marketTrip = false;
  private facingLeft = false;
  private facingBuilding: IsoCell | null = null;
  private actor!: Phaser.GameObjects.Image;
  private actorShadow!: Phaser.GameObjects.Ellipse;
  private cargo!: Phaser.GameObjects.Text;
  private cargoBackground!: Phaser.GameObjects.Graphics;
  private plantingSelection: readonly IsoCell[] | null = null;
  private selectionMode: "plant" | "harvest" = "plant";
  private cropImages: { cell: IsoCell; image: Phaser.GameObjects.Image }[] = [];
  private buildingImages: Phaser.GameObjects.Image[] = [];
  private farmerMarker!: Phaser.GameObjects.Graphics;
  private markerAlpha = 0;
  private alphaMasks = new Map<string, ImageData>();
  private storageChipStates = new Map<string, StorageChipState>();
  private storageChips: { state: StorageChipState; x: number; bottom: number; background: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }[] = [];
  private reportedAnchor = "";
  private commandPending = false;
  private pickup: GroundTransfer | null = null;
  private heldMaterial!: Phaser.GameObjects.Image;
  private gatheringApproach: { path: readonly IsoCell[]; startedAt: number } | null = null;
  private constructionApproach: { path: readonly IsoCell[]; startedAt: number; completesAt: number } | null = null;
  private readonly selectPlantingTile: (cell: IsoCell) => void;
  private readonly report: (anchor: IsometricTileAnchor | null) => void;
  private readonly enterMarket: () => void;
  constructor(snapshot: FarmSnapshot, report: (anchor: IsometricTileAnchor | null) => void, selectPlantingTile: (cell: IsoCell) => void = () => {}, enterMarket: () => void = () => {}) {
    super("isometric-farm"); this.snapshot = snapshot; this.report = report; this.selectPlantingTile = selectPlantingTile;
    this.enterMarket = enterMarket;
    this.farmerCell = snapshot.farm.production.lastHarvestDelivery?.target ?? config.farmerSpawn;
  }
  preload() {
    LYRE_SOURCES.forEach(({ key, url }) => this.load.image(`source-${key}`, url));
    for (const [key, url] of Object.entries(FARM_EVOLUTION_SOURCES)) this.load.image(`source-${key}`, url);
    this.load.image("source-granary", granaryUrl);
    for (const [key, url] of Object.entries(DOG_SOURCES)) this.load.image(`source-dog-${key}`, url);
    this.load.image("source-market-preview", marketUrl);
    this.load.image("source-non-arable-ground", groundUrl);
    this.load.image("source-arable-ground", arableGroundUrl);
    this.load.image("source-river-water", riverWaterUrl);
    this.load.image("source-central-road", roadUrl);
    this.load.image("source-road-corner", roadCornerUrl);
    this.load.image("source-road-junction", roadJunctionUrl);
    this.load.image("source-canal-straight", canalStraightUrl);
    this.load.image("source-canal-corner", canalCornerUrl);
    this.load.image("source-canal-junction", canalJunctionUrl);
    this.load.image("source-farmer-idle", FARM_SPRITES.farmerIdle0);
    FARMER_WALK_SOURCES.forEach((url, i) => this.load.image(`source-farmer-walk-${i}`, url));
    FARMER_CARRY_SOURCES.forEach((url, i) => this.load.image(`source-farmer-carry-${i}`, url));
    FARMER_BUILD_SOURCES.forEach((url, i) => this.load.image(`source-farmer-build-${i}`, url));
    FARMER_PLANT_SOURCES.forEach((url, i) => this.load.image(`source-farmer-plant-${i}`, url));
    FARMER_HARVEST_SOURCES.forEach((url, i) => this.load.image(`source-farmer-harvest-${i}`, url));
    for (const [key, url] of Object.entries({ ...scenery, ...crops, ...fallback })) this.load.image(`source-${key}`, url);
  }
  create() {
    LYRE_SOURCES.forEach(({ key }) => {
      this.textures.addCanvas(key, prepareFarmerTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement,
        undefined, { left: 0, top: 0, right: 511, bottom: 511 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    this.events.on("sleep", () => this.stopProcession());
    for (const key of Object.keys(FARM_EVOLUTION_SOURCES)) {
      this.textures.addCanvas(key, prepareBuildingTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(DOG_SOURCES)) {
      this.textures.addCanvas(`dog-${key}`, prepareFarmerTexture(this.textures.get(`source-dog-${key}`).getSourceImage() as HTMLImageElement,
        undefined, { left: 0, top: 0, right: 511, bottom: 511 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    FARMER_BUILD_SOURCES.forEach((_, i) => {
      this.textures.addCanvas(`farmer-build-v2-${i}`, prepareFarmerTexture(this.textures.get(`source-farmer-build-${i}`).getSourceImage() as HTMLImageElement, undefined, FARMER_BUILD_BOUNDS))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    const prepareRoad = (key: string) => prepareBuildingTexture(this.textures.get(key).getSourceImage() as HTMLImageElement);
    this.textures.addCanvas("non-arable-ground", prepareRoad("source-non-arable-ground"))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.addCanvas("arable-ground", prepareRoad("source-arable-ground"))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.addCanvas("river-water", prepareRoad("source-river-water"))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const [mask, texture] of Object.entries(roadTextures(prepareRoad("source-central-road"), prepareRoad("source-road-corner"), prepareRoad("source-road-junction")))) {
      this.textures.addCanvas(`road-${mask}`, texture)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    // The manually selected T source is larger; full-frame preparation normalizes
    // all three to 256×128 before composing matching junctions and end caps.
    for (const [mask, texture] of Object.entries(roadTextures(prepareRoad("source-canal-straight"), prepareRoad("source-canal-corner"), prepareRoad("source-canal-junction")))) {
      this.textures.addCanvas(`canal-${mask}`, texture)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    FARMER_CARRY_SOURCES.forEach((_, i) => {
      this.textures.addCanvas(`farmer-carry-v2-${i}`, prepareFarmerTexture(this.textures.get(`source-farmer-carry-${i}`).getSourceImage() as HTMLImageElement, undefined, FARMER_CARRY_BOUNDS))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    FARMER_HARVEST_SOURCES.forEach((_, i) => {
      const source = this.textures.get(`source-farmer-harvest-${i}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(`farmer-harvest-iso-${i}`, prepareFarmerTexture(source, undefined, FARMER_HARVEST_BOUNDS[i]))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    FARMER_PLANT_SOURCES.forEach((_, i) => {
      const source = this.textures.get(`source-farmer-plant-${i}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(`farmer-plant-v2-${i}`, prepareFarmerTexture(source, undefined, farmerPlantBounds(source.naturalWidth)))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    FARMER_WALK_SOURCES.forEach((_, i) => {
      this.textures.addCanvas(`farmer-walk-v2-${i}`, prepareFarmerTexture(this.textures.get(`source-farmer-walk-${i}`).getSourceImage() as HTMLImageElement, undefined, FARMER_WALK_BOUNDS))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    this.textures.addCanvas("farmer-idle", prepareFarmerTexture(this.textures.get("source-farmer-idle").getSourceImage() as HTMLImageElement))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.addCanvas("granary", prepareBuildingTexture(this.textures.get("source-granary").getSourceImage() as HTMLImageElement))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.addCanvas("market-preview", prepareBuildingTexture(this.textures.get("source-market-preview").getSourceImage() as HTMLImageElement))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const key of Object.keys({ ...scenery, ...crops, ...fallback })) {
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      const isCrop = key in crops;
      const bounds = isCrop ? farmerPlantBounds(512) : key in scenery ? { left: 0, top: 0, right: 511, bottom: 511 } : undefined;
      this.textures.addCanvas(key, prepareFarmerTexture(source, isCrop ? 0.6 : 0.15, bounds))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.ready = true; this.draw(); this.fit();
    // Start at the player's preferred framing: two presses of the 1.2× zoom button.
    // Keep the original fit scale as the zoom-out limit and explicit Fit action.
    this.zoomBy(1.2 ** 2);
    let last: { x: number; y: number } | null = null;
    let dragged = false;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { last = { x: pointer.x, y: pointer.y }; dragged = false; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.mockPlacement && !this.placementLocked && !pointer.isDown) this.moveMockPlacement(pointer.x, pointer.y);
      if (!pointer.isDown || !last) return;
      if (!dragged && pointer.getDistance() < 6) return;
      dragged = true;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - last.x) / camera.zoom;
      camera.scrollY -= (pointer.y - last.y) / camera.zoom;
      last = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      last = null;
      if (dragged) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.mockPlacement) {
        if (!this.placementLocked) {
          this.moveMockPlacement(pointer.x, pointer.y);
          if (this.realPlacement) { this.placementLocked = true; this.placementSelected(this.mockPlacement!); }
        }
        return;
      }
      const cell: IsoCell = objects.find(object => object.getData("tile"))?.getData("tile") ?? isoCell(world.x, world.y);
      if (this.commandPending || this.marketTrip) return;
      if (this.plantingSelection !== null) { this.selectPlantingTile(cell); return; }
      this.selectedFarmer = hasFarmerPopup(this.snapshot) && objects.some(object => object.getData("farmer") === true);
      this.selected = this.selectedFarmer ? this.farmerCell : insideWorld(cell) ? cell : null; this.draw();
      this.publishAnchor();
    });
    this.scale.on("resize", this.fit, this);
    this.events.once("shutdown", () => { this.stopProcession(); this.ready = false; this.scale.off("resize", this.fit, this); });
  }
  beginGranaryPlacement(onSelected: (cell: IsoCell) => void) {
    this.realPlacement = true; this.placementLocked = false; this.placementSelected = onSelected;
    this.setMockGranaryPlacement(true);
  }
  endGranaryPlacement() {
    this.setMockGranaryPlacement(false); this.realPlacement = false; this.placementLocked = false;
    this.placementSelected = () => {};
  }
  setMockGranaryPlacement(enabled: boolean) {
    if (!this.ready) return;
    if (!enabled && !this.mockPlacement) return;
    if (enabled) { this.walkPath = []; this.walkProgress = 0; this.marketTrip = false; }
    this.clearSelection();
    const camera = this.cameras.main;
    const center = camera.getWorldPoint(camera.width / 2, camera.height / 2);
    this.mockPlacement = enabled ? isoCell(center.x, center.y) : null;
    this.drawMockPlacement();
  }
  private moveMockPlacement(x: number, y: number) {
    const point = this.cameras.main.getWorldPoint(x, y);
    this.mockPlacement = isoCell(point.x, point.y);
    this.drawMockPlacement();
  }
  private drawMockPlacement() {
    this.mockFootprint?.destroy(); this.mockBuilding?.destroy();
    this.mockFootprint = undefined; this.mockBuilding = undefined;
    if (!this.mockPlacement) return;
    const preview = (this.realPlacement ? granaryPlacement : mockGranaryPlacement)(this.snapshot, this.mockPlacement, this.farmerCell, Date.now());
    const colour = preview.rule.type === "valid" && (!this.realPlacement || !granaryBuildBlocker(this.snapshot, Date.now())) ? 0x55ce75 : 0xe65c5c;
    this.mockFootprint = this.add.graphics().setDepth(10000);
    for (const cell of preview.footprint) this.diamond(this.mockFootprint, cell, colour, 0.55);
    if (preview.loading) this.diamond(this.mockFootprint, preview.loading, 0xffd45a, 0.75);
    const p = footprintFront(this.mockPlacement, 2, 2);
    this.mockBuilding = this.add.image(p.x, p.y - 12, "granary").setOrigin(0.5, 1)
      .setDisplaySize(240, 240).setDepth(10001).setTint(colour).setAlpha(0.65);
  }
  setSnapshot(snapshot: FarmSnapshot) {
    if (this.snapshot.farm.gathering && !snapshot.farm.gathering) {
      const pose = gatheringPose(this.snapshot, Date.now(), this.gatheringApproach);
      if (pose) { this.farmerCell = pose.position; this.facingLeft = pose.facingLeft; }
      this.gatheringApproach = null;
    }
    const oldBatch = this.snapshot.farm.production.planting;
    if (oldBatch && !snapshot.farm.production.planting) {
      const lastPose = oldBatch.mode === "harvest" ? isometricHarvestPose(this.snapshot, Date.now()) : isometricPlantingPose(oldBatch, Date.now());
      if (lastPose) {
        this.farmerCell = { column: Math.round(lastPose.position.column), row: Math.round(lastPose.position.row) };
        this.facingLeft = lastPose.facingLeft;
      }
      if (snapshot.farm.production.lastHarvestDelivery?.batchId === oldBatch.id) this.farmerCell = snapshot.farm.production.lastHarvestDelivery.target;
    }
    this.snapshot = snapshot;
    if (this.marketTrip && !canVisitIsometricMarket(snapshot, Date.now())) this.marketTrip = false;
    if (snapshot.farm.production.planting || activeConstruction(snapshot, Date.now())) { this.walkPath = []; this.walkProgress = 0; }
    if (this.ready) this.draw();
  }
  setPlantingSelection(cells: readonly IsoCell[] | null, pending = false, mode: "plant" | "harvest" = "plant") {
    this.plantingSelection = cells; this.commandPending = pending; this.selectionMode = mode;
    if (cells !== null || pending) {
      this.facingBuilding = null;
      // Finish at a valid route waypoint before submitting that location.
      if (this.walkProgress >= 0.5 && this.walkPath[0]) this.farmerCell = this.walkPath[0];
      this.walkPath = []; this.walkProgress = 0;
    }
    if (this.ready) this.draw();
  }
  farmerPosition(): IsoCell { return this.farmerCell; }
  presentGatheringApproach(path: readonly IsoCell[]) {
    this.walkPath = []; this.walkProgress = 0; this.clearSelection();
    this.gatheringApproach = { path, startedAt: Date.now() };
  }
  presentConstructionApproach(path: readonly IsoCell[], completesAt: number): number {
    this.walkPath = []; this.walkProgress = 0;
    this.constructionApproach = { path, completesAt, startedAt: Date.now() };
    return (path.length - 1) * WORKER_MOVE_DURATION_PER_TILE;
  }
  presentGroundTransfer(type: "pickup" | "drop", path: readonly IsoCell[], item: FarmSnapshot["groundItems"][number], carried: number): number {
    this.walkPath = []; this.walkProgress = 0;
    this.pickup = { type, path, item, carried, startedAt: Date.now() };
    return pickupDuration(path);
  }
  presentStorageDelivery(path: readonly IsoCell[], before: FarmSnapshot, building: IsoCell): number {
    this.walkPath = []; this.walkProgress = 0;
    this.pickup = { type: "store", path, before, building, carried: before.farm.carriedItem?.quantity ?? 0, startedAt: Date.now() };
    return pickupDuration(path);
  }
  clearSelection() { this.selected = null; this.selectedFarmer = false; this.reportedAnchor = ""; this.report(null); if (this.ready) this.draw(); }
  walkTo(cell: IsoCell) {
    if (this.marketTrip || this.commandPending || this.plantingSelection !== null || transferBlocker(this.snapshot, Date.now()) || this.walkPath.length) return;
    this.facingBuilding = null;
    this.walkPath = previewWalkPath(this.snapshot, this.farmerCell, cell, Date.now()); this.walkProgress = 0;
    this.clearSelection();
  }
  goToMarket(): boolean {
    if (this.marketTrip || this.commandPending || this.plantingSelection !== null || this.walkPath.length || !canVisitIsometricMarket(this.snapshot, Date.now())) return false;
    const path = previewWalkPath(this.snapshot, this.farmerCell, marketEntrance, Date.now());
    if (!path.length && !sameCell(this.farmerCell, marketEntrance)) return false;
    this.facingBuilding = null;
    this.walkPath = path; this.walkProgress = 0; this.marketTrip = true;
    this.clearSelection();
    return true;
  }
  private publishAnchor() {
    if (!this.selected) return;
    const p = this.selectedFarmer ? { x: this.actor.x, y: this.actor.y - 55 } : isoPoint(this.selected), camera = this.cameras.main, origin = camera.getWorldPoint(0, 0);
    const x = Math.round((p.x - origin.x) * camera.zoom), y = Math.round((p.y - origin.y) * camera.zoom);
    const kind = this.selectedFarmer ? "farmer" : isMarketTile(this.selected) ? "market" : "tile";
    const key = `${kind}:${fieldKey(this.selected)}:${x}:${y}`;
    if (key !== this.reportedAnchor) { this.reportedAnchor = key; this.report({ cell: this.selectedFarmer ? this.farmerCell : this.selected, x, y, kind }); }
  }
  private diamond(g: Phaser.GameObjects.Graphics, cell: IsoCell, colour: number, alpha = 1) {
    const p = isoPoint(cell);
    const points = [new Phaser.Math.Vector2(p.x, p.y - 24), new Phaser.Math.Vector2(p.x + 48, p.y), new Phaser.Math.Vector2(p.x, p.y + 24), new Phaser.Math.Vector2(p.x - 48, p.y)];
    g.fillStyle(colour, alpha).fillPoints(points, true).lineStyle(1, 0xffffff, 0.1).strokePoints(points, true);
  }
  private draw() {
    this.children.removeAll(true);
    this.musicians = [];
    this.mockFootprint = undefined; this.mockBuilding = undefined;
    this.cropImages = [];
    this.buildingImages = [];
    this.storageChips = [];
    const now = Date.now(); this.drawnAt = now;
    const snapshot = this.snapshot;
    const canals = presentCanals(snapshot, now);
    const ground = this.add.graphics().setDepth(-1000);
    const details = this.add.graphics().setDepth(-900);
    this.riverWaves = this.add.graphics().setDepth(-940);
    const bounds = config.worldBounds;
    for (let row: number = bounds.minimumRow; row <= bounds.maximumRow; row++) for (let column: number = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
      const cell = { column, row }, point = isoPoint(cell);
      const road = row === config.roadRow || snapshot.farm.roads.some(r => sameCell(r, cell) && (!r.completesAt || r.completesAt <= now));
      const canal = canals.find(c => sameCell(c, cell));
      this.diamond(ground, cell, row === config.riverRow ? 0x46a9b0 : road ? 0xd9ad69 : insidePlot(cell) ? 0x9f6429 : 0xd0b77b);
      if (row === config.riverRow) {
        this.add.image(point.x, point.y, "river-water").setOrigin(0.5)
          .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-975);
      }
      if (row !== config.riverRow && !road && !canal) {
        this.add.image(point.x, point.y, insidePlot(cell) ? "arable-ground" : "non-arable-ground").setOrigin(0.5)
          .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-975);
      }
      if (road) {
        this.add.image(point.x, point.y, `road-${roadConnectionMask(cell, snapshot.farm.roads, now)}`).setOrigin(0.5)
          .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-950);
      }
      const roadWork = snapshot.farm.roads.find(r => sameCell(r, cell) && (r.completesAt ?? 0) > now);
      if (roadWork) {
        this.diamond(details, cell, 0x94724a, 0.8);
        const progress = 1 - ((roadWork.completesAt ?? now) - now) / ROAD_CONSTRUCTION_DURATION_MS;
        this.add.graphics().setDepth(9997)
          .fillStyle(0x513821).fillRoundedRect(point.x - 19, point.y - 21, 38, 7, 3)
          .fillStyle(0xffd471).fillRect(point.x - 17, point.y - 19, 34 * Math.max(0, Math.min(1, progress)), 3);
      }
      if (canal) {
        const complete = Date.parse(canal.completesAt) <= now;
        if (complete) {
          this.add.image(point.x, point.y, `canal-${canalConnectionMask(cell, canals, now)}`).setOrigin(0.5)
            .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-925);
        } else {
          details.lineStyle(13, 0x94724a, 1);
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const next = { column: column + dc!, row: row + dr! };
            if (next.row !== config.riverRow && !canals.some(c => sameCell(c, next))) continue;
            const end = isoPoint({ column: column + dc! / 2, row: row + dr! / 2 });
            details.lineBetween(point.x, point.y, end.x, end.y);
          }
          details.fillStyle(0x94724a).fillCircle(point.x, point.y, 7);
          const duration = Date.parse(canal.completesAt) - Date.parse(canal.startedAt);
          const progress = Math.max(0, Math.min(1, (now - Date.parse(canal.startedAt)) / Math.max(1, duration)));
          this.add.graphics().setDepth(9997)
            .fillStyle(0x513821).fillRoundedRect(point.x - 19, point.y - 21, 38, 7, 3)
            .fillStyle(0xffd471).fillRect(point.x - 17, point.y - 19, 34 * progress, 3);
        }
        if (road) details.lineStyle(9, 0xd9ad69).lineBetween(point.x - 19, point.y - 10, point.x + 19, point.y + 10);
      }
    }
    const batch = snapshot.farm.production.planting;
    if (this.plantingSelection !== null || batch) {
      const selected = new Set((this.plantingSelection ?? []).map(fieldKey));
      const limit = this.selectionMode === "harvest" ? harvestFieldLimit(snapshot.farm.household.happiness) : plantingSelectionLimit(snapshot, now);
      const targets = batch ? [...batch.remaining, ...(batch.phase.type === "sowing" || batch.phase.type === "harvesting" ? [batch.phase.target] : [])] : (this.selectionMode === "harvest" ? harvestableFields : plantableFields)(snapshot, now);
      const overlay = this.add.graphics().setDepth(-850);
      for (const cell of targets) this.diamond(overlay, cell, batch || selected.has(fieldKey(cell)) ? 0x42ad62 : selected.size >= limit ? 0xda4545 : 0xffd84d, 0.6);
    }
    for (const crop of snapshot.crops) {
      const p = isoPoint(crop), stage = barleyStage(crop, now);
      if (stage) {
        const image = this.add.image(p.x - (stage === "ripe" ? 4 : 0), p.y + (stage === "ripe" ? 2 : 0), stage)
          .setOrigin(0.5, 84 / 128).setDisplaySize(stage === "sown" ? 112 : 98, stage === "sown" ? 112 : 98).setDepth(barleyDepth(p.y, stage));
        this.cropImages.push({ cell: crop, image });
      } else {
        const sprite = cropSprite(crop, now);
        if (sprite) this.add.image(p.x, p.y, sprite).setOrigin(0.5, 120 / 128).setDisplaySize(100, 100).setDepth(p.y);
      }
    }
    for (const object of snapshot.objects) {
      const p = isoPoint(object);
      const variant = Math.abs(object.column + object.row) % 2 === 0 ? "01" : "02";
      const key = object.type === "rock" ? `rocks${variant}` : object.type === "bush" ? `bush${variant}` : "reeds";
      this.add.image(p.x, p.y, key).setOrigin(0.5, object.type === "reeds" ? 120 / 128 : 106 / 128).setDisplaySize(72, 72).setDepth(p.y)
        .setData("tile", { column: object.column, row: object.row }).setInteractive({ pixelPerfect: true });
    }
    const front = footprintFront(farmOrigin, 2, 2);
    const appearance = farmAppearance(snapshot.farm.progression?.level);
    this.buildingImages.push(this.add.image(front.x, front.y + 19, appearance.texture).setOrigin(0.5, 1).setDisplaySize(232, 232).setDepth(front.y - 24).setData("tile", farmOrigin).setInteractive({ pixelPerfect: true }));
    // Anchor on the visible roof, not the transparent top of the source frame.
    const storageSnapshot = this.pickup?.type === "store" ? this.pickup.before : snapshot;
    this.drawStorageChip("farm", front.x, front.y + appearance.storageChipY, storageSnapshot.inventory.find(item => item.itemKey === "barley")?.quantity ?? 0);
    for (const building of snapshot.buildings) {
      const size = FARM_BUILDING_DEFINITIONS[building.type].footprint;
      const p = footprintFront(building, size.columns, size.rows);
      const granary = building.type === "granary";
      // Inset the granary's rounded decorative base inside its diamond footprint.
      // Retain uniform scale and allow the towers to rise naturally above it.
      this.buildingImages.push(this.add.image(p.x, p.y + (granary ? -12 : 0), building.type).setOrigin(0.5, granary ? 1 : 120 / 128)
        .setDisplaySize(granary ? 240 : 150, granary ? 240 : 150).setDepth(p.y - 24)
        .setAlpha(Date.parse(building.completesAt) > now ? 0.5 : 1).setData("tile", { column: building.column, row: building.row }).setInteractive({ pixelPerfect: true }));
      if (granary && Date.parse(building.completesAt) <= now) {
        this.drawStorageChip(building.id, p.x, p.y - 145, storageSnapshot.buildings.find(b => b.id === building.id)?.storedBarley ?? building.storedBarley);
      }
      if (granary && Date.parse(building.completesAt) > now) {
        const progress = Math.max(0, Math.min(1, (now - Date.parse(building.startedAt)) / (Date.parse(building.completesAt) - Date.parse(building.startedAt))));
        this.add.graphics().setDepth(9997).fillStyle(0x513821).fillRoundedRect(p.x - 31, p.y - 22, 62, 9, 3)
          .fillStyle(0xffd471).fillRect(p.x - 29, p.y - 20, 58 * progress, 5);
      }
    }
    // Account for the source's transparent bottom margin.
    const marketFront = footprintFront(marketOrigin, 2, 2);
    this.buildingImages.push(this.add.image(marketFront.x, marketFront.y, "market-preview")
      .setOrigin(0.5, 5 / 6).setDisplaySize(232, 232).setDepth(marketFront.y - 24)
      .setData("tile", marketOrigin).setInteractive({ pixelPerfect: true }));
    const groundItems = transferGroundItems(snapshot.groundItems, this.pickup);
    for (const item of groundItems) {
      const p = isoPoint(item);
      const material = item.itemKey === "reed" || item.itemKey === "clay";
      if (item.itemKey in fallback) {
        const sprite = this.add.image(p.x, p.y, item.itemKey)
          .setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
          .setDisplaySize(52, 52).setDepth(p.y + 1);
        // Centre the bundle over its own tile, and map clicks on the grains back
        // to that tile rather than projecting the clicked pixel onto a neighbour.
        sprite.setData("tile", { column: item.column, row: item.row }).setInteractive({ pixelPerfect: true });
      }
      if (item.itemKey !== "barley" && !material) this.add.text(p.x, p.y - 36, `${item.quantity} ${item.itemKey}`, { fontSize: "12px", color: "#352015", backgroundColor: "#fff5df", padding: { x: 5, y: 3 } }).setOrigin(0.5, 1).setDepth(p.y + 2);
    }
    // Presentation position survives snapshot and tile-selection redraws.
    this.dogState ??= initialDog(snapshot, this.farmerCell, now);
    const dogPoint = isoPoint(this.dogState.position);
    this.dog = this.add.image(dogPoint.x, dogPoint.y, dogTexture(this.dogState))
      .setOrigin(0.5, 108 / 128).setDisplaySize(56, 56).setDepth(dogPoint.y + 2).setFlipX(this.dogState.flip);
    this.actorShadow = this.add.ellipse(0, 0, 23, 8, 0x624728, 0.18);
    this.heldMaterial = this.add.image(0, 0, "reed").setDisplaySize(26, 26).setVisible(false);
    this.actor = this.add.image(0, 0, "farmer-idle").setOrigin(0.5, 120 / 128).setDisplaySize(64, 64)
      .setData("farmer", true);
    // Without farmer actions, let clicks reach the tile/building behind his art.
    if (hasFarmerPopup(this.snapshot)) this.actor.setInteractive({ pixelPerfect: true });
    this.cargoBackground = this.add.graphics().setDepth(10000).setVisible(false);
    this.cargo = this.add.text(0, 0, "", { fontFamily: "Georgia, serif", fontSize: "12px", fontStyle: "bold", color: "#513821", resolution: 2 }).setOrigin(0.5, 1).setDepth(10001);
    // Temporary code-drawn arrow; no image asset needed, and it never catches clicks.
    this.farmerMarker = this.add.graphics().setDepth(10002).setVisible(false);
    const arrow = [{ x: -4, y: -20 }, { x: 4, y: -20 }, { x: 4, y: -11 }, { x: 10, y: -11 },
      { x: 0, y: 0 }, { x: -10, y: -11 }, { x: -4, y: -11 }].map(p => new Phaser.Math.Vector2(p.x, p.y));
    this.farmerMarker.fillStyle(0xffd568).fillPoints(arrow, true).lineStyle(2, 0x624728).strokePoints(arrow, true);
    this.renderFarmer();
    this.renderRiverWaves();
    this.renderStorageChips();
    this.renderFarmerMarker(0);
    this.renderProcession();
    if (this.selected && !this.selectedFarmer) {
      this.diamond(this.add.graphics().setDepth(-800), this.selected, 0xffdc57, 0.6);
    }
  }
  /** Visual preview only: never sends commands or changes the farmer's job. */
  previewProcession() {
    if (!this.ready) return;
    this.stopProcession();
    this.processionStartedAt = Date.now();
    this.renderProcession();
  }
  private stopProcession() {
    this.processionStartedAt = null;
    this.musicians.forEach(sprite => sprite.destroy());
    this.musicians = [];
  }
  private renderProcession() {
    if (this.processionStartedAt === null) return;
    const elapsed = Date.now() - this.processionStartedAt;
    if (elapsed >= PROCESSION_DURATION_MS) { this.stopProcession(); return; }
    if (!this.musicians.length) this.musicians = Array.from({ length: PROCESSION_COUNT }, (_, index) =>
      this.add.image(0, 0, processionPose(elapsed, index).texture).setOrigin(0.5, 108 / 128).setDisplaySize(72, 72));
    // The road procession must not switch behind/in front at building corners.
    const foregroundDepth = Math.max(0, ...this.buildingImages.map(building => building.depth)) + 1;
    this.musicians.forEach((sprite, index) => {
      const pose = processionPose(elapsed, index), point = isoPoint(pose.cell);
      sprite.setTexture(pose.texture).setDisplaySize(72, 72).setPosition(point.x, point.y)
        .setDepth(Math.max(point.y + 2, foregroundDepth)).setVisible(pose.visible);
    });
  }
  private renderFarmer() {
    this.heldMaterial.setVisible(false);
    if (this.pickup) {
      const pose = pickupPose(this.pickup.path, this.pickup.startedAt, Date.now(), this.pickup.type === "store" ? this.pickup.building : undefined);
      if (this.pickup.type === "store" && !pose.walking) {
        this.facingBuilding = this.pickup.building;
        this.facingLeft = buildingFacingLeft(pose.position, this.facingBuilding, this.facingLeft);
      }
      if (pose.done) {
        this.farmerCell = this.pickup.path.at(-1)!;
        this.facingLeft = pose.facingLeft;
        this.pickup = null;
        this.draw();
        return;
      }
      const point = isoPoint(pose.position);
      const key = this.pickup.type === "store" ? this.pickup.before.farm.carriedItem?.itemKey ?? "barley" : this.pickup.item.itemKey;
      this.actor.setPosition(point.x, point.y + pose.dip).setDepth(point.y + 2)
        .setTexture(farmerTravelTexture(pose.distance, key === "barley" ? this.pickup.carried : 0, pose.walking)).setDisplaySize(64, 64 - pose.dip)
        .setFlipX(this.facingBuilding && !pose.walking ? this.facingLeft : pose.facingLeft);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      if (key === "reed" || key === "clay") this.renderHeldMaterial(key, this.pickup.carried);
      this.renderCargo(point.x, point.y - 62, this.pickup.carried, key);
      return;
    }
    const now = Date.now();
    const gathering = gatheringPose(this.snapshot, now, this.gatheringApproach);
    if (gathering) {
      const point = isoPoint(gathering.position);
      const y = point.y + gatheringOffsetY(gathering.itemKey, gathering.walking);
      this.farmerCell = gathering.position;
      this.walkPath = []; this.walkProgress = 0;
      this.actor.setPosition(point.x, y).setDepth(y + 1).setFlipX(gathering.facingLeft)
        .setTexture(gathering.walking ? farmerTravelTexture(gathering.distance, 0, true)
          : gathering.itemKey === "reed" ? farmerHarvestTexture(gathering.elapsed) : farmerBuildTexture(gathering.elapsed)).setDisplaySize(64, 64);
      this.actorShadow.setPosition(point.x, y).setDepth(y);
      this.renderCargo(point.x, point.y - 62, 0);
      return;
    }
    if (this.constructionApproach) {
      const approach = this.constructionApproach;
      const pose = pickupPose(approach.path, approach.startedAt, now);
      if (pose.walking) {
        const point = isoPoint(pose.position);
        this.actor.setPosition(point.x, point.y).setDepth(point.y + 1).setFlipX(pose.facingLeft)
          .setTexture(farmerTravelTexture(pose.distance, 0, true)).setDisplaySize(64, 64);
        this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
        this.renderCargo(point.x, point.y - 62, 0);
        return;
      }
      this.farmerCell = approach.path.at(-1)!;
      this.facingLeft = pose.facingLeft;
      if (now >= approach.completesAt) this.constructionApproach = null;
    }
    const construction = isometricConstructionPose(this.snapshot, now, this.constructionApproach?.path.at(-1));
    if (construction) {
      const point = isoPoint(construction.position);
      this.farmerCell = construction.position;
      this.walkPath = []; this.walkProgress = 0;
      this.actor.setPosition(point.x + construction.offsetX, point.y + construction.offsetY).setDepth(point.y + construction.offsetY + 1)
        .setFlipX(construction.facingLeft).setTexture(farmerBuildTexture(construction.elapsed)).setDisplaySize(64, 64);
      this.actorShadow.setPosition(this.actor.x, this.actor.y).setDepth(this.actor.depth - 1);
      this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
      return;
    }
    const batch = this.snapshot.farm.production.planting;
    const harvest = isometricHarvestPose(this.snapshot, Date.now());
    const work = harvest ?? (batch ? isometricPlantingPose(batch, Date.now()) : null);
    for (const { cell, image } of this.cropImages) image.setVisible(!harvest?.harvested.some(p => sameCell(p, cell)));
    if (work) {
      const point = isoPoint(work.position);
      this.actor.setPosition(point.x, point.y).setDepth(point.y + 1).setFlipX(work.type === "sowing" ? false : work.facingLeft)
        .setTexture(work.type === "harvesting" ? farmerHarvestTexture(work.elapsed) : work.type === "sowing" ? farmerPlantTexture(work.elapsed) : farmerTravelTexture(work.distance, work.seeds, work.type === "walking")).setDisplaySize(64, 64);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      this.renderCargo(point.x, point.y - 62, work.seeds);
      return;
    }
    this.cargo.setVisible(false);
    this.cargoBackground.setVisible(false);
    const start = isoPoint(this.farmerCell), end = isoPoint(this.walkPath[0] ?? this.farmerCell);
    const x = start.x + (end.x - start.x) * this.walkProgress;
    const y = start.y + (end.y - start.y) * this.walkProgress;
    const carry = this.snapshot.farm.carriedItem;
    if (this.facingBuilding && !this.walkPath.length) this.facingLeft = buildingFacingLeft(this.farmerCell, this.facingBuilding, this.facingLeft);
    this.actor.setPosition(x, y).setDepth(y + 1)
      .setTexture(farmerTravelTexture(this.walkDistance, carry?.itemKey === "barley" ? carry.quantity : 0, this.walkPath.length > 0)).setDisplaySize(64, 64)
      .setFlipX(this.facingLeft);
    this.actorShadow.setPosition(x, y).setDepth(y);
    const material = materialCarry(this.snapshot);
    if (material) this.renderHeldMaterial(material.itemKey, material.quantity);
    this.renderCargo(x, y - 62, carry?.quantity ?? 0, carry?.itemKey ?? "barley");
  }
  private renderHeldMaterial(key: string, quantity: number) {
    this.heldMaterial.setTexture(key).setPosition(this.actor.x + (this.actor.flipX ? -10 : 10), this.actor.y - 28)
      .setDepth(this.actor.depth + 0.1).setDisplaySize(26, 26).setVisible(quantity > 0);
  }
  private renderCargo(x: number, bottom: number, quantity: number, key = "barley") {
    const label = `${quantity} ${materialLabel(key)}`;
    if (this.cargo.text !== label) {
      this.cargo.setText(label);
      this.drawChipBackground(this.cargoBackground, this.cargo);
    }
    this.cargo.setPosition(x, bottom - 5).setVisible(quantity > 0);
    this.cargoBackground.setPosition(x, bottom).setVisible(quantity > 0);
  }
  private drawChipBackground(background: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text) {
    const width = text.width + 18, height = text.height + 10;
    background.clear()
      .fillStyle(0x624728, 0.16).fillRoundedRect(-width / 2, -height + 2, width, height, height / 2)
      .fillStyle(0x9d7546).fillRoundedRect(-width / 2, -height, width, height, height / 2)
      .fillStyle(0xfff1cf).fillRoundedRect(-width / 2 + 1.5, -height + 1.5, width - 3, height - 3, (height - 3) / 2);
  }
  private drawStorageChip(id: string, x: number, bottom: number, quantity: number) {
    const state = updateStorageChip(this.storageChipStates.get(id), quantity, Date.now());
    this.storageChipStates.set(id, state);
    if (quantity <= 0) return;
    // World-space, non-interactive labels follow pan/zoom without blocking building clicks.
    // Use each storage's authoritative count, never estate-wide totals.
    const background = this.add.graphics().setPosition(x, bottom).setDepth(9998);
    const text = this.add.text(x, bottom - 5, `${quantity} barley`, {
      fontFamily: "Georgia, serif", fontSize: "12px", fontStyle: "bold", color: "#513821", resolution: 2,
    }).setOrigin(0.5, 1).setDepth(9999);
    this.drawChipBackground(background, text);
    this.storageChips.push({ state, x, bottom, background, text });
  }
  private renderStorageChips() {
    const now = Date.now();
    for (const { state, x, bottom, background, text } of this.storageChips) {
      const { scale, offsetY } = storageChipBounce(state.increasedAt, now, this.reducedMotion?.matches);
      background.setScale(scale).setPosition(x, bottom + offsetY);
      text.setScale(scale).setPosition(x, bottom + offsetY - 5 * scale);
    }
  }
  private occlusionSprite(sprite: Phaser.GameObjects.Image): OcclusionSprite {
    const key = sprite.texture.key;
    let mask = this.alphaMasks.get(key);
    if (!mask) {
      const source = sprite.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(source, 0, 0);
      mask = context.getImageData(0, 0, canvas.width, canvas.height);
      this.alphaMasks.set(key, mask);
    }
    const pixels = mask, bounds = sprite.getBounds();
    return { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, depth: sprite.depth,
      opaqueAt: (u, v) => {
        const x = Math.min(pixels.width - 1, Math.floor((sprite.flipX ? 1 - u : u) * pixels.width));
        const y = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
        return (pixels.data[(y * pixels.width + x) * 4 + 3] ?? 0) * sprite.alpha >= 64;
      } };
  }
  private renderFarmerMarker(delta: number) {
    const hidden = farmerObscured(this.occlusionSprite(this.actor), this.buildingImages.filter(b => b.visible).map(b => this.occlusionSprite(b)));
    const reduced = this.reducedMotion?.matches ?? false;
    const target = hidden ? 1 : 0;
    this.markerAlpha = reduced ? target : this.markerAlpha + Math.sign(target - this.markerAlpha) * Math.min(Math.abs(target - this.markerAlpha), Math.min(delta, 80) / 120);
    this.farmerMarker.setPosition(this.actor.x, this.actor.y - 63 + hiddenFarmerBounce(Date.now(), reduced))
      .setAlpha(this.markerAlpha).setVisible(this.markerAlpha > 0);
  }
  private renderRiverWaves() {
    const graphics = this.riverWaves;
    graphics.clear();
    for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
      const origin = isoPoint({ column, row: config.riverRow });
      for (const ripple of riverRipples(column, this.riverElapsed, this.reducedMotion?.matches)) {
        graphics.lineStyle(2, 0xffffff, ripple.alpha).beginPath();
        ripple.points.forEach((point, index) => {
          if (index === 0) graphics.moveTo(origin.x + point.x, origin.y + point.y);
          else graphics.lineTo(origin.x + point.x, origin.y + point.y);
        });
        graphics.strokePath();
      }
    }
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    if (this.mockPlacement && !this.mockBuilding) this.drawMockPlacement();
    this.mockBuilding?.setAlpha(this.reducedMotion?.matches ? 0.65 : 0.65 + Math.sin(_time / 220) * 0.12);
    if (!this.reducedMotion?.matches) this.riverElapsed += Math.min(delta, 80);
    this.publishAnchor();
    if (!this.snapshot.farm.production.planting && this.walkPath.length) {
      // A new obstacle in a refreshed snapshot cancels the next segment before
      // entering it. Hidden-tab elapsed time is not replayed as a giant jump.
      if (this.walkProgress === 0 && !previewWalkable(this.snapshot, this.walkPath[0]!, Date.now())) { this.walkPath = []; this.marketTrip = false; }
      else {
        const start = isoPoint(this.farmerCell), end = isoPoint(this.walkPath[0]!);
        const previous = this.walkProgress;
        this.walkProgress = Math.min(1, previous + Math.min(delta, 80) / WORKER_MOVE_DURATION_PER_TILE);
        this.walkDistance += Math.hypot(end.x - start.x, end.y - start.y) * (this.walkProgress - previous);
        this.facingLeft = end.x < start.x;
        if (this.walkProgress === 1) {
          this.farmerCell = this.walkPath[0]!; this.walkPath = this.walkPath.slice(1); this.walkProgress = 0;
        }
      }
    }
    if (Date.now() - this.drawnAt >= 5000) this.draw();
    else { this.renderFarmer(); this.renderRiverWaves(); this.renderStorageChips(); }
    this.renderFarmerMarker(delta);
    this.renderProcession();
    if (this.dogState) {
      const mouse = this.input.mousePointer;
      const mousePresent = mouse?.event && !this.input.activePointer.wasTouch;
      if (mousePresent) mouse.updateWorldPoint(this.cameras.main);
      // Inverse projection without rounding follows the farmer's actual animated feet.
      const farmer = { column: this.actor.x / ISO_WIDTH + this.actor.y / ISO_HEIGHT,
        row: this.actor.y / ISO_HEIGHT - this.actor.x / ISO_WIDTH };
      this.dogState = stepDog(this.dogState, this.snapshot, farmer, delta, Date.now(), mousePresent ? mouse.worldX : null);
      const point = isoPoint(this.dogState.position);
      this.dog.setPosition(point.x, point.y).setDepth(point.y + 2).setTexture(dogTexture(this.dogState))
        .setDisplaySize(56, 56).setFlipX(this.dogState.flip);
    }
    if (this.marketTrip && !this.walkPath.length && sameCell(this.farmerCell, marketEntrance)) {
      this.marketTrip = false;
      this.enterMarket();
      this.scene.switch("isometric-market");
    }
  }
  fit() {
    if (!this.ready) return;
    this.baseZoom = Math.min(this.scale.width / 1580, this.scale.height / 880);
    this.cameras.main.setZoom(this.baseZoom).centerOn(-192, 240);
  }
  zoomBy(factor: number) {
    if (!this.ready) return;
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * factor, this.baseZoom, Math.max(2, this.baseZoom)));
  }
}
