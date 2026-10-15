import Phaser from "phaser";
import { createShadowLayer } from "../shadowLayer";
import type { ShadowPreset } from "../daylightShadows";
import { INITIAL_FARM_CONFIG as config } from "../../../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../../game-data/movement";
import { farmerTravelTexture } from "../farmerCarry";
import { farmAppearance } from "../farmEvolution";
import { isoPoint, isoCell, footprintFront, footprintContains, ISO_WIDTH, ISO_HEIGHT } from "../isometricProjection";
import { marketReturnOrigin, marketReturnEntrance } from "../isometricMarket";
import type { IsometricTileAnchor } from "./IsometricFarmScene";
import barleyStandUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/market-barley-isometric.png";
import beerStandUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/market-beer-isometric.png";
import bakingStandUrl from "../../../../assets/sprite_assets/pngs/v2/isometric-test/market-baking-isometric.png";
import { prepareBuildingTexture } from "../buildingTexture";
import { isMarketRoad, marketLastRow, marketRoadMask, marketRoadPath } from "../isometricMarketLayout";
import type { IsoCell } from "../isometricProjection";
import { advanceMerchantFacing, initialMerchantFacing, type MerchantFacing } from "../merchantFacing";
import { advanceGreeting, greetingAppearance, initialGreetingState, merchantGreetings } from "../merchantGreeting";
import { marketUiStore } from "../../../stores/marketUiStore";

export const stands = [
  { scope: "barley", kind: "barleyMarket", url: barleyStandUrl, origin: { column: 2, row: 2 }, merchant: { column: 3, row: 4.5 } },
  { scope: "beer", kind: "beerMarket", url: beerStandUrl, origin: { column: 5, row: 2 }, merchant: { column: 6, row: 4.5 } },
  { scope: "baking", kind: "bakingMarket", url: bakingStandUrl, origin: { column: 2, row: 8 }, merchant: { column: 3, row: 10.5 } },
] as const;

/** Market presentation trial. Farmer and terrain textures are shared with the farm. */
export class IsometricMarketScene extends Phaser.Scene {
  private ready = false;
  private baseZoom = 1;
  private selected: "farmReturn" | typeof stands[number]["kind"] | null = null;
  private reportedAnchor = "";
  private position: IsoCell = { column: 0, row: config.roadRow };
  private path: readonly IsoCell[] = [];
  private distance = 0;
  private returning = false;
  private approaching: typeof stands[number] | null = null;
  private actor!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  shadowPreset: ShadowPreset = "local";
  private daylightShadows!: ReturnType<typeof createShadowLayer>;
  private returnFarm!: Phaser.GameObjects.Image;
  private readonly farmLevel: () => number;
  private merchants: { sprite: Phaser.GameObjects.Image; cell: IsoCell; facing: MerchantFacing }[] = [];
  private greeting = initialGreetingState();
  private speech?: Phaser.GameObjects.Container;
  private speechText?: Phaser.GameObjects.Text;
  private speechBackground?: Phaser.GameObjects.Graphics;
  private reducedMotion = false;
  private readonly report: (anchor: IsometricTileAnchor | null) => void;
  private readonly returned: () => void;

  constructor(report: (anchor: IsometricTileAnchor | null) => void, returned: () => void, farmLevel: () => number = () => 1) {
    super("isometric-market");
    this.report = report; this.returned = returned; this.farmLevel = farmLevel;
  }
  preload() {
    stands.forEach(stand => this.load.image(`source-market-${stand.scope}`, stand.url));
  }
  create() {
    this.merchants = [];
    this.greeting = initialGreetingState();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const stand of stands) if (!this.textures.exists(`market-${stand.scope}`)) {
      this.textures.addCanvas(`market-${stand.scope}`, prepareBuildingTexture(this.textures.get(`source-market-${stand.scope}`).getSourceImage() as HTMLImageElement))
        ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (let row = 0; row <= marketLastRow; row++) for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
      const p = isoPoint({ column, row });
      this.add.image(p.x, p.y, isMarketRoad({ column, row }) ? `road-${marketRoadMask({ column, row })}` : "non-arable-ground")
        .setOrigin(0.5).setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(-1000);
    }
    const front = footprintFront(marketReturnOrigin, 2, 2);
    this.returnFarm = this.add.image(front.x, front.y + 19, farmAppearance(this.farmLevel()).texture).setOrigin(0.5, 1).setDisplaySize(232, 232)
      .setDepth(front.y - 24).setData("returnFarm", true).setInteractive({ pixelPerfect: true });
    this.daylightShadows = createShadowLayer(this, { ...config.worldBounds, minimumRow: 0, maximumRow: marketLastRow });
    this.daylightShadows.addBuilding(this.returnFarm);
    stands.forEach(stand => this.drawStand(stand));
    this.shadow = this.add.ellipse(0, 0, 23, 8, 0x624728, 0).setAlpha(0);
    this.daylightShadows.add(() => this.shadow, 23, 48);
    this.actor = this.add.image(0, 0, "farmer-idle").setOrigin(0.5, 120 / 128).setDisplaySize(64, 64);
    this.speechBackground = this.add.graphics();
    this.speechText = this.add.text(0, 0, "", { fontFamily: "Georgia, serif", fontSize: "18px",
      fontStyle: "bold", color: "#382519", align: "center", wordWrap: { width: 220 } })
      .setOrigin(0.5).setResolution(2);
    this.speech = this.add.container(0, 0, [this.speechBackground, this.speechText])
      .setDepth(10000).setName("merchant-speech-bubble").setVisible(false);
    this.ready = true; this.fit(); this.zoomBy(1.2 ** 2); this.renderFarmer(false);
    let last: { x: number; y: number } | null = null, dragged = false;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { last = { x: p.x, y: p.y }; dragged = false; });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !last || (!dragged && p.getDistance() < 6)) return;
      dragged = true;
      this.cameras.main.scrollX -= (p.x - last.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (p.y - last.y) / this.cameras.main.zoom;
      last = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      last = null;
      if (dragged || this.returning) return;
      const world = this.cameras.main.getWorldPoint(p.x, p.y), cell = isoCell(world.x, world.y);
      this.clearSelection();
      const stand = stands.find(s => objects.some(o => o.getData("marketScope") === s.scope));
      if (stand) this.approachMerchant(stand);
      else if (objects.some(o => o.getData("returnFarm")) || footprintContains(marketReturnOrigin, 2, 2, cell)) this.selected = "farmReturn";
      else if (isMarketRoad(cell)) this.walkTo(cell);
      this.publishAnchor();
    });
    this.scale.on("resize", this.fit, this);
    this.events.on("wake", () => {
      this.returnFarm.setTexture(farmAppearance(this.farmLevel()).texture).setDisplaySize(232, 232);
      this.greeting = initialGreetingState(); this.speech?.setVisible(false);
      this.position = { column: 0, row: config.roadRow }; this.path = []; this.returning = false;
      this.merchants.forEach(merchant => { merchant.facing = { ...merchant.facing, waitingMs: 0 }; });
      this.clearSelection(); this.renderFarmer(false);
    });
    this.events.on("sleep", () => { this.approaching = null; this.speech?.setVisible(false); });
    this.events.once("shutdown", () => {
      this.ready = false; this.approaching = null; this.merchants = []; this.speech = undefined;
      this.speechText = undefined; this.speechBackground = undefined;
      this.scale.off("resize", this.fit, this);
    });
  }
  private drawStand(stand: typeof stands[number]) {
    const front = footprintFront(stand.origin, 2, 2);
    const size = 232, depth = front.y - 24;
    const merchant = isoPoint(stand.merchant);
    // Keep the stationary merchant fully visible in front, just off the walking road.
    this.daylightShadows.add(() => merchant, 23, 48);
    const sprite = this.add.image(merchant.x, merchant.y, "farmer-idle")
      .setOrigin(0.5, 120 / 128).setDisplaySize(64, 64).setFlipX(true).setDepth(merchant.y + 1)
      .setName(`${stand.scope}-merchant-preview`).setData("marketScope", stand.scope).setInteractive({ pixelPerfect: true, useHandCursor: true });
    this.merchants.push({ sprite, cell: stand.merchant, facing: initialMerchantFacing() });
    const building = this.add.image(front.x, front.y, `market-${stand.scope}`).setOrigin(0.5, 0.9).setDisplaySize(size, size)
      .setDepth(depth).setName(`${stand.scope}-stand-preview`).setData("marketScope", stand.scope).setInteractive({ pixelPerfect: true, useHandCursor: true });
    this.daylightShadows.addBuilding(building);
  }
  clearSelection() { this.approaching = null; this.selected = null; this.reportedAnchor = ""; this.report(null); }
  private merchantEntrance(stand: typeof stands[number]): IsoCell {
    return { column: stand.merchant.column, row: Math.ceil(stand.merchant.row) };
  }
  private approachMerchant(stand: typeof stands[number]) {
    this.clearSelection();
    this.walkTo(this.merchantEntrance(stand));
    this.approaching = stand;
  }
  private walkTo(target: IsoCell) {
    this.approaching = null;
    // Finish the current step before rerouting: never snap to a rounded tile.
    const next = this.path[0];
    this.path = next ? [next, ...marketRoadPath(next, target)] : marketRoadPath(this.position, target);
  }
  goBackToFarm() { this.clearSelection(); this.returning = true; this.walkTo(marketReturnEntrance); }
  private publishAnchor() {
    if (!this.selected) return;
    const stand = stands.find(s => s.kind === this.selected);
    const cell = stand?.merchant ?? marketReturnOrigin;
    const merchant = isoPoint(cell);
    const p = stand ? { x: merchant.x, y: merchant.y - 56 } : footprintFront(marketReturnOrigin, 2, 2);
    const camera = this.cameras.main, origin = camera.getWorldPoint(0, 0);
    const x = Math.round((p.x - origin.x) * camera.zoom), y = Math.round((p.y - origin.y) * camera.zoom);
    const key = `${this.selected}:${x}:${y}`;
    if (key !== this.reportedAnchor) { this.reportedAnchor = key; this.report({ cell, x, y, kind: this.selected }); }
  }
  private renderFarmer(walking: boolean) {
    const p = isoPoint(this.position);
    this.actor.setPosition(p.x, p.y).setDepth(p.y + 1).setTexture(farmerTravelTexture(this.distance, 0, walking)).setDisplaySize(64, 64);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y);
  }
  private renderGreeting(now: number) {
    if (!this.speech || !this.speechText || !this.speechBackground) return;
    this.greeting = advanceGreeting(this.greeting, stands, this.position, now,
      this.returning || this.selected !== null || marketUiStore.getState().isOpen);
    const active = this.greeting.active;
    this.speech.setVisible(active !== null);
    if (!active) return;
    const text = merchantGreetings[active.merchant];
    if (this.speechText.text !== text) {
      this.speechText.setText(text);
      const width = this.speechText.width + 28, height = this.speechText.height + 22;
      this.speechText.setPosition(0, -12 - height / 2);
      const g = this.speechBackground.clear();
      g.fillStyle(0x382519, 0.16).fillRoundedRect(-width / 2 + 2, -height - 9, width, height, 14);
      g.fillStyle(0xfff7e8).lineStyle(2, 0x9b7545);
      g.fillRoundedRect(-width / 2, -height - 12, width, height, 14);
      g.strokeRoundedRect(-width / 2, -height - 12, width, height, 14);
      g.fillTriangle(-9, -13, 9, -13, 0, 0);
      g.lineBetween(-9, -12, 0, 0); g.lineBetween(0, 0, 9, -12);
    }
    const merchant = stands.find(stand => stand.scope === active.merchant)!;
    const p = isoPoint(merchant.merchant);
    const appearance = greetingAppearance(now - active.startedAt, this.reducedMotion);
    this.speech.setPosition(p.x, p.y - 62).setScale(appearance.scale).setAlpha(appearance.alpha);
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    let budget = Math.min(delta, 80) / WORKER_MOVE_DURATION_PER_TILE;
    while (budget > 0 && this.path[0]) {
      const next = this.path[0], dc = next.column - this.position.column, dr = next.row - this.position.row;
      const remaining = Math.abs(dc) + Math.abs(dr), step = Math.min(remaining, budget);
      this.actor.setFlipX(dc - dr < 0);
      this.position = remaining <= budget ? next : { column: this.position.column + dc * step / remaining, row: this.position.row + dr * step / remaining };
      this.distance += step * Math.hypot(ISO_WIDTH / 2, ISO_HEIGHT / 2);
      budget -= step;
      if (step === remaining) this.path = this.path.slice(1);
    }
    // Stop and face the merchant before React receives the selection/open event.
    const approached = this.approaching;
    if (approached && this.path.length === 0) {
      const entrance = this.merchantEntrance(approached);
      this.approaching = null;
      if (this.position.column === entrance.column && this.position.row === entrance.row) {
        this.actor.setFlipX(isoPoint(approached.merchant).x < isoPoint(this.position).x);
        this.selected = approached.kind;
      }
    }
    this.renderFarmer(this.path.length > 0); this.publishAnchor();
    this.daylightShadows.render(this.shadowPreset);
    this.renderGreeting(Date.now());
    for (const merchant of this.merchants) {
      const facing = advanceMerchantFacing(merchant.facing, merchant.cell, this.position, delta);
      if (facing.flipX !== merchant.facing.flipX) merchant.sprite.setFlipX(facing.flipX);
      merchant.facing = facing;
    }
    if (this.returning && this.path.length === 0 && this.position.column === marketReturnEntrance.column && this.position.row === marketReturnEntrance.row) {
      this.returning = false; this.returned(); this.scene.switch("isometric-farm");
    }
  }
  fit() {
    if (!this.ready) return;
    this.baseZoom = Math.min(this.scale.width / 1580, this.scale.height / 940);
    this.cameras.main.setZoom(this.baseZoom).centerOn(-144, 195);
  }
  zoomBy(factor: number) {
    if (this.ready) this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, this.baseZoom, Math.max(2, this.baseZoom)));
  }
}
