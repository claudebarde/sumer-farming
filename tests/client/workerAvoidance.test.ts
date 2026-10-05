import { describe, expect, it, vi } from "vitest";
import { createWorkerAvoidance, findYieldPosition, updateWorkerAvoidance, type WorkerView } from "../../src/client/game/phaser/workerAvoidance";

const idle: WorkerView = { position: { x: 64, y: 0 }, moving: false, yielding: false, visible: true };
const roads = [0, 64, 128].map(x => ({ x, y: 0 }));
const actor = (initial: WorkerView) => {
  let view = initial;
  return { read: () => view, set: (next: WorkerView) => { view = next; }, yieldTo: vi.fn(() => true) };
};

describe("idle worker separation", () => {
  it("uses a neighbouring road tile without changing road height", () => {
    expect(findYieldPosition(idle.position, idle, roads, 64)).toEqual({ x: 0, y: 0 });
  });
  it.each([false, true])("allows a moving worker to pass through an idle worker (%s)", reverse => {
    const a = actor({ ...idle, moving: true }); const b = actor(idle);
    updateWorkerAvoidance(reverse ? [b, a] : [a, b], roads, 64);
    expect(a.yieldTo).not.toHaveBeenCalled();
    expect(b.yieldTo).not.toHaveBeenCalled();
  });
  it.each([false, true])("moves the previously idle worker when the other stops (%s)", reverse => {
    const a = actor({ ...idle, moving: true }); const b = actor(idle);
    const workers = reverse ? [b, a] : [a, b];
    const update = createWorkerAvoidance();
    update(workers, roads, 64);
    a.set(idle);
    update(workers, roads, 64);
    expect(b.yieldTo).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(a.yieldTo).not.toHaveBeenCalled();
  });
  it("never invents an upward offset when no safe tile exists", () => {
    const a = actor(idle); const b = actor(idle);
    updateWorkerAvoidance([a, b], [{ x: 64, y: 0 }, { x: 64, y: -64 }], 64);
    expect(a.yieldTo).not.toHaveBeenCalled();
    expect(b.yieldTo).not.toHaveBeenCalled();
  });
  it("leaves separated or hidden workers and active sidesteps alone", () => {
    for (const view of [{ ...idle, position: { x: 128, y: 0 } }, { ...idle, visible: false }, { ...idle, yielding: true }]) {
      const a = actor(idle); const b = actor(view);
      updateWorkerAvoidance([a, b], roads, 64);
      expect(a.yieldTo).not.toHaveBeenCalled();
      expect(b.yieldTo).not.toHaveBeenCalled();
    }
  });
  it("tries the other worker if the first cannot leave its task", () => {
    const a = actor(idle); const b = actor(idle);
    b.yieldTo.mockReturnValue(false);
    updateWorkerAvoidance([a, b], roads, 64);
    expect(a.yieldTo).toHaveBeenCalledOnce();
  });
});
