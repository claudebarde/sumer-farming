import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ command: vi.fn(), evaluate: vi.fn(), notify: vi.fn(), setReady: vi.fn(), getState: vi.fn() }));
vi.mock("../../src/client/api/gameActions", () => ({ executeGameCommand: mocks.command }));
vi.mock("../../src/game-core/farm/progression", () => ({ evaluateProgression: mocks.evaluate }));
vi.mock("../../src/client/stores/farmStore", () => ({ farmStore: { getState: mocks.getState } }));
vi.mock("../../src/client/stores/notificationStore", () => ({ notificationStore: { getState: () => ({ notifyLevel: mocks.notify }) } }));
import { claimFarmLevel } from "../../src/client/api/claimFarmLevel";
const snapshot = { farm: { id: "farm", playerId: "player", version: 8, progression: { level: 3 } } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getState.mockReturnValue({ farm: { type: "ready", snapshot }, setReady: mocks.setReady });
  mocks.evaluate.mockReturnValue({ canClaim: true, level: 3, nextLevel: 4 });
});
it("does not submit an unavailable level", async () => {
  mocks.evaluate.mockReturnValue({ canClaim: false });
  expect(await claimFarmLevel()).toBeNull();
  expect(mocks.command).not.toHaveBeenCalled();
});
it("guards duplicate claims and updates the snapshot and unlock notification once", async () => {
  const next = { farm: { ...snapshot.farm, progression: { level: 4 } } };
  mocks.command.mockResolvedValue(next);
  const first = claimFarmLevel();
  expect(await claimFarmLevel()).toBeNull();
  expect(await first).toEqual(next);
  expect(mocks.command).toHaveBeenCalledExactlyOnceWith({ type: "claim_farm_level", expectedLevel: 3, expectedFarmVersion: 8 });
  expect(mocks.setReady).toHaveBeenCalledExactlyOnceWith(next);
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith("player", "farm", 4);
});
it("allows retry after a failed claim without announcing a level", async () => {
  mocks.command.mockRejectedValue(new Error("Unavailable"));
  await expect(claimFarmLevel()).rejects.toThrow("Unavailable");
  await expect(claimFarmLevel()).rejects.toThrow("Unavailable");
  expect(mocks.command).toHaveBeenCalledTimes(2);
  expect(mocks.notify).not.toHaveBeenCalled();
});
