import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import { BACKGROUND_MUSIC_VOLUME } from "../game/phaser/backgroundMusic";

export const adjustedMusicVolume = (volume: number, direction: -1 | 1) =>
  Math.max(0, Math.min(1, Math.round((volume + direction * 0.1) * 10) / 10));

type MusicSettings = {
  enabled: boolean;
  volume: number;
  changeVolume: (direction: -1 | 1) => void;
  toggle: () => void;
};

export const musicSettingsStore = createStore<MusicSettings>()(persist(set => ({
  enabled: true,
  volume: BACKGROUND_MUSIC_VOLUME,
  changeVolume: direction => set(state => ({ volume: adjustedMusicVolume(state.volume, direction) })),
  toggle: () => set(state => ({ enabled: !state.enabled }))
}), {
  name: "sumer:music-settings",
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({ enabled: state.enabled, volume: state.volume }),
  merge: (saved, current) => {
    const value = saved as Partial<MusicSettings> | undefined;
    return { ...current,
      enabled: typeof value?.enabled === "boolean" ? value.enabled : current.enabled,
      volume: typeof value?.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : current.volume };
  }
}));
