/** Reconcile one looping sound without restarting it on each animation frame. */
export const syncActionLoopAudio = (sound: {
  readonly isPlaying: boolean;
  play: () => boolean;
  stop: () => unknown;
  setVolume: (volume: number) => unknown;
}, active: boolean, allowed: boolean, volume: number) => {
  sound.setVolume(volume);
  if (!active || !allowed || volume <= 0) {
    if (sound.isPlaying) sound.stop();
  } else if (!sound.isPlaying) sound.play();
};
