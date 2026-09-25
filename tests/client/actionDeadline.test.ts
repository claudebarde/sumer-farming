import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleActionDeadline } from "../../src/client/game/phaser/actionDeadline";

describe("action deadlines after tab suspension", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => vi.useRealTimers());

  it("finishes overdue sowing immediately on return, exactly once", () => {
    const finish = vi.fn();
    const deadline = scheduleActionDeadline(10000, finish);
    vi.advanceTimersByTime(3000);
    // Time passed while the browser suspended callbacks.
    vi.setSystemTime(60000);
    deadline.reconcile();
    deadline.reconcile();
    vi.runAllTimers();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("waits only the real remaining duration after an early return", () => {
    const finish = vi.fn();
    const deadline = scheduleActionDeadline(10000, finish);
    vi.setSystemTime(7000);
    deadline.reconcile();
    vi.advanceTimersByTime(2999);
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("does not touch a destroyed scene after cancellation", () => {
    const finish = vi.fn();
    const deadline = scheduleActionDeadline(10000, finish);
    deadline.cancel();
    vi.setSystemTime(60000);
    deadline.reconcile();
    vi.runAllTimers();
    expect(finish).not.toHaveBeenCalled();
  });

  it("finishes normally without a visibility event", () => {
    const finish = vi.fn();
    scheduleActionDeadline(10000, finish);
    vi.advanceTimersByTime(10000);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate asynchronous server completion requests", () => {
    const finish = vi.fn(() => new Promise<void>(() => {}));
    const deadline = scheduleActionDeadline(10000, () => { void finish(); });
    vi.setSystemTime(60000);
    deadline.reconcile();
    deadline.reconcile();
    vi.runAllTimers();
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
