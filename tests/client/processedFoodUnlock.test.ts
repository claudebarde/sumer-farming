import { describe, expect, it } from "vitest";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { marketUnlockLevel } from "../../src/game-data/progression";
import type { GameCommand } from "../../src/schemas/gameCommands";

const id = "00000000-0000-4000-8000-000000000001";

describe("finished food market unlocks", () => {
  it.each(["beer", "bread"] as const)("gates every %s trade at its building's construction level", itemKey => {
    const building: GameCommand = {
      type: itemKey === "beer" ? "build_brewery" : "build_bread_oven",
      target: { column: 3, row: 3 }, expectedFarmVersion: 1
    };
    const requiredLevel = commandUnlockLevel(building);
    expect(requiredLevel).toBe(6);
    const trades: readonly GameCommand[] = [
      { type: "buy_from_npc_market", itemKey, quantity: 1, expectedUnitPrice: 8, expectedFarmVersion: 1, idempotencyKey: id },
      { type: "sell_to_npc_market", itemKey, quantity: 1, expectedUnitPrice: 8, expectedFarmVersion: 1, idempotencyKey: id },
      { type: "create_market_sell_order", itemKey, quantity: 1, unitPrice: 8, expectedFarmVersion: 1, idempotencyKey: id },
      { type: "buy_market_sell_order", orderId: id, quantity: 1, expectedUnitPrice: 8, expectedFarmVersion: 1, idempotencyKey: id }
    ];
    for (const command of trades) {
      expect(commandUnlockLevel(command, itemKey)).toBe(requiredLevel);
      for (let level = 1; level <= 8; level++) {
        expect(level >= marketUnlockLevel(itemKey)).toBe(level >= requiredLevel);
        expect(level >= commandUnlockLevel(command, itemKey)).toBe(level >= requiredLevel);
      }
    }
  });
  it("still allows ingredients at level 5 without unlocking finished goods", () => {
    expect(marketUnlockLevel("flour")).toBe(5);
    expect(marketUnlockLevel("brewersGroats")).toBe(5);
    expect(marketUnlockLevel("beer")).toBe(6);
    expect(marketUnlockLevel("bread")).toBe(6);
  });
});
