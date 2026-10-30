import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { FarmSnapshot } from "../../src/schemas/farm";
import { CropWorkSchema, cropWorkReserved } from "../../src/game-data/cropWork";
import { cropSprite, nextCropTransition } from "../../src/client/game/phaser/cropPresentation";
import { palmHarvestPose, palmHarvestCarrier } from "../../src/client/game/phaser/palmHarvesting";
import { palmPlantingPose } from "../../src/client/game/phaser/palmPlanting";
import PalmHarvestProgress from "../../src/client/components/PalmHarvestProgress";
import PalmPlantingProgress from "../../src/client/components/PalmPlantingProgress";

const crop: FarmSnapshot["crops"][number] = { id: "00000000-0000-4000-8000-000000000001", cropKey: "sesame", column: 4, row: 8,
  sowingStartedAt: new Date(0).toISOString(), plantedAt: new Date(10000).toISOString(), growthCompletesAt: new Date(3610000).toISOString(),
  harvestStartedAt: null, harvestCompletesAt: null, decayEligible: false };
it("uses all four approved stages at 15, 35 and 60 minutes and remains ripe without barley decay", () => {
  expect(cropSprite(crop, 9999)).toBeNull();
  for (const [minute, texture] of [[0,"sesameYoung"],[14,"sesameYoung"],[15,"sesameGrowing"],[34,"sesameGrowing"],[35,"sesameFlowering"],[59,"sesameFlowering"],[60,"sesameRipe"],[3000,"sesameRipe"]] as const)
    expect(cropSprite(crop,10000+minute*60000)).toBe(texture);
  expect(nextCropTransition(crop, 10000)).toBe(910000);
  expect(nextCropTransition(crop, 910000)).toBe(2110000);
  expect(cropSprite({ ...crop, harvestCompletesAt: new Date(4000000).toISOString() }, 4000000)).toBeNull();
});
const target = { column: 4, row: 8 }, destination = { column: 5, row: 5 };
const job = CropWorkSchema.parse({ id: crop.id, cropId: crop.id, cropKey: "sesame", action: "harvest", quantity: 3,
  startedAt: 0, workStartsAt: 2000, workEndsAt: 12000, completesAt: 15000,
  outbound: [{ column: 4, row: 7 }, target], inbound: [target, destination] });
it("works in the field, carries baskets only during delivery and reserves exactly three slots", () => {
  expect(palmHarvestPose(job,target,2000).position).toEqual(target);
  expect(palmPlantingPose({...job,action:"plant"},target,7000).position).toEqual(target);
  expect(palmHarvestCarrier(job,target,12000)).not.toBeNull();
  expect(palmHarvestPose(job,target,15000).position).toEqual(destination);
  expect(cropWorkReserved({cropWork:job},"sesame")).toBe(3);
  expect(cropWorkReserved({cropWork:job},"dates")).toBe(0);
  expect(cropWorkReserved({cropWork:{...job,settled:true}},"sesame")).toBe(0);
});
it("shows sesame-specific labels and countdowns in the shared progress UI", () => {
  expect(renderToStaticMarkup(createElement(PalmHarvestProgress,{job,now:7000}))).toContain("Harvesting sesame…");
  const html=renderToStaticMarkup(createElement(PalmPlantingProgress,{job:{...job,action:"plant"},now:7000}));
  expect(html).toContain("Planting sesame…"); expect(html).toContain("5s remaining");
  expect(html).toContain('aria-valuenow="50"');
});
