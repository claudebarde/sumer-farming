import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { neighbourhoodPlots, neighbourhoodPlotTiles, neighbourhoodRoads, neighbourhoodRoadMask, neighbourhoodScenery, neighbourhoodBounds } from "../../src/client/game/phaser/neighbourhoodLayout";

it("maps only saved members to their assigned slots, leaving other lots empty", () => {
  const plots = neighbourhoodPlots([{ slot: 4, name: "Lugalzagesi", level: 7, isYou: true }, { slot: 9, name: "Gudea", level: 3, isYou: false }]);
  expect(plots).toHaveLength(10);
  expect(plots.filter(p => p.type === "neighbour")).toHaveLength(1);
  expect(plots.filter(p => p.type === "empty")).toHaveLength(8);
  expect(plots[3]).toMatchObject({ type: "self", name: "Lugalzagesi", level: 7 });
  expect(plots[8]).toMatchObject({ type: "neighbour", name: "Gudea", level: 3 });
  expect(new Set(plots.map(p => `${p.x},${p.y}`)).size).toBe(10);
});

it("does not rearrange the map when a player's name or level changes", () => {
  const positions = (name: string, level: number) => neighbourhoodPlots([{ slot: 4, name, level, isYou: true }]).map(({ slot, x, y }) => ({ slot, x, y }));
  expect(positions("One", 7)).toEqual(positions("Two", 9));
});

it("uses a one-tile border enclosing four building tiles", () => {
  expect(neighbourhoodPlotTiles.filter(t => t.arable)).toHaveLength(12);
  expect(neighbourhoodPlotTiles.filter(t => !t.arable)).toEqual([
    { column: 1, row: 1, arable: false }, { column: 2, row: 1, arable: false },
    { column: 1, row: 2, arable: false }, { column: 2, row: 2, arable: false },
  ]);
});

it("uses grid-aligned roads with matching junction textures, outside all farm plots", () => {
  for (const plot of neighbourhoodPlots([])) {
    expect(Number.isInteger(plot.column) && Number.isInteger(plot.row)).toBe(true);
    expect(neighbourhoodRoads.some(p => p.column >= plot.column && p.column < plot.column + 4 &&
      p.row >= plot.row && p.row < plot.row + 4)).toBe(false);
  }
  expect(neighbourhoodRoadMask(1, 2)).toBe(15);
  expect(neighbourhoodRoadMask(-6, -4)).toBe(12);
});

it("keeps the map read-only with a level-seven entry and return navigation", () => {
  const scene = readFileSync(new URL("../../src/client/game/phaser/scenes/NeighbourhoodScene.ts", import.meta.url), "utf8");
  expect(scene).not.toMatch(/executeGameCommand|fetch\(|localStorage/);
  expect(scene).toContain('this.scale.off("resize"');
  expect(scene).toContain('const ground = this.add.graphics().setDepth(-1000)');
  expect(scene).toContain('road ? 0xd9ad69 : cultivated ? 0x9f6429 : 0xd0b77b');
  expect(scene).not.toContain("strokePoints");
  const ui = readFileSync(new URL("../../src/client/components/IsometricFarm.tsx", import.meta.url), "utf8");
  expect(ui).toContain('(snapshot?.farm.progression?.level ?? 1) >= 7 && <Tooltip.Root {...navigationTooltip("neighbourhood")}>');
  const controls = ui.slice(ui.indexOf('<div className={styles.manageControls}>'), ui.indexOf('<EstateManagementContent'));
  expect(controls.match(/styles.manageButton}/g)).toHaveLength(3); // Manage, neighbourhood and road planning.
  expect(controls).toContain('<div className={styles.manageButtonRow}>');
  expect(controls).toContain('aria-label="Manage"><BuildingActionIcon kind="manage" /></button>');
  expect(controls).toContain('Manage your estate<Tooltip.Arrow');
  expect(controls).toContain('View your neighbourhood<Tooltip.Arrow');
  expect(controls).not.toContain('title="Manage"');
  expect(controls).not.toContain('title="Neighbourhood"');
  expect(controls).toContain('<BuildingActionIcon kind="neighbourhood" /></button>');
  expect(controls.indexOf('aria-label="Manage"')).toBeLessThan(controls.indexOf('aria-label="Neighbourhood"'));
  expect(controls.indexOf('aria-label="Neighbourhood"')).toBeLessThan(controls.indexOf("<ShekelBalance"));
  expect(ui).toContain('scene.switch("neighbourhood")');
  expect(ui).toContain('neighbourhoodScene.current?.scene.switch("isometric-farm")');
  const neighbourhoodControls = ui.slice(ui.indexOf('{neighbourhoodOpen && <div className={styles.manageControls}>'), ui.indexOf('<div className={styles.toolbar}>'));
  expect(neighbourhoodControls.match(/styles.manageIconButton/g)).toHaveLength(2);
  expect(neighbourhoodControls).toContain('<div className={styles.manageButtonRow}>');
  expect(neighbourhoodControls).toContain('<BuildingActionIcon kind="leaderboard" />');
  expect(neighbourhoodControls).toContain('<BuildingActionIcon kind="neighbourhood" />');
  expect(neighbourhoodControls).toContain('View the leaderboard<Tooltip.Arrow');
  expect(neighbourhoodControls).toContain('Back to your farm<Tooltip.Arrow');
  expect(neighbourhoodControls.indexOf('aria-label="Leaderboard"')).toBeLessThan(neighbourhoodControls.indexOf('aria-label="Back to your farm"'));
});

it("shares ten bushes and ten rocks on distinct ground tiles, clear of plots, roads and market", () => {
  expect(neighbourhoodScenery.filter(p => p.type === "bush")).toHaveLength(10);
  expect(neighbourhoodScenery.filter(p => p.type === "rock")).toHaveLength(10);
  expect(new Set(neighbourhoodScenery.map(p => `${p.column}:${p.row}`)).size).toBe(20);
  for (const p of neighbourhoodScenery) {
    expect(p.column).toBeGreaterThanOrEqual(neighbourhoodBounds.minimumColumn);
    expect(p.column).toBeLessThanOrEqual(neighbourhoodBounds.maximumColumn);
    expect(p.row).toBeGreaterThanOrEqual(neighbourhoodBounds.minimumRow);
    expect(p.row).toBeLessThanOrEqual(neighbourhoodBounds.maximumRow);
    expect(neighbourhoodRoads.some(r => r.column === p.column && r.row === p.row)).toBe(false);
    expect(neighbourhoodPlots([]).some(f => p.column >= f.column && p.column < f.column + 4 &&
      p.row >= f.row && p.row < f.row + 4)).toBe(false);
    expect(p.column >= 2 && p.column <= 3 && p.row >= 3 && p.row <= 4).toBe(false);
  }
});
