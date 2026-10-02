import Phaser from "phaser";
import { spriteName } from "../../../../assets/farmSprites";
import { MARKET_TITLES, marketUiStore, type MarketScope } from "../../../stores/marketUiStore";
import type { RoadCoordinate } from "../../../../game-core/farm/roads";
import { farmStore } from "../../../stores/farmStore";
import { canOpenMarketStand, marketStandUnlockLevel } from "../../../../game-data/progression";
import { farmerCommandStore } from "../../../stores/farmerCommandStore";
import { TILE_SIZE } from "../config";
import { marketSceneLayout, marketSceneZoom, marketStandStop, marketWalkingPath } from "../marketSceneLayout";
import { installSceneDomIsolation } from "../sceneDomIsolation";
import { createDonkey } from "../donkey";

export class MarketScene extends Phaser.Scene {
  constructor() { super("market-scene"); }

  create(): void {
    installSceneDomIsolation(this);
    let farmer: Phaser.GameObjects.Image | null = null;
    let returningHome = false;
    let movement: Phaser.Tweens.Tween | null = null;
    let destination: MarketScope | "farm" | null = null;
    let farmerTile: RoadCoordinate | null = null;
    let previousLeft: number | null = null;
    let walking = false;
    let donkey: ReturnType<typeof createDonkey> | null = null;
    let donkeyFollowing = false;
    const syncDonkey = () => {
      if (!donkeyFollowing || !farmer || donkey) return;
      donkey = createDonkey(this);
      donkey.image.setPosition(farmer.x + TILE_SIZE, farmer.y).setVisible(true);
    };
    const scopes = ["barley", "beer", "bread"] as const;
    let bottomDialog: Phaser.GameObjects.DOMElement | null = null;
    let bottomDialogTimer: Phaser.Time.TimerEvent | null = null;
    const clearBottomDialog = () => {
      bottomDialogTimer?.remove(false);
      bottomDialogTimer = null;
      bottomDialog?.destroy();
      bottomDialog = null;
    };
    const showBottomDialog = (message: string) => {
      clearBottomDialog();
      const element = document.createElement("div");
      element.className = "dialog-bottom-container nes-container is-centered is-rounded";
      element.textContent = message;
      element.setAttribute("role", "status");
      element.style.maxWidth = `${Math.max(0, Math.min(560, this.scale.width - 32))}px`;
      const zoom = this.cameras.main.zoom;
      const dialog = this.add.dom(this.scale.width / (2 * zoom), this.scale.height * 0.96 / zoom, element)
        .setOrigin(0.5, 1).setScrollFactor(0).setScale(1 / zoom);
      dialog.updateSize();
      bottomDialog = dialog;
      void document.fonts.ready.then(() => {
        if (bottomDialog === dialog) dialog.updateSize();
      });
      bottomDialogTimer = this.time.delayedCall(2_000, clearBottomDialog);
    };
    const updateFarmer = () => {
      const carriedItem = farmerCommandStore.getState().carriedItem;
      farmer?.setTexture(spriteName(
        carriedItem?.itemKey === "fish" ? "farmerWithFish"
          : carriedItem !== null ? "farmerHarvest3" : walking
            ? (["farmerWalk0", "farmerWalk1", "farmerWalk2", "farmerWalk3"] as const)[Math.floor(this.time.now / 100) % 4]!
            : "farmerIdle0"
      )).setDisplaySize(TILE_SIZE, TILE_SIZE);
    };
    const draw = () => {
      donkey?.destroy();
      donkey = null;
      movement?.stop();
      movement = null;
      walking = false;
      clearBottomDialog();
      this.children.removeAll(true);
      const zoom = marketSceneZoom(this.scale.width, this.scale.height, TILE_SIZE);
      const width = this.scale.width / zoom;
      const height = this.scale.height / zoom;
      this.cameras.main.setZoom(zoom).setScroll(0, 0).setOrigin(0, 0);
      const columns = Math.ceil(width / TILE_SIZE);
      const layout = marketSceneLayout(columns);
      // Preserve the last reached road tile when the responsive layout moves.
      farmerTile = farmerTile === null ? layout.farmer : {
        column: previousLeft !== null && farmerTile.column >= previousLeft
          ? farmerTile.column + layout.left - previousLeft
          : Math.min(farmerTile.column, layout.left),
        row: farmerTile.row
      };
      previousLeft = layout.left;
      const tile = (column: number, row: number, name: "ground" | "groundPathHorizontal", angle = 0) =>
        this.add.image((column + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, spriteName(name))
          .setDisplaySize(TILE_SIZE, TILE_SIZE).setAngle(angle);
      for (let row = 0; row < Math.ceil(height / TILE_SIZE); row++) {
        for (let column = 0; column < columns; column++) tile(column, row, "ground");
      }
      for (let column = 0; column < columns; column++) {
        if (column < layout.left || column > layout.right) tile(column, layout.roadRow, "groundPathHorizontal");
      }
      for (let column = layout.left + 1; column < layout.right; column++) {
        tile(column, layout.top, "groundPathHorizontal");
        tile(column, layout.bottom, "groundPathHorizontal");
      }
      for (let row = layout.top + 1; row < layout.bottom; row++) {
        tile(layout.left, row, "groundPathHorizontal", 90);
        tile(layout.right, row, "groundPathHorizontal", 90);
      }
      // Compose bends from the same central road strip used at intersections.
      // Each arm extends through the center square so the two crops overlap.
      // Cropping retains the original image origin; rotation turns the east arm
      // south (90), west (180), or north (270) around the tile center.
      const corner = (column: number, row: number, angles: readonly number[]) => {
        angles.forEach((angle) => {
          const arm = tile(column, row, "groundPathHorizontal", angle);
          arm.setCrop(arm.width * 0.35, arm.height * 0.35, arm.width * 0.65, arm.height * 0.3);
        });
      };
      corner(layout.left, layout.top, [0, 90]);
      corner(layout.right, layout.top, [180, 90]);
      corner(layout.left, layout.bottom, [0, 270]);
      corner(layout.right, layout.bottom, [180, 270]);
      // Horizontal half-tiles join the incoming road to the vertical loop.
      for (const [column, side] of [[layout.left, 0], [layout.right, 1]] as const) {
        const junction = tile(column, layout.roadRow, "groundPathHorizontal");
        junction.setCrop(side * junction.width / 2, junction.height * 0.35, junction.width / 2, junction.height * 0.3);
      }
      const walkToDestination = (): void => {
        if (!farmer || !farmerTile || !destination || movement) return;
        const target = destination === "farm"
          ? { column: layout.farm.column, row: layout.roadRow }
          : marketStandStop(columns, scopes.indexOf(destination));
        const path = marketWalkingPath(columns, farmerTile, target);
        if (!path) {
          destination = null;
          returningHome = false;
          walking = false;
          updateFarmer();
          showBottomDialog("There is no road to this stand.");
          return;
        }
        const next = path[1];
        if (next) {
          walking = true;
          donkey?.move({ x: farmer.x, y: farmer.y }, 180);
          if (next.column !== farmerTile.column) farmer.setFlipX(next.column < farmerTile.column);
          updateFarmer();
          movement = this.tweens.add({
            targets: farmer, x: (next.column + 0.5) * TILE_SIZE, y: (next.row + 0.5) * TILE_SIZE,
            duration: 180, ease: "Linear", onUpdate: updateFarmer,
            onComplete: () => {
              movement = null;
              farmerTile = next;
              walkToDestination();
            }
          });
          return;
        }
        const arrivedAt = destination;
        destination = null;
        walking = false;
        updateFarmer();
        clearBottomDialog();
        if (arrivedAt === "farm") {
          marketUiStore.getState().setLocation("farm");
          const farm = this.scene.get("main-scene");
          farm.events.emit("return-from-market");
          farm.input.enabled = true;
          this.scene.setVisible(true, "main-scene");
          this.scene.stop();
        } else {
          const stand = layout.stands[scopes.indexOf(arrivedAt)]!;
          farmer.setFlipX(stand.column + 1 < farmerTile.column + 0.5);
          const farm = farmStore.getState().farm;
          const level = farm.type === "ready" ? farm.snapshot.farm.progression?.level : 1;
          if (canOpenMarketStand(arrivedAt, level)) marketUiStore.getState().openMarket(arrivedAt);
        }
      };
      const returnHome = () => {
        if (returningHome || !farmer) return;
        returningHome = true;
        destination = "farm";
        showBottomDialog("Going back to the farm...");
        walkToDestination();
      };
      this.add.image(0, layout.farm.row * TILE_SIZE, spriteName("farm"))
        .setOrigin(0).setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
        .setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP,
          (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            returnHome();
          });
      const label = (x: number, y: number, text: string) => this.add.text(x, y, text, {
        fontFamily: "Bree Serif, Georgia, serif", fontSize: "14px", color: "#352116",
        backgroundColor: "#fff6e6", padding: { x: 6, y: 3 }
      }).setOrigin(0.5, 1);
      label(TILE_SIZE, layout.farm.row * TILE_SIZE, "Return to farm");
      layout.stands.forEach(({ column, row }, index) => {
        const definition = ([
          { scope: "barley", sprite: "marketStand" },
          { scope: "beer", sprite: "marketBeerStand" },
          { scope: "bread", sprite: "marketBreadStand" }
        ] as const)[index];
        if (!definition) return;
        const { scope, sprite } = definition;
        const marketLabel = MARKET_TITLES[scope];
        const stand = this.add.image(column * TILE_SIZE, row * TILE_SIZE, spriteName(sprite))
          .setOrigin(0).setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
        stand.setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_UP, () => {
            if (returningHome) return;
            const farm = farmStore.getState().farm;
            const level = farm.type === "ready" ? farm.snapshot.farm.progression?.level : 1;
            if (!canOpenMarketStand(scope, level)) {
              showBottomDialog(`${marketLabel} unlocks at level ${marketStandUnlockLevel(scope)}.`);
              return;
            }
            destination = scope;
            showBottomDialog(`Walking to the ${marketLabel.toLowerCase()}...`);
            walkToDestination();
          });
        label((column + 1) * TILE_SIZE, row * TILE_SIZE, marketLabel);
      });
      // A scene-local representation of the same farmer; no inventory mutation
      // or second actor simulation. Keep the return-home building unobstructed.
      farmer = this.add.image(
        (farmerTile.column + 0.5) * TILE_SIZE,
        (farmerTile.row + 0.5) * TILE_SIZE,
        spriteName("farmerIdle0")
      ).setOrigin(0.5, 1).setDisplaySize(TILE_SIZE, TILE_SIZE);
      updateFarmer();
      syncDonkey();
      walkToDestination();
    };
    draw();
    const unsubscribe = farmerCommandStore.subscribe((state, previous) => {
      if (state.carriedItem !== previous.carriedItem) updateFarmer();
    });
    const unsubscribeFarm = farmStore.subscribe((state, previous) => {
      const owns = state.farm.type === "ready" && state.farm.snapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0);
      const owned = previous.farm.type === "ready" && previous.farm.snapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0);
      if (owns && !owned) { donkeyFollowing = true; syncDonkey(); }
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, draw);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      movement?.stop();
      movement = null;
      destination = null;
      this.input.enabled = true;
      clearBottomDialog();
      this.scale.off(Phaser.Scale.Events.RESIZE, draw);
      unsubscribe();
      unsubscribeFarm();
      donkey?.destroy();
      donkey = null;
      farmer = null;
    });
  }
}
