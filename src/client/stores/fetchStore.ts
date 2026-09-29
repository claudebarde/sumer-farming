import { createStore } from "zustand/vanilla";

export type FetchPhase = "idle" | "menu" | "starting" | "running" | "flying" | "chasing" | "result";
export const fetchStore = createStore<{
  readonly phase: FetchPhase;
  readonly message: string;
  readonly menuPosition: { readonly x: number; readonly y: number } | null;
  readonly openMenu: (position: { readonly x: number; readonly y: number }) => void;
  readonly set: (phase: FetchPhase, message?: string) => void;
}>()(set => ({
  phase: "idle", message: "", menuPosition: null,
  openMenu: menuPosition => set({ phase: "menu", message: "", menuPosition }),
  set: (phase, message = "") => set({ phase, message, ...(phase !== "menu" ? { menuPosition: null } : {}) })
}));
