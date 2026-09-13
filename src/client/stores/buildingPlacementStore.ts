import { createStore } from "zustand/vanilla";

import type { FarmBuildingType } from "../../game-data/buildings";

export type BuildingPlacementState =
  | { readonly type: "idle" }
  | { readonly type: "placing"; readonly building: FarmBuildingType }
  | { readonly type: "submitting"; readonly building: FarmBuildingType };

type State = {
  readonly placement: BuildingPlacementState;
  readonly startPlacement: (building: FarmBuildingType) => void;
  readonly setSubmitting: (building: FarmBuildingType) => void;
  readonly cancelPlacement: () => void;
};

export const buildingPlacementStore = createStore<State>()(set => ({
  placement: { type: "idle" },

  startPlacement: building => {
    set({ placement: { type: "placing", building } });
  },

  setSubmitting: building => {
    set({ placement: { type: "submitting", building } });
  },

  cancelPlacement: () => {
    set({ placement: { type: "idle" } });
  }
}));
