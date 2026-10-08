import { create } from "zustand";

/** Layout hint only; the server validates roads and computes every delivery. */
export const workerLocationStore = create<{ marketRoad: { column: number; row: number } | undefined; farmerPosition?: { column: number; row: number } }>(() => ({ marketRoad: undefined }));
