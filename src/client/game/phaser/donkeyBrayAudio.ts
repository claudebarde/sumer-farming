import type { MillingJob } from "../../../game-data/milling";

export const DONKEY_BRAY_KEY = "donkey-bray";
export const DONKEY_BRAY_URL = "/audio/donkey-bray.mp3";

export const donkeyPickupCue = (job: MillingJob | null | undefined) => {
  const journey = job?.preparation;
  if (job?.worker !== "donkey" || !journey || journey.donkeyPickupIndex === undefined) return null;
  return {
    id: `${job.buildingId}:${job.startedAt}:${journey.departedAt}`,
    at: journey.departedAt + journey.donkeyPickupIndex * journey.stepDurationMs,
  };
};

/** Observe the saved pickup boundary, never replay an elapsed pickup on return. */
export const createDonkeyBrayAudio = (sound: {
  readonly isPlaying: boolean;
  play: () => boolean;
  stop: () => unknown;
  setVolume: (volume: number) => unknown;
}) => {
  let previousTime: number | undefined;
  let previouslyAudible = false;
  let handledId: string | undefined;
  return (cue: ReturnType<typeof donkeyPickupCue>, now: number, allowed: boolean, volume: number) => {
    const audible = allowed && volume > 0;
    sound.setVolume(volume);
    if (!audible && sound.isPlaying) sound.stop();
    if (cue && now >= cue.at && handledId !== cue.id) {
      handledId = cue.id;
      // A long suspended frame must not emit a stale arrival sound.
      if (previousTime !== undefined && previousTime < cue.at && now - cue.at <= 500 &&
          previouslyAudible && audible) sound.play();
    }
    previousTime = now;
    previouslyAudible = audible;
  };
};
