import { describe, expect, it } from "vitest";
import { evaluateFetchThrow, fetchPosition, fetchProgress, findFetchRoutes, findDogWalk, FETCH_FLIGHT_MS, type FetchRun } from "../../src/game-core/fetch";

const run: FetchRun = { start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, duration: 7000 };
describe("fetch", () => {
  it("keeps the dog in place when already at the next start", () => {
    expect(findDogWalk({ x: 32, y: 32 }, { x: 32, y: 32 }, { column: 0, row: 0 }, () => true, 64)).toEqual([]);
  });
  it("walks from a between-tile stop instead of snapping to a new start", () => {
    expect(findDogWalk({ x: 80, y: 32 }, { x: 224, y: 32 }, { column: 0, row: 0 }, () => true, 64))
      .toEqual([{ x: 160, y: 32 }, { x: 224, y: 32 }]);
  });
  it("routes walking around obstacles and rejects unreachable starts", () => {
    const path = findDogWalk({ x: 32, y: 32 }, { x: 160, y: 32 }, { column: 0, row: 0 },
      (column, row) => !(column === 1 && row === 0), 64);
    expect(path).not.toBeNull();
    expect(path).not.toContainEqual({ x: 96, y: 32 });
    expect(path?.at(-1)).toEqual({ x: 160, y: 32 });
    expect(findDogWalk({ x: 32, y: 32 }, { x: 160, y: 32 }, { column: 0, row: 0 }, () => false, 64)).toBeNull();
  });
  it("clamps the run and slows down before stopping", () => {
    expect(fetchProgress(-1, 7000)).toBe(0);
    expect(fetchPosition(run, 9000)).toEqual(run.end);
    expect(fetchProgress(7000, 7000)).toBe(1);
    expect(fetchProgress(6900, 7000) - fetchProgress(6800, 7000))
      .toBeLessThan(fetchProgress(1100, 7000) - fetchProgress(1000, 7000));
  });
  it("accepts a reachable throw ahead of the dog at landing time", () => {
    expect(evaluateFetchThrow(run, { x: 100, y: 10 }, 1000 + FETCH_FLIGHT_MS)).toBe("catchable");
  });
  it("uses the landing position, not the position when the stick was thrown", () => {
    const target = { x: 40, y: 0 };
    expect(evaluateFetchThrow(run, target, 1000)).toBe("catchable");
    expect(evaluateFetchThrow(run, target, 1000 + FETCH_FLIGHT_MS)).toBe("behind");
  });
  it("rejects sideways, overly long and late throws", () => {
    expect(evaluateFetchThrow(run, { x: 100, y: 23 }, 1000)).toBe("wide");
    expect(evaluateFetchThrow(run, { x: 201, y: 0 }, 1000)).toBe("too_far");
    expect(evaluateFetchThrow(run, { x: 200, y: 0 }, 7000)).toBe("stopped");
  });
  it("handles leftward and vertical runs", () => {
    expect(evaluateFetchThrow({ ...run, end: { x: -200, y: 0 } }, { x: -100, y: 0 }, 1000)).toBe("catchable");
    expect(evaluateFetchThrow({ ...run, end: { x: 0, y: 200 } }, { x: 0, y: 100 }, 1000)).toBe("catchable");
  });
  it("never plans through obstacles or beyond the plot and leaves a winning window", () => {
    const routes = findFetchRoutes({ column: 0, row: 0 }, (column, row) => row === 3 && column !== 5, 64);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.start.y).toBe(224);
      expect(route.end.y).toBe(224);
      expect(route.start.x).toBeLessThan(320);
      expect(route.end.x).toBeLessThan(320);
      const halfway = { x: (route.start.x + route.end.x) / 2, y: route.start.y };
      expect(evaluateFetchThrow(route, halfway, 1000 + FETCH_FLIGHT_MS)).toBe("catchable");
    }
    expect(findFetchRoutes({ column: 0, row: 0 }, () => false, 64)).toEqual([]);
  });
});
