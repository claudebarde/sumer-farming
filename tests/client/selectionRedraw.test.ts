import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { IsometricFarmScene } from "../../src/client/game/phaser/scenes/IsometricFarmScene";

type SceneHarness = {
  ready: boolean; graphicsLost: boolean; selectionRedrawPending: boolean;
  selected: { column: number; row: number } | null;
  plantingSelection: readonly { column: number; row: number }[] | null;
  commandPending: boolean;
  clearSelection: IsometricFarmScene["clearSelection"];
  setPlantingSelection: IsometricFarmScene["setPlantingSelection"];
  flushSelectionRedraw(): void;
};
const harness = () => {
  const report = vi.fn();
  const scene = Object.assign(Object.create(IsometricFarmScene.prototype), {
    ready: true, graphicsLost: false, selectionRedrawPending: false,
    selected: { column: 2, row: 3 }, report, stopSweeping: vi.fn(),
    walkProgress: 0, walkPath: [],
  }) as SceneHarness;
  const draw = vi.fn(() => { scene.selectionRedrawPending = false; });
  Object.assign(scene, { draw });
  return { scene, draw, report };
};
it("coalesces action-start selection changes while reporting popup closure immediately", () => {
  const { scene, draw, report } = harness();
  scene.setPlantingSelection(null, true);
  scene.clearSelection();
  expect(scene.commandPending).toBe(true);
  expect(scene.selected).toBeNull();
  expect(report).toHaveBeenCalledWith(null);
  expect(draw).not.toHaveBeenCalled();
  scene.flushSelectionRedraw();
  scene.flushSelectionRedraw();
  expect(draw).toHaveBeenCalledTimes(1);
});
it("renders the latest field selection and retains pending work while graphics are unavailable", () => {
  const { scene, draw } = harness();
  scene.graphicsLost = true;
  scene.setPlantingSelection([{ column: 2, row: 7 }]);
  const latest = [{ column: 2, row: 7 }, { column: 3, row: 7 }];
  scene.setPlantingSelection(latest);
  scene.flushSelectionRedraw();
  expect(draw).not.toHaveBeenCalled();
  expect(scene.plantingSelection).toBe(latest);
  scene.graphicsLost = false;
  scene.flushSelectionRedraw();
  expect(draw).toHaveBeenCalledTimes(1);
});
