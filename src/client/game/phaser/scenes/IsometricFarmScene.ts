import Phaser from "phaser";
import { palmPlantingPose } from "../palmPlanting";
import { buildingAudioActive, type BuildingAudioKey } from "../buildingAudio";
import { DATE_HARVEST_PREVIEW_SOURCES, dateHarvestPreviewFrame, dateHarvestPreviewOrigin, dateHarvestPreviewBasketsVisible } from "../dateHarvestPreview";
import dateHarvestBaskets from "../../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.png";
import { palmHarvestPose, palmHarvestCarrier } from "../palmHarvesting";
import { FARMER_DATE_SOURCES, FARMER_DATE_BOUNDS, FARMER_DATE_ORIGIN, FARMER_DATE_DISPLAY_SIZE } from "../farmerDateCarry";
import { DONKEY_SOURCES, donkeyFrameBounds, donkeyDirectionalPose, donkeyWanderPose } from "../donkeySprites";
import { scheduledMerchantVisit } from "../merchantVisit";
import { MERCHANT_BOAT_SOURCE, MERCHANT_POLE_SOURCE, createMerchantBoat, prepareMerchantBoatTexture, prepareMerchantHandsTexture } from "../merchantBoat";
import { merchantUiStore } from "../../../stores/merchantUiStore";
import { donkeyEscortPath, donkeyMillingPose } from "../donkeyMilling";
import type { MillingJob } from "../../../../game-data/milling";
import { farmerProductionJob } from "../../../../game-core/farm/farmerProduction";
import { advanceDonkeyWander, arrivingDonkey, donkeyEscapeFootprint, donkeyGround, donkeyNoRestTiles, donkeyOwnedAndIdle, donkeyRestKey, DONKEY_REST_MS, type DonkeyWander } from "../isometricDonkey";
import { drawActionProgress } from "../actionProgressBar";
import { drawBuildingProgress } from "../buildingProgressBar";
import { createShadowLayer } from "../shadowLayer";
import type { ShadowPreset } from "../daylightShadows";
import { BAKING_SOURCES, prepareBakingAnimation, createBakingAnimation } from "../breadOvenAnimation";
import renovationSprite from "../../../../assets/sprite_assets/pngs/v2/isometric-test/building-renovation.png";
import { RENOVATION_BUILDER_SOURCES, prepareRenovationBuilder } from "../renovationBuilder";
import { renovationProgress } from "../renovationProgress";
import { createBuildingRenovationAnimation } from "../buildingRenovationAnimation";
import { BREWING_WORKER_SOURCES, BREWING_STOOL_SOURCE, prepareBrewingAnimation, createBrewingTest } from "../breweryAnimation";
import { bakingDogArea, bakingJourneyPose, bakingProgress } from "../isometricBaking";
import type { FarmSnapshot } from "../../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../../game-data/movement";
import { FARM_BUILDING_DEFINITIONS } from "../../../../game-data/buildings";
import { FARM_SPRITES } from "../../../../assets/farmSprites";
import { FARM_EVOLUTION_SOURCES, farmAppearance } from "../farmEvolution";
import { LYRE_SOURCES, PROCESSION_COUNT, PROCESSION_DURATION_MS, processionPose } from "../lyreProcession";
import { DOG_SOURCES, initialDog, dogTexture, type DogState } from "../isometricDog";
import { stepDogConstructionEscape } from "../dogConstructionEscape";
import { initialWandering, stepWandering } from "../dogWandering";
import granaryUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/granary-isometric-test.png";
import breadOvenUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-isometric.png";
import smallShrineUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/small-shrine-isometric.png";
import warehouseUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/warehouse-isometric.png";
import breweryUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-left-bottom-shell.png";
import breweryRightTopUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-right-top-shell.png";
import breweryJarUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-left-bottom-jar.png";
import { prepareBreweryLayout, breweryVesselCount, breweryVesselTexture } from "../breweryLayout";
import { breweryOrientationTexture } from "../breweryOrientation";
import { activeBrewingPreparation, breweryOutputPlacement } from "../isometricBrewing";
import { MILL_ANIMATION_SOURCES, prepareMillAnimation, renderMillAnimation, millShadowCasters, millWorkerForegroundDepths, type MillAnimationImages } from "../millAnimation";
import { millingJourneyPose, millingProgress } from "../isometricMilling";
import { roadsideOutputPlacement, isometricOutputPosition } from "../buildingOutputPlacement";
import millOutputBagsUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.png";
import { mockGranaryPlacement, buildingPlacement, buildingBuildBlocker, type PlaceableBuilding } from "../isometricBuildingPlacement";
import marketUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/market-isometric-test.png";
import groundUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/ground-non-arable.png";
import arableGroundUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/ground-arable.png";
import riverWaterUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/river-water-isometric.png";
import { riverRipples } from "../riverRipples";
import { FISHING_SOURCES, fishingTexture, FISHING_CAST_DURATION } from "../farmerFishing";
import { CAST_DELAY_MS, CAST_COOLDOWN_MS } from "../../../../game-data/fishing";
import { fishingReadiness } from "../fishingReadiness";
import { ISOMETRIC_RIVER_ROWS, isIsometricRiverRow } from "../isometricRiver";
import { isometricRiverFish, fishingAreaFish, fishingBounds, fishingAim, blendRiverFish, RIVER_FISH_WIDTH, RIVER_FISH_HEIGHT, RIVER_FISH_ALPHA } from "../isometricRiverFish";
import roadUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import roadCornerUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-nw-ne.png";
import roadJunctionUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-nw-ne-se.png";
import canalStraightUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import canalCornerUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-nw-ne.png";
import canalJunctionUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-nw-ne-se.png";
import { canalConnectionMask } from "../isometricIrrigation";
import { roadTextures } from "../roadTextures";
import { roadConnectionMask, roadGhostPreview, roadWorkActive } from "../isometricRoads";
import { ROAD_CONSTRUCTION_DURATION_MS } from "../../../../game-data/roads";
import { FARMER_BUILD_SOURCES, FARMER_BUILD_BOUNDS, farmerBuildTexture } from "../farmerBuild";
import { activeConstruction, isometricConstructionPose, savedRoadApproach } from "../isometricConstruction";
import bush01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-01.png";
import bush02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/bush-isometric-02.png";
import rocks01 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-01.png";
import rocks02 from "../../../../assets/sprite_assets/pngs/v2/isometric-test/rocks-isometric-02.png";
import sown from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-sown.png";
import growing from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-growing.png";
import ripe from "../../../../assets/sprite_assets/pngs/v2/isometric-test/barley-isometric-ripe.png";
import { isoPoint, isoCell, footprintContains, footprintFront, ISO_WIDTH, ISO_HEIGHT, type IsoCell } from "../isometricProjection";
import { barleyDepth, barleyStage, buildingAt, farmOrigin, groundItemDepth, GROUND_ITEM_ORIGIN, insideWorld, insidePlot, presentCanals, sameCell } from "../isometricFarm";
import { prepareFarmerTexture } from "../farmerTexture";
import { PORTER_SOURCES, PORTER_TEXTURE_SIZE, PORTER_SHARPEN_AMOUNT, PORTER_DISPLAY_SIZE, porterFrameBounds } from "../porterSprites";
import { porterPose, porterAwaitingPickup } from "../isometricPorter";
import { FARMER_PLANT_SOURCES, farmerPlantBounds, farmerPlantTexture } from "../farmerPlant";
import { DATE_PALM_BOUNDS, DATE_PALM_ORIGIN, DATE_PALM_SOURCES, DATE_PALM_TEXTURE_SIZE, DATE_PALM_SHARPEN_AMOUNT, isometricCropSprite } from "../isometricDatePalm";
import { prepareBuildingTexture } from "../buildingTexture";
import { FARMER_WALK_SOURCES, FARMER_WALK_BOUNDS } from "../farmerWalk";
import { FARMER_CARRY_SOURCES, FARMER_CARRY_BOUNDS, farmerTravelTexture } from "../farmerCarry";
import { FARMER_FISH_SOURCES, FARMER_FISH_BOUNDS, farmerFishCarryTexture } from "../farmerFishCarry";
import { FARMER_FLOUR_SOURCES, farmerFlourBounds, farmerFlourCarryTexture } from "../farmerFlourCarry";
import { FARMER_JAR_SOURCES, farmerJarBounds, farmerJarCarryTexture, carryingLiquidJars } from "../farmerJarCarry";
import { previewWalkPath, previewWalkable } from "../isometricWalking";
import { isometricPlantingPose, plantingBlocker } from "../isometricPlanting";
import { isometricHarvestPose, harvestingBlocker } from "../isometricHarvesting";
import { PALM_TENDING_SOURCES, PALM_TENDING_BOUNDS, PALM_TENDING_ORIGIN, palmTendingTexture } from "../palmTending";
import { FARMER_HARVEST_SOURCES, FARMER_HARVEST_BOUNDS, farmerHarvestTexture } from "../farmerHarvest";
import { fieldKey, plantableFields, harvestableFields, plantingSelectionLimit } from "../../../../game-core/farm/batchPlanting";
import { harvestFieldLimit } from "../../../../game-core/farm/harvestCapacity";
import { pickupDuration, pickupPose, transferGroundItems, type GroundTransfer } from "../isometricPickup";
import { buildingFacingLeft } from "../buildingFacing";
import { createFarmerIdle } from "../farmerIdle";
import { hasFarmerPopup } from "../isometricTilePopup";
import { farmRenderKey } from "../farmRenderState";
import { renderDiagnostic } from "../renderDiagnostics";
import { visibleSpriteHit } from "../visibleSpriteHit";
import { SWEEP_SOURCES, SWEEP_BOUNDS, SWEEP_ORIGIN, SWEEP_IDLE_DELAY, SWEEP_TILES, planSweeping, planReturningSweep, sweepTexture, sweepingPose, sweepStopDeadline, sweepOriginX, type SweepPlan } from "../farmerSweeping";
import { CLOUD_TEXTURES, advanceClouds, cloudPose, initialClouds, prepareCloudTexture } from "../ambientClouds";
import { isometricIdleEligible, isometricIdleWorld } from "../isometricIdle";
import { storageChipBounce, updateStorageChip, type StorageChipState } from "../storageChipBounce";
import { farmerObscured, hiddenFarmerBounce, walkingCharacterDepth, type OcclusionSprite } from "../farmerOcclusion";
import { canVisitIsometricMarket, isMarketTile, marketOrigin, marketEntrance } from "../isometricMarket";
import { gatheringOffsetY, gatheringPose, materialCarry, materialLabel, transferBlocker } from "../isometricGathering";

export type IsometricTileAnchor = { cell: IsoCell; x: number; y: number; walking?: boolean; kind?: "porter" | "farmer" | "tile" | "millBags" | "breadBasket" | "beerJars" | "market" | "farmReturn" | "barleyMarket" | "beerMarket" | "bakingMarket" };

const scenery = { bush01, bush02, rocks01, rocks02 };
const crops = { sown, growing, ripe };
const fallback = { beer: FARM_SPRITES.beerJars, water: FARM_SPRITES.water, reeds: FARM_SPRITES.reeds, barley: FARM_SPRITES.harvestedBarley, reed: FARM_SPRITES.reedBundle, clay: FARM_SPRITES.brickPile,
  ...DATE_PALM_SOURCES, dateHarvestBaskets,
  mill: FARM_SPRITES.mill, brewery: breweryUrl, breadOven: breadOvenUrl, warehouse: warehouseUrl, smallShrine: smallShrineUrl };

/** Saved-world presentation and selection. Economic commands stay in React/server. */
export class IsometricFarmScene extends Phaser.Scene {
  private snapshot: FarmSnapshot;
  private selected: IsoCell | null = null;
  private palmConfirmationTarget: IsoCell | null = null;
  private porterActor?: Phaser.GameObjects.Image;
  private mockPlacement: IsoCell | null = null;
  private realPlacement = false;
  private placementLocked = false;
  private placementSelected: (cell: IsoCell) => void = () => {};
  private mockFootprint?: Phaser.GameObjects.Graphics;
  private mockBuilding?: Phaser.GameObjects.Image;
  private selectedFarmer = false;
  private selectedPorter = false;
  private selectedMillBags = false;
  private cloudSprites: Phaser.GameObjects.Image[] = [];
  private cloudState = initialClouds();
  private millDeliveryLeg: { path: readonly IsoCell[]; building: IsoCell; carrying: boolean; jars: boolean; bread: boolean; startedAt: number } | null = null;
  private baseZoom = 1;
  private drawnAt = 0;
  private renderedKey = "";
  private nextRenderCheck = 0;
  private graphicsLost = false;
  private ready = false;
  private palmProgress?: Phaser.GameObjects.Graphics;
  private palmPlantingSeen: string | null = null;
  private palmHarvestSeen: string | null = null;
  private palmHarvestBaskets?: Phaser.GameObjects.Image;
  private palmRest: { cell: IsoCell; visual: IsoCell } | null = null;
  private riverWaves!: Phaser.GameObjects.Graphics;
  private riverElapsed = 0;
  private swimmingFish!: Phaser.GameObjects.Image;
  private readonly fishSeed = Math.floor(Math.random() * 4294967296);
  private fishPosition: IsoCell | null = null;
  private fishMode: string | null = null;
  private fishFacingLeft = false;
  private fishRespawnAt = 0;
  private fishTransition: { from: IsoCell; startedAt: number; duration: number } | null = null;
  private reducedMotion: MediaQueryList | undefined;
  private farmerCell: IsoCell = config.farmerSpawn;
  private dogState: DogState | null = null;
  private dogWandering = initialWandering();
  private dog!: Phaser.GameObjects.Image;
  private donkeyActor?: Phaser.GameObjects.Image;
  private donkeyWander: DonkeyWander | null = null;
  private donkeyJob: MillingJob | null = null;
  private caravan?: ReturnType<typeof createMerchantBoat>;
  private merchantNameUntil = 0;
  private boatBobElapsed = 0;
  private millingJourneyId: string | null = null;
  private donkeyCells: readonly IsoCell[] = [];
  private processionStartedAt: number | null = null;
  private lastCelebratedLevel = 0;
  private musicians: Phaser.GameObjects.Image[] = [];
  private walkPath: readonly IsoCell[] = [];
  private walkProgress = 0;
  private walkDistance = 0;
  private farmerIdle?: ReturnType<typeof createFarmerIdle>;
  private idlePosition: IsoCell | null = null;
  private reedRestPosition: { cell: IsoCell; visual: IsoCell } | null = null;
  private idleWalking = false;
  private idleDistance = 0;
  private sweepIdleMs = 0;
  private sweepStopAt: number | null = null;
  private sweeping: { plan: SweepPlan; elapsed: number } | null = null;
  private marketTrip = false;
  private facingLeft = false;
  private facingBuilding: IsoCell | null = null;
  private actor!: Phaser.GameObjects.Image;
  private actorShadow!: Phaser.GameObjects.Ellipse;
  shadowPreset: ShadowPreset = "local";
  private breweries: { id: string; animation: ReturnType<typeof createBrewingTest> }[] = [];
  private selectedBeer = false;
  private ovens: { id: string; animation: ReturnType<typeof createBakingAnimation> }[] = [];
  private renovations: { id: string; animation: ReturnType<typeof createBuildingRenovationAnimation> }[] = [];
  private selectedBread = false;
  private daylightShadows!: ReturnType<typeof createShadowLayer>;
  private cargo!: Phaser.GameObjects.Text;
  private cargoBackground!: Phaser.GameObjects.Graphics;
  private plantingSelection: readonly IsoCell[] | null = null;
  private selectionMode: "plant" | "harvest" = "plant";
  private cropImages: { cell: IsoCell; image: Phaser.GameObjects.Image }[] = [];
  private buildingImages: Phaser.GameObjects.Image[] = [];
  private roadPlan: readonly IsoCell[] | null = null;
  private roadPlanClick: (cell: IsoCell) => void = () => {};
  private roadPlanObjects: Phaser.GameObjects.GameObject[] = [];
  private roadPlanOverlay?: Phaser.GameObjects.Graphics;
  private roadPlanNumbers: Phaser.GameObjects.Text[] = [];
  private roadPointer: { x: number; y: number } | null = null;
  private roadGhost?: Phaser.GameObjects.Image;
  private roadGhostFootprint?: Phaser.GameObjects.Graphics;
  private roadGhostKey = "";

  private renderRoadGhost() {
    if (this.roadPlan === null || !this.roadPointer || roadWorkActive(this.snapshot.farm.roads, Date.now())) {
      this.roadGhost?.setVisible(false); this.roadGhostFootprint?.setVisible(false);
      this.roadGhostKey = "";
      return;
    }
    const world = this.cameras.main.getWorldPoint(this.roadPointer.x, this.roadPointer.y);
    const cell = isoCell(world.x, world.y), now = Date.now();
    const key = `${cell.column}:${cell.row}:${this.snapshot.farm.version}:${Math.floor(now / 250)}`;
    if (key === this.roadGhostKey) return;
    this.roadGhostKey = key;
    const preview = roadGhostPreview(this.snapshot, this.roadPlan, cell, now);
    const point = isoPoint(cell);
    this.roadGhostFootprint ??= this.add.graphics().setDepth(9992);
    this.roadGhostFootprint.clear().setVisible(true);
    this.diamond(this.roadGhostFootprint, cell, preview.colour, 0.4);
    this.roadGhost ??= this.add.image(0, 0, preview.texture).setOrigin(0.5).setDepth(9993);
    this.roadGhost.setTexture(preview.texture).setPosition(point.x, point.y)
      .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setTint(preview.colour).setAlpha(0.7).setVisible(true);
  }

  setRoadPlanning(cells: readonly IsoCell[] | null, onClick: (cell: IsoCell) => void = () => {}) {
    const changedMode = (this.roadPlan === null) !== (cells === null);
    this.roadPlan = cells;
    this.roadGhostKey = "";
    if (cells === null) this.roadPointer = null;
    this.roadPlanClick = onClick;
    if (cells !== null) { this.walkPath = []; this.walkProgress = 0; }
    if (!this.ready) return;
    if (changedMode) this.clearSelection();
    else this.drawRoadPlan();
    this.renderRoadGhost();
  }

  private fadeRoadPlanBuildings() {
    if (this.roadPlan === null) return;
    for (const object of this.roadPlanObjects) {
      if (object instanceof Phaser.GameObjects.Image || object instanceof Phaser.GameObjects.Text || object instanceof Phaser.GameObjects.Graphics)
        object.setAlpha(Math.min(object.alpha, 0.25));
    }
  }

  private drawRoadPlan() {
    this.roadPlanOverlay?.destroy();
    this.roadPlanNumbers.forEach(text => text.destroy());
    this.roadPlanNumbers = [];
    this.roadPlanOverlay = undefined;
    if (this.roadPlan === null) return;
    const overlay = this.roadPlanOverlay = this.add.graphics().setDepth(9990);
    const footprints = [
      { ...farmOrigin, columns: 2, rows: 2 }, { ...marketOrigin, columns: 2, rows: 2 },
      ...this.snapshot.buildings.map(b => ({ ...b, ...FARM_BUILDING_DEFINITIONS[b.type].footprint })),
    ];
    for (const footprint of footprints) for (let row = 0; row < footprint.rows; row++) for (let column = 0; column < footprint.columns; column++) {
      const p = isoPoint({ column: footprint.column + column, row: footprint.row + row });
      overlay.lineStyle(1.5, 0x79512f, 0.8).strokePoints([
        new Phaser.Math.Vector2(p.x, p.y - ISO_HEIGHT / 2), new Phaser.Math.Vector2(p.x + ISO_WIDTH / 2, p.y),
        new Phaser.Math.Vector2(p.x, p.y + ISO_HEIGHT / 2), new Phaser.Math.Vector2(p.x - ISO_WIDTH / 2, p.y),
      ], true);
    }
    this.roadPlan.forEach((cell, index) => {
      this.diamond(overlay, cell, 0x42ad62, 0.55);
      const p = isoPoint(cell);
      this.roadPlanNumbers.push(this.add.text(p.x, p.y, String(index + 1), {
        fontFamily: "Georgia, serif", fontSize: "14px", fontStyle: "bold", color: "#352015", resolution: 2,
      }).setOrigin(0.5).setDepth(9991));
    });
  }
  private mills: { building: FarmSnapshot["buildings"][number]; images: MillAnimationImages; progress: Phaser.GameObjects.Graphics }[] = [];
  private farmerMarker!: Phaser.GameObjects.Graphics;
  private markerAlpha = 0;
  private alphaMasks = new Map<string, ImageData>();
  private storageChipStates = new Map<string, StorageChipState>();
  private millOutputSprites: Phaser.GameObjects.Image[] = [];
  private storageChips: { state: StorageChipState; x: number; bottom: number; background: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }[] = [];
  private reportedAnchor = "";
  private commandPending = false;
  private pickup: GroundTransfer | null = null;
  private heldMaterial!: Phaser.GameObjects.Image;
  private gatheringApproach: { path: readonly IsoCell[]; startedAt: number } | null = null;
  private fishingApproach: { path: readonly IsoCell[]; startedAt: number } | null = null;
  private cast: { startedAt: number; aim: number } | null = null;
  private castPending = false;
  private nextCastAt = 0;
  private fishingClockOffset = 0;
  private fishingOverlay!: Phaser.GameObjects.Graphics;
  private keyboardAim = 0.5;
  private onFishingCast: (aim: number) => void = () => {};
  private onFishingStatus: (label: string) => void = () => {};
  private lastFishingStatus = "";
  private invalidFishingClickUntil = 0;
  private constructionApproach: { path: readonly IsoCell[]; startedAt: number; completesAt: number } | null = null;
  private readonly selectPlantingTile: (cell: IsoCell) => void;
  private readonly report: (anchor: IsometricTileAnchor | null) => void;
  private readonly enterMarket: () => void;
  constructor(snapshot: FarmSnapshot, report: (anchor: IsometricTileAnchor | null) => void, selectPlantingTile: (cell: IsoCell) => void = () => {}, enterMarket: () => void = () => {}) {
    super("isometric-farm"); this.snapshot = snapshot; this.report = report; this.selectPlantingTile = selectPlantingTile;
    this.enterMarket = enterMarket;
    this.fishingClockOffset = (snapshot.farm.fishing?.serverNow ?? Date.now()) - Date.now();
    this.farmerCell = snapshot.farm.production.lastHarvestDelivery?.target ?? config.farmerSpawn;
  }
  preload() {
    this.load.image("source-building-renovation", renovationSprite);
    RENOVATION_BUILDER_SOURCES.forEach((url, index) => this.load.image(`source-builder-${index}`, url));
    this.load.image("source-merchant-boat", MERCHANT_BOAT_SOURCE);
    this.load.image("source-merchant-pole", MERCHANT_POLE_SOURCE);
    for (const [key, url] of Object.entries(DONKEY_SOURCES)) this.load.image(`source-${key}`, url);
    for (const [key, url] of Object.entries(PORTER_SOURCES)) this.load.image(`source-${key}`, url);
    this.load.image("source-brewery-right-top", breweryRightTopUrl);
    BREWING_WORKER_SOURCES.forEach((url, i) => this.load.image(`source-brewing-worker-${i}`, url));
    this.load.image("source-brewing-stool", BREWING_STOOL_SOURCE);
    this.load.image("source-brewery-vessel", breweryJarUrl);
    SWEEP_SOURCES.forEach((url, index) => this.load.image(`source-farmer-sweep-${index}`, url));
    for (const [key, url] of Object.entries(FARMER_FISH_SOURCES)) this.load.image(`source-${key}`, url);
    for (const [key, url] of Object.entries(FARMER_FLOUR_SOURCES)) this.load.image(`source-${key}`, url);
    for (const [key, url] of Object.entries(FARMER_JAR_SOURCES)) this.load.image(`source-${key}`, url);
    for (const [key, url] of Object.entries(FISHING_SOURCES)) this.load.image(`source-${key}`, url);
    LYRE_SOURCES.forEach(({ key, url }) => this.load.image(`source-${key}`, url));
    for (const [key, url] of Object.entries(FARM_EVOLUTION_SOURCES)) this.load.image(`source-${key}`, url);
    this.load.image("source-granary", granaryUrl);
    this.load.image("source-mill-output-bags", millOutputBagsUrl);
    for (const { key, url } of MILL_ANIMATION_SOURCES) this.load.image(`source-${key}`, url);
    BAKING_SOURCES.forEach((url, i) => this.load.image(`source-baking-${i}`, url));
    for (const [key, url] of Object.entries(DOG_SOURCES)) this.load.image(`source-dog-${key}`, url);
    this.load.image("source-market-preview", marketUrl);
    this.load.image("source-non-arable-ground", groundUrl);
    this.load.image("source-arable-ground", arableGroundUrl);
    this.load.image("source-river-water", riverWaterUrl);
    this.load.image("source-river-fish", FARM_SPRITES.fish);
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
    for (const [key, url] of Object.entries({ ...scenery, ...crops, ...fallback, ...DATE_HARVEST_PREVIEW_SOURCES, ...PALM_TENDING_SOURCES, ...FARMER_DATE_SOURCES })) this.load.image(`source-${key}`, url);
  }
  create() {
    const texturesStarted = performance.now();
    const lost = () => { this.graphicsLost = true; renderDiagnostic("graphics-lost"); };
    const restored = () => {
      this.graphicsLost = false;
      renderDiagnostic("graphics-restored");
      if (this.ready) this.draw();
    };
    const resumed = () => {
      renderDiagnostic("tab-visible");
      // Keep the last scene visible; catch up from saved state without waiting
      // for the asynchronous server refresh.
      if (this.ready && !this.graphicsLost) this.reconcileRender();
    };
    this.game.renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, lost);
    this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restored);
    this.game.events.on(Phaser.Core.Events.VISIBLE, resumed);
    this.events.once("shutdown", () => {
      this.game.renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, lost);
      this.game.renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restored);
      this.game.events.off(Phaser.Core.Events.VISIBLE, resumed);
    });
    if (!this.textures.exists("merchant-boat")) {
      const source = this.textures.get("source-merchant-boat").getSourceImage() as HTMLImageElement;
      this.textures.addCanvas("merchant-boat", prepareMerchantBoatTexture(source))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.textures.addCanvas("merchant-boat-hands", prepareMerchantHandsTexture(source))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const pole = this.textures.get("source-merchant-pole").getSourceImage() as HTMLImageElement;
      this.textures.addCanvas("merchant-pole", prepareMerchantBoatTexture(pole))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(DONKEY_SOURCES)) {
      if (this.textures.exists(key)) continue;
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(key, prepareFarmerTexture(source, undefined, donkeyFrameBounds(key), 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(donkeyRestKey(this.snapshot.farm.id)) ?? "null");
      if (saved && Number.isInteger(saved.column) && Number.isInteger(saved.row)) {
        this.donkeyWander = { position: saved, facingLeft: true, motion: null, rest: DONKEY_REST_MS };
      }
    } catch { /* Optional cosmetic persistence. */ }
    const interruptSweep = () => {
      this.sweepIdleMs = 0;
      if (this.sweeping) this.sweepStopAt = sweepStopDeadline(this.sweepStopAt, Date.now());
      this.dogWandering = initialWandering();
      if (this.dogState) this.dogState = { ...this.dogState, target: null, checkIn: 0 };
    };
    const activityEvents = ["pointermove", "pointerdown", "touchstart", "touchmove", "keydown", "wheel", "blur"] as const;
    activityEvents.forEach(event => window.addEventListener(event, interruptSweep, true));
    let idleAwaySince: number | null = null;
    const sweepVisibility = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible") {
        idleAwaySince = this.sweepEligible(now) ? now : null;
        this.stopSweeping();
        return;
      }
      const plan = this.sweepEligible(now)
        ? planReturningSweep(this.snapshot, this.farmerCell, idleAwaySince, now) : null;
      idleAwaySince = null;
      if (!plan) return;
      this.farmerIdle?.cancel();
      this.idlePosition = null; this.idleWalking = false;
      this.sweepStopAt = null;
      this.sweeping = { plan, elapsed: 0 };
      this.farmerCell = plan.first;
      if (this.ready) this.renderFarmer();
    };
    document.addEventListener("visibilitychange", sweepVisibility);
    this.events.once("shutdown", () => {
      activityEvents.forEach(event => window.removeEventListener(event, interruptSweep, true));
      document.removeEventListener("visibilitychange", sweepVisibility);
      idleAwaySince = null;
      this.sweeping = null; this.sweepIdleMs = 0;
      this.sweepStopAt = null;
      this.dogWandering = initialWandering();
    });
    prepareCloudTexture(this);
    SWEEP_SOURCES.forEach((_, index) => {
      const source = this.textures.get(`source-farmer-sweep-${index}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(`farmer-sweep-${index}`, prepareFarmerTexture(source, undefined, SWEEP_BOUNDS))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Cosmetic persistence is optional. */ }
    this.farmerIdle = createFarmerIdle({ key: `sumer:isometric-farmer-idle:${this.snapshot.farm.id}`, storage,
      present: (position, moving) => {
        const previous = isoPoint(this.idlePosition ?? this.farmerCell), next = isoPoint(position);
        if (moving && Math.abs(next.x - previous.x) > 0.001) this.facingLeft = next.x < previous.x;
        if (moving) this.idleDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
        this.idlePosition = moving ? position : null;
        this.idleWalking = moving;
        if (!moving) this.farmerCell = position;
        this.facingBuilding = null;
      } });
    const suspendIdle = () => this.farmerIdle?.suspend();
    const visibility = () => { if (document.visibilityState !== "visible") suspendIdle(); };
    document.addEventListener("visibilitychange", visibility);
    this.events.on("sleep", suspendIdle);
    this.events.once("shutdown", () => {
      suspendIdle(); this.events.off("sleep", suspendIdle);
      document.removeEventListener("visibilitychange", visibility);
    });
    for (const key of Object.keys(FARMER_FISH_SOURCES)) {
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(key, prepareFarmerTexture(source, undefined, FARMER_FISH_BOUNDS))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(FARMER_FLOUR_SOURCES)) {
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(key, prepareFarmerTexture(source, undefined, farmerFlourBounds(key)))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(FARMER_JAR_SOURCES)) {
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      this.textures.addCanvas(key, prepareFarmerTexture(source, undefined, farmerJarBounds(key)))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(FISHING_SOURCES)) {
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      // Forward cast is a larger export: normalize full frames, never crop each pose.
      this.textures.addCanvas(key, prepareFarmerTexture(source, undefined,
        { left: 0, top: 0, right: source.naturalWidth - 1, bottom: source.naturalHeight - 1 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    LYRE_SOURCES.forEach(({ key }) => {
      this.textures.addCanvas(key, prepareFarmerTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement,
        undefined, { left: 0, top: 0, right: 511, bottom: 511 }))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    this.events.on("sleep", () => this.stopProcession());
    this.textures.addCanvas("mill-output-bags", prepareBuildingTexture(
      this.textures.get("source-mill-output-bags").getSourceImage() as HTMLImageElement,
      { maxSize: 96, sharpen: 0.45 }
    ))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
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
    this.textures.addCanvas("river-fish", prepareRoad("source-river-fish"))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
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
    prepareMillAnimation(this);
    prepareBakingAnimation(this);
    prepareRenovationBuilder(this);
    prepareBrewingAnimation(this);
    for (const rightTop of [false, true]) for (const count of [0, 1, 2]) {
      this.textures.addCanvas(breweryVesselTexture(rightTop, count), prepareBreweryLayout(
        this.textures.get(rightTop ? "source-brewery-right-top" : "source-brewery").getSourceImage() as HTMLImageElement,
        this.textures.get("source-brewery-vessel").getSourceImage() as HTMLImageElement, rightTop, count))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.events.once("shutdown", () => {
      this.breweries.forEach(b => b.animation.destroy()); this.breweries = [];
    });
    this.textures.addCanvas("building-renovation", prepareBuildingTexture(this.textures.get("source-building-renovation").getSourceImage() as HTMLImageElement))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.events.once("shutdown", () => { this.ovens.forEach(o => o.animation.destroy()); this.ovens = []; });
    this.events.once("shutdown", () => { this.renovations.forEach(r => r.animation.destroy()); this.renovations = []; });
    for (const key of Object.keys({ ...scenery, ...crops, ...fallback, ...DATE_HARVEST_PREVIEW_SOURCES })) {
      if (key === "brewery") continue;
      const source = this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
      const isCrop = key in crops;
      const isDatePalm = key in DATE_PALM_SOURCES;
      const bounds = key in DATE_HARVEST_PREVIEW_SOURCES ? { left: 0, top: 0, right: source.naturalWidth - 1, bottom: source.naturalHeight - 1 }
        : key in DATE_PALM_SOURCES ? DATE_PALM_BOUNDS : isCrop ? farmerPlantBounds(512) : key in scenery ? { left: 0, top: 0, right: 511, bottom: 511 } : undefined;
      this.textures.addCanvas(key, key === "breadOven" || key === "smallShrine" || key === "warehouse" ? prepareBuildingTexture(source)
        : prepareFarmerTexture(source, isDatePalm ? DATE_PALM_SHARPEN_AMOUNT : isCrop ? 0.6 : 0.15, bounds,
          isDatePalm ? DATE_PALM_TEXTURE_SIZE : key in DATE_HARVEST_PREVIEW_SOURCES ? 256 : 128))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(FARMER_DATE_SOURCES)) if (!this.textures.exists(key)) {
      this.textures.addCanvas(key, prepareFarmerTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement,
        0.15, FARMER_DATE_BOUNDS, 256))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(PALM_TENDING_SOURCES)) if (!this.textures.exists(key)) {
      // Use the idle farmer's sharpening and texture resolution defaults,
      // retaining the shared crop that registers the tending animation frames.
      this.textures.addCanvas(key, prepareFarmerTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement,
        undefined, PALM_TENDING_BOUNDS))?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of Object.keys(PORTER_SOURCES)) if (!this.textures.exists(key)) {
      // Trial the idle farmer's sharpening and texture resolution on the waiting porter.
      const idle = key === "porter-empty-idle";
      this.textures.addCanvas(key, prepareFarmerTexture(this.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement,
        idle ? undefined : PORTER_SHARPEN_AMOUNT, porterFrameBounds(key), idle ? undefined : PORTER_TEXTURE_SIZE))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    renderDiagnostic("texture-preparation", texturesStarted);
    this.events.once("shutdown", () => { delete this.game.canvas.dataset.fieldCursor; });
    this.ready = true; this.draw(); this.fit();
    // Start at the player's preferred framing: two presses of the 1.2× zoom button.
    // Keep the original fit scale as the zoom-out limit and explicit Fit action.
    this.zoomBy(1.2 ** 2);
    let last: { x: number; y: number } | null = null;
    let dragged = false;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { last = { x: pointer.x, y: pointer.y }; dragged = false; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.roadPlan !== null) this.roadPointer = { x: pointer.x, y: pointer.y };
      if (this.mockPlacement && !this.placementLocked && !pointer.isDown) this.moveMockPlacement(pointer.x, pointer.y);
      if (!pointer.isDown || !last) return;
      if (!dragged && pointer.getDistance() < 6) return;
      dragged = true;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - last.x) / camera.zoom;
      camera.scrollY -= (pointer.y - last.y) / camera.zoom;
      last = { x: pointer.x, y: pointer.y };
    });
    this.input.on("gameout", () => { this.roadPointer = null; this.renderRoadGhost(); });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      last = null;
      if (dragged || this.palmConfirmationTarget) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.roadPlan !== null) {
        this.roadPointer = { x: pointer.x, y: pointer.y };
        this.roadGhostKey = ""; this.renderRoadGhost();
        if (!this.commandPending) this.roadPlanClick(isoCell(world.x, world.y));
        return;
      }
      if (this.snapshot.farm.fishing) {
        const column = world.x / ISO_WIDTH + world.y / ISO_HEIGHT;
        const row = world.y / ISO_HEIGHT - world.x / ISO_WIDTH;
        const aim = fishingAim(column, this.snapshot.farm.fishing.column);
        if (row >= config.riverRow - 0.5 && row <= config.riverRow + 1.5 && aim !== null) this.tryFishingCast(aim);
        else { this.invalidFishingClickUntil = Date.now() + 1500; this.publishFishingStatus(); }
        return;
      }
      if (this.mockPlacement) {
        if (!this.placementLocked) {
          this.moveMockPlacement(pointer.x, pointer.y);
          if (this.realPlacement) { this.placementLocked = true; this.placementSelected(this.mockPlacement!); }
        }
        return;
      }
      if (this.plantingSelection === null && this.caravan?.contains(world.x, world.y)) {
        const visit = this.merchantVisit();
        this.clearSelection();
        if (visit.phase === "stopped") {
          this.merchantNameUntil = 0;
          merchantUiStore.getState().setOpen(true);
        } else if (visit.phase !== "away") this.merchantNameUntil = Date.now() + 2000;
        this.updateMerchantCaravan();
        return;
      }
      const cell: IsoCell = objects.find(object => object.getData("tile"))?.getData("tile") ?? isoCell(world.x, world.y);
      if (this.commandPending || this.marketTrip) return;
      if (this.plantingSelection !== null) { this.selectPlantingTile(cell); return; }
      this.farmerIdle?.cancel();
      this.selectedFarmer = objects.some(object => {
        if (object.getData("farmer") !== true) return false;
        const sprite = object === this.actor ? this.actor : this.mills.find(mill => mill.images.farmer === object)?.images.farmer;
        return !!sprite && visibleSpriteHit(sprite.visible, sprite.alpha, sprite.getBounds(), world);
      });
      this.selectedPorter = !this.selectedFarmer && objects.some(object => object === this.porterActor && this.porterActor.visible);
      this.selectedMillBags = !this.selectedFarmer && objects.some(object => object.getData("millBags") === true);
      this.selectedBread = !this.selectedFarmer && objects.some(object => object.getData("breadBasket") === true);
      this.selectedBeer = !this.selectedFarmer && objects.some(object => object.getData("beerJars") === true);
      this.selected = this.selectedFarmer ? this.farmerCell : insideWorld(cell) ? cell : null; this.draw();
      this.publishAnchor();
    });
    this.scale.on("resize", this.fit, this);
    const fishingKey = (event: KeyboardEvent) => {
      if (!this.sys.isActive() || !this.snapshot.farm.fishing ||
        (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName))) return;
      if (!["ArrowLeft", "ArrowRight", " "].includes(event.key)) return;
      event.preventDefault();
      if (event.key === " ") this.tryFishingCast(this.keyboardAim);
      else this.keyboardAim = Math.max(0, Math.min(1, this.keyboardAim + (event.key === "ArrowLeft" ? -0.04 : 0.04)));
    };
    window.addEventListener("keydown", fishingKey);
    this.events.once("shutdown", () => window.removeEventListener("keydown", fishingKey));
    this.events.once("shutdown", () => { this.stopProcession(); this.ready = false; this.scale.off("resize", this.fit, this); });
  }
  private placementBuilding: PlaceableBuilding = "granary";
  private millPreviewParts: Phaser.GameObjects.Image[] = [];
  beginBuildingPlacement(type: PlaceableBuilding, onSelected: (cell: IsoCell) => void) {
    this.placementBuilding = type;
    this.realPlacement = true; this.placementLocked = false; this.placementSelected = onSelected;
    this.setMockGranaryPlacement(true);
  }
  endBuildingPlacement() {
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
    this.millPreviewParts.forEach(image => image.destroy()); this.millPreviewParts = [];
    this.mockFootprint?.destroy(); this.mockBuilding?.destroy();
    this.mockFootprint = undefined; this.mockBuilding = undefined;
    if (!this.mockPlacement) return;
    const preview = this.realPlacement
      ? buildingPlacement(this.snapshot, this.mockPlacement, this.farmerCell, Date.now(), this.placementBuilding)
      : mockGranaryPlacement(this.snapshot, this.mockPlacement, this.farmerCell, Date.now(), false, this.placementBuilding);
    const colour = preview.rule.type === "valid" && (!this.realPlacement || !buildingBuildBlocker(this.snapshot, Date.now(), this.placementBuilding)) ? 0x55ce75 : 0xe65c5c;
    this.mockFootprint = this.add.graphics().setDepth(10000);
    for (const cell of preview.footprint) this.diamond(this.mockFootprint, cell, colour, 0.55);
    if (preview.loading) this.diamond(this.mockFootprint, preview.loading, 0xffd45a, 0.75);
    const size = FARM_BUILDING_DEFINITIONS[this.placementBuilding].footprint;
    const shrine = this.placementBuilding === "smallShrine";
    // The shrine's ground contact is the centre of its pedestal, not the
    // bottom of the padded source frame or the front of a two-tile building.
    const p = shrine ? isoPoint(this.mockPlacement) : footprintFront(this.mockPlacement, size.columns, size.rows);
    const granary = this.placementBuilding === "granary";
    const displaySize = granary ? 240 : this.placementBuilding === "warehouse" ? 200 : 150;
    if (this.placementBuilding === "mill") {
      const mill = renderMillAnimation(this, null, this.mockPlacement, null);
      mill.farmer.destroy(); mill.donkey.destroy(); mill.flour.destroy();
      this.mockBuilding = mill.base;
      this.millPreviewParts = [mill.bowl, mill.bags, mill.lever];
      [mill.base, ...this.millPreviewParts].forEach((image, index) => image.setDepth(10001 + index).setTint(colour).setAlpha(0.65));
      return;
    }
    const texture = this.placementBuilding === "brewery"
      ? breweryVesselTexture(breweryOrientationTexture({ ...this.mockPlacement, loadingTile: preview.loading }, this.snapshot.farm.roads, Date.now()) === "brewery-right-top", breweryVesselCount(this.snapshot.inventory))
      : this.placementBuilding;
    this.mockBuilding = this.add.image(p.x, p.y + (granary ? -12 : 0), texture).setOrigin(0.5, shrine ? 840 / 1024 : granary ? 1 : 120 / 128)
      .setDisplaySize(displaySize, displaySize).setDepth(10001).setTint(colour).setAlpha(0.65);
  }
  setSnapshot(snapshot: FarmSnapshot) {
    if (activeBrewingPreparation(snapshot, Date.now())) { this.walkPath = []; this.walkProgress = 0; }
    for (const [id, job] of Object.entries(this.snapshot.farm.production.baking)) {
      if (!snapshot.farm.production.baking[id]) this.farmerCell = job.preparation?.path.at(-1) ?? this.farmerCell;
    }
    if (Object.keys(snapshot.farm.production.baking).length) { this.walkPath = []; this.walkProgress = 0; }
    if (!isometricIdleEligible(snapshot, Date.now())) this.stopSweeping();
    if (!isometricIdleEligible(snapshot, Date.now())) this.farmerIdle?.cancel();
    if (snapshot.farm.production.cropWork && !snapshot.farm.production.cropWork.settled) {
      this.walkPath = []; this.walkProgress = 0;
      this.idlePosition = null; this.idleWalking = false;
    }
    if (this.snapshot.farm.milling && !snapshot.farm.milling) {
      const job = this.snapshot.farm.milling;
      const mill = this.snapshot.buildings.find(b => b.id === job.buildingId);
      if (job.worker !== "donkey") this.farmerCell = job.preparation?.path.at(-1) ?? mill?.loadingTile ?? this.farmerCell;
    }
    this.fishingClockOffset = (snapshot.farm.fishing?.serverNow ?? Date.now()) - Date.now();
    if (this.snapshot.farm.fishing && !snapshot.farm.fishing) {
      if (snapshot.farm.carriedItem?.itemKey === "fish") this.fishRespawnAt = Date.now() + 3000;
      // Cancellation during approach must leave routing on a real tile waypoint.
      this.farmerCell = { column: Math.round(this.farmerCell.column), row: Math.round(this.farmerCell.row) };
      this.fishingApproach = null;
      this.cast = null; this.facingLeft = true;
    }
    if (this.snapshot.farm.gathering && !snapshot.farm.gathering) {
      const pose = gatheringPose(this.snapshot, Date.now(), this.gatheringApproach);
      if (pose) {
        this.farmerCell = pose.position; this.facingLeft = pose.facingLeft;
        this.reedRestPosition = pose.itemKey === "reed" ? { cell: pose.position, visual: pose.visualPosition } : null;
      }
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
    if (farmerProductionJob(snapshot.farm) || snapshot.farm.production.planting || activeConstruction(snapshot, Date.now())) { this.walkPath = []; this.walkProgress = 0; }
    if (this.ready) this.reconcileRender();
  }
  setPlantingSelection(cells: readonly IsoCell[] | null, pending = false, mode: "plant" | "harvest" = "plant") {
    if (cells !== null || pending) this.stopSweeping();
    this.plantingSelection = cells; this.commandPending = pending; this.selectionMode = mode;
    if (cells !== null || pending) {
      this.farmerIdle?.cancel();
      this.facingBuilding = null;
      // Finish at a valid route waypoint before submitting that location.
      if (this.walkProgress >= 0.5 && this.walkPath[0]) this.farmerCell = this.walkPath[0];
      this.walkPath = []; this.walkProgress = 0;
    }
    if (this.ready) this.draw();
  }
  private updateFieldSelectionCursor() {
    const canvas = this.game.canvas;
    const pointer = this.input.activePointer;
    let cursor = "";
    if (this.plantingSelection !== null && !pointer.wasTouch) {
      const now = Date.now();
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cell = isoCell(world.x, world.y);
      const selected = this.plantingSelection.some(field => sameCell(field, cell));
      const harvesting = this.selectionMode === "harvest";
      const eligible = (harvesting ? harvestableFields : plantableFields)(this.snapshot, now).some(field => sameCell(field, cell));
      const limit = harvesting ? harvestFieldLimit(this.snapshot.farm.household.happiness) : plantingSelectionLimit(this.snapshot, now);
      const room = this.plantingSelection.length < limit;
      const blocked = (harvesting ? harvestingBlocker : plantingBlocker)(this.snapshot, now);
      cursor = !this.commandPending && !blocked && eligible && (selected || room)
        ? harvesting ? "harvest" : "sow" : "unavailable";
    }
    if (cursor) {
      if (canvas.dataset.fieldCursor !== cursor) canvas.dataset.fieldCursor = cursor;
    } else if (canvas.dataset.fieldCursor) delete canvas.dataset.fieldCursor;
  }
  farmerPosition(): IsoCell { return this.farmerCell; }
  private merchantVisit() {
    const { board, clockOffset } = merchantUiStore.getState();
    return scheduledMerchantVisit(this.snapshot.farm.progression?.level ?? 1, board, Date.now() + clockOffset);
  }
  private updateMerchantCaravan() {
    const visit = this.merchantVisit();
    if ((this.snapshot.farm.progression?.level ?? 1) < 7) return;
    this.caravan ??= createMerchantBoat(this);
    this.caravan.render(visit, this.reducedMotion?.matches, Date.now() < this.merchantNameUntil, this.boatBobElapsed);
  }
  donkeyPosition(): IsoCell | undefined {
    const state = this.donkeyWander;
    if (!state) return undefined;
    const position = state.motion ? state.motion.elapsed >= 450 ? state.motion.to : state.motion.from : state.position;
    this.donkeyWander = { ...state, position, motion: null, rest: DONKEY_REST_MS };
    return position;
  }
  receiveMarketDonkey() {
    if (this.snapshot.farm.milling?.worker === "donkey") return;
    this.donkeyWander = arrivingDonkey(donkeyGround(this.snapshot, Date.now()), [this.farmerCell]);
    if (this.ready) this.updateDonkey(0);
  }
  setFishingCastHandler(handler: (aim: number) => void) { this.onFishingCast = handler; }
  setFishingStatusHandler(handler: (label: string) => void) { this.onFishingStatus = handler; this.lastFishingStatus = ""; }
  finishFishingCast() { this.castPending = false; }
  private fishingReadiness() {
    const session = this.snapshot.farm.fishing;
    const now = Date.now();
    const arrival = this.fishingApproach ? this.fishingApproach.startedAt + (this.fishingApproach.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE + FISHING_CAST_DURATION : 0;
    const transition = this.fishTransition;
    return fishingReadiness({ pending: this.castPending, busy: this.commandPending || !session,
      arrivalMs: arrival - now,
      approachMs: transition ? transition.duration - (this.riverElapsed - transition.startedAt) : 0,
      cooldownMs: Math.max(this.nextCastAt - now, session?.lastCastAt != null ? session.lastCastAt + CAST_COOLDOWN_MS - now - this.fishingClockOffset : 0) });
  }
  private publishFishingStatus() {
    const readiness = this.fishingReadiness();
    const label = !this.snapshot.farm.fishing ? "" : readiness.ready && Date.now() < this.invalidFishingClickUntil
      ? "Tap inside the marked water" : readiness.label;
    if (label !== this.lastFishingStatus) { this.lastFishingStatus = label; this.onFishingStatus(label); }
  }
  private tryFishingCast(aim: number) {
    this.invalidFishingClickUntil = 0;
    if (!this.fishingReadiness().ready) { this.publishFishingStatus(); return; }
    const now = Date.now();
    this.castPending = true; this.nextCastAt = now + CAST_COOLDOWN_MS;
    this.cast = { startedAt: now, aim }; this.keyboardAim = aim;
    this.onFishingCast(aim);
  }
  presentFishingApproach(path: readonly IsoCell[]) {
    this.walkPath = []; this.walkProgress = 0;
    this.fishingApproach = { path, startedAt: Date.now() };
  }
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
  presentMillDeliveryLeg(path: readonly IsoCell[], building: IsoCell, carrying: boolean, jars = false, bread = false): number {
    this.walkPath = []; this.walkProgress = 0;
    this.millDeliveryLeg = { path, building, carrying, jars, bread, startedAt: Date.now() };
    return pickupDuration(path);
  }
  finishMillDeliveryLeg() {
    if (!this.millDeliveryLeg) return;
    this.farmerCell = this.millDeliveryLeg.path.at(-1)!;
    this.facingLeft = buildingFacingLeft(this.farmerCell, this.millDeliveryLeg.building, this.facingLeft);
    this.millDeliveryLeg = null;
  }
  setPalmConfirmationTarget(target: IsoCell | null) {
    this.palmConfirmationTarget = target;
    if (this.ready) this.draw();
  }
  clearSelection() { this.farmerIdle?.cancel(); this.selected = null; this.selectedFarmer = false; this.selectedPorter = false; this.selectedMillBags = false; this.selectedBread = false; this.selectedBeer = false; this.reportedAnchor = ""; this.report(null); if (this.ready) this.draw(); }
  walkTo(cell: IsoCell) {
    if (this.marketTrip || this.commandPending || this.plantingSelection !== null || transferBlocker(this.snapshot, Date.now()) || this.walkPath.length) return;
    this.farmerIdle?.cancel();
    this.facingBuilding = null;
    this.walkPath = previewWalkPath(this.snapshot, this.farmerCell, cell, Date.now()); this.walkProgress = 0;
    this.clearSelection();
  }
  goToMarket(): boolean {
    if (this.marketTrip || this.commandPending || this.plantingSelection !== null || this.walkPath.length || !canVisitIsometricMarket(this.snapshot, Date.now())) return false;
    this.farmerIdle?.cancel();
    const path = previewWalkPath(this.snapshot, this.farmerCell, marketEntrance, Date.now());
    if (!path.length && !sameCell(this.farmerCell, marketEntrance)) return false;
    this.facingBuilding = null;
    this.walkPath = path; this.walkProgress = 0; this.marketTrip = true;
    this.clearSelection();
    return true;
  }
  private publishAnchor() {
    if (!this.selected) return;
    if (this.selectedPorter && !this.porterActor?.visible) { this.clearSelection(); return; }
    const p = this.selectedPorter && this.porterActor ? { x: this.porterActor.x, y: this.porterActor.y - 55 } : this.selectedFarmer ? { x: this.actor.x, y: this.actor.y - 55 } : isoPoint(this.selected), camera = this.cameras.main, origin = camera.getWorldPoint(0, 0);
    const x = Math.round((p.x - origin.x) * camera.zoom), y = Math.round((p.y - origin.y) * camera.zoom);
    const kind = this.selectedPorter ? "porter" : this.selectedFarmer ? "farmer" : this.selectedBeer ? "beerJars" : this.selectedBread ? "breadBasket" : this.selectedMillBags ? "millBags" : isMarketTile(this.selected) ? "market" : "tile";
    const walking = this.walkPath.length > 0 || this.idleWalking;
    const key = `${kind}:${fieldKey(this.selected)}:${x}:${y}:${walking}`;
    if (key !== this.reportedAnchor) { this.reportedAnchor = key; this.report({ cell: this.selectedFarmer ? this.farmerCell : this.selected, x, y, kind, walking }); }
  }
  private diamond(g: Phaser.GameObjects.Graphics, cell: IsoCell, colour: number, alpha = 1) {
    const p = isoPoint(cell);
    const points = [new Phaser.Math.Vector2(p.x, p.y - 24), new Phaser.Math.Vector2(p.x + 48, p.y), new Phaser.Math.Vector2(p.x, p.y + 24), new Phaser.Math.Vector2(p.x - 48, p.y)];
    g.fillStyle(colour, alpha).fillPoints(points, true).lineStyle(1, 0xffffff, 0.1).strokePoints(points, true);
  }
  private outlineItem(sprite: Phaser.GameObjects.Image) {
    // Share the approved mill-bag silhouette, colour and four-world-pixel radius.
    // Non-interactive copies sit behind the unchanged artwork and follow its depth.
    for (let step = 0; step < 24; step += 1) {
      const angle = step * Math.PI * 2 / 24;
      this.add.image(sprite.x + Math.cos(angle) * 4, sprite.y + Math.sin(angle) * 4, sprite.texture.key)
        .setOrigin(sprite.originX, sprite.originY).setDisplaySize(sprite.displayWidth, sprite.displayHeight)
        .setTint(0xffdc57).setTintMode(Phaser.TintModes.FILL).setDepth(sprite.depth - 0.1);
    }
  }
  private reconcileRender() {
    if (this.graphicsLost) return;
    const key = farmRenderKey(this.snapshot, Date.now());
    if (key !== this.renderedKey) this.draw();
    else {
      this.renderFarmer(); this.updatePorter(); this.updateDonkey(0);
      this.renderStorageChips(); this.updateMerchantCaravan();
    }
  }
  private draw() {
    if (this.graphicsLost) return;
    const renderStarted = performance.now();
    this.renovations.forEach(r => r.animation.destroy()); this.renovations = [];
    this.breweries.forEach(b => b.animation.destroy()); this.breweries = [];
    this.ovens.forEach(o => o.animation.destroy()); this.ovens = [];
    this.daylightShadows?.destroy();
    this.children.removeAll(true);
    this.roadGhost = undefined; this.roadGhostFootprint = undefined; this.roadGhostKey = "";
    this.roadPlanOverlay = undefined;
    this.roadPlanNumbers = [];
    this.roadPlanObjects = [];
    this.caravan = undefined;
    this.daylightShadows = createShadowLayer(this, config.worldBounds);
    this.millPreviewParts = [];
    this.musicians = [];
    this.mockFootprint = undefined; this.mockBuilding = undefined;
    this.cropImages = [];
    this.buildingImages = [];
    this.mills = [];
    this.storageChips = [];
    this.millOutputSprites = [];
    const now = Date.now(); this.drawnAt = now;
    this.renderedKey = farmRenderKey(this.snapshot, now);
    this.nextRenderCheck = now + 250;
    const snapshot = this.snapshot;
    const canals = presentCanals(snapshot, now);
    const ground = this.add.graphics().setDepth(-1000);
    const details = this.add.graphics().setDepth(-900);
    this.riverWaves = this.add.graphics().setDepth(-940);
    this.fishingOverlay = this.add.graphics().setDepth(9996);
    this.swimmingFish = this.add.image(0, 0, "river-fish")
      .setDisplaySize(RIVER_FISH_WIDTH, RIVER_FISH_HEIGHT).setDepth(-970).setAlpha(RIVER_FISH_ALPHA);
    const bounds = config.worldBounds;
    for (let row: number = bounds.minimumRow; row <= bounds.maximumRow; row++) for (let column: number = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
      const cell = { column, row }, point = isoPoint(cell);
      const road = row === config.roadRow || snapshot.farm.roads.some(r => sameCell(r, cell) && (r.removing ? (r.completesAt ?? 0) > now : (!r.completesAt || r.completesAt <= now)));
      const canal = canals.find(c => sameCell(c, cell));
      this.diamond(ground, cell, isIsometricRiverRow(row) ? 0x46a9b0 : road ? 0xd9ad69 : insidePlot(cell) ? 0x9f6429 : 0xd0b77b);
      if (isIsometricRiverRow(row)) {
        this.add.image(point.x, point.y, "river-water").setOrigin(0.5)
          .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-975);
      }
      if (!isIsometricRiverRow(row) && !road && !canal) {
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
        drawActionProgress(this.add.graphics().setDepth(9997), point.x, point.y - 21, progress);
      }
      if (canal) {
        const complete = Date.parse(canal.completesAt) <= now;
        if (complete) {
          this.add.image(point.x, point.y, `canal-${canalConnectionMask(cell, canals, now)}`).setOrigin(0.5)
            .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-925);
          if (canal.destroyStartedAt && canal.destroyCompletesAt) {
            const start = Date.parse(canal.destroyStartedAt), end = Date.parse(canal.destroyCompletesAt);
            const progress = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
            drawActionProgress(this.add.graphics().setDepth(9997), point.x, point.y - 21, progress);
          }
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
          drawActionProgress(this.add.graphics().setDepth(9997), point.x, point.y - 21, progress);
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
        const sprite = isometricCropSprite(crop, now, snapshot.farm.production.palmCycles?.[crop.id]);
        if (sprite) this.add.image(p.x, p.y, sprite).setOrigin(DATE_PALM_ORIGIN.x, DATE_PALM_ORIGIN.y).setDisplaySize(100, 100).setDepth(p.y)
          .setData("tile", { column: crop.column, row: crop.row }).setInteractive({ pixelPerfect: true });
      }
    }
    for (const object of snapshot.objects) {
      // Keep saved southern decorations intact while previewing the wider water.
      if (isIsometricRiverRow(object.row)) continue;
      const p = isoPoint(object);
      this.daylightShadows.add(() => p, object.type === "rock" ? 34 : 30, object.type === "reeds" ? 40 : 28);
      const variant = Math.abs(object.column + object.row) % 2 === 0 ? "01" : "02";
      const key = object.type === "rock" ? `rocks${variant}` : object.type === "bush" ? `bush${variant}` : "reeds";
      this.add.image(p.x, p.y, key).setOrigin(0.5, object.type === "reeds" ? 120 / 128 : 106 / 128).setDisplaySize(72, 72).setDepth(p.y)
        .setData("tile", { column: object.column, row: object.row }).setInteractive({ pixelPerfect: true });
    }
    const buildingStart = this.children.list.length;
    const front = footprintFront(farmOrigin, 2, 2);
    const appearance = farmAppearance(snapshot.farm.progression?.level);
    this.buildingImages.push(this.add.image(front.x, front.y + 19, appearance.texture).setOrigin(0.5, 1).setDisplaySize(232, 232).setDepth(front.y - 24).setData("tile", farmOrigin).setInteractive({ pixelPerfect: true }));
    this.daylightShadows.addBuilding(this.buildingImages[this.buildingImages.length - 1]!);
    // Anchor on the visible roof, not the transparent top of the source frame.
    const storageSnapshot = this.pickup?.type === "store" ? this.pickup.before : snapshot;
    this.drawStorageChip("farm", front.x, front.y + appearance.storageChipY, storageSnapshot.inventory.find(item => item.itemKey === "barley")?.quantity ?? 0);
    for (const building of snapshot.buildings) {
      const size = FARM_BUILDING_DEFINITIONS[building.type].footprint;
      const shrine = building.type === "smallShrine";
      const p = shrine ? isoPoint(building) : footprintFront(building, size.columns, size.rows);
      const granary = building.type === "granary";
      const displaySize = granary ? 240 : building.type === "warehouse" ? 200 : 150;
      // Inset the granary's rounded decorative base inside its diamond footprint.
      // Retain uniform scale and allow the towers to rise naturally above it.
      if (building.type === "mill") {
        const mill = renderMillAnimation(this, null, building, null);
        this.mills.push({ building, images: mill, progress: this.add.graphics().setDepth(p.y + 10) });
        mill.farmer.setData("farmer", true).setInteractive({ pixelPerfect: true });
        for (const image of [mill.base, mill.bowl, mill.bags, mill.lever]) {
          this.buildingImages.push(image.setAlpha(Date.parse(building.completesAt) > now ? 0.5 : 1)
            .setData("tile", { column: building.column, row: building.row }).setInteractive({ pixelPerfect: true }));
        }
        for (const caster of millShadowCasters(mill)) this.daylightShadows.addBuilding(caster);
        const bags = snapshot.farm.millGoods.pending[building.id];
        const quantity = (bags ? bags.flour + bags.brewersGroats : 0) + porterAwaitingPickup(snapshot.farm.production.porter, building.id, now);
        const outputTile = roadsideOutputPlacement(building, snapshot.farm.roads, now).tile;
        const output = isometricOutputPosition(outputTile);
        this.drawStorageChip(`mill-output:${building.id}`, output.x, output.y - 42, quantity, quantity === 1 ? "bag" : "bags");
        if (quantity > 0) {
          const sprite = this.add.image(output.x, output.y, "mill-output-bags").setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
            // The flour frame has transparent margins; 74px gives roughly the
            // same visible 43×39px size as the tightly cropped idle bags.
            .setDisplaySize(74, 74).setDepth(p.y + 5).setData("tile", outputTile).setData("millBags", true).setInteractive({ pixelPerfect: true });
          this.millOutputSprites.push(sprite);
          this.daylightShadows.add(() => ({ x: sprite.x, y: sprite.y + 12, visible: sprite.visible }), 32, 24);
          if (this.selectedMillBags && this.selected && sameCell(outputTile, this.selected)) this.outlineItem(sprite);
        }
      } else this.buildingImages.push(this.add.image(p.x, p.y + (granary ? -12 : 0), building.type === "brewery" ? breweryVesselTexture(breweryOrientationTexture(building, snapshot.farm.roads, now) === "brewery-right-top", breweryVesselCount(snapshot.inventory)) : building.type).setOrigin(0.5, shrine ? 840 / 1024 : granary ? 1 : 120 / 128)
        .setDisplaySize(displaySize, displaySize).setDepth(p.y - 24)
        .setAlpha(Date.parse(building.completesAt) > now ? 0.5 : 1).setData("tile", { column: building.column, row: building.row }).setInteractive({ pixelPerfect: true }));
      if (building.type !== "mill") this.daylightShadows.addBuilding(this.buildingImages[this.buildingImages.length - 1]!);
      const blessing = snapshot.farm.production.shrineBlessing;
      if (shrine && blessing?.buildingId === building.id && Date.parse(blessing.startedAt) <= now && Date.parse(blessing.expiresAt) > now) {
        // Saved offering is decorative, not a collectable output pile.
        this.add.image(p.x, p.y + 16, blessing.item === "beer" ? "beer" : "baking-8")
          .setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
          .setDisplaySize(64, 64).setDepth(p.y + 1);
      }
      if (building.type === "brewery" && Date.parse(building.completesAt) <= now) {
        const animation = createBrewingTest(this, this.buildingImages[this.buildingImages.length - 1]!, breweryOrientationTexture(building, snapshot.farm.roads, now) === "brewery-right-top", breweryVesselCount(snapshot.inventory));
        this.breweries.push({ id: building.id, animation });
        this.daylightShadows.add(animation.shadowAnchor, 23, 48);
        const placement = breweryOutputPlacement(building);
        const output = isometricOutputPosition(placement.tile);
        const quantity = (snapshot.farm.production.pending[building.id]?.quantity ?? 0) + porterAwaitingPickup(snapshot.farm.production.porter, building.id, now);
        this.drawStorageChip(`beer-output:${building.id}`, output.x, output.y - 35, quantity, "beer");
        if (quantity > 0) {
          const jars = this.add.image(output.x, output.y, "beer").setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
            .setDisplaySize(64, 64).setDepth(p.y + 5).setData("tile", placement.tile).setData("beerJars", true).setInteractive({ pixelPerfect: true });
          this.millOutputSprites.push(jars);
          if (this.selectedBeer && this.selected && sameCell(this.selected, placement.tile)) this.outlineItem(jars);
        }
      }
      if (building.type === "breadOven" && Date.parse(building.completesAt) <= now) {
        const animation = createBakingAnimation(this, this.buildingImages[this.buildingImages.length - 1]!);
        this.ovens.push({ id: building.id, animation });
        this.daylightShadows.add(animation.shadowAnchor, 23, 48);
        const placement = roadsideOutputPlacement(building, snapshot.farm.roads, now);
        const output = isometricOutputPosition(placement.tile);
        const quantity = (snapshot.farm.production.pending[building.id]?.quantity ?? 0) + porterAwaitingPickup(snapshot.farm.production.porter, building.id, now);
        this.drawStorageChip(`bread-output:${building.id}`, output.x, output.y - 35, quantity, "bread");
        if (quantity > 0) {
          const basket = this.add.image(output.x, output.y, "baking-8").setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
            .setDisplaySize(64, 64).setDepth(p.y + 5).setData("tile", placement.tile)
            .setData("breadBasket", true).setInteractive({ pixelPerfect: true });
          this.millOutputSprites.push(basket);
          if (this.selectedBread && this.selected && sameCell(this.selected, placement.tile)) this.outlineItem(basket);
        }
      }
      if (granary && Date.parse(building.completesAt) <= now) {
        this.drawStorageChip(building.id, p.x, p.y - 145, storageSnapshot.buildings.find(b => b.id === building.id)?.storedBarley ?? building.storedBarley);
      }
      if (Date.parse(building.completesAt) > now) {
        const progress = Math.max(0, Math.min(1, (now - Date.parse(building.startedAt)) / (Date.parse(building.completesAt) - Date.parse(building.startedAt))));
        const image = building.type === "mill" ? this.mills.find(mill => mill.building.id === building.id)!.images.base : this.buildingImages[this.buildingImages.length - 1]!;
        drawBuildingProgress(this.add.graphics(), image, progress);
      }
      // Register every completed building, not just currently unlocked upgrade
      // types. Future server-backed tiers automatically use this presentation.
      if (Date.parse(building.completesAt) <= now) {
        const mill = this.mills.find(m => m.building.id === building.id);
        const originals = mill ? Object.values(mill.images) : [this.buildingImages[this.buildingImages.length - 1]!];
        const animation = createBuildingRenovationAnimation(this, p, originals);
        animation.site.setData("tile", { column: building.column, row: building.row }).setInteractive({ pixelPerfect: true });
        this.buildingImages.push(animation.site);
        this.daylightShadows.addBuilding(animation.site);
        this.renovations.push({ id: building.id, animation });
      }
    }
    // Account for the source's transparent bottom margin.
    const marketFront = footprintFront(marketOrigin, 2, 2);
    this.buildingImages.push(this.add.image(marketFront.x, marketFront.y, "market-preview")
      .setOrigin(0.5, 5 / 6).setDisplaySize(232, 232).setDepth(marketFront.y - 24)
      .setData("tile", marketOrigin).setInteractive({ pixelPerfect: true }));
    this.daylightShadows.addBuilding(this.buildingImages[this.buildingImages.length - 1]!);
    const groundItems = transferGroundItems(snapshot.groundItems, this.pickup);
    this.roadPlanObjects = this.children.list.slice(buildingStart);
    this.fadeRoadPlanBuildings();
    this.drawRoadPlan();
    let outlinedGroundItem = false;
    for (const item of groundItems) {
      const p = isoPoint(item);
      const material = item.itemKey === "reed" || item.itemKey === "clay";
      if (material && item.quantity > 0) this.drawStorageChip(`pile:${item.id}`, p.x, p.y - 30, item.quantity, "");
      if (item.itemKey in fallback) {
        this.daylightShadows.add(() => ({ x: p.x, y: p.y + 10 }), 22, 22);
        const sprite = this.add.image(p.x, p.y, item.itemKey)
          .setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y)
          .setDisplaySize(52, 52).setDepth(groundItemDepth(p.y, item.itemKey));
        // Centre the bundle over its own tile, and map clicks on the grains back
        // to that tile rather than projecting the clicked pixel onto a neighbour.
        sprite.setData("tile", { column: item.column, row: item.row }).setInteractive({ pixelPerfect: true });
        if ((material || item.itemKey === "barley") && this.selected && !this.selectedFarmer && !this.selectedMillBags && sameCell(item, this.selected)) {
          this.outlineItem(sprite);
          outlinedGroundItem = true;
        }
      }
      if (item.itemKey !== "barley" && !material) this.add.text(p.x, p.y - 36, `${item.quantity} ${item.itemKey}`, { fontSize: "12px", color: "#352015", backgroundColor: "#fff5df", padding: { x: 5, y: 3 } }).setOrigin(0.5, 1).setDepth(p.y + 2);
    }
    // Presentation position survives snapshot and tile-selection redraws.
    this.donkeyCells = donkeyGround(snapshot, now);
    this.donkeyActor = this.add.image(0, 0, "isometric-donkey")
      .setOrigin(0.5, 120 / 128).setDisplaySize(76, 76).setVisible(false);
    this.updateDonkey(0);
    this.daylightShadows.add(() => this.donkeyActor!, 32, 48);
    this.porterActor = this.add.image(0, 0, "porter-empty-idle").setInteractive({ pixelPerfect: true })
      .setOrigin(0.5, 120 / 128).setDisplaySize(PORTER_DISPLAY_SIZE, PORTER_DISPLAY_SIZE).setVisible(false);
    this.updatePorter();
    this.daylightShadows.add(() => this.porterActor!, 23, 48);
    this.dogState ??= initialDog(snapshot, this.farmerCell, now);
    const dogPoint = isoPoint(this.dogState.position);
    this.dog = this.add.image(dogPoint.x, dogPoint.y, dogTexture(this.dogState))
      .setOrigin(0.5, 108 / 128).setDisplaySize(56, 56)
      .setDepth(dogPoint.y + 2).setFlipX(this.dogState.flip);
    // Retain the existing pose-specific feet anchor, but use the shared shadow renderer.
    this.actorShadow = this.add.ellipse(0, 0, 23, 8, 0x624728, 0).setAlpha(0);
    this.daylightShadows.add(() => this.actorShadow, 23, 48);
    this.daylightShadows.add(() => this.dog, 22, 25);
    for (const mill of this.mills) this.daylightShadows.add(() => {
      const worker = mill.images.farmer;
      const feet = worker.getBottomCenter();
      return { x: feet.x, y: feet.y - 5, visible: worker.visible };
    }, 23, 48);
    for (const mill of this.mills) this.daylightShadows.add(() => {
      const worker = mill.images.donkey, feet = worker.getBottomCenter();
      return { x: feet.x, y: feet.y - 4, visible: worker.visible };
    }, 32, 48);
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
    this.cloudSprites = Array.from({ length: 3 }, () => this.add.image(0, 0, CLOUD_TEXTURES[0]).setDepth(10010));
    this.renderClouds();
    // Redraw destroys the caravan too. Recreate its current pose now, not next
    // update(), so periodic/snapshot redraws never leave a blank rendered frame.
    this.updateMerchantCaravan();
    if (this.selected && !this.selectedPorter && !this.selectedFarmer && !this.selectedMillBags && !this.selectedBread && !this.selectedBeer && !outlinedGroundItem) {
      const highlight = this.add.graphics().setDepth(-800);
      const building = buildingAt(snapshot, this.selected);
      const origin = building ?? (footprintContains(farmOrigin, 2, 2, this.selected) ? farmOrigin
        : isMarketTile(this.selected) ? marketOrigin : null);
      const size = building ? FARM_BUILDING_DEFINITIONS[building.type].footprint : { columns: 2, rows: 2 };
      if (origin) {
        for (let row = 0; row < size.rows; row += 1) {
          for (let column = 0; column < size.columns; column += 1) {
            this.diamond(highlight, { column: origin.column + column, row: origin.row + row }, 0xffdc57, 0.6);
          }
        }
      } else this.diamond(highlight, this.selected, 0xffdc57, 0.6);
    }
    if (this.palmConfirmationTarget) {
      this.diamond(this.add.graphics().setDepth(-800), this.palmConfirmationTarget, 0xffdc57, 0.6);
    }
    renderDiagnostic("scene-rebuild", renderStarted, { objects: this.children.length });
  }
  /** Called only after a successful claim, never by snapshot reconciliation. */
  celebrateLevel(level: number) {
    if (!this.ready || level <= this.lastCelebratedLevel) return;
    this.lastCelebratedLevel = level;
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
  private walkingForAudio = false;
  isBuildingActiveForAudio(key: BuildingAudioKey, now: number): boolean {
    return this.ready && !this.graphicsLost && this.sys.isActive() && this.sys.isVisible() &&
      buildingAudioActive(this.snapshot.farm, key, now);
  }
  isWalkingForAudio(): boolean {
    return this.ready && !this.graphicsLost && this.sys.isActive() && this.sys.isVisible() &&
      this.actor.visible && this.walkingForAudio;
  }


  private renderFarmer() {
    this.walkingForAudio = false;
    this.renderMills();
    this.actor.setVisible(true); this.actorShadow.setVisible(true);
    const cropJob = this.snapshot.farm.production.cropWork;
    if (this.palmProgress?.scene) this.palmProgress.clear();
    if (this.palmHarvestBaskets?.scene) this.palmHarvestBaskets.setVisible(false);
    if (cropJob?.action === "harvest") {
      const target = this.snapshot.crops.find(c => c.id === cropJob.cropId);
      if (target && (!cropJob.settled || this.palmHarvestSeen === cropJob.id)) {
        const now = Date.now(), pose = palmHarvestPose(cropJob, target, now);
        if (pose.phase !== "complete") {
          this.palmHarvestSeen = cropJob.id;
          const p = isoPoint(pose.position), previous = isoPoint(palmHarvestPose(cropJob, target, now - 1).position);
          const working = pose.phase === "harvesting";
          const carrier = palmHarvestCarrier(cropJob, target, now, this.reducedMotion?.matches);
          this.farmerCell = { column: Math.round(pose.position.column), row: Math.round(pose.position.row) };
          this.walkingForAudio = !working;
          const origin = carrier ? FARMER_DATE_ORIGIN : working ? dateHarvestPreviewOrigin() : { x: 0.5, y: 120 / 128 };
          const size = carrier ? FARMER_DATE_DISPLAY_SIZE : working ? 88 : 64;
          this.actor.setTexture(carrier ? carrier.texture : working ? dateHarvestPreviewFrame(pose.elapsed, this.reducedMotion?.matches)
            : farmerTravelTexture((now - cropJob.startedAt) / 4, 0, true))
            .setOrigin(origin.x, origin.y).setDisplaySize(size, size)
            .setPosition(p.x, p.y).setDepth(walkingCharacterDepth(p.y))
            .setFlipX(carrier ? carrier.flipX : working ? false : p.x < previous.x);
          this.actorShadow.setPosition(p.x, p.y).setDepth(p.y);
          this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
          if (working) {
            const tree = isoPoint(target);
            if (!this.palmHarvestBaskets?.scene) this.palmHarvestBaskets = this.add.image(tree.x + 10, tree.y + 11, "dateHarvestBaskets");
            this.palmHarvestBaskets.setPosition(tree.x + 10, tree.y + 11).setOrigin(0.5, 120 / 128)
              .setDisplaySize(32, 32).setDepth(tree.y + 5)
              .setVisible(dateHarvestPreviewBasketsVisible(pose.elapsed, this.reducedMotion?.matches));
            if (!this.palmProgress?.scene) this.palmProgress = this.add.graphics().setDepth(9997);
            drawActionProgress(this.palmProgress, p.x, p.y - 62, pose.percentage / 100);
          }
          return;
        }
        this.farmerCell = cropJob.inbound.at(-1)!;
        this.palmRest = null; this.palmHarvestSeen = null;
      }
    }
    if (cropJob?.action === "plant" || cropJob?.action === "tend") {
      const target = this.snapshot.crops.find(c => c.id === cropJob.cropId);
      if (target && (!cropJob.settled || this.palmPlantingSeen === cropJob.id)) {
        const now = Date.now(), pose = palmPlantingPose(cropJob, target, now);
        this.palmPlantingSeen = cropJob.id;
        if (now < cropJob.completesAt) {
          const p = isoPoint(pose.position), previous = isoPoint(palmPlantingPose(cropJob, target, now - 1).position);
          this.farmerCell = { column: Math.round(pose.position.column), row: Math.round(pose.position.row) };
          this.walkingForAudio = pose.traveling;
          const tending = pose.working && cropJob.action === "tend";
          this.actor.setTexture(tending ? palmTendingTexture(now - cropJob.workStartsAt, this.reducedMotion?.matches)
            : pose.working ? farmerPlantTexture(this.reducedMotion?.matches ? 0 : now - cropJob.workStartsAt)
            : farmerTravelTexture((now - cropJob.startedAt) / 4, 0, pose.traveling))
            .setOrigin(tending ? PALM_TENDING_ORIGIN.x : 0.5, tending ? PALM_TENDING_ORIGIN.y : 120 / 128)
            .setDisplaySize(64, 64).setPosition(p.x, p.y).setDepth(p.y + 1)
            .setFlipX(tending ? false : pose.working ? true : p.x < previous.x);
          this.actorShadow.setPosition(p.x, p.y).setDepth(p.y);
          this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
          if (pose.working) {
            if (!this.palmProgress?.scene) this.palmProgress = this.add.graphics().setDepth(9997);
            drawActionProgress(this.palmProgress, p.x, p.y - 62, pose.percentage / 100);
          }
          return;
        }
        this.farmerCell = { column: target.column, row: target.row };
        this.palmRest = { cell: this.farmerCell, visual: pose.position };
        this.facingLeft = true; this.palmPlantingSeen = null;
      }
    }
    if (this.sweeping) {
      const pose = sweepingPose(this.sweeping.plan, this.sweeping.elapsed), point = isoPoint(pose.position);
      this.farmerCell = { column: Math.round(pose.position.column), row: Math.round(pose.position.row) };
      this.facingLeft = pose.facingLeft;
      const sweeping = pose.type === "sweeping";
      this.walkingForAudio = !sweeping;
      this.actor.setTexture(sweeping ? sweepTexture(pose.elapsed) : farmerTravelTexture(pose.distance, 0, true))
        .setOrigin(sweeping ? sweepOriginX(pose.facingLeft) : 0.5, sweeping ? SWEEP_ORIGIN.y : 120 / 128)
        .setDisplaySize(64, 64).setPosition(point.x, point.y).setDepth(point.y + 1).setFlipX(pose.facingLeft);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
      return;
    }
    if (this.millDeliveryLeg) {
      const leg = this.millDeliveryLeg, pose = pickupPose(leg.path, leg.startedAt, Date.now(), leg.building);
      this.walkingForAudio = pose.walking;
      const point = isoPoint(pose.position);
      this.actor.setOrigin(0.5, 120 / 128).setPosition(point.x, point.y + pose.dip).setDepth(point.y + 1)
        .setTexture(leg.jars || carryingLiquidJars(this.snapshot.farm.carriedItem, leg.carrying ? this.snapshot.farm.production.delivery : null)
          ? farmerJarCarryTexture(pose.distance, pose.walking)
          : leg.carrying && !leg.bread && !this.snapshot.farm.production.delivery ? farmerFlourCarryTexture(pose.distance, pose.walking) : farmerTravelTexture(pose.distance, 0, pose.walking))
        .setDisplaySize(64, 64 - pose.dip).setFlipX(pose.facingLeft);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
      if (pose.done) { this.farmerCell = leg.path.at(-1)!; this.facingLeft = pose.facingLeft; this.millDeliveryLeg = null; }
      if (leg.carrying && (leg.bread || this.snapshot.farm.production.delivery?.itemKey === "bread")) this.renderHeldMaterial("baking-8", 1);
      return;
    }
    const brewing = activeBrewingPreparation(this.snapshot, Date.now());
    const baking = Object.values(this.snapshot.farm.production.baking)[0];
    const bakingTrip = bakingJourneyPose(baking ?? (brewing ? { ...brewing, output: 2, startedAt: brewing.arrivedAt } : undefined), Date.now());
    if (bakingTrip) {
      this.walkingForAudio = bakingTrip.walking;
      this.farmerCell = bakingTrip.position;
      const p = isoPoint(bakingTrip.position);
      this.actor.setOrigin(0.5, 120 / 128).setPosition(p.x, p.y).setDepth(p.y + 1).setFlipX(bakingTrip.facingLeft)
        .setTexture(bakingTrip.carrying ? farmerFlourCarryTexture(bakingTrip.distance, true) : farmerTravelTexture(bakingTrip.distance, 0, true)).setDisplaySize(64, 64);
      this.actorShadow.setPosition(p.x, p.y).setDepth(p.y);
      this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
      return;
    }
    if (baking) {
      this.farmerCell = baking.preparation?.path.at(-1) ?? this.farmerCell;
      if (bakingProgress(baking, Date.now())) {
        const p = isoPoint(this.farmerCell);
        this.actor.setPosition(p.x, p.y).setVisible(false); this.actorShadow.setVisible(false);
        this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
        return;
      }
    }
    if (brewing) {
      this.farmerCell = brewing.preparation.path.at(-1) ?? this.farmerCell;
      const p = isoPoint(this.farmerCell);
      const noVessel = breweryVesselCount(this.snapshot.inventory) === 0;
      this.actor.setPosition(p.x, p.y).setTexture("farmer-idle").setDisplaySize(64, 64).setVisible(noVessel);
      this.actorShadow.setPosition(p.x, p.y).setVisible(noVessel);
      this.heldMaterial.setVisible(false); this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
      return;
    }
    const milling = this.snapshot.farm.milling;
    const journey = millingJourneyPose(this.snapshot, Date.now());
    if (journey) {
      this.walkingForAudio = journey.walking;
      this.millingJourneyId = milling!.startedAt;
      this.farmerCell = milling!.preparation!.path[Math.max(0, Math.min(milling!.preparation!.path.length - 1,
        Math.round((Date.now() - milling!.preparation!.departedAt) / milling!.preparation!.stepDurationMs)))]!;
      const p = isoPoint(journey.position);
      this.actor.setOrigin(0.5, 120 / 128).setPosition(p.x, p.y).setDepth(p.y + 1).setFlipX(journey.facingLeft)
        .setTexture(farmerTravelTexture(journey.distance, journey.carried, true)).setDisplaySize(64, 64);
      this.actorShadow.setPosition(p.x, p.y).setDepth(p.y);
      this.heldMaterial.setVisible(false);
      this.renderCargo(p.x, p.y - 62, journey.carried);
      return;
    }
    if (milling && this.millingJourneyId === milling.startedAt) {
      this.farmerCell = milling.preparation?.path.at(-1) ?? this.farmerCell;
      this.millingJourneyId = null;
    }
    if (milling && milling.worker !== "donkey") {
      const mill = this.mills.find(m => m.building.id === milling.buildingId);
      if (mill && millingProgress(this.snapshot, mill.building.id, Date.now())) {
        const p = isoPoint({ column: mill.building.column + 0.5, row: mill.building.row + 0.5 });
        this.actor.setPosition(p.x + 28, p.y + 12).setVisible(false);
        this.actorShadow.setVisible(false); this.heldMaterial.setVisible(false);
        this.cargo.setVisible(false); this.cargoBackground.setVisible(false);
        return;
      }
      this.farmerCell = milling.preparation?.path.at(-1) ?? this.farmerCell;
    }
    this.actor.setOrigin(0.5, 120 / 128);
    this.heldMaterial.setVisible(false);
    const session = this.snapshot.farm.fishing;
    if (session) {
      const bank = { column: session.column, row: config.riverRow - 1 };
      const pose = this.fishingApproach ? pickupPose(this.fishingApproach.path, this.fishingApproach.startedAt, Date.now()) : null;
      const walking = pose?.walking ?? false;
      this.walkingForAudio = walking;
      const castElapsed = this.cast ? (Date.now() - this.cast.startedAt) * FISHING_CAST_DURATION / CAST_DELAY_MS : this.fishingApproach ? Date.now() - this.fishingApproach.startedAt
        - (this.fishingApproach.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE : null;
      this.farmerCell = walking ? pose!.position : bank;
      // Seat closer to the south edge of the bank without changing the route's
      // logical tile or the agreed sprite anchor. At this scale the feet sit
      // just short of the waterline (16.8px left / 8.4px down from tile centre).
      const point = isoPoint(walking ? this.farmerCell : { ...bank, row: bank.row + 0.35 });
      this.actor.setPosition(point.x, point.y).setDepth(point.y + 4)
        .setTexture(walking ? farmerTravelTexture(pose!.distance, 0, true) : fishingTexture(castElapsed, this.reducedMotion?.matches))
        .setDisplaySize(walking ? 64 : 96, walking ? 64 : 96)
        .setFlipX(walking ? pose!.facingLeft : true);
      // Use the player-approved ground-item anchor for the seated fishing pose.
      if (!walking) this.actor.setOrigin(GROUND_ITEM_ORIGIN.x, GROUND_ITEM_ORIGIN.y);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      this.renderCargo(point.x, point.y - 62, 0);
      return;
    }
    if (this.pickup) {
      const pose = pickupPose(this.pickup.path, this.pickup.startedAt, Date.now(), this.pickup.type === "store" ? this.pickup.building : undefined);
      this.walkingForAudio = pose.walking;
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
        .setTexture(key === "fish" && this.pickup.carried > 0 ? farmerFishCarryTexture(pose.distance, pose.walking)
          : farmerTravelTexture(pose.distance, key === "barley" ? this.pickup.carried : 0, pose.walking)).setDisplaySize(64, 64 - pose.dip)
        .setFlipX(this.facingBuilding && !pose.walking ? this.facingLeft : pose.facingLeft);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      if (key === "reed" || key === "clay") this.renderHeldMaterial(key, this.pickup.carried);
      this.renderCargo(point.x, point.y - 62, this.pickup.carried, key);
      return;
    }
    const now = Date.now();
    const gathering = gatheringPose(this.snapshot, now, this.gatheringApproach);
    if (gathering) {
      this.walkingForAudio = gathering.walking;
      const point = isoPoint(gathering.visualPosition);
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
    const roadApproach = savedRoadApproach(this.snapshot, now);
    if (roadApproach) {
      this.constructionApproach = roadApproach;
      this.walkPath = []; this.walkProgress = 0;
    }
    if (this.constructionApproach) {
      const approach = this.constructionApproach;
      const pose = pickupPose(approach.path, approach.startedAt, now);
      if (pose.walking) {
        this.walkingForAudio = true;
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
      this.walkingForAudio = work.type === "walking";
      const point = isoPoint(work.position);
      this.actor.setPosition(point.x, point.y).setDepth(point.y + 1).setFlipX(work.type === "sowing" ? false : work.facingLeft)
        .setTexture(work.type === "harvesting" ? farmerHarvestTexture(work.elapsed) : work.type === "sowing" ? farmerPlantTexture(work.elapsed) : farmerTravelTexture(work.distance, work.seeds, work.type === "walking")).setDisplaySize(64, 64);
      this.actorShadow.setPosition(point.x, point.y).setDepth(point.y);
      this.renderCargo(point.x, point.y - 62, work.seeds);
      return;
    }
    this.cargo.setVisible(false);
    this.cargoBackground.setVisible(false);
    if (this.reedRestPosition && !sameCell(this.reedRestPosition.cell, this.farmerCell)) this.reedRestPosition = null;
    if (this.palmRest && !sameCell(this.palmRest.cell, this.farmerCell)) this.palmRest = null;
    const restingPosition = this.palmRest?.visual ?? this.reedRestPosition?.visual ?? this.farmerCell;
    const start = isoPoint(this.idlePosition ?? restingPosition), end = isoPoint(this.walkPath[0] ?? this.idlePosition ?? restingPosition);
    const x = start.x + (end.x - start.x) * this.walkProgress;
    const y = start.y + (end.y - start.y) * this.walkProgress;
    const carry = this.snapshot.farm.carriedItem;
    this.walkingForAudio = this.walkPath.length > 0 || this.idleWalking;
    const millDelivery = this.snapshot.farm.millGoods.delivery;
    const carriedBags = millDelivery ? millDelivery.bags.flour + millDelivery.bags.brewersGroats : 0;
    if (this.facingBuilding && !this.walkPath.length) this.facingLeft = buildingFacingLeft(this.farmerCell, this.facingBuilding, this.facingLeft);
    this.actor.setPosition(x, y).setDepth(walkingCharacterDepth(y))
      .setTexture(carryingLiquidJars(carry, this.snapshot.farm.production.delivery) ? farmerJarCarryTexture(this.walkDistance, this.walkPath.length > 0)
        : carriedBags > 0 ? farmerFlourCarryTexture(this.walkDistance, this.walkPath.length > 0)
        : carry?.itemKey === "fish" && carry.quantity > 0 ? farmerFishCarryTexture(this.walkDistance, this.walkPath.length > 0)
        : farmerTravelTexture(this.idleWalking ? this.idleDistance : this.walkDistance, carry?.itemKey === "barley" ? carry.quantity : 0, this.walkPath.length > 0 || this.idleWalking)).setDisplaySize(64, 64)
      .setFlipX(this.facingLeft);
    this.actorShadow.setPosition(x, y).setDepth(y);
    const material = materialCarry(this.snapshot);
    if (material) this.renderHeldMaterial(material.itemKey, material.quantity);
    if (this.snapshot.farm.production.delivery?.itemKey === "bread") this.renderHeldMaterial("baking-8", 1);
    this.renderCargo(x, y - 62, carry?.quantity ?? 0, carry?.itemKey ?? "barley");
  }
  private renderHeldMaterial(key: string, quantity: number) {
    this.heldMaterial.setTexture(key).setPosition(this.actor.x + (this.actor.flipX ? -10 : 10), this.actor.y - 28)
      .setDepth(this.actor.depth + 0.1).setDisplaySize(26, 26).setVisible(quantity > 0);
  }
  private renderCargo(x: number, bottom: number, quantity: number, key = "barley") {
    const label = `${quantity} ${materialLabel(key, quantity)}`;
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
  private drawStorageChip(id: string, x: number, bottom: number, quantity: number, unit = "barley") {
    const state = updateStorageChip(this.storageChipStates.get(id), quantity, Date.now());
    this.storageChipStates.set(id, state);
    if (quantity <= 0) return;
    // World-space, non-interactive labels follow pan/zoom without blocking building clicks.
    // Use each storage's authoritative count, never estate-wide totals.
    const background = this.add.graphics().setPosition(x, bottom).setDepth(9998);
    const text = this.add.text(x, bottom - 5, `${quantity} ${unit}`.trim(), {
      fontFamily: "Georgia, serif", fontSize: "12px", fontStyle: "bold", color: "#513821", resolution: 2,
    }).setOrigin(0.5, 1).setDepth(9999);
    this.drawChipBackground(background, text);
    this.storageChips.push({ state, x, bottom, background, text });
    return { background, text };
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
  private renderMills() {
    for (const { building, images, progress } of this.mills) {
      const state = millingProgress(this.snapshot, building.id, Date.now());
      const bags = this.snapshot.farm.millGoods.pending[building.id];
      const outputOnC = ((bags ? bags.flour + bags.brewersGroats : 0) + porterAwaitingPickup(this.snapshot.farm.production.porter, building.id, Date.now())) > 0 &&
        roadsideOutputPlacement(building, this.snapshot.farm.roads, Date.now()).tile.column === building.column + 1;
      const elapsed = state?.elapsed ?? null;
      renderMillAnimation(this, images, building, elapsed === null ? null : this.reducedMotion?.matches ? 0 : elapsed,
        outputOnC, state?.farmer ?? true);
      progress.clear();
      if (state) {
        drawBuildingProgress(progress, images.base, state.fraction);
      }
    }
  }
  private renderFarmerMarker(delta: number) {
    if (!this.actor.visible) { this.farmerMarker.setVisible(false); return; }
    const hidden = farmerObscured(this.occlusionSprite(this.actor), this.buildingImages.filter(b => b.visible).map(b => this.occlusionSprite(b)));
    const reduced = this.reducedMotion?.matches ?? false;
    const target = hidden ? 1 : 0;
    this.markerAlpha = reduced ? target : this.markerAlpha + Math.sign(target - this.markerAlpha) * Math.min(Math.abs(target - this.markerAlpha), Math.min(delta, 80) / 120);
    this.farmerMarker.setPosition(this.actor.x, this.actor.y - 63 + hiddenFarmerBounce(Date.now(), reduced))
      .setAlpha(this.markerAlpha).setVisible(this.markerAlpha > 0);
  }
  private renderRiverWaves() {
    const roaming = isometricRiverFish(this.fishSeed, this.riverElapsed);
    const session = this.snapshot.farm.fishing;
    const target = session ? fishingAreaFish(session, Date.now() + this.fishingClockOffset - session.startedAt) : roaming;
    const mode = session?.id ?? "roaming";
    if (mode !== this.fishMode) {
      const from = this.fishPosition ?? roaming;
      const a = isoPoint(from), b = isoPoint(target);
      this.fishTransition = { from, startedAt: this.riverElapsed,
        duration: Math.max(2500, Math.hypot(b.x - a.x, b.y - a.y) / 50 * 1000) };
      this.fishMode = mode;
    }
    const transition = this.fishTransition;
    const position = transition ? blendRiverFish(transition.from, target, this.riverElapsed - transition.startedAt, transition.duration) : target;
    const point = isoPoint(position);
    const previous = this.fishPosition;
    if (previous && Math.abs(position.column - previous.column) > 0.0001) this.fishFacingLeft = position.column < previous.column;
    this.swimmingFish.setPosition(point.x, point.y).setRotation(roaming.rotation).setFlipX(this.fishFacingLeft).setVisible(Date.now() >= this.fishRespawnAt);
    this.fishPosition = position;
    const overlay = this.fishingOverlay;
    overlay.clear();
    if (session) {
      const bounds = fishingBounds(session.column);
      const corners = [isoPoint({ column: bounds.left, row: config.riverRow - 0.45 }),
        isoPoint({ column: bounds.left + bounds.width, row: config.riverRow - 0.45 }),
        isoPoint({ column: bounds.left + bounds.width, row: config.riverRow + 1.45 }),
        isoPoint({ column: bounds.left, row: config.riverRow + 1.45 })];
      overlay.lineStyle(2, this.fishingReadiness().ready ? 0x7dda8c : 0xe24b45, 0.85).strokePoints(corners.map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
      const aim = this.cast?.aim ?? this.keyboardAim;
      const hook = isoPoint({ column: bounds.left + aim * bounds.width, row: target.row });
      if (this.cast && Date.now() - this.cast.startedAt < CAST_DELAY_MS + 450) {
        const progress = Math.min(1, (Date.now() - this.cast.startedAt) / CAST_DELAY_MS);
        const x = this.actor.x + (hook.x - this.actor.x) * progress;
        const y = this.actor.y - 25 + (hook.y - this.actor.y + 25) * progress - Math.sin(progress * Math.PI) * 24;
        overlay.lineStyle(1, 0xfff4cf, 0.8).lineBetween(this.actor.x - 22, this.actor.y - 15, x, y);
        overlay.fillStyle(0xffd45a).fillCircle(x, y, 3);
      } else overlay.lineStyle(1, 0xffd45a, 0.6).strokeCircle(hook.x, hook.y, 4);
    }
    const graphics = this.riverWaves;
    graphics.clear();
    for (const row of ISOMETRIC_RIVER_ROWS) for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
      const origin = isoPoint({ column, row });
      for (const ripple of riverRipples(column, this.riverElapsed + (row - config.riverRow) * 1700, this.reducedMotion?.matches)) {
        graphics.lineStyle(2, 0xffffff, ripple.alpha).beginPath();
        ripple.points.forEach((point, index) => {
          if (index === 0) graphics.moveTo(origin.x + point.x, origin.y + point.y);
          else graphics.lineTo(origin.x + point.x, origin.y + point.y);
        });
        graphics.strokePath();
      }
    }
  }
  private sweepEligible(now: number) {
    return isometricIdleEligible(this.snapshot, now) && !this.walkPath.length && !this.marketTrip &&
      !this.pickup && !this.constructionApproach && !this.millDeliveryLeg && !this.commandPending && !this.mockPlacement &&
      this.plantingSelection === null && !this.selected && !this.reducedMotion?.matches;
  }
  private stopSweeping() {
    this.sweepIdleMs = 0;
    this.sweepStopAt = null;
    if (!this.sweeping) return;
    this.sweeping = null;
    this.idlePosition = null; this.idleWalking = false;
    this.facingBuilding = null;
    if (this.ready) this.renderFarmer();
  }
  private renderClouds() {
    const camera = this.cameras.main;
    this.cloudSprites.forEach((sprite, index) => {
      const cloud = this.cloudState.clouds[index];
      sprite.setVisible(!!cloud);
      if (!cloud) return;
      const pose = cloudPose(cloud.progress, camera.width, camera.height, cloud.style);
      const point = camera.getWorldPoint(pose.x, pose.y);
      sprite.setTexture(CLOUD_TEXTURES[cloud.style.shape]!).setPosition(point.x, point.y).setDisplaySize(pose.width / camera.zoom, pose.height / camera.zoom)
        .setAlpha(pose.alpha);
    });
  }
  private updatePorter() {
    if (!this.porterActor) return;
    const pose = porterPose(this.snapshot.farm.production.porter, Date.now(), this.reducedMotion?.matches);
    this.porterActor.setVisible(pose !== null);
    if (pose) {
      const point = isoPoint(pose.position);
      this.porterActor.setPosition(point.x, point.y).setDepth(point.y + 1).setTexture(pose.texture)
        .setDisplaySize(PORTER_DISPLAY_SIZE, PORTER_DISPLAY_SIZE);
      this.porterActor.setFlipX(pose.facingLeft);
    }
  }

  private renderDonkeyPose(pose: NonNullable<ReturnType<typeof donkeyMillingPose>>) {
    const point = isoPoint(pose.position);
    const sprite = donkeyDirectionalPose(pose, this.reducedMotion?.matches);
    this.donkeyActor!.setTexture(sprite.texture)
      .setDisplaySize(76, 76).setPosition(point.x, point.y).setDepth(point.y + 1).setFlipX(sprite.flipX).setAngle(0);
  }

  private updateDonkey(delta: number) {
    if (!this.donkeyActor) return;
    const job = this.snapshot.farm.milling;
    if (job?.worker === "donkey") {
      if (this.donkeyJob?.startedAt !== job.startedAt) {
        const rest = donkeyEscortPath(job)[0];
        if (rest) {
          this.donkeyWander = { position: rest, facingLeft: true, rest: DONKEY_REST_MS, motion: null };
          // Offline completion restores the pickup tile, without replaying the trip.
          try { window.localStorage.setItem(donkeyRestKey(this.snapshot.farm.id), JSON.stringify(rest)); } catch { /* Cosmetic only. */ }
        }
      }
      this.donkeyJob = job;
      const pose = donkeyMillingPose(job, Date.now());
      // Return only once the server has settled the job; never gate settlement.
      const escort = pose?.phase === "waiting" || pose?.phase === "following";
      this.donkeyActor.setVisible(escort);
      if (pose && escort) this.renderDonkeyPose(pose);
      return;
    }
    if (this.donkeyJob) {
      const returning = donkeyMillingPose(this.donkeyJob, Date.now());
      const canReturn = !this.reducedMotion?.matches && document.visibilityState === "visible" &&
        donkeyEscortPath(this.donkeyJob).every(cell => previewWalkable(this.snapshot, cell, Date.now()));
      if (returning?.phase === "returning" && canReturn) {
        this.donkeyActor.setVisible(true);
        this.renderDonkeyPose(returning);
        return;
      }
      this.donkeyJob = null;
    }
    if (!donkeyOwnedAndIdle(this.snapshot)) {
      this.donkeyActor.setVisible(false);
      this.donkeyWander = null;
      return;
    }
    const porter = porterPose(this.snapshot.farm.production.porter, Date.now());
    const occupied = [this.farmerCell, ...(this.dogState ? [this.dogState.position] : []), ...(porter ? [porter.position] : [])]
      .map(p => ({ column: Math.round(p.column), row: Math.round(p.row) }));
    const previous = this.donkeyWander;
    const escapeFootprint = donkeyEscapeFootprint(this.snapshot, previous, Date.now());
    this.donkeyWander = advanceDonkeyWander(previous, { cells: this.donkeyCells, roads: this.snapshot.farm.roads,
      escapeFootprint, noRest: donkeyNoRestTiles(this.snapshot),
      occupied, delta, movingAllowed: (!this.commandPending || escapeFootprint.length > 0 || !!previous?.motion?.escape) &&
        !this.reducedMotion?.matches && document.visibilityState === "visible", random: Math.random() });
    const state = this.donkeyWander;
    this.donkeyActor.setVisible(state !== null);
    if (!state) return;
    const p = isoPoint(state.position);
    const pose = donkeyWanderPose(state, this.reducedMotion?.matches);
    this.donkeyActor.setTexture(pose.texture)
      .setDisplaySize(76, 76).setPosition(p.x, p.y).setDepth(p.y + 1).setFlipX(pose.flipX).setAngle(0);
    if (!state.motion && (!previous || previous.motion || !sameCell(previous.position, state.position))) {
      try { window.localStorage.setItem(donkeyRestKey(this.snapshot.farm.id), JSON.stringify(state.position)); } catch { /* Cosmetic only. */ }
    }
  }

  isHarvestingForAudio(now: number): boolean {
    return this.ready && !this.graphicsLost && this.sys.isActive() && this.sys.isVisible() &&
      isometricHarvestPose(this.snapshot, now)?.type === "harvesting";
  }

  update(_time: number, delta: number) {
    if (!this.ready || this.graphicsLost) return;
    this.updateFieldSelectionCursor();
    this.renovations.forEach(r => r.animation.restore());
    if (!document.hidden && !this.reducedMotion?.matches) this.boatBobElapsed += Math.min(80, Math.max(0, delta));
    this.updateMerchantCaravan();
    const pickupAt = this.snapshot.farm.production.porter?.job?.pickupAt;
    if (pickupAt && this.drawnAt < pickupAt && Date.now() >= pickupAt) this.draw();
    this.updatePorter();
    this.updateDonkey(delta);
    const sweepEligible = this.sweepEligible(Date.now()) && document.visibilityState === "visible";
    if (!sweepEligible) this.stopSweeping();
    else if (this.sweeping) {
      if ((this.sweepStopAt !== null && Date.now() >= this.sweepStopAt) ||
        !SWEEP_TILES.every(cell => previewWalkable(this.snapshot, cell, Date.now()))) this.stopSweeping();
      else this.sweeping.elapsed += Math.min(delta, 80);
    } else {
      this.sweepIdleMs += Math.min(delta, 80);
      if (this.sweepIdleMs >= SWEEP_IDLE_DELAY) {
        const plan = planSweeping(this.snapshot, this.farmerCell, Date.now());
        if (plan) {
          this.farmerIdle?.cancel(); this.idlePosition = null; this.idleWalking = false;
          this.sweeping = { plan, elapsed: 0 };
        } else this.sweepIdleMs = 0;
      }
    }
    if (!this.reducedMotion?.matches && document.visibilityState === "visible") {
      this.cloudState = advanceClouds(this.cloudState, Math.min(delta, 80));
    }
    this.farmerIdle?.update({ now: Date.now(), version: this.snapshot.farm.version,
      eligible: !this.sweeping && isometricIdleEligible(this.snapshot, Date.now()) && !this.walkPath.length && !this.marketTrip &&
        !this.pickup && !this.constructionApproach && !this.commandPending && !this.mockPlacement &&
        this.plantingSelection === null && !this.selected && !this.reducedMotion?.matches,
      visible: document.visibilityState === "visible", position: this.farmerCell,
      world: isometricIdleWorld(this.snapshot, Date.now()) });
    if (this.mockPlacement && !this.mockBuilding) this.drawMockPlacement();
    this.mockBuilding?.setAlpha(this.reducedMotion?.matches ? 0.65 : 0.65 + Math.sin(_time / 220) * 0.12);
    this.millPreviewParts.forEach(image => image.setAlpha(this.mockBuilding?.alpha ?? 0.65));
    // Fishing approach is functional readiness, not decorative motion: it must
    // still finish when reduced motion is enabled.
    if (!this.reducedMotion?.matches || this.snapshot.farm.fishing) this.riverElapsed += Math.min(delta, 80);
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
    if (Date.now() >= this.nextRenderCheck) {
      this.nextRenderCheck = Date.now() + 250;
      this.reconcileRender();
    }
    this.renderFarmer(); this.renderRiverWaves(); this.renderStorageChips();
    this.renderFarmerMarker(delta);
    this.renderClouds();
    this.publishFishingStatus();
    this.renderProcession();
    if (this.dogState) {
      const mouse = this.input.mousePointer;
      const mousePresent = mouse?.event && !this.input.activePointer.wasTouch;
      if (mousePresent) mouse.updateWorldPoint(this.cameras.main);
      // Inverse projection without rounding follows the farmer's actual animated feet.
      const bakingArea = bakingDogArea(this.snapshot, Date.now());
      const farmer = bakingArea?.anchor ?? { column: this.actor.x / ISO_WIDTH + this.actor.y / ISO_HEIGHT,
        row: this.actor.y / ISO_HEIGHT - this.actor.x / ISO_WIDTH };
      const working = !isometricIdleEligible(this.snapshot, Date.now());
      const reserved = bakingArea ? [...bakingArea.reserved] : this.sweeping ? [...SWEEP_TILES] : [];
      if (working && !bakingArea) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          reserved.push({ column: Math.round(farmer.column) + dc, row: Math.round(farmer.row) + dr });
        }
      }
      const porter = porterPose(this.snapshot.farm.production.porter, Date.now());
      const escape = stepDogConstructionEscape(this.dogState, this.snapshot, {
        now: Date.now(), delta, animate: !document.hidden && !this.reducedMotion?.matches,
        occupied: [farmer, ...(this.donkeyWander ? [this.donkeyWander.position] : []), ...(porter ? [porter.position] : [])],
      });
      const wandering = escape ? { dog: escape.dog, state: { idleMs: 0, goal: null, pauseMs: 0 } } : stepWandering(this.dogState, this.dogWandering, this.snapshot, farmer, delta, Date.now(),
        mousePresent ? mouse.worldX : null, reserved,
        !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.dogState = wandering.dog; this.dogWandering = wandering.state;
      this.dog.setVisible(escape?.visible ?? true);
      const point = isoPoint(this.dogState.position);
      this.dog.setPosition(point.x, point.y).setDepth(point.y + 2).setTexture(dogTexture(this.dogState))
        .setDisplaySize(56, 56).setFlipX(this.dogState.flip);
    }
    // Local foreground exception: keep all farmer poses and the dog in front
    // of finished mill bags without raising them globally above crops/buildings.
    for (const actor of [this.actor, this.dog, ...this.mills.flatMap(mill => [mill.images.farmer, mill.images.donkey])]) {
      if (!actor?.visible) continue;
      const bounds = actor.getBounds();
      for (const bags of this.millOutputSprites) {
        const bagBounds = bags.getBounds();
        if (bounds.left < bagBounds.right && bounds.right > bagBounds.left &&
          bounds.top < bagBounds.bottom && bounds.bottom > bagBounds.top) {
          const mill = this.mills.find(mill => mill.images.farmer === actor || mill.images.donkey === actor);
          if (mill) {
            const depths = millWorkerForegroundDepths(actor.depth, mill.images.lever.depth, bags.depth + 1);
            actor.setDepth(depths.farmer);
            mill.images.lever.setDepth(depths.lever);
          } else actor.setDepth(Math.max(actor.depth, bags.depth + 1));
        }
      }
    }
    if (this.heldMaterial?.visible) this.heldMaterial.setDepth(this.actor.depth + 0.1);
    for (const oven of this.ovens) {
      const now = Date.now();
      oven.animation.render(this.snapshot.farm.production.baking[oven.id], now, !!this.reducedMotion?.matches);
    }
    for (const brewery of this.breweries) {
      const job = this.snapshot.farm.production.brewing?.[brewery.id];
      const now = Date.now();
      const active = !!job && now >= Date.parse(job.arrivedAt) && now < Date.parse(job.completesAt);
      brewery.animation.render(active ? now - Date.parse(job.arrivedAt) : null, !!this.reducedMotion?.matches,
        active && now >= Date.parse(job.startedAt) ? (now - Date.parse(job.startedAt)) / (Date.parse(job.completesAt) - Date.parse(job.startedAt)) : undefined);
    }
    for (const renovation of this.renovations) {
      const now = Date.now();
      renovation.animation.render(renovationProgress(this.snapshot.farm.production.buildingUpgrades, renovation.id, now),
        now, !!this.reducedMotion?.matches);
    }
    // Resolve active building artwork first, including immediately after draw()
    // recreates idle sprites. Otherwise shadows flash the idle silhouette for a frame.
    this.fadeRoadPlanBuildings();
    this.daylightShadows.render(this.shadowPreset);
    this.renderRoadGhost();
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
