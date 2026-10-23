export const BACKGROUND_MUSIC_KEY = "estate-background-music";
export const BACKGROUND_MUSIC_URL = "/audio/background-music.wav";
export const BACKGROUND_MUSIC_VOLUME = 0.3;

/** A blocked resume may stay pending until a gesture; never await it to load the UI. */
export const tryMusicAutoplay = (context: { state: string; resume: () => Promise<void> } | undefined,
  hidden: boolean, onReady: () => void) => {
  if (hidden) return;
  if (!context || context.state === "running") { onReady(); return; }
  if (context.state === "closed") return;
  void context.resume().then(onReady, () => { /* Keep the gesture fallback available. */ });
};

/** Visibility takes precedence over unlock and delayed loading events. */
export const backgroundMusicAction = (hidden: boolean, locked: boolean, playing: boolean, paused: boolean, enabled = true) => {
  if (!enabled) return playing || paused ? "stop" : "wait";
  if (hidden) return playing ? "pause" : "wait";
  if (locked || playing) return "wait";
  return paused ? "resume" : "play";
};
