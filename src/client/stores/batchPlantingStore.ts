import { createStore } from "zustand/vanilla";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { plantableFields, harvestableFields, plantingSelectionLimit, togglePlantingField } from "../../game-core/farm/batchPlanting";
import { harvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import { farmStore } from "./farmStore";

export const batchPlantingStore = createStore<{
  active: boolean; mode: "plant" | "harvest"; selected: readonly FarmCoordinate[]; origin: FarmCoordinate; retry: number;
  start: (mode?: "plant" | "harvest") => void; cancel: () => void; toggle: (world: FarmCoordinate) => void;
}>()(set => ({
  active: false, mode: "plant", selected: [], origin: { column: 0, row: 0 }, retry: 0,
  start: (mode = "plant") => set({ active: true, mode, selected: [] }),
  cancel: () => set({ active: false, selected: [] }),
  toggle: world => set(state => {
    const farm = farmStore.getState().farm;
    if (!state.active || farm.type !== "ready") return {};
    const target = { column: world.column - state.origin.column, row: world.row - state.origin.row };
    return { selected: togglePlantingField(state.selected, target,
      (state.mode === "harvest" ? harvestableFields : plantableFields)(farm.snapshot, Date.now()),
      state.mode === "harvest" ? harvestFieldLimit(farm.snapshot.farm.household.happiness) : plantingSelectionLimit(farm.snapshot, Date.now())) };
  })
}));
