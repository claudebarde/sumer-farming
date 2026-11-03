import { describe, expect, it } from "vitest";
import { createGazelleHerd, advanceGazelleHerd } from "../../src/client/game/phaser/gazelleHerd";
import { gazellesTooClose, gazelleGrazePose } from "../../src/client/game/phaser/gazelleMotion";

describe("gazelle preview liveness",()=> {
  it.each([{obstacles:[]},{obstacles:[{column:3,row:12},{column:-1,row:15},{column:6,row:14}]}])("keeps all seven moving and grazing around scenery %j", ({obstacles})=> {
    let herd=createGazelleHerd(obstacles);
    expect(herd).toHaveLength(7);
    expect(herd.filter(a=>a.age==="young")).toHaveLength(2);
    const walking=new Set<number>(),chewing=new Set<number>();
    for(let time=0;time<180000;time+=40) {
      herd=advanceGazelleHerd(herd,40,obstacles);
      herd.forEach((a,i)=> {
        if(a.age==="young") {
          const adult=herd.find(b=>b.id===a.guardianId)!;
          expect(adult.age).toBe("adult");
          expect(Math.abs(a.position.column-adult.position.column)+Math.abs(a.position.row-adult.position.row)).toBeLessThanOrEqual(6.00001);
        }
        if(a.route.length) {
          walking.add(i);
          a.route.slice(1).forEach((to,index)=> {
            const from=a.route[index]!;
            expect(to.column+to.row).toBe(from.column+from.row);
          });
          const from=a.route[0]!, to=a.route[1]!;
          expect(a.flip).toBe(to.column>from.column);
        }
        else if(gazelleGrazePose(a.elapsed,6500+i*350).kind==="chew") chewing.add(i);
        herd.slice(i+1).forEach(b=>expect(gazellesTooClose(a.position,b.position)).toBe(false));
        expect(a.position.row).toBeGreaterThanOrEqual(12);
        expect(a.position.row).toBeLessThanOrEqual(15);
      });
    }
    expect(walking.size).toBe(7);
    expect(chewing.size).toBe(7);
  });
  it("grazes instead of freezing when all routes are blocked",()=> {
    const obstacles=Array.from({length:64},(_,i)=>({column:-4+i%16,row:12+Math.floor(i/16)})).filter(p=>p.column!==-3||p.row!==12);
    let herd=createGazelleHerd(obstacles);
    for(let i=0;i<40;i++) herd=advanceGazelleHerd(herd,40,obstacles);
    expect(herd[0]!.route).toEqual([]);
    expect(gazelleGrazePose(herd[0]!.elapsed,6500).kind).toBe("chew");
  });
});
