import type { Gazelle } from "./gazelleHerd";
import type { IsoCell } from "./isometricProjection";

const bank = Array.from({length:64},(_,i)=>({column:-4+i%16,row:12+Math.floor(i/16)}));
/** Keep the approved screen-horizontal gait; exclude lanes crossing scenery or its corners. */
export const gazelleTravelObstacles = (obstacles: readonly IsoCell[]): IsoCell[] => {
  const bankObstacles=obstacles.filter(p=>p.column>=-4 && p.column<=11 && p.row>=12 && p.row<=15);
  return [...obstacles,...bank.filter(p=>bankObstacles.some(o=>Math.abs(p.column+p.row-o.column-o.row)<=1))];
};

export const gazelleTravelDistance = (herd: readonly Gazelle[], entering: boolean) =>
  1 + Math.max(0,...herd.map(a=>entering
    ? Math.min(a.position.column+4,15-a.position.row)
    : Math.min(11-a.position.column,a.position.row-12)));

// One tile diagonal is 96 screen pixels. Slow, constant movement avoids sliding
// acceleration and preserves all pair distances, including the young/adult pairs.
export const GAZELLE_TRAVEL_STEP_MS=3000;
export const gazelleTravelPose = (position: IsoCell, distance: number, elapsed: number, entering: boolean) => {
  const progress=Math.min(distance,Math.max(0,elapsed)/GAZELLE_TRAVEL_STEP_MS);
  const offset=entering ? progress-distance : progress;
  const cell={column:position.column+offset,row:position.row-offset};
  const edgeDistance=entering ? Math.min(cell.column+4,15-cell.row) : Math.min(11-cell.column,cell.row-12);
  const alpha=Math.max(0,Math.min(1,1+edgeDistance*2));
  return {cell,alpha};
};
