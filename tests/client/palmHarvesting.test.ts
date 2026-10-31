import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { currentCropWork, cropWorkReserved, CropWorkSchema } from "../../src/game-data/cropWork";
import { palmHarvestPose, palmHarvestCarrier } from "../../src/client/game/phaser/palmHarvesting";
import { palmPlantingPosition } from "../../src/client/game/phaser/palmPlanting";
import PalmHarvestProgress from "../../src/client/components/PalmHarvestProgress";

const target = { column: 4, row: 8 };
const destination = { column: 5, row: 5 };
const job = CropWorkSchema.parse({ id: "00000000-0000-4000-8000-000000000001", cropId: "00000000-0000-4000-8000-000000000002", cropKey: "datePalm", action: "harvest", quantity: 2,
  startedAt: 0, workStartsAt: 2000, workEndsAt: 12000, completesAt: 15000,
  outbound: [{ column: 4, row: 7 }, target], inbound: [target, { column: 4, row: 6 }, destination] });

it("walks to the approved right-side work position and leaves from the same position", () => {
  expect(palmHarvestPose(job, target, 0)).toMatchObject({ phase: "approaching", position: job.outbound[0] });
  expect(palmHarvestPose(job, target, 2000)).toMatchObject({ phase: "harvesting", position: palmPlantingPosition(target), percentage: 0 });
  expect(palmHarvestPose(job, target, 12000)).toMatchObject({ phase: "delivering", position: palmPlantingPosition(target) });
});
it("resumes elapsed work and delivery without restarting or requiring callbacks", () => {
  expect(palmHarvestPose(job, target, 7000)).toMatchObject({ phase: "harvesting", elapsed: 5000, percentage: 50, remainingSeconds: 5 });
  expect(palmHarvestPose(job, target, 13500)).toMatchObject({ phase: "delivering", percentage: 50 });
  expect(palmHarvestPose(job, target, 86400000)).toMatchObject({ phase: "complete", position: destination, remainingSeconds: 0 });
});
it("shows the harvest countdown and left-to-right elapsed meter", () => {
  const html = renderToStaticMarkup(createElement(PalmHarvestProgress, { job, now: 7000 }));
  expect(html).toContain("Harvesting dates…");
  expect(html).toContain("5s remaining");
  expect(html).toContain('aria-valuenow="50"');
  expect(html).toContain('stroke-dashoffset="50"');
});
it("carries two baskets only during saved delivery, including reload and reduced motion", () => {
  expect(palmHarvestCarrier(job, target, 1000)).toBeNull();
  expect(palmHarvestCarrier(job, target, 11999)).toBeNull();
  expect(palmHarvestCarrier(job, target, 12000)).toEqual({ texture: "farmer-dates-walk-0", flipX: true });
  expect(palmHarvestCarrier(job, target, 12320)?.texture).toBe("farmer-dates-walk-2");
  expect(palmHarvestCarrier(job, target, 13500, true)?.texture).toBe("farmer-dates-idle");
  expect(palmHarvestCarrier(job, target, 15000)).toBeNull();
  expect(palmHarvestCarrier(job, target, 86400000)).toBeNull();
  const leftward = { ...job, inbound: [target, { column: 2, row: 8 }] };
  expect(palmHarvestCarrier(leftward, target, 12000)?.flipX).toBe(false);
  expect(palmHarvestCarrier(leftward, target, 13500)?.flipX).toBe(false);
});

it("presents the next queued sesame journey at its saved deadline without waiting for a refresh", () => {
  const first = { ...job, cropKey: "sesame" as const, quantity: 3, batch: { id: job.id, index: 0, total: 2 } };
  const second = { ...first, id: "00000000-0000-4000-8000-000000000003", startedAt: 15000, workStartsAt: 17000, workEndsAt: 27000, completesAt: 30000,
    outbound: [destination, target], batch: { ...first.batch, index: 1 } };
  const production = { cropWork: first, cropWorkQueue: [second] };
  expect(currentCropWork(production, 14999)?.id).toBe(first.id);
  const active = currentCropWork(production, 15000)!;
  expect(active.id).toBe(second.id);
  expect(palmHarvestPose(active, target, 15000)).toMatchObject({ phase: "approaching", position: destination });
  expect(palmHarvestPose(currentCropWork(production, 20000)!, target, 20000).phase).toBe("harvesting");
  const html = renderToStaticMarkup(createElement(PalmHarvestProgress, { job: active, now: 20000 }));
  expect(html).toContain("2/2 fields");
  expect(html).toContain("Harvesting sesame");
  expect(cropWorkReserved(production, "sesame")).toBe(6);
  expect(cropWorkReserved(production, "dates")).toBe(0);
});

it("uses sesame baskets throughout delivery and resumes the saved walking cycle", () => {
  const sesame = { ...job, cropKey: "sesame" as const, quantity: 3 };
  expect(palmHarvestCarrier(sesame, target, 11999)).toBeNull();
  expect([12000, 12160, 12320, 12480, 12640].map(now => palmHarvestCarrier(sesame, target, now)?.texture)).toEqual([
    "farmer-sesame-walk-0", "farmer-sesame-walk-1", "farmer-sesame-walk-2", "farmer-sesame-walk-3", "farmer-sesame-walk-0"
  ]);
  expect(palmHarvestCarrier(sesame, target, 13500, true)?.texture).toBe("farmer-sesame-idle");
  expect(palmHarvestCarrier(sesame, target, 15000)).toBeNull();
  expect(palmHarvestCarrier(sesame, target, 86400000)).toBeNull();
  expect(palmHarvestCarrier({ ...sesame, inbound: [target, { column: 2, row: 8 }] }, target, 13500)?.flipX).toBe(false);
});
