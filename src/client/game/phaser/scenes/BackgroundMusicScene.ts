import Phaser from "phaser";
import { BACKGROUND_MUSIC_KEY, BACKGROUND_MUSIC_URL, backgroundMusicAction, tryMusicAutoplay } from "../backgroundMusic";
import { musicSettingsStore } from "../../../stores/musicSettingsStore";

/** Independent loader/lifetime: scene navigation and map redraws never restart music. */
export class BackgroundMusicScene extends Phaser.Scene {
  constructor() { super({ key: "BackgroundMusic", active: true }); }

  preload() {
    this.load.audio(BACKGROUND_MUSIC_KEY, BACKGROUND_MUSIC_URL);
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
    const sync = () => {
      if (disposed) return;
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
      if (started) fade = this.tweens.add({ targets: music, volume, duration: 700 });
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
      unsubscribe();
      document.removeEventListener("visibilitychange", attempt);
      document.removeEventListener("pointerup", attempt);
      document.removeEventListener("keydown", attempt);
      context?.removeEventListener("statechange", sync);
      this.sound.off(Phaser.Sound.Events.UNLOCKED, sync);
      fade?.stop();
      music.destroy();
      this.sound.pauseOnBlur = previousPauseOnBlur;
    });
  }
}
