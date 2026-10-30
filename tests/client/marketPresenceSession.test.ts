import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarketPresenceSession } from "../../src/client/game/marketPresenceSession";
import type { MarketPresenceCommand, MarketVisitor } from "../../src/schemas/marketPresence";

afterEach(() => { vi.useRealTimers(); });
const position = { column: 0, row: 5 };
describe("market visit lifecycle", () => {
  it("joins once, heartbeats, leaves and uses a new session on return", async () => {
    vi.useFakeTimers();
    const send = vi.fn<(command: MarketPresenceCommand) => Promise<MarketVisitor[]>>(async () => []);
    const receive = vi.fn();
    let eligible = false;
    const session = createMarketPresenceSession({ eligible: () => eligible, position: () => position, receive, send });
    session.start(); expect(send).not.toHaveBeenCalled();
    eligible = true; session.start(); session.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(send.mock.calls.map(([c]) => c.type)).toEqual(["join", "heartbeat"]);
    const first = send.mock.calls[0]![0].sessionId;
    eligible = false; session.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(send.mock.calls.at(-1)?.[0]).toEqual({ type: "leave", sessionId: first });
    expect(receive).toHaveBeenLastCalledWith([]);
    eligible = true; session.start();
    expect(send.mock.calls.at(-1)?.[0].sessionId).not.toBe(first);
    session.stop();
  });
  it("does not overlap requests or render a late response after leaving", async () => {
    vi.useFakeTimers();
    let resolve!: (visitors: MarketVisitor[]) => void;
    const send = vi.fn((command: MarketPresenceCommand) => command.type === "leave"
      ? Promise.resolve([]) : new Promise<MarketVisitor[]>(r => { resolve = r; }));
    const receive = vi.fn();
    const session = createMarketPresenceSession({ eligible: () => true, position: () => position, receive, send });
    session.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).toHaveBeenCalledTimes(1);
    session.stop();
    resolve([{ playerId: "old", name: "Old visitor", position }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith([]);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("clears stale visitors on connection failure and retries without a tight loop", async () => {
    vi.useFakeTimers();
    const receive = vi.fn();
    const send = vi.fn<(command: MarketPresenceCommand) => Promise<readonly MarketVisitor[] | null>>(async () => { throw new Error("Offline"); });
    const session = createMarketPresenceSession({ eligible: () => true, position: () => position, receive, send });
    session.start();
    await vi.advanceTimersByTimeAsync(15000);
    expect(receive).toHaveBeenCalledWith([]);
    expect(send.mock.calls.length).toBeLessThanOrEqual(31);
    session.stop();
  });
});
