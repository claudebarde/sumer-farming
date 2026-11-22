import { createStore } from "zustand/vanilla";

// Cosmetic level-up audio lifetime; never persisted or sent to the server.
export const processionAudioStore = createStore<{ active: boolean }>(() => ({ active: false }));
