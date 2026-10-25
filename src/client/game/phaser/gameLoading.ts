import Phaser from "phaser";

export type GameLoadingState = "loading" | "recovering" | "ready" | "error";

/** UI readiness follows a rendered world frame, not receipt of the farm snapshot. */
export const monitorGameLoading = (game: Phaser.Game, worlds: readonly Phaser.Scene[],
  publish: (state: GameLoadingState) => void) => {
  let state: GameLoadingState = "loading";
  let graphicsLost = false;
  const set = (next: GameLoadingState) => { if (state !== next) { state = next; publish(next); } };
  const loading = () => { if (state !== "error") set("loading"); };
  const failed = () => set("error");
  const lost = () => { graphicsLost = true; if (state !== "error") set("recovering"); };
  const restored = () => { graphicsLost = false; };
  // Arm the cover while hidden so it is already present if the browser clears
  // the canvas. Ordinary background snapshot refreshes never cover a ready map.
  const visibility = () => { if (document.hidden && state === "ready") set("recovering"); };
  const rendered = () => {
    if (state === "ready" || state === "error" || graphicsLost || document.hidden) return;
    if (worlds.some(scene => scene.sys.isActive() && scene.sys.isVisible())) set("ready");
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, rendered);
  game.renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, lost);
  game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restored);
  for (const scene of worlds) {
    scene.events.on(Phaser.Scenes.Events.START, loading);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
  }
  document.addEventListener("visibilitychange", visibility);
  return () => {
    game.events.off(Phaser.Core.Events.POST_RENDER, rendered);
    game.renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, lost);
    game.renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restored);
    for (const scene of worlds) {
      scene.events.off(Phaser.Scenes.Events.START, loading);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    }
    document.removeEventListener("visibilitychange", visibility);
  };
};
