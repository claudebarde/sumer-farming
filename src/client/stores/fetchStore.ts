import { createStore } from "zustand/vanilla";

export type FetchPhase = "idle" | "menu" | "starting" | "running" | "flying" | "chasing" | "result";
export const fetchStore = createStore<{
  readonly phase: FetchPhase;
  readonly message: string;
  readonly set: (phase: FetchPhase, message?: string) => void;
}>()(set => ({
  phase: "idle", message: "",
  set: (phase, message = "") => set({ phase, message })
}));
