import { describe, expect, it, vi } from "vitest";
import { chooseIdleStep, createFarmerIdle, idleKey, type IdlePoint, type IdleWorld } from "../../src/client/game/phaser/farmerIdle";

const position = { column: 0, row: 5 };
const world: IdleWorld = { roads: new Set(Array.from({ length: 9 }, (_, i) => `${i - 4}:5`)), allowed: p => Math.abs(p.column) <= 4 && p.row >= 0 && p.row < 10 };
describe("farmer idle strolls", () => {
  it("only steps along roads and never drifts beyond two tiles", () => {
    let p = position;
    for (let i = 0; i < 100; i++) {
      const next = chooseIdleStep(p, position, world, i % 2 ? 0.9 : 0)!;
      expect(next.row).toBe(5);
      expect(Math.abs(next.column)).toBeLessThanOrEqual(2);
      expect(Math.abs(next.column - p.column)).toBe(1);
      p = next;
    }
  });
  it("walks back toward a nearby road without entering blocked tiles", () => {
    const p = { column: 0, row: 3 };
    expect(chooseIdleStep(p, p, world, 0)).toEqual({ column: 0, row: 4 });
    expect(chooseIdleStep(p, p, { ...world, allowed: tile => world.allowed(tile) && tile.row !== 4 }, 0)).toBeNull();
    expect(chooseIdleStep({ column: 0, row: 0 }, { column: 0, row: 0 }, world, 0)).toBeNull();
  });
  it("does not end on the resting porter", () => {
    const next = chooseIdleStep(position, position, { ...world, occupied: { column: -1, row: 5 } }, 0);
    expect(next).toEqual({ column: 1, row: 5 });
  });
  const setup = () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    const present = vi.fn();
    const options = { key: "farm-a", storage, random: () => 0, present };
    return { values, present, options, idle: createFarmerIdle(options) };
  };
  const input = (now: number) => ({ now, position, version: 1, eligible: true, visible: true, world });
  it("waits one minute, strolls slowly, then waits again", () => {
    const { idle, present } = setup();
    idle.update(input(0));
    idle.update(input(59999));
    expect(present).not.toHaveBeenCalled();
    idle.update(input(60000));
    expect(present).toHaveBeenLastCalledWith(position, true);
    idle.update(input(60900));
    expect(present).toHaveBeenLastCalledWith({ column: -0.5, row: 5 }, true);
    idle.update(input(61800));
    expect(present).toHaveBeenLastCalledWith({ column: -1, row: 5 }, false);
  });
  it("cancels immediately for player work and clears saved idle position", () => {
    const { idle, present, values } = setup();
    idle.update(input(0)); idle.update(input(59999)); idle.update(input(60000));
    idle.cancel();
    expect(present).toHaveBeenLastCalledWith(position, false);
    expect(values.size).toBe(0);
    present.mockClear();
    idle.update({ ...input(90000), eligible: false });
    expect(present).not.toHaveBeenCalled();
  });
  it("restores at most one small step after hours away, without replaying animation", () => {
    const { idle, options, present } = setup();
    idle.update(input(0)); idle.suspend();
    const reloaded = createFarmerIdle(options);
    reloaded.update(input(3600000));
    expect(present).toHaveBeenLastCalledWith({ column: -1, row: 5 }, false);
    present.mockClear(); reloaded.update(input(3600010));
    expect(present).not.toHaveBeenCalled();
  });
  it("ignores obsolete saves after authoritative work changes the farm", () => {
    const { idle, options, present } = setup(); idle.update(input(0));
    createFarmerIdle(options).update({ ...input(3600000), version: 2 });
    expect(present).not.toHaveBeenCalled();
  });
  it("stays still while hidden and catches up once on return", () => {
    const { idle, present } = setup(); idle.update(input(0));
    idle.update({ ...input(3600000), visible: false });
    expect(present).not.toHaveBeenCalled();
    idle.update(input(3600001));
    expect(present).toHaveBeenLastCalledWith({ column: -1, row: 5 }, false);
  });
  it("rejects saved positions blocked by a new building", () => {
    const { idle, options, present } = setup(); idle.update(input(0));
    createFarmerIdle(options).update({ ...input(3600000), world: { ...world, allowed: (p: IdlePoint) => idleKey(p) !== idleKey(position) } });
    expect(present).not.toHaveBeenCalled();
  });
});
