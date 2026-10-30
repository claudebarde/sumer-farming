import { WORKER_MOVE_DURATION_PER_TILE } from "./movement";
import { neighbourhoodPlotOrigins, neighbourhoodRoads, neighbourhoodMarket } from "./neighbourhoodGeometry";
export type DeliveryCell = { readonly column: number; readonly row: number };
// Like the farm donkey following the farmer: both travel at the worker pace.
export const DELIVERY_STEP_MS = WORKER_MOVE_DURATION_PER_TILE;
export const DONKEY_HITCH = { column: 0, row: 4 } as const;
export const ZIGGURAT_DROPOFF = { column: -3, row: 2 } as const;
const key = (p: DeliveryCell) => `${p.column}:${p.row}`;
const distance = (a: DeliveryCell, b: DeliveryCell) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
const neighbours = (p: DeliveryCell) => [{ column: p.column + 1, row: p.row }, { column: p.column, row: p.row + 1 },
  { column: p.column - 1, row: p.row }, { column: p.column, row: p.row - 1 }];
const blocked = (p: DeliveryCell) =>
  neighbourhoodPlotOrigins.some(([c, r]) => p.column >= c + 1 && p.column <= c + 2 && p.row >= r + 1 && p.row <= r + 2) ||
  (p.column >= -5 && p.column <= -2 && p.row >= -2 && p.row <= 1) ||
  (p.column >= neighbourhoodMarket.column && p.column <= 3 && p.row >= 3 && p.row <= 4);
const path = (start: DeliveryCell, end: DeliveryCell, allowed: (p: DeliveryCell) => boolean): DeliveryCell[] => {
  const queue = [{ cell: start, route: [start] }], visited = new Set([key(start)]);
  for (const entry of queue) {
    if (key(entry.cell) === key(end)) return entry.route;
    for (const next of neighbours(entry.cell).sort((a,b) => distance(a,end)-distance(b,end))) {
      if (visited.has(key(next)) || !allowed(next)) continue;
      visited.add(key(next)); queue.push({ cell: next, route: [...entry.route, next] });
    }
  }
  throw new Error("No neighbourhood delivery route");
};
const roadKeys = new Set(neighbourhoodRoads.map(key));
const approach = (home: DeliveryCell) => {
  const road = [...neighbourhoodRoads].sort((a,b) => distance(a,home)-distance(b,home))[0]!;
  return path(home, road, p => !blocked(p) && p.column >= -13 && p.column <= 13 && p.row >= -10 && p.row <= 15);
};
export type DeliveryLeg = { readonly phase: "fetch" | "lead-home" | "load" | "deliver" | "unload" | "return-donkey" | "walk-home";
  readonly route: readonly DeliveryCell[]; readonly escort: boolean; readonly duration: number };
export const deliveryPlan = (slot: number) => {
  const [column, row] = neighbourhoodPlotOrigins[slot - 1]!;
  const home = { column: column + 3, row: row + 3 };
  const access = approach(home), accessKeys = new Set(access.map(key));
  const route = (from: DeliveryCell, to: DeliveryCell) => path(from, to, p => roadKeys.has(key(p)) || accessKeys.has(key(p)) || key(p) === key(DONKEY_HITCH));
  const walk = (phase: DeliveryLeg["phase"], from: DeliveryCell, to: DeliveryCell, escort: boolean): DeliveryLeg => {
    const points = route(from,to);
    return { phase, route: points, escort, duration: ((points.length - 1) + (escort ? 0.7 : 0)) * DELIVERY_STEP_MS };
  };
  const legs: readonly DeliveryLeg[] = [walk("fetch",home,DONKEY_HITCH,false),walk("lead-home",DONKEY_HITCH,home,true),
    {phase:"load",route:[home],escort:false,duration:2400}, walk("deliver",home,ZIGGURAT_DROPOFF,true),
    {phase:"unload",route:[ZIGGURAT_DROPOFF],escort:false,duration:2400},
    walk("return-donkey",ZIGGURAT_DROPOFF,DONKEY_HITCH,true), walk("walk-home",DONKEY_HITCH,home,false)];
  return { home, legs, duration: legs.reduce((sum,leg)=>sum+leg.duration,0) };
};
const samplePath = (route: readonly DeliveryCell[], steps: number) => {
  const t = Math.max(0,Math.min(route.length-1,steps));
  const index = Math.min(route.length-2,Math.floor(t));
  if (index < 0) return {position:route[0]!,from:route[0]!,to:route[0]!,moving:false, travelledTiles:0};
  const from=route[index]!,to=route[index+1]!,fraction=t-index;
  return {position:{column:from.column+(to.column-from.column)*fraction,row:from.row+(to.row-from.row)*fraction},from,to,
    moving:steps>0 && steps<route.length-1, travelledTiles:t};
};
export const deliveryPose = (plan: ReturnType<typeof deliveryPlan>, elapsed: number) => {
  let remaining=Math.max(0,elapsed), leg=plan.legs[plan.legs.length-1]!;
  for (const candidate of plan.legs) { leg=candidate; if(remaining<candidate.duration) break; remaining-=candidate.duration; }
  if(elapsed>=plan.duration) remaining=leg.duration;
  const steps=remaining/DELIVERY_STEP_MS;
  const farmer=samplePath(leg.route,steps);
  const donkey=leg.escort ? samplePath(leg.route,steps-0.7) : samplePath([
    leg.phase==="fetch" || leg.phase==="walk-home" ? DONKEY_HITCH : leg.route[0]!],0);
  const load=leg.phase==="load" ? remaining/leg.duration : leg.phase==="deliver" ? 1 : leg.phase==="unload" ? 1-remaining/leg.duration : 0;
  return {phase:leg.phase,farmer,donkey,load:Math.max(0,Math.min(1,load)),working:leg.phase==="load" || leg.phase==="unload"};
};
