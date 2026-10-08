import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startMarketPresence } from "../../src/client/api/marketPresence";
import { encodeMarketPosition, decodeMarketPosition } from "../../src/client/game/phaser/marketPresencePosition";
import { marketRoadTiles, marketSceneLayout } from "../../src/client/game/phaser/marketSceneLayout";
import { MarketPositionSchema, type MarketVisitor } from "../../src/schemas/marketPresence";

describe("shared market coordinates", () => {
  it.each([10, 12, 24, 50])("keeps all supported positions on roads across viewport widths (%i)", columns => {
    const { right } = marketSceneLayout(columns);
    for (const tile of marketRoadTiles(columns).filter(tile => tile.column <= right)) {
      const encoded = encodeMarketPosition(tile, columns);
      expect(MarketPositionSchema.safeParse(encoded).success).toBe(true);
      for (const other of [10, 16, 24, 50]) expect(marketRoadTiles(other)).toContainEqual(decodeMarketPosition(encoded, other));
    }
  });
  it("rejects building, non-finite and off-map coordinates", () => {
    for (const position of [{ column: 1, row: 5 }, { column: -1, row: 3 }, { column: Infinity, row: 5 }, { column: 5, row: 5 }]) {
      expect(MarketPositionSchema.safeParse(position).success).toBe(false);
    }
  });
});

describe("presence connection lifecycle", () => {
  let doc: EventTarget & { hidden: boolean };
  let win: EventTarget;
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    doc = Object.assign(new EventTarget(), { hidden: false }); win = new EventTarget();
    vi.stubGlobal("document", doc); vi.stubGlobal("window", win);
  });
  afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const position = () => ({ column: 0, row: 5 });
  it("joins, heartbeats, then leaves and cancels future requests", async () => {
    const request = vi.fn(async () => [] as MarketVisitor[]); const receive = vi.fn();
    stop = startMarketPresence(position, receive, request);
    await vi.advanceTimersByTimeAsync(510);
    expect(request.mock.calls).toHaveLength(2);
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "join" }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "heartbeat" }));
    stop(); stop = undefined;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(request.mock.calls).toHaveLength(3);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ type: "leave" }));
  });
  it("does not overlap polls or accept a late response after exit", async () => {
    let resolve!: (visitors: MarketVisitor[]) => void;
    const request = vi.fn(() => new Promise<MarketVisitor[]>(r => { resolve = r; })); const receive = vi.fn();
    stop = startMarketPresence(position, receive, request);
    win.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(request).toHaveBeenCalledTimes(1);
    const complete = resolve;
    stop(); stop = undefined;
    complete([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(receive).not.toHaveBeenCalled();
  });
  it("leaves hidden tabs and rejoins with a new session when visible", async () => {
    const request = vi.fn(async () => [] as MarketVisitor[]);
    stop = startMarketPresence(position, vi.fn(), request);
    await vi.advanceTimersByTimeAsync(0);
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(request).toHaveBeenCalledTimes(2);
    doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ type: "join" }));
    expect(request.mock.calls.at(-1)).not.toEqual(request.mock.calls[0]);
  });
  it("clears stale visitors on failure and retries", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]); const receive = vi.fn();
    stop = startMarketPresence(position, receive, request);
    await vi.advanceTimersByTimeAsync(0);
    expect(receive).toHaveBeenLastCalledWith([], false);
    await vi.advanceTimersByTimeAsync(500);
    expect(receive).toHaveBeenLastCalledWith([], true);
  });
});
