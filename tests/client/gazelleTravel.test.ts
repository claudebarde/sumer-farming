import {describe,it,expect} from "vitest";
import {createGazelleHerd,advanceGazelleHerd} from "../../src/client/game/phaser/gazelleHerd";
import {gazelleTravelDistance,gazelleTravelPose,gazelleTravelObstacles,GAZELLE_TRAVEL_STEP_MS} from "../../src/client/game/phaser/gazelleTravel";
import {gazellesTooClose} from "../../src/client/game/phaser/gazelleMotion";

describe("gazelle entrances and exits",()=>{
  it.each([{scenery:[]},{scenery:[{column:3,row:12},{column:-1,row:15},{column:6,row:14}]}])("keeps seven animals together on clear lanes %j",({scenery})=>{
    const obstacles=gazelleTravelObstacles(scenery);
    let herd=createGazelleHerd(obstacles);
    expect(herd).toHaveLength(7);
    for(const entering of [true,false]) {
      const distance=gazelleTravelDistance(herd,entering);
      for(let elapsed=0;elapsed<=distance*GAZELLE_TRAVEL_STEP_MS;elapsed+=40) {
        const poses=herd.map(a=>gazelleTravelPose(a.position,distance,elapsed,entering));
        poses.forEach((p,i)=>{
          poses.slice(i+1).forEach(q=>expect(gazellesTooClose(p.cell,q.cell)).toBe(false));
          if(p.alpha>0) scenery.forEach(o=>expect(Math.hypot(p.cell.column-o.column,p.cell.row-o.row)).toBeGreaterThan(.7));
          const a=herd[i]!;
          if(a.guardianId!==undefined){
            const adult=poses[herd.findIndex(b=>b.id===a.guardianId)]!;
            expect(Math.abs(p.cell.column-adult.cell.column)+Math.abs(p.cell.row-adult.cell.row)).toBeLessThanOrEqual(6.00001);
          }
        });
      }
      herd.forEach(a=>{
        const start=gazelleTravelPose(a.position,distance,0,entering);
        const end=gazelleTravelPose(a.position,distance,distance*GAZELLE_TRAVEL_STEP_MS,entering);
        expect(start.alpha).toBe(entering?0:1);
        expect(end.alpha).toBe(entering?1:0);
        expect(end.cell.column).toBeGreaterThan(start.cell.column);
        expect(end.cell.row+end.cell.column).toBeCloseTo(start.cell.row+start.cell.column);
        expect(entering?end.cell:start.cell).toEqual(a.position);
      });
      // Departure must preserve wherever the herd ended its grazing/wandering.
      for(let t=0;t<90000;t+=40) herd=advanceGazelleHerd(herd,40,obstacles);
    }
  });
});
