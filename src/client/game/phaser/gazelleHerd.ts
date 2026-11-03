import { gazellesTooClose } from "./gazelleMotion";
import { isoPoint, type IsoCell } from "./isometricProjection";

export type Gazelle = { id: number; age: "adult" | "young"; guardianId?: number; position: IsoCell; route: readonly IsoCell[]; elapsed: number; cycle: number; flip: boolean };
const cells = Array.from({ length: 64 }, (_, i) => ({ column: -4+i%16, row: 12+Math.floor(i/16) }));
const same = (a: IsoCell, b: IsoCell) => a.column===b.column && a.row===b.row;
const distance = (a: IsoCell,b: IsoCell) => Math.abs(a.column-b.column)+Math.abs(a.row-b.row);
export const createGazelleHerd = (obstacles: readonly IsoCell[]): Gazelle[] => {
  const herd: Gazelle[] = [];
  const reserved: IsoCell[] = [];
  const clear = (c: IsoCell) => !obstacles.some(o=>same(c,o)) && !reserved.some(p=>gazellesTooClose(c,p));
  const exitFor = (c: IsoCell) => cells.find(n=>Math.abs(n.column-c.column)===1 && n.row-c.row===-(n.column-c.column) && clear(n) &&
    !obstacles.some(o=>same(o,{column:c.column,row:n.row})||same(o,{column:n.column,row:c.row})));
  for (const i of [0,5,1,6,2,3,4]) {
    const guardian = i>=5 ? herd.find(a=>a.id===i-5) : undefined;
    if (i>=5 && !guardian) continue;
    const target = guardian?.position ?? { column: -3+i%3*2, row: i<3?12:15 };
    const nearby = (c: IsoCell) => !guardian || distance(c,guardian.position)<=6;
    const position = cells.filter(c=>nearby(c) && clear(c) && exitFor(c))
      .sort((a,b)=>distance(a,target)-distance(b,target))[0] ?? cells.find(c=>nearby(c) && clear(c));
    if (position) {
      const exit=exitFor(position);
      reserved.push(position);
      if (exit) reserved.push(exit);
      herd.push({ id:i, age:i<5?"adult":"young", guardianId:guardian?.id, position, route: [], elapsed: -i*250, cycle: 0, flip: false });
    }
  }
  return herd;
};

/** Reserve whole paths, including between tiles, so neighbours cannot meet head-on. */
const plan = (animal: Gazelle, others: readonly Gazelle[], obstacles: readonly IsoCell[]) => {
  const reserved = others.flatMap(other=>other.route.length ? other.route.flatMap((from,i)=> {
    const to=other.route[i+1]??from;
    return Array.from({length:9},(_,j)=>({column:from.column+(to.column-from.column)*j/8,row:from.row+(to.row-from.row)*j/8}));
  }) : [other.position]);
  // Bound both sides of each adult/young pair, including every reserved route
  // endpoint. This also keeps them close while one pauses and the other walks.
  const companions = others.filter(other=>other.id===animal.guardianId || other.guardianId===animal.id);
  const nearCompanions = (cell: IsoCell) => companions.every(other=>
    [other.position,...other.route].every(p=>distance(cell,p)<=6));
  const safe = (cell: IsoCell) => nearCompanions(cell) && !obstacles.some(o=>same(cell,o)) && !reserved.some(other=>gazellesTooClose(cell,other));
  const edgeSafe = (from: IsoCell,to: IsoCell) => Array.from({length:9},(_,i)=>({column:from.column+(to.column-from.column)*i/8,row:from.row+(to.row-from.row)*i/8}))
    .every(p=>!reserved.some(other=>gazellesTooClose(p,other)));
  const queue = [{ cell: animal.position, path: [animal.position] }];
  const seen = new Set([`${animal.position.column}:${animal.position.row}`]);
  for (const {cell,path} of queue) {
    if (path.length>=5) continue;
    for (const next of cells.filter(c=>Math.abs(c.column-cell.column)===1 && c.row-cell.row===-(c.column-cell.column))) {
      const key=`${next.column}:${next.row}`;
      // Current artwork has one side/front view: stay on a screen-horizontal
      // axis rather than showing that same view while walking away from camera.
      // Both crossed tile corners must be clear (no diagonal scenery cutting).
      if (seen.has(key)||!safe(next)||!edgeSafe(cell,next) ||
        obstacles.some(o=>same(o,{column:cell.column,row:next.row}) || same(o,{column:next.column,row:cell.row}))) continue;
      seen.add(key);queue.push({cell:next,path:[...path,next]});
    }
  }
  const centre = { column: others.reduce((sum,a)=>sum+a.position.column,animal.position.column)/(others.length+1), row:13.5 };
  const direction = animal.cycle%2===0?1:-1;
  return queue.filter(p=>p.path.length>1).sort((a,b)=> {
    const score = (p: typeof a) => p.path.length*2 + direction*(p.cell.column-animal.position.column) - distance(p.cell,centre)*.7;
    return score(b)-score(a);
  })[0]?.path ?? [];
};

export const advanceGazelleHerd = (herd: readonly Gazelle[], delta: number, obstacles: readonly IsoCell[]): Gazelle[] => {
  const next = herd.map(a=>({...a}));
  next.forEach((a,i)=> {
    a.elapsed += Math.min(delta,80);
    if (!a.route.length) {
      if(a.elapsed<6500+i*350) return;
      a.route=plan(a,next.filter((_,j)=>i!==j),obstacles);
      a.elapsed=0;a.cycle++;
      if (a.route[1]) a.flip=isoPoint(a.route[1]).x>isoPoint(a.route[0]!).x;
      return;
    }
    const step=a.elapsed/750,index=Math.floor(step);
    if(index>=a.route.length-1) { a.position=a.route.at(-1)!;a.route=[];a.elapsed=0;return; }
    const from=a.route[index]!,to=a.route[index+1]!,t=step-index;
    a.position={column:from.column+(to.column-from.column)*t,row:from.row+(to.row-from.row)*t};
    a.flip=isoPoint(to).x>isoPoint(from).x;
  });
  return next;
};
