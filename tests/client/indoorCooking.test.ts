import { describe, expect, it } from "vitest";
import { CookingSchema } from "../../src/game-data/kitchen";
import { indoorCookingPose } from "../../src/game-core/home/indoorCooking";

const job = CookingSchema.parse({
  id: "00000000-0000-4000-8000-000000000001", buildingId: "00000000-0000-4000-8000-000000000002", meal: "dateCakes",
  interior: { kitchen: { key: "indoor-kitchen", x: 800, y: 700 }, departedAt: 1000,
    path: [{ x: 700, y: 800 }, { x: 800, y: 800 }, { x: 800, y: 700 }] },
  startedAt: new Date(3000).toISOString(), completesAt: new Date(33000).toISOString()
});
describe("saved indoor cooking presentation", () => {
  it("resumes midway through the saved route without restarting travel", () => {
    expect(indoorCookingPose(job, 1500)).toMatchObject({ x: 750, y: 800, walking: true, distance: 50 });
    expect(indoorCookingPose(job, 2500)).toMatchObject({ x: 800, y: 750, walking: true, distance: 150 });
  });
  it("stays at the table after arrival and after an offline completion", () => {
    expect(indoorCookingPose(job, 8000)).toMatchObject({ x: 800, y: 700, walking: false });
    expect(indoorCookingPose(job, 50000)).toMatchObject({ x: 800, y: 700, walking: false });
  });
});
