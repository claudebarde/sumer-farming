import Phaser from "phaser";
import { BACKGROUND_MUSIC_KEY, BACKGROUND_MUSIC_URL, backgroundMusicAction, backgroundMusicFade, tryMusicAutoplay } from "../backgroundMusic";
import { musicSettingsStore } from "../../../stores/musicSettingsStore";
import { createWindAmbience, WIND_GUST_KEY, WIND_GUST_URL } from "../windAmbience";
import { HARVEST_AUDIO_KEY, HARVEST_AUDIO_URL, syncHarvestingAudio } from "../harvestingAudio";
import type { IsometricFarmScene } from "./IsometricFarmScene";
import type { IsometricMarketScene } from "./IsometricMarketScene";
import { syncActionLoopAudio } from "../actionLoopAudio";
import { BUILDING_AUDIO, type BuildingAudioKey } from "../buildingAudio";
import { createBuildingAudioSequence } from "../buildingAudioSequence";
import { createDonkeyBrayAudio, donkeyPickupCue, DONKEY_BRAY_KEY, DONKEY_BRAY_URL } from "../donkeyBrayAudio";

/** Independent loader/lifetime: scene navigation and map redraws never restart music. */
export class BackgroundMusicScene extends Phaser.Scene {
  private syncHarvest: (() => void) | undefined;
  constructor() { super({ key: "BackgroundMusic", active: true }); }

  preload() {
    this.load.audio(BACKGROUND_MUSIC_KEY, BACKGROUND_MUSIC_URL);
    this.load.audio(WIND_GUST_KEY, WIND_GUST_URL);
    this.load.audio(HARVEST_AUDIO_KEY, HARVEST_AUDIO_URL);
    this.load.audio("farmer-walking", "/audio/walking.mp3");
    this.load.audio(DONKEY_BRAY_KEY, DONKEY_BRAY_URL);
    for (const [key, url] of Object.entries(BUILDING_AUDIO)) this.load.audio(`building-${key}`, url);
  }

  create() {
    if (!this.cache.audio.exists(BACKGROUND_MUSIC_KEY)) {
      console.warn("Background music could not be loaded; gameplay remains available.");
      return;
    }
    // Own tab visibility explicitly, avoiding a competing automatic focus resume.
    const previousPauseOnBlur = this.sound.pauseOnBlur;
    this.sound.pauseOnBlur = false;
    const music = this.sound.add(BACKGROUND_MUSIC_KEY, { loop: true, volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    let fade: Phaser.Tweens.Tween | undefined;
    let disposed = false;
    const context = "context" in this.sound ? this.sound.context : undefined;
    const harvestSound = this.cache.audio.exists(HARVEST_AUDIO_KEY)
      ? this.sound.add(HARVEST_AUDIO_KEY, { loop: true, volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound
      : undefined;
    if (!harvestSound) console.warn("Harvesting audio could not be loaded; gameplay remains available.");
    const walkingSound = this.cache.audio.exists("farmer-walking")
      ? this.sound.add("farmer-walking", { loop: true, volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound
      : undefined;
    if (!walkingSound) console.warn("Walking audio could not be loaded; gameplay remains available.");
    const buildingSounds = (Object.keys(BUILDING_AUDIO) as BuildingAudioKey[]).flatMap(key => {
      if (!this.cache.audio.exists(`building-${key}`)) {
        console.warn(`Building ${key} audio could not be loaded; gameplay remains available.`);
        return [];
      }
      const sound = this.sound.add(`building-${key}`, { loop: key !== "bubbling", volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
      return [{ key, sound }];
    });
    const buildingAudio = createBuildingAudioSequence(buildingSounds);
    const braySound = this.cache.audio.exists(DONKEY_BRAY_KEY)
      ? this.sound.add(DONKEY_BRAY_KEY, { loop: false, volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound
      : undefined;
    const brayAudio = braySound ? createDonkeyBrayAudio(braySound) : undefined;
    this.syncHarvest = () => {
      if (disposed) return;
      const { enabled, volume } = musicSettingsStore.getState();
      const farm = this.scene.get("isometric-farm") as IsometricFarmScene | undefined;
      const market = this.scene.get("isometric-market") as IsometricMarketScene | undefined;
      const allowed = !document.hidden && enabled && (context ? context.state === "running" : !this.sound.locked);
      const harvesting = !document.hidden && !!farm?.isHarvestingForAudio(Date.now());
      if (harvestSound) syncHarvestingAudio(harvestSound, harvesting, allowed, volume);
      if (walkingSound) syncActionLoopAudio(walkingSound,
        !harvesting && (!!farm?.isWalkingForAudio() || !!market?.isWalkingForAudio()), allowed, volume);
      const now = Date.now();
      brayAudio?.(donkeyPickupCue(farm?.donkeyMillingForAudio()), now,
        allowed && !!farm?.sys.isActive() && !!farm?.sys.isVisible(), volume);
      buildingAudio(buildingSounds.filter(({ key }) => farm?.isBuildingActiveForAudio(key, now)).map(({ key }) => key),
        allowed, volume, performance.now());
    };
    const wind = this.cache.audio.exists(WIND_GUST_KEY)
      ? this.sound.add(WIND_GUST_KEY, { loop: false, volume: 0 }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound
      : undefined;
    const ambience = wind ? createWindAmbience(wind, () => {
      const { enabled, volume } = musicSettingsStore.getState();
      return { allowed: !document.hidden && enabled && (context ? context.state === "running" : !this.sound.locked), volume };
    }) : undefined;
    if (!wind) console.warn("Wind ambience could not be loaded; background music remains available.");
    if (wind && ambience) wind.on(Phaser.Sound.Events.COMPLETE, ambience.sync);
    const sync = () => {
      if (disposed) return;
      this.syncHarvest?.();
      ambience?.sync();
      // The actual context state also covers autoplay allowed before Phaser's unlock event.
      const locked = context ? context.state !== "running" : this.sound.locked;
      const { enabled, volume } = musicSettingsStore.getState();
      const action = backgroundMusicAction(document.hidden, locked, music.isPlaying, music.isPaused, enabled);
      if (action === "wait") return;
      fade?.stop();
      if (action === "stop") { music.stop(); return; }
      if (action === "pause") { music.pause(); return; }
      music.setVolume(0);
      const started = action === "resume" ? music.resume() : music.play();
      if (started) fade = this.tweens.add({ targets: music, ...backgroundMusicFade(volume) });
    };
    const attempt = () => {
      sync();
      if (musicSettingsStore.getState().enabled) tryMusicAutoplay(context, document.hidden, sync);
    };
    const unsubscribe = musicSettingsStore.subscribe((next, previous) => {
      if (next.volume !== previous.volume) { fade?.stop(); music.setVolume(next.volume); }
      attempt();
    });
    document.addEventListener("visibilitychange", attempt);
    document.addEventListener("pointerup", attempt);
    document.addEventListener("keydown", attempt);
    context?.addEventListener("statechange", sync);
    this.sound.on(Phaser.Sound.Events.UNLOCKED, sync);
    attempt();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      disposed = true;
      this.syncHarvest = undefined;
      harvestSound?.destroy();
      walkingSound?.destroy();
      braySound?.destroy();
      buildingSounds.forEach(({ sound }) => sound.destroy());
      unsubscribe();
      document.removeEventListener("visibilitychange", attempt);
      document.removeEventListener("pointerup", attempt);
      document.removeEventListener("keydown", attempt);
      context?.removeEventListener("statechange", sync);
      this.sound.off(Phaser.Sound.Events.UNLOCKED, sync);
      fade?.stop();
      ambience?.dispose();
      if (wind && ambience) wind.off(Phaser.Sound.Events.COMPLETE, ambience.sync);
      wind?.destroy();
      music.destroy();
      this.sound.pauseOnBlur = previousPauseOnBlur;
    });
  }

  update() { this.syncHarvest?.(); }
}
