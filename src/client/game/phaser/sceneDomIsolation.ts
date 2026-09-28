import Phaser from "phaser";

/** DOM overlays share a game-wide container and survive skipped scene renders. */
export const installSceneDomIsolation = (scene: Phaser.Scene): void => {
  const overlays = new Set<Phaser.GameObjects.DOMElement>();
  const hiddenStyles = new Map<HTMLElement, string>();
  const sync = () => {
    for (const overlay of overlays) {
      const node = overlay.node;
      if (!(node instanceof HTMLElement)) continue;
      if (!scene.sys.settings.visible || !scene.sys.settings.active) {
        if (!hiddenStyles.has(node)) hiddenStyles.set(node, node.style.visibility);
        node.style.visibility = "hidden";
      } else if (hiddenStyles.has(node)) {
        node.style.visibility = hiddenStyles.get(node)!;
        hiddenStyles.delete(node);
      }
    }
  };
  const add = (object: Phaser.GameObjects.GameObject) => {
    if (!(object instanceof Phaser.GameObjects.DOMElement)) return;
    overlays.add(object);
    const node = object.node;
    object.once(Phaser.GameObjects.Events.DESTROY, () => {
      overlays.delete(object);
      if (node instanceof HTMLElement) hiddenStyles.delete(node);
    });
    sync();
  };
  scene.children.list.forEach(add);
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, add);
  // Game-level event still runs when this scene is invisible or sleeping.
  scene.game.events.on(Phaser.Core.Events.PRE_RENDER, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, add);
    scene.game.events.off(Phaser.Core.Events.PRE_RENDER, sync);
    overlays.clear();
    hiddenStyles.clear();
  });
};
