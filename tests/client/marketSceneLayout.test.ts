import { describe, expect, it } from "vitest";
import { marketRoadTiles, marketSceneLayout, marketSceneZoom, marketStandStop, marketWalkingPath } from "../../src/client/game/phaser/marketSceneLayout";
import { marketUiStore } from "../../src/client/stores/marketUiStore";

describe("market scene", () => {
  it.each([10, 12, 16, 24])("walks between every stand and home using only connected roads (%i columns)", columns => {
    const layout = marketSceneLayout(columns);
    const roads = new Set(marketRoadTiles(columns).map(p => `${p.column}:${p.row}`));
    const stops = [layout.farmer, { column: 0, row: layout.roadRow }, ...layout.stands.map((_, i) => marketStandStop(columns, i))];
    for (const start of stops) for (const target of stops) {
      const path = marketWalkingPath(columns, start, target)!;
      expect(path[0]).toEqual(start);
      expect(path.at(-1)).toEqual(target);
      path.forEach((point, i) => {
        expect(roads.has(`${point.column}:${point.row}`)).toBe(true);
        if (i) expect(Math.abs(point.column - path[i - 1]!.column) + Math.abs(point.row - path[i - 1]!.row)).toBe(1);
        for (const stand of layout.stands) {
          expect(point.column >= stand.column && point.column < stand.column + 2 && point.row >= stand.row && point.row < stand.row + 2).toBe(false);
        }
      });
    }
  });
  it("does not take a shortcut through the market square", () => {
    const columns = 16;
    const path = marketWalkingPath(columns, marketStandStop(columns, 0), marketStandStop(columns, 2))!;
    const layout = marketSceneLayout(columns);
    expect(path.some(p => p.column === layout.left || p.column === layout.right)).toBe(true);
    expect(path.length).toBeGreaterThan(layout.bottom - layout.top + 1);
    expect(marketWalkingPath(columns, layout.farmer, layout.stands[0])).toBeNull();
    expect(new Set(layout.stands.map((_, i) => JSON.stringify(marketStandStop(columns, i)))).size).toBe(3);
  });
  it.each([[1440, 800], [390, 600], [844, 300]])("keeps all three stands on screen at %i×%i", (width, height) => {
    const zoom = marketSceneZoom(width, height, 64);
    const layout = marketSceneLayout(Math.ceil(width / zoom / 64));
    expect(layout.stands).toHaveLength(3);
    for (const stand of layout.stands) {
      expect((stand.column + 2) * 64 * zoom).toBeLessThanOrEqual(width);
      expect((stand.row + 2) * 64 * zoom).toBeLessThanOrEqual(height);
    }
  });
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
