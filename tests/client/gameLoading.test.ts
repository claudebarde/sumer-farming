import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import type Phaser from "phaser";
vi.mock("phaser", () => ({ default: {
  Core: { Events: { POST_RENDER: "postrender" } },
  Renderer: { Events: { LOSE_WEBGL: "lost", RESTORE_WEBGL: "restored" } },
  Scenes: { Events: { START: "start" } }, Loader: { Events: { FILE_LOAD_ERROR: "loaderror" } }
} }));
import { monitorGameLoading } from "../../src/client/game/phaser/gameLoading";
afterEach(() => vi.unstubAllGlobals());
const setup = () => {
  const visibility = new EventEmitter();
  const document = { hidden: false, addEventListener: visibility.on.bind(visibility), removeEventListener: visibility.off.bind(visibility) };
  vi.stubGlobal("document", document);
  const events = new EventEmitter(), renderer = new EventEmitter();
  let active = false;
  const world = { sys: { isActive: () => active, isVisible: () => true }, events: new EventEmitter(), load: new EventEmitter() };
  const publish = vi.fn();
  const stop = monitorGameLoading({ events, renderer } as unknown as Phaser.Game, [world] as unknown as Phaser.Scene[], publish);
  return { events, renderer, world, publish, stop, document, visibility, activate: () => { active = true; } };
};
it("waits for a rendered, running world rather than a loader frame", () => {
  const t = setup();
  t.events.emit("postrender"); expect(t.publish).not.toHaveBeenCalled();
  t.activate(); expect(t.publish).not.toHaveBeenCalled();
  t.events.emit("postrender"); expect(t.publish).toHaveBeenLastCalledWith("ready");
  t.events.emit("postrender"); expect(t.publish).toHaveBeenCalledOnce();
  t.stop();
});
it("covers tab return and graphics loss until a valid new frame is rendered", () => {
  const t = setup(); t.activate(); t.events.emit("postrender");
  t.document.hidden = true; t.visibility.emit("visibilitychange");
  expect(t.publish).toHaveBeenLastCalledWith("recovering");
  t.events.emit("postrender"); expect(t.publish).toHaveBeenLastCalledWith("recovering");
  t.document.hidden = false; t.renderer.emit("lost");
  t.events.emit("postrender"); expect(t.publish).toHaveBeenLastCalledWith("recovering");
  t.renderer.emit("restored"); expect(t.publish).toHaveBeenLastCalledWith("recovering");
  t.events.emit("postrender"); expect(t.publish).toHaveBeenLastCalledWith("ready");
  t.stop();
});
it("retains the error screen for missing sprites and removes listeners on teardown", () => {
  const t = setup(); t.world.load.emit("loaderror"); t.activate(); t.events.emit("postrender");
  expect(t.publish).toHaveBeenLastCalledWith("error");
  t.stop(); t.publish.mockClear();
  t.renderer.emit("lost"); t.world.events.emit("start"); t.events.emit("postrender");
  expect(t.publish).not.toHaveBeenCalled();
  expect(t.visibility.listenerCount("visibilitychange")).toBe(0);
});
