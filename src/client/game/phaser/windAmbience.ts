export const WIND_GUST_KEY = "estate-wind-gust";
export const WIND_GUST_URL = "/audio/wind-gust.mp3";
export const windGustDelay = (random: number) => 20_000 + Math.max(0, Math.min(1, random)) * 40_000;

type WindSound = {
  readonly isPlaying: boolean;
  play: () => boolean;
  stop: () => unknown;
  setVolume: (volume: number) => unknown;
};

/** One gust at a time; hidden/locked/muted periods never accumulate a backlog. */
export const createWindAmbience = (sound: WindSound, settings: () => { allowed: boolean; volume: number }, random = Math.random) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const sync = () => {
    if (disposed) return;
    const { allowed, volume } = settings();
    sound.setVolume(volume * 0.6);
    if (!allowed || volume <= 0) {
      clear();
      if (sound.isPlaying) sound.stop();
      return;
    }
    if (timer !== undefined || sound.isPlaying) return;
    timer = setTimeout(() => {
      timer = undefined;
      const current = settings();
      if (disposed || !current.allowed || current.volume <= 0) { sync(); return; }
      if (sound.isPlaying) return;
      sound.setVolume(current.volume * 0.6);
      if (!sound.play()) sync();
    }, windGustDelay(random()));
  };
  return { sync, dispose: () => { disposed = true; clear(); sound.stop(); } };
};
