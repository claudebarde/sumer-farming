import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SumerScene } from "../../src/client/game/phaser/scenes/SumerScene";
import { sumerMapStore } from "../../src/client/stores/sumerMapStore";

vi.mock("phaser", () => ({ default: {
  Scene: class {},
  Math: { Vector2: class { constructor(public x: number, public y: number) {} } }
} }));

const createScene = () => {
  const scene = new SumerScene();
  const events = new EventEmitter();
  const scale = Object.assign(new EventEmitter(), { width: 800, height: 600 });
  const removeAll = vi.fn();
  const setBackgroundColor = vi.fn();
  const cameras = { main: { setBackgroundColor } as { setBackgroundColor: typeof setBackgroundColor } | undefined };
  const drawable = new Proxy({}, { get: () => () => drawable });
  Object.assign(scene, { events, scale, cameras, children: { removeAll },
    add: { graphics: () => drawable, text: () => drawable, zone: () => drawable } });
  scene.create();
  return { scene, events, scale, cameras, removeAll, setBackgroundColor };
};

afterEach(() => sumerMapStore.setState({ selectedCity: null, residence: null }));

describe("Sumer scene subscriptions", () => {
  it.each(["shutdown", "destroy"])("stops redraws after %s, without leaving lifecycle listeners", event => {
    const map = createScene();
    sumerMapStore.getState().selectCity("uruk");
    expect(map.removeAll).toHaveBeenCalledTimes(2);
    map.events.emit(event);
    map.cameras.main = undefined;
    expect(() => sumerMapStore.getState().selectCity("ur")).not.toThrow();
    map.scale.emit("resize");
    expect(map.removeAll).toHaveBeenCalledTimes(2);
    expect(map.scale.listenerCount("resize")).toBe(0);
    expect(map.events.listenerCount("shutdown")).toBe(0);
    expect(map.events.listenerCount("destroy")).toBe(0);
  });

  it("resubscribes exactly once when a stopped scene restarts", () => {
    const map = createScene();
    map.events.emit("shutdown");
    map.scene.create();
    map.removeAll.mockClear();
    sumerMapStore.getState().selectCity("uruk");
    expect(map.removeAll).toHaveBeenCalledTimes(1);
    expect(map.scale.listenerCount("resize")).toBe(1);
    map.events.emit("destroy");
  });

  it("does not touch display objects if cameras have already been disposed", () => {
    const map = createScene();
    map.cameras.main = undefined;
    expect(() => sumerMapStore.getState().selectCity("uruk")).not.toThrow();
    expect(map.removeAll).toHaveBeenCalledTimes(1);
    map.events.emit("destroy");
  });
});
