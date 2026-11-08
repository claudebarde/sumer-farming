import { describe, expect, it } from "vitest";
import { getMerchantVisit } from "../../src/client/game/phaser/merchantVisit";
import { MERCHANT_TRAVEL_MS, REQUEST_CYCLE_MS, REQUEST_OPEN_MS } from "../../src/game-data/npcRequests";

const anchor = 100_000;
const board = { cycle: 0, closesAt: new Date(anchor + REQUEST_OPEN_MS).toISOString() };
describe("merchant visit", () => {
  it("holds the final confirmation, departs on close, and stays away after reload", () => {
    const completed = { ...board, visitCompleted: true };
    const departureAt = anchor + 10000;
    expect(getMerchantVisit(completed, departureAt, { holdCompleted: true })).toEqual({ phase: "stopped" });
    expect(getMerchantVisit(completed, departureAt, { departureAt })).toEqual({ phase: "departing", progress: 0 });
    expect(getMerchantVisit(completed, departureAt + MERCHANT_TRAVEL_MS / 2, { departureAt })).toEqual({ phase: "departing", progress: 0.5 });
    expect(getMerchantVisit(completed, departureAt + MERCHANT_TRAVEL_MS, { departureAt })).toEqual({ phase: "away" });
    expect(getMerchantVisit(completed, departureAt)).toEqual({ phase: "away" });
    expect(getMerchantVisit(completed, anchor + REQUEST_OPEN_MS)).toEqual({ phase: "away" });
    expect(getMerchantVisit(completed, anchor + REQUEST_CYCLE_MS - MERCHANT_TRAVEL_MS)).toEqual({ phase: "arriving", progress: 0 });
    expect(getMerchantVisit(completed, anchor + REQUEST_CYCLE_MS)).toEqual({ phase: "stopped" });
  });
  it("arrives during the 15 seconds before opening", () => {
    expect(getMerchantVisit(board, anchor - MERCHANT_TRAVEL_MS - 1)).toEqual({ phase: "away" });
    expect(getMerchantVisit(board, anchor - MERCHANT_TRAVEL_MS)).toEqual({ phase: "arriving", progress: 0 });
    expect(getMerchantVisit(board, anchor - MERCHANT_TRAVEL_MS / 2)).toEqual({ phase: "arriving", progress: 0.5 });
  });
  it("stops for exactly 24 hours then departs", () => {
    expect(getMerchantVisit(board, anchor)).toEqual({ phase: "stopped" });
    expect(getMerchantVisit(board, anchor + REQUEST_OPEN_MS - 1)).toEqual({ phase: "stopped" });
    expect(getMerchantVisit(board, anchor + REQUEST_OPEN_MS)).toEqual({ phase: "departing", progress: 0 });
    expect(getMerchantVisit(board, anchor + REQUEST_OPEN_MS + MERCHANT_TRAVEL_MS / 2)).toEqual({ phase: "departing", progress: 0.5 });
    expect(getMerchantVisit(board, anchor + REQUEST_OPEN_MS + MERCHANT_TRAVEL_MS)).toEqual({ phase: "away" });
  });
  it("begins the next arrival before the next existing opening", () => {
    expect(getMerchantVisit(board, anchor + REQUEST_CYCLE_MS - MERCHANT_TRAVEL_MS)).toEqual({ phase: "arriving", progress: 0 });
    expect(getMerchantVisit(board, anchor + REQUEST_CYCLE_MS)).toEqual({ phase: "stopped" });
  });
  it("catches up after offline time without replaying missed visits", () => {
    expect(getMerchantVisit(board, anchor + REQUEST_CYCLE_MS * 8 + 1000)).toEqual({ phase: "stopped" });
    expect(getMerchantVisit(board, anchor + REQUEST_CYCLE_MS * 8 + REQUEST_OPEN_MS * 2)).toEqual({ phase: "away" });
    const current = { cycle: 8, closesAt: new Date(anchor + REQUEST_CYCLE_MS * 8 + REQUEST_OPEN_MS).toISOString() };
    expect(getMerchantVisit(current, anchor + REQUEST_CYCLE_MS * 9 - 7500)).toEqual({ phase: "arriving", progress: 0.5 });
  });
});
