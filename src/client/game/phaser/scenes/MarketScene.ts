import Phaser from "phaser";
import { spriteName } from "../../../../assets/farmSprites";
import { marketUiStore } from "../../../stores/marketUiStore";
import { farmStore } from "../../../stores/farmStore";
import { canOpenMarketStand, marketStandUnlockLevel } from "../../../../game-data/progression";
import { farmerCommandStore } from "../../../stores/farmerCommandStore";
import { TILE_SIZE } from "../config";
import { marketSceneLayout } from "../marketSceneLayout";
import { installSceneDomIsolation } from "../sceneDomIsolation";

export class MarketScene extends Phaser.Scene {
  constructor() { super("market-scene"); }

  create(): void {
    installSceneDomIsolation(this);
    let farmer: Phaser.GameObjects.Image | null = null;
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
          : carriedItem !== null ? "farmerHarvest3" : "farmerIdle0"
      )).setDisplaySize(TILE_SIZE, TILE_SIZE);
    };
    const draw = () => {
      clearBottomDialog();
      this.children.removeAll(true);
      const zoom = Math.min(1, this.scale.width / (10 * TILE_SIZE));
      const width = this.scale.width / zoom;
      const height = this.scale.height / zoom;
      this.cameras.main.setZoom(zoom).setScroll(0, 0).setOrigin(0, 0);
      const columns = Math.ceil(width / TILE_SIZE);
      const layout = marketSceneLayout(columns);
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
      const returnHome = () => {
        marketUiStore.getState().setLocation("farm");
        const farm = this.scene.get("main-scene");
        farm.events.emit("return-from-market");
        farm.input.enabled = true;
        this.scene.setVisible(true, "main-scene");
        this.scene.stop();
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
        const stand = this.add.image(column * TILE_SIZE, row * TILE_SIZE, spriteName("marketStand"))
          .setOrigin(0).setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
        // The remaining stand is decorative until it receives its own purpose.
        if (index < 2) {
          stand.setInteractive({ useHandCursor: true })
            .on(Phaser.Input.Events.POINTER_UP, () => {
              const scope = index === 0 ? "barley" : "beer";
              const farm = farmStore.getState().farm;
              const level = farm.type === "ready" ? farm.snapshot.farm.progression?.level : 1;
              if (!canOpenMarketStand(scope, level)) {
                showBottomDialog(`${marketLabel} unlocks at level ${marketStandUnlockLevel(scope)}.`);
                return;
              }
              clearBottomDialog();
              marketUiStore.getState().openMarket(scope);
            });
        }
        const marketLabel = ["Barley market", "Beer market"][index];
        if (marketLabel !== undefined) {
          label((column + 1) * TILE_SIZE, row * TILE_SIZE, marketLabel);
        }
      });
      // A scene-local representation of the same farmer; no inventory mutation
      // or second actor simulation. Keep the return-home building unobstructed.
      farmer = this.add.image(
        layout.farmer.column * TILE_SIZE,
        layout.farmer.row * TILE_SIZE,
        spriteName("farmerIdle0")
      ).setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE);
      updateFarmer();
    };
    draw();
    const unsubscribe = farmerCommandStore.subscribe((state, previous) => {
      if (state.carriedItem !== previous.carriedItem) updateFarmer();
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, draw);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearBottomDialog();
      this.scale.off(Phaser.Scale.Events.RESIZE, draw);
      unsubscribe();
      farmer = null;
    });
  }
}
