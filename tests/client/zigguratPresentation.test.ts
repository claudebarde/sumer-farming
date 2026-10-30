import { expect, it } from "vitest";
import { zigguratPresentation } from "../../src/client/game/phaser/zigguratPresentation";
it("presents saved foundations work and catches up after time away", () => {
  const start = 1_000_000, end = start + 6 * 3600000;
  const job = { type: "building" as const, stage: 0, startedAt: new Date(start).toISOString(), completesAt: new Date(end).toISOString() };
  expect(zigguratPresentation(job, start)).toEqual({ stage: "worksite", fraction: 0 });
  expect(zigguratPresentation(job, start + 3 * 3600000)).toEqual({ stage: "worksite", fraction: 0.5 });
  expect(zigguratPresentation(job, end)).toEqual({ stage: "foundations", fraction: null });
  expect(zigguratPresentation(job, end + 86400000)).toEqual({ stage: "foundations", fraction: null });
  expect(zigguratPresentation({ type: "interest" }, start)).toEqual({ stage: "site", fraction: null });
});

it("shows every approved stage and the completed monument after each deadline", () => {
  const before = ["site", "foundations", "lower-terrace", "upper-terraces"];
  const during = ["worksite", "lower-terrace", "upper-terraces", "upper-terraces"];
  const after = ["foundations", "lower-terrace", "upper-terraces", "completed"];
  for (let stage = 0; stage < 4; stage++) {
    expect(zigguratPresentation({type:"fundraising",stage,openedAt:new Date(0).toISOString()},0).stage).toBe(before[stage]);
    const job = {type:"building" as const,stage,startedAt:new Date(0).toISOString(),completesAt:new Date(1000).toISOString()};
    expect(zigguratPresentation(job,500)).toEqual({stage:during[stage],fraction:0.5});
    expect(zigguratPresentation(job,1000)).toEqual({stage:after[stage],fraction:null});
  }
  expect(zigguratPresentation({type:"complete",completedAt:new Date(0).toISOString()},1000)).toEqual({stage:"completed",fraction:null});
});
