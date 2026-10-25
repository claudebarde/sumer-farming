import type { BuildingAudioKey } from "./buildingAudio";
import { createBubblingAudio } from "./bubblingAudio";
import { syncActionLoopAudio } from "./actionLoopAudio";

type Sound = {
  readonly isPlaying: boolean;
  play: () => boolean;
  stop: () => unknown;
  setVolume: (volume: number) => unknown;
  setLoop: (loop: boolean) => unknown;
};
type Entry = { readonly key: BuildingAudioKey; readonly sound: Sound };

/** Presentation-only rotation. Never catches up missed sounds or changes production. */
export const createBuildingAudioSequence = (entries: readonly Entry[], random = Math.random) => {
  const bubbling = entries.find(entry => entry.key === "bubbling");
  const intermittent = bubbling ? createBubblingAudio(bubbling.sound, random) : undefined;
  let mode: "silent" | "single" | "sequence" = "silent";
  let current: Entry | undefined;
  let startedAt = 0;
  let endsAt = 0;
  let nextAt = 0;
  let played = new Set<BuildingAudioKey>();
  const stopAll = () => {
    for (const { sound } of entries) if (sound.isPlaying) sound.stop();
    intermittent?.(false, false, 0, 0);
    current = undefined;
  };
  const between = (min: number, max: number) => min + Math.max(0, Math.min(1, random())) * (max - min);

  return (activeKeys: readonly BuildingAudioKey[], allowed: boolean, volume: number, now: number) => {
    const active = entries.filter(entry => activeKeys.includes(entry.key));
    const nextMode = !allowed || volume <= 0 || !active.length ? "silent" : active.length === 1 ? "single" : "sequence";
    if (nextMode !== mode) {
      stopAll(); played = new Set(); nextAt = now; mode = nextMode;
    }
    if (mode === "silent") return;
    if (mode === "single") {
      for (const { key, sound } of entries) {
        sound.setLoop(key !== "bubbling");
        if (key === "bubbling") intermittent?.(activeKeys.includes(key), true, volume, now);
        else syncActionLoopAudio(sound, activeKeys.includes(key), true, volume);
      }
      return;
    }
    // Stop completed work immediately, including stirring when fermentation begins.
    if (current && (!active.includes(current) || now >= endsAt)) {
      current.sound.stop(); current = undefined;
      const finishedRound = active.every(entry => played.has(entry.key));
      nextAt = now + (finishedRound ? between(3000, 5000) : between(1000, 2000));
      if (finishedRound) played = new Set();
    }
    if (!current && now >= nextAt) {
      current = active.find(entry => !played.has(entry.key));
      if (!current) { played = new Set(); nextAt = now + between(3000, 5000); return; }
      played.add(current.key);
      startedAt = now; endsAt = now + between(5000, 8000);
      current.sound.setLoop(true);
      current.sound.setVolume(0);
      // A blocked/failed clip is skipped until its next turn, not retried every frame.
      if (!current.sound.play()) { current = undefined; nextAt = now + between(1000, 2000); return; }
    }
    if (current) {
      const fade = Math.max(0, Math.min(1, (now - startedAt) / 700, (endsAt - now) / 700));
      current.sound.setVolume(volume * fade);
    }
  };
};
