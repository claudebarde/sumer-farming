import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CropWorkSchema } from "../../src/game-data/cropWork";
import { palmPlantingPose, palmPlantingPosition } from "../../src/client/game/phaser/palmPlanting";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";
import PalmPlantingProgress from "../../src/client/components/PalmPlantingProgress";
import { palmTendingTexture } from "../../src/client/game/phaser/palmTending";
const target = { column: 4, row: 8 };
const job = CropWorkSchema.parse({ id: "00000000-0000-4000-8000-000000000001", cropId: "00000000-0000-4000-8000-000000000002", cropKey: "datePalm", action: "plant", quantity: 0,
  startedAt: 0, workStartsAt: 2000, workEndsAt: 12000, completesAt: 12000,
  outbound: [{ column: 4, row: 6 }, { column: 4, row: 7 }, target], inbound: [target] });

it("keeps the farmer on the right side of the palm's own tile", () => {
  const p = isoPoint(palmPlantingPosition(target)), centre = isoPoint(target);
  expect(p.x - centre.x).toBeCloseTo(27);
  expect(p.y - centre.y).toBeCloseTo(5);
});
it("samples travel, work and completion directly from the saved timeline", () => {
  expect(palmPlantingPose(job, target, 0).position).toEqual(job.outbound[0]);
  expect(palmPlantingPose(job, target, 1999).traveling).toBe(true);
  expect(palmPlantingPose(job, target, 2000)).toMatchObject({ working: true, percentage: 0, remainingSeconds: 10 });
  expect(palmPlantingPose(job, target, 7000)).toMatchObject({ working: true, percentage: 50, remainingSeconds: 5 });
  expect(palmPlantingPose(job, target, 12000)).toMatchObject({ working: false, traveling: false, percentage: 100, remainingSeconds: 0 });
  expect(palmPlantingPose(job, target, 86400000).position).toEqual(palmPlantingPosition(target));
});
it("renders a circular work meter and countdown without changing barley UI", () => {
  const html = renderToStaticMarkup(createElement(PalmPlantingProgress, { job, now: 7000 }));
  expect(html).toContain('aria-valuenow="50"');
  expect(html).toContain('stroke-dashoffset="50"');
  expect(html).toContain("5s remaining");
  expect(html).toContain("Planting date palm");
});
it("uses the same saved work and rest timing for tending with its dedicated motion", () => {
  const tending = { ...job, action: "tend" as const };
  expect(palmTendingTexture(0)).toBe("farmer-tend-0");
  expect(palmTendingTexture(350)).toBe("farmer-tend-1");
  expect(palmTendingTexture(700)).toBe("farmer-tend-2");
  expect(palmTendingTexture(1050)).toBe("farmer-tend-1");
  expect(palmTendingTexture(1400)).toBe("farmer-tend-0");
  expect(palmTendingTexture(700, true)).toBe("farmer-tend-0");
  expect(palmPlantingPose(tending, target, 86400000)).toMatchObject({ working: false, traveling: false, position: palmPlantingPosition(target) });
  const html = renderToStaticMarkup(createElement(PalmPlantingProgress, { job: tending, now: 7000 }));
  expect(html).toContain("Tending date palm");
  expect(html).toContain("5s remaining");
  expect(html).toContain('stroke-dashoffset="50"');
});
