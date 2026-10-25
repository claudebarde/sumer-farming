import { expect, it } from "vitest";
import { DATE_HARVEST_PREVIEW_SOURCES, dateHarvestPreviewFrame, dateHarvestPreviewOrigin, dateHarvestPreviewBasketsVisible } from "../../src/client/game/phaser/dateHarvestPreview";

it("cycles through reach, cut, lower and release with the sickle sprites", () => {
  expect(Object.keys(DATE_HARVEST_PREVIEW_SOURCES)).toHaveLength(4);
  for (const url of Object.values(DATE_HARVEST_PREVIEW_SOURCES)) expect(url).toContain("farmer-harvest-dates-sickle-");
  expect(dateHarvestPreviewFrame(0)).toBe("dateHarvestReach");
  expect(dateHarvestPreviewFrame(450)).toBe("dateHarvestCut");
  expect(dateHarvestPreviewFrame(900)).toBe("dateHarvestLower");
  expect(dateHarvestPreviewFrame(1350)).toBe("dateHarvestRelease");
  expect(dateHarvestPreviewFrame(1800)).toBe(dateHarvestPreviewFrame(0));
});
it("holds the original pose for reduced motion and handles negative elapsed time", () => {
  expect(dateHarvestPreviewFrame(1200, true)).toBe("dateHarvestReach");
  expect(dateHarvestPreviewFrame(-1)).toBe("dateHarvestReach");
});
it("registers the feet independently of the sickle silhouette", () => {
    const origin = dateHarvestPreviewOrigin();
    expect(origin.x).toBe(0.54);
    expect(origin.y).toBeGreaterThan(0.85);
    expect(origin.y).toBeLessThan(0.9);
});
it("reveals baskets halfway through the first stroke and keeps them visible", () => {
  expect(dateHarvestPreviewBasketsVisible(899)).toBe(false);
  expect(dateHarvestPreviewBasketsVisible(900)).toBe(true);
  expect(dateHarvestPreviewBasketsVisible(1800)).toBe(true);
  expect(dateHarvestPreviewBasketsVisible(0, true)).toBe(true);
});
