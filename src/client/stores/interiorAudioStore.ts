import { createStore } from "zustand/vanilla";

// The interior has a separate, silent renderer. The main audio scene owns sound.
export const interiorAudioStore = createStore<{ active: boolean; walking: boolean }>(() => ({
  active: false,
  walking: false,
}));
