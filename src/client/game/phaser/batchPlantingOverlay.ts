import type Phaser from "phaser";
import { batchPlantingStore } from "../../stores/batchPlantingStore";
import { farmStore } from "../../stores/farmStore";
import { fieldKey, plantableFields, harvestableFields, availablePlantingBarley } from "../../../game-core/farm/batchPlanting";
import type { FarmCoordinate } from "../../../game-core/farm/irrigation";
import { TILE_SIZE } from "./config";
import { MAX_BATCH_HARVEST_FIELDS } from "../../../game-data/batchPlanting";

export const installBatchPlantingOverlay = (scene: Phaser.Scene, origin: () => FarmCoordinate) => {
  const graphics = scene.add.graphics().setDepth(3.8);
  const draw = () => {
    graphics.clear();
    const offset = origin();
    const state = batchPlantingStore.getState();
    if (state.origin.column !== offset.column || state.origin.row !== offset.row) batchPlantingStore.setState({ origin: offset });
    const farm = farmStore.getState().farm;
    if (farm.type !== "ready") return;
    const batch = farm.snapshot.farm.production.planting;
    if (!state.active && !batch) return;
    const selected = new Set(state.selected.map(fieldKey));
    const selectionLimit = state.mode === "harvest" ? MAX_BATCH_HARVEST_FIELDS : availablePlantingBarley(farm.snapshot, Date.now());
    const limitReached = state.selected.length >= selectionLimit;
    const tiles = batch ? batch.remaining : (state.mode === "harvest" ? harvestableFields : plantableFields)(farm.snapshot, Date.now());
    for (const tile of tiles) {
      const isSelected = !!batch || selected.has(fieldKey(tile));
      const color = isSelected ? 0x42ad62 : limitReached ? 0xda4545 : 0xffd84d;
      const x = (tile.column + offset.column) * TILE_SIZE, y = (tile.row + offset.row) * TILE_SIZE;
      graphics.fillStyle(color, 0.22).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      graphics.lineStyle(2, color, 0.9).strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      for (let d = 12; d < TILE_SIZE * 2; d += 12) {
        graphics.lineBetween(x + Math.max(0, d - TILE_SIZE), y + Math.min(TILE_SIZE, d), x + Math.min(TILE_SIZE, d), y + Math.max(0, d - TILE_SIZE));
      }
      if (isSelected) {
        graphics.lineStyle(4, 0xffffff).lineBetween(x + 18, y + 32, x + 28, y + 42);
        graphics.lineBetween(x + 28, y + 42, x + 47, y + 20);
      }
    }
  };
  const offSelection = batchPlantingStore.subscribe(draw);
  const offFarm = farmStore.subscribe(draw);
  scene.scale.on("resize", draw);
  draw();
  return () => { offSelection(); offFarm(); scene.scale.off("resize", draw); graphics.destroy(); batchPlantingStore.getState().cancel(); };
};
