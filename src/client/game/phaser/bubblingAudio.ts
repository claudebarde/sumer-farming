export const bubblingPause = (random: number) => 5000 + Math.max(0, Math.min(1, random)) * 7000;

/** One full clip followed by silence; no catch-up or overlapping playback. */
export const createBubblingAudio = (sound: {
  readonly isPlaying: boolean;
  play: () => boolean;
  stop: () => unknown;
  setVolume: (volume: number) => unknown;
}, random = Math.random) => {
  let nextPlayAt: number | null = null;
  let playing = false;
  return (active: boolean, allowed: boolean, volume: number, now: number) => {
    sound.setVolume(volume);
    if (!active || !allowed || volume <= 0) {
      if (sound.isPlaying) sound.stop();
      nextPlayAt = null; playing = false;
      return;
    }
    if (sound.isPlaying) { playing = true; return; }
    if (playing) {
      playing = false;
      nextPlayAt = now + bubblingPause(random());
    }
    if (nextPlayAt !== null && now < nextPlayAt) return;
    playing = sound.play();
    nextPlayAt = playing ? null : now + bubblingPause(random());
  };
};
