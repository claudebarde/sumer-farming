import type { InteriorPoint } from "./interiorNavigation";

export type WallPolygon = readonly (readonly [number, number])[];
/** Visible masonry/wood silhouettes, traced in the 1536 × 1024 source image.
 * Do not bridge concave corners: that paints floor pixels over the farmer.
 * These are occlusion shapes, not the floor/pathfinding polygons.
 */
export const INTERIOR_WALLS = {
  left: [
    // Short return wall from the back-left pier to the doorway wall.
    // Its room-facing cap must hide furniture legs, including wide kitchen sprites.
    [[171,420],[343,513],[305,534],[183,597],[147,577],[147,435]],
    [[180,590],[208,577],[488,447],[499,429],[520,419],[521,442],[537,458],[537,591],[337,682],[180,625]],
    [[588,437],[620,422],[637,402],[637,365],[722,325],[754,340],[758,485],[625,552],[588,535]],
    // Include the pale cap behind the beam, up to its room-facing edge.
    // Tracing only the wooden lintel leaves furniture visible through that strip.
    [[499,429],[637,365],[637,414],[534,460],[521,453],[520,433]],
  ],
  right: [
    [[757,339],[781,332],[882,384],[882,406],[905,417],[905,552],[757,486]],
    [[973,467],[992,454],[1007,471],[1014,470],[1231,576],[1353,511],[1383,528],[1383,652],[1308,697],[1246,705],[973,590]],
    // Join the wall cap to the lintel: omitting this corner left a triangular
    // hole where a basket behind the doorway could paint over the plaster.
    [[881,405],[882,384],[900,395],[992,448],[993,463],[981,474],[881,424]],
  ],
  // Trace the inner edge of the stone caps, not their outer/front edge.
  // The left cap begins at (254,620) where it meets the plaster wall.
  // The right cap rises to y=640 at its junction with the corner pier.
  front: [
    [[193,625],[224,636],[254,620],[568,793],[627,765],[660,778],[665,902],[633,924],[633,953],[597,980],[193,786]],
    [[764,778],[789,766],[895,813],[1246,640],[1245,621],[1271,608],[1308,626],[1350,610],[1350,800],[805,1004],[764,951]],
  ],
} as const satisfies Record<string, readonly WallPolygon[]>;

// Only the wall facing the actor can cover him. Use the ground-level wall line,
// not its raised silhouette, to decide which side of the wall he occupies.
export const behindLeftInteriorWall = (p: InteriorPoint) => p.y < 825 - .45 * p.x;
export const behindRightInteriorWall = (p: InteriorPoint) => p.y < 140 + .45 * p.x;

/** The rear of each doorway is a covered passage, not open room floor.
 * Cover the space above its lintel while the actor is inside the passage.
 * Keep these separate from permanent walls so room-floor pixels are never
 * painted over a farmer who is actually standing in the room.
 */
export const DOORWAY_HEADERS = [
  { minX: 550, maxX: 584, rearY: 425, frontY: 580,
    silhouette: [[520,260],[638,260],[638,414],[534,460],[520,453]] },
  { minX: 918, maxX: 954, rearY: 470, frontY: 590,
    silhouette: [[880,280],[994,280],[994,463],[981,474],[880,424]] },
] as const satisfies readonly { minX: number; maxX: number; rearY: number; frontY: number; silhouette: WallPolygon }[];
export const insideDoorway = (p: InteriorPoint, door: typeof DOORWAY_HEADERS[number]) =>
  p.x >= door.minX && p.x <= door.maxX && p.y >= door.rearY && p.y <= door.frontY;

/** Actor-only clipping; never repaint these walls over furniture in other rooms. */
export const actorOccludingWalls = (point: InteriorPoint): readonly WallPolygon[] => [
  ...INTERIOR_WALLS.front,
  ...(behindLeftInteriorWall(point) ? INTERIOR_WALLS.left : []),
  ...(behindRightInteriorWall(point) ? INTERIOR_WALLS.right : []),
  ...DOORWAY_HEADERS.filter(door => insideDoorway(point, door)).map(door => door.silhouette),
];
