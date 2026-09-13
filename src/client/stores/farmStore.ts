import { createStore } from "zustand/vanilla";

import type { FarmSnapshot } from "../../schemas/farm";

export type FarmLoadState =
  | { readonly type: "loading" }
  | { readonly type: "ready"; readonly snapshot: FarmSnapshot }
  | { readonly type: "failed"; readonly reason: string };

type State = {
  readonly farm: FarmLoadState;
  readonly setLoading: () => void;
  readonly setReady: (snapshot: FarmSnapshot) => void;
  readonly setFailed: (reason: string) => void;
};

export const farmStore = createStore<State>()(set => ({
  farm: { type: "loading" },

  setLoading: () => {
    set({ farm: { type: "loading" } });
  },

  setReady: snapshot => {
    set({ farm: { type: "ready", snapshot } });
  },

  setFailed: reason => {
    set({ farm: { type: "failed", reason } });
  }
}));
