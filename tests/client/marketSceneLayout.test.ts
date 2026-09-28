import { describe, expect, it } from "vitest";
import { marketSceneLayout } from "../../src/client/game/phaser/marketSceneLayout";
import { marketUiStore } from "../../src/client/stores/marketUiStore";

describe("market scene", () => {
  it.each([10, 12, 16, 24])("fits a square road and stands within %i columns", columns => {
    const layout = marketSceneLayout(columns);
    expect(layout.right - layout.left).toBe(layout.bottom - layout.top);
    expect(layout.right).toBeLessThan(columns);
    expect(layout.farm.row + 2).toBe(layout.roadRow);
    expect(layout.farm.column + 2).toBeLessThan(layout.left);
    expect(layout.farmer.column).toBe(layout.farm.column + 1);
    expect(layout.farmer.row).toBe(layout.farm.row + 2);
    expect(layout.farmer.column).toBeLessThan(layout.left);
    expect(layout.farmer.row).toBe(layout.roadRow);
    for (const stand of layout.stands) {
      expect(stand.column).toBeGreaterThan(layout.left);
      expect(stand.column + 2).toBeLessThanOrEqual(layout.right);
      for (let row = stand.row; row < stand.row + 2; row++) {
        expect(row).not.toBe(layout.top);
        expect(row).not.toBe(layout.bottom);
      }
    }
  });
  it("closes trade dialogs on entering or leaving the market", () => {
    marketUiStore.getState().openMarket("barley");
    marketUiStore.getState().setLocation("market");
    expect(marketUiStore.getState().isOpen).toBe(false);
    marketUiStore.getState().openMarket("beer");
    marketUiStore.getState().setLocation("farm");
    expect(marketUiStore.getState().isOpen).toBe(false);
  });
});
