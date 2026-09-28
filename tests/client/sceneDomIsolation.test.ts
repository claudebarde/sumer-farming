import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import Phaser from "phaser";
import { installSceneDomIsolation } from "../../src/client/game/phaser/sceneDomIsolation";

vi.mock("phaser", async () => {
  const { EventEmitter } = await import("node:events");
  return { default: {
    GameObjects: { DOMElement: class extends EventEmitter {}, Events: { DESTROY: "destroy" } },
    Scenes: { Events: { ADDED_TO_SCENE: "added", SHUTDOWN: "shutdown" } },
    Core: { Events: { PRE_RENDER: "prerender" } }
  } };
});

class TestElement { style = { visibility: "" }; }
afterEach(() => vi.unstubAllGlobals());

const setup = () => {
  vi.stubGlobal("HTMLElement", TestElement);
  const gameEvents = new EventEmitter();
  const makeScene = () => {
    const scene = {
      children: { list: [] }, events: new EventEmitter(),
      game: { events: gameEvents }, sys: { settings: { visible: true, active: true } }
    };
    installSceneDomIsolation(scene as unknown as Phaser.Scene);
    const add = () => {
      const overlay = Object.assign(new Phaser.GameObjects.DOMElement({} as Phaser.Scene), { node: new TestElement() });
      scene.events.emit("added", overlay);
      return overlay.node;
    };
    return { scene, add };
  };
  return { gameEvents, makeScene };
};

describe("scene DOM isolation", () => {
  it("hides only the hidden scene and restores labels when returning", () => {
    const { gameEvents, makeScene } = setup();
    const farm = makeScene();
    const market = makeScene();
    const farmLabel = farm.add();
    const marketLabel = market.add();
    farm.scene.sys.settings.visible = false;
    gameEvents.emit("prerender");
    expect(farmLabel.style.visibility).toBe("hidden");
    expect(marketLabel.style.visibility).toBe("");
    farm.scene.sys.settings.visible = true;
    market.scene.sys.settings.visible = false;
    gameEvents.emit("prerender");
    expect(farmLabel.style.visibility).toBe("");
    expect(marketLabel.style.visibility).toBe("hidden");
  });

  it("immediately hides overlays created during background refreshes", () => {
    const { makeScene } = setup();
    const farm = makeScene();
    farm.scene.sys.settings.visible = false;
    expect(farm.add().style.visibility).toBe("hidden");
  });

  it("removes game listeners on shutdown", () => {
    const { gameEvents, makeScene } = setup();
    const { scene } = makeScene();
    scene.events.emit("shutdown");
    expect(gameEvents.listenerCount("prerender")).toBe(0);
    expect(scene.events.listenerCount("added")).toBe(0);
  });
});
