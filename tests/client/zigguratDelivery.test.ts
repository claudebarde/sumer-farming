import { WORKER_MOVE_DURATION_PER_TILE } from "../../src/game-data/movement";
import { expect, it } from "vitest";
import { deliveryPlan, deliveryPose, interestPlan, interestPose, DONKEY_HITCH, ZIGGURAT_DROPOFF } from "../../src/game-data/zigguratDelivery";
import { neighbourhoodMarket, neighbourhoodRoads } from "../../src/game-data/neighbourhoodGeometry";
it("walks every neighbour to the tablet, pauses exactly three seconds and returns home", () => {
  for (let slot = 1; slot <= 10; slot++) {
    const plan = interestPlan(slot);
    const home = deliveryPlan(slot).home;
    expect(interestPose(plan, 0).position).toEqual(home);
    expect(interestPose(plan, plan.travelMs).waiting).toBe(true);
    expect(interestPose(plan, plan.travelMs + 2999).waiting).toBe(true);
    expect(interestPose(plan, plan.travelMs + 3000).waiting).toBe(false);
    expect(interestPose(plan, plan.travelMs + 100).position).toEqual({ column: -3, row: 1.65 });
    expect(interestPose(plan, plan.duration + 100000).position).toEqual(home);
    for (let i = 1; i < plan.route.length; i++) {
      const a = plan.route[i-1]!, b = plan.route[i]!;
      expect(Math.abs(a.column-b.column)+Math.abs(a.row-b.row)).toBeLessThanOrEqual(1);
    }
  }
});
it("routes every plot to the hitch and worksite without crossing the market or ziggurat",()=>{
 for(let slot=1;slot<=10;slot++){
  const plan=deliveryPlan(slot);
  expect(plan.legs.map(l=>l.phase)).toEqual(["fetch","lead-home","load","deliver","unload","return-donkey","walk-home"]);
  for(const leg of plan.legs) for(const [i,p] of leg.route.entries()){
   expect(p.column>=neighbourhoodMarket.column&&p.column<=3&&p.row>=3&&p.row<=4).toBe(false);
   expect(p.column>=-5&&p.column<=-2&&p.row>=-2&&p.row<=1).toBe(false);
   if(i)expect(Math.abs(p.column-leg.route[i-1]!.column)+Math.abs(p.row-leg.route[i-1]!.row)).toBe(1);
  }
  expect(plan.legs[3]!.route.at(-1)).toEqual(ZIGGURAT_DROPOFF);
  const final=deliveryPose(plan,plan.duration+100000);
  expect(final.donkey.position).toEqual(DONKEY_HITCH);expect(final.farmer.position).toEqual(plan.home);expect(final.load).toBe(0);
 }
});
it("uses only roads between the site and shared donkey and shows a loaded outward trip",()=>{
 const plan=deliveryPlan(1);
 const elapsed=plan.legs.slice(0,3).reduce((n,l)=>n+l.duration,0);
 const pose=deliveryPose(plan,elapsed+WORKER_MOVE_DURATION_PER_TILE*2);expect(pose.phase).toBe("deliver");expect(pose.load).toBe(1);
 for(const p of plan.legs[5]!.route) expect(neighbourhoodRoads.some(r=>r.column===p.column&&r.row===p.row)||(p.column===DONKEY_HITCH.column&&p.row===DONKEY_HITCH.row)).toBe(true);
});

it("matches farm following speed for both characters",()=>{
 const plan=deliveryPlan(1);
 const half=deliveryPose(plan,WORKER_MOVE_DURATION_PER_TILE/2);
 expect(half.farmer.travelledTiles).toBeCloseTo(.5);
 const start=plan.legs[0]!.duration;
 const escorted=deliveryPose(plan,start+WORKER_MOVE_DURATION_PER_TILE*2);
 expect(escorted.farmer.travelledTiles).toBeCloseTo(2);
 expect(escorted.donkey.travelledTiles).toBeCloseTo(1.3);
});
