import { deliveryPlan } from "../../../../game-data/zigguratDelivery";
import { preloadZigguratDonkey } from "../zigguratDonkeyPreview";
import { createZigguratDeliveryAnimation } from "../zigguratDeliveryAnimation";
import Phaser from "phaser";
import type { Ziggurat } from "../../../../schemas/ziggurat";
import { zigguratPresentation } from "../zigguratPresentation";
import { drawBuildingProgress } from "../buildingProgressBar";
import { preloadZigguratPlacement, createZigguratPlacementPreview } from "../zigguratPlacementPreview";
import { farmAppearance } from "../farmEvolution";
import { neighbourhoodPlots, neighbourhoodPlotTiles, neighbourhoodBounds, neighbourhoodRoads, neighbourhoodRoadMask, neighbourhoodScenery, neighbourhoodMarket, neighbourhoodMarketDepth } from "../neighbourhoodLayout";
import { isoPoint, footprintFront, ISO_WIDTH, ISO_HEIGHT } from "../isometricProjection";
import { createShadowLayer } from "../shadowLayer";
import { createAmbientCloudLayer } from "../ambientClouds";
import type { Neighbourhood } from "../../../../schemas/neighbourhood";

/** Read-only composition using already prepared farm artwork. No gameplay commands. */
export class NeighbourhoodScene extends Phaser.Scene {
  onZigguratClick: () => void = () => {};
  private zigguratState: Ziggurat["state"] = { type: "interest" };
  private zigguratProgress?: Phaser.GameObjects.Graphics;
  private displayedZigguratStage: string | null = null;
  private delivery?: ReturnType<typeof createZigguratDeliveryAnimation>;
  private latestZiggurat?: Ziggurat;
  setZigguratState(data: Ziggurat) { this.zigguratState = data.state; this.latestZiggurat=data; this.delivery?.receive(data); }
  previewDelivery(active: boolean) {
    const home=neighbourhoodPlots(this.members).find(p=>p.type==="self");
    this.delivery?.preview(active && home ? home.slot+1 : null);
    if(active && home) {
      const points=deliveryPlan(home.slot+1).legs.flatMap(leg=>leg.route.map(isoPoint));
      const minX=Math.min(...points.map(p=>p.x))-180,maxX=Math.max(...points.map(p=>p.x))+180;
      const minY=Math.min(...points.map(p=>p.y))-180,maxY=Math.max(...points.map(p=>p.y))+120;
      this.cameras.main.setZoom(Math.min(2,this.scale.width/(maxX-minX),this.scale.height/(maxY-minY)))
        .centerOn((minX+maxX)/2,(minY+maxY)/2);
    }
  }
  private baseZoom = 1;
  private ziggurat?: ReturnType<typeof createZigguratPlacementPreview>;
  preload() { preloadZigguratPlacement(this); preloadZigguratDonkey(this); }
  private shadows?: ReturnType<typeof createShadowLayer>;
  private clouds?: ReturnType<typeof createAmbientCloudLayer>;
  private members: Neighbourhood["members"] = [];
  constructor() {
    super("neighbourhood");
  }
  setMembers(members: Neighbourhood["members"]) { this.members = members; }
  clearSelection() { /* Overview has no gameplay selection. */ }
  create() {
    this.cameras.main.setBackgroundColor("#f4e5c7");
    this.drawMap();
    this.focusHome();
    this.events.on("wake", this.redraw, this);
    this.scale.on("resize", this.fit, this);
    let last: { x: number; y: number } | null = null;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { last = { x: p.x, y: p.y }; });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !last) return;
      this.cameras.main.scrollX -= (p.x - last.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (p.y - last.y) / this.cameras.main.zoom;
      last = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", () => { last = null; });
    this.events.once("shutdown", () => {
      this.delivery?.destroy(); this.delivery=undefined;
      this.ziggurat = undefined;
      this.zigguratProgress = undefined;
      this.clouds?.destroy(); this.clouds = undefined;
      this.shadows?.destroy(); this.shadows = undefined;
      this.scale.off("resize", this.fit, this);
      this.events.off("wake", this.redraw, this);
    });
  }
  private redraw() {
    this.delivery?.destroy(); this.delivery=undefined;
    this.ziggurat = undefined;
    this.zigguratProgress = undefined;
    this.clouds?.destroy(); this.shadows?.destroy(); this.children.removeAll(true); this.drawMap(); this.focusHome();
  }
  private focusHome() {
    this.fit();
    const home = neighbourhoodPlots(this.members).find(plot => plot.type === "self");
    if (!home) return;
    // Same initial magnification as the farm, independent of this larger map's extent.
    const zoom = Math.min(this.scale.width / 1580, this.scale.height / 880) * 1.2 ** 2;
    this.cameras.main.setZoom(Math.max(this.baseZoom, zoom)).centerOn(home.x, home.y);
  }
  private drawMap() {
    const plots = neighbourhoodPlots(this.members);
    const farmers=new Map<number,Phaser.GameObjects.Image>();
    const buildings:{sprite:Phaser.GameObjects.Image;column:number;row:number;columns:number;rows:number}[]=[];
    this.shadows = createShadowLayer(this, neighbourhoodBounds);
    const arable = new Set(plots.flatMap(plot => neighbourhoodPlotTiles.filter(t => t.arable)
      .map(t => `${plot.column + t.column}:${plot.row + t.row}`)));
    // As in the farm, back transparent tile edges with terrain-coloured diamonds.
    // Without this layer the pale scene background shows through as white seams.
    const ground = this.add.graphics().setDepth(-1000);
    for (let row = neighbourhoodBounds.minimumRow; row <= neighbourhoodBounds.maximumRow; row++) {
      for (let column = neighbourhoodBounds.minimumColumn; column <= neighbourhoodBounds.maximumColumn; column++) {
        const point = isoPoint({ column, row });
        const road = neighbourhoodRoads.some(p => p.column === column && p.row === row);
        const cultivated = arable.has(`${column}:${row}`);
        ground.fillStyle(road ? 0xd9ad69 : cultivated ? 0x9f6429 : 0xd0b77b, 1).fillPoints([
          new Phaser.Math.Vector2(point.x, point.y - ISO_HEIGHT / 2),
          new Phaser.Math.Vector2(point.x + ISO_WIDTH / 2, point.y),
          new Phaser.Math.Vector2(point.x, point.y + ISO_HEIGHT / 2),
          new Phaser.Math.Vector2(point.x - ISO_WIDTH / 2, point.y),
        ], true);
        const texture = road ? `road-${neighbourhoodRoadMask(column, row)}`
          : cultivated ? "arable-ground" : "non-arable-ground";
        this.add.image(point.x, point.y, texture).setOrigin(0.5)
          .setDisplaySize(ISO_WIDTH, ISO_HEIGHT).setDepth(road ? -950 : -975);
      }
    }
    for (const decoration of neighbourhoodScenery) {
      const point = isoPoint(decoration);
      this.add.image(point.x, point.y, decoration.texture)
        .setOrigin(0.5, 106 / 128).setDisplaySize(72, 72).setDepth(point.y);
    }
    for (const plot of plots) {
      const front = footprintFront({ column: plot.column + 1, row: plot.row + 1 }, 2, 2);
      if (plot.type !== "empty") {
        const building = this.add.image(front.x, front.y + 19, farmAppearance(plot.level!).texture)
          .setOrigin(0.5, 1).setDisplaySize(232, 232).setDepth(front.y - 24);
        this.shadows.addBuilding(building);
        buildings.push({sprite:building,column:plot.column+1,row:plot.row+1,columns:2,rows:2});
        // One shared actor texture now; this slot can later resolve public custom appearances.
        const farmer = this.add.image(front.x + 35, front.y + 16, "farmer-idle")
          .setOrigin(0.5, 120 / 128).setDisplaySize(64, 64).setDepth(front.y + 17);
        this.shadows.add(() => farmer, 23, 48);
        farmers.set(plot.slot+1,farmer);
      }
      const caption = plot.type === "empty" ? `Plot ${plot.slot + 1} · Empty lot`
        : `${plot.name} · Lvl ${plot.level}${plot.type === "self" ? " · You" : ""}`;
      this.add.text(plot.x, front.y + 55, caption, {
        fontFamily: "Georgia, serif", fontSize: "18px",
        color: plot.type === "self" ? "#49652b" : "#513821",
        backgroundColor: plot.type === "self" ? "#e4e7c3" : "#fff7e8",
        padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(2000).setResolution(2);
    }
    const market = footprintFront(neighbourhoodMarket, neighbourhoodMarket.columns, neighbourhoodMarket.rows);
    // Match the farm market: anchor the visible base, not the transparent bottom margin.
    const marketImage = this.add.image(market.x, market.y, "market-preview").setOrigin(0.5, 5 / 6).setDisplaySize(232, 232).setDepth(neighbourhoodMarketDepth);
    this.shadows.addBuilding(marketImage);
    buildings.push({sprite:marketImage,...neighbourhoodMarket});
    this.add.text(market.x, market.y + 30, "Neighbourhood market", {
      fontFamily: "Georgia, serif", fontSize: "26px", color: "#513821",
      backgroundColor: "#fff7e8", padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(2000).setResolution(2);
    this.ziggurat = createZigguratPlacementPreview(this, "site");
    this.displayedZigguratStage = null;
    this.zigguratProgress = this.add.graphics();
    this.ziggurat.building.setInteractive({ pixelPerfect: true, alphaTolerance: 32 })
      .on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.getDistance() < 8) this.onZigguratClick();
      });
    buildings.push({sprite:this.ziggurat.building,column:-5,row:-2,columns:4,rows:4});
    this.delivery=createZigguratDeliveryAnimation(this,farmers,buildings);
    if(this.latestZiggurat) this.delivery.receive(this.latestZiggurat);
    this.clouds = createAmbientCloudLayer(this);
  }
  fit() {
    if (!this.cameras?.main) return;
    this.baseZoom = Math.min(this.scale.width / 2700, this.scale.height / 1450);
    this.cameras.main.setZoom(this.baseZoom).centerOn(-120, 60);
  }
  update(_time: number, delta: number) {
    this.delivery?.update(delta);
    this.shadows?.render("local"); this.clouds?.update(delta);
    if (this.ziggurat && this.zigguratProgress) {
      const presentation = zigguratPresentation(this.zigguratState, Date.now());
      if (this.displayedZigguratStage !== presentation.stage) {
        this.ziggurat.setStage(presentation.stage);
        this.displayedZigguratStage = presentation.stage;
      }
      this.zigguratProgress.clear();
      if (presentation.fraction !== null) drawBuildingProgress(this.zigguratProgress, this.ziggurat.building, presentation.fraction);
    }
  }
  zoomBy(factor: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, this.baseZoom, 2));
  }
}
