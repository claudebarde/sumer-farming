import type { FarmSnapshot } from "../../../schemas/farm";
import { ROAD_CONSTRUCTION_DURATION_MS } from "../../../game-data/roads";
import { previewWalkable, previewWalkPath } from "./isometricWalking";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { sameCell } from "./isometricFarm";

const constructionNeighbours = (target: IsoCell): readonly IsoCell[] => [
  { column: target.column - 1, row: target.row }, { column: target.column, row: target.row - 1 },
  { column: target.column + 1, row: target.row }, { column: target.column, row: target.row + 1 },
];

/** Walk to a reachable neighbour, never through the tile being excavated. */
export const constructionApproachPath = (snapshot: FarmSnapshot, from: IsoCell, target: IsoCell, now: number): readonly IsoCell[] | null => {
  const paths = constructionNeighbours(target).filter(cell => previewWalkable(snapshot, cell, now)).flatMap(cell => {
    const route = previewWalkPath(snapshot, from, cell, now, target);
    return sameCell(from, cell) || route.length ? [[from, ...route]] : [];
  });
  return paths.sort((a, b) => a.length - b.length)[0] ?? null;
};

export const activeConstruction = (snapshot: FarmSnapshot, now: number) => {
  const road = snapshot.farm.roads.find(r => (r.completesAt ?? 0) > now);
  const building = snapshot.buildings.find(b => Date.parse(b.startedAt) <= now && Date.parse(b.completesAt) > now);
  if (building) return { target: { column: building.column, row: building.row }, workPosition: building.loadingTile,
    startedAt: Date.parse(building.startedAt), completesAt: Date.parse(building.completesAt) };
  if (road) return { target: { column: road.column, row: road.row }, startedAt: road.completesAt! - ROAD_CONSTRUCTION_DURATION_MS, completesAt: road.completesAt! };
  const canal = snapshot.improvements.find(i => i.destroyCompletesAt === null && Date.parse(i.startedAt) <= now && Date.parse(i.completesAt) > now);
  return canal ? { target: { column: canal.column, row: canal.row }, startedAt: Date.parse(canal.startedAt), completesAt: Date.parse(canal.completesAt) } : null;
};

/** Stand on safe adjacent ground, preferring an upper neighbour for the tool stroke. */
export const isometricConstructionPose = (snapshot: FarmSnapshot, now: number, arrivedPosition?: IsoCell) => {
  const job = activeConstruction(snapshot, now);
  if (!job) return null;
  const neighbours = "workPosition" in job && job.workPosition ? [job.workPosition] : constructionNeighbours(job.target);
  const arrived = arrivedPosition && neighbours.some(cell => sameCell(cell, arrivedPosition)) && previewWalkable(snapshot, arrivedPosition, now);
  const position = arrived ? arrivedPosition : neighbours.find(cell => previewWalkable(snapshot, cell, now));
  if (!position) return null;
  const point = isoPoint(position), target = isoPoint(job.target);
  return { position, elapsed: Math.max(0, now - job.startedAt), facingLeft: target.x < point.x,
    // Lean into the work tile while keeping the feet on their safe ground diamond.
    offsetX: arrived ? 0 : (target.x - point.x) * 0.25, offsetY: arrived ? 0 : (target.y - point.y) * 0.25 };
};
