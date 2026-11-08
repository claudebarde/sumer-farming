import { furnitureDefinition, type FurniturePlacement } from "../../game-data/homeFurniture";
import { FURNITURE_SILHOUETTES } from "../../game-data/homeFurnitureSilhouettes";
import { containsPoint, type InteriorPoint } from "./interiorNavigation";
import { INTERIOR_WALLS, behindLeftInteriorWall, behindRightInteriorWall } from "./interiorWalls";
// Furniture can occupy floor concealed by raised foreground walls. These room
// polygons deliberately omit the doorway corridors used by the farmer.
const floors = [
  [[240,650],[750,480],[1240,700],[790,940],[650,920]],
  [[180,435],[595,235],[725,300],[725,400],[330,610],[220,550]],
  [[815,390],[945,320],[1345,525],[1240,670],[980,550]],
].map(points => points.map(([x,y]) => ({ x: x!, y: y! })));
export const furnitureFloorContains = (point: InteriorPoint) => floors.some(floor => containsPoint(point, floor));
/** Sample the opaque artwork against the same masonry polygons used to render it. */
export const furnitureVisibleEnough = (item: FurniturePlacement) => {
  const definition = furnitureDefinition(item.key);
  const walls = [...INTERIOR_WALLS.front, ...(behindLeftInteriorWall(item) ? INTERIOR_WALLS.left : []), ...(behindRightInteriorWall(item) ? INTERIOR_WALLS.right : [])]
    .map(wall => wall.map(([x,y]) => ({ x, y })));
  const samples = FURNITURE_SILHOUETTES[item.key];
  const visible = samples.filter(([x,y]) => !walls.some(wall => containsPoint({ x: item.x + ((item.orientation === "mirrored" ? 1 - x : x) - .5) * definition.width, y: item.y + (y - .78) * definition.height }, wall)));
  if (visible.length / samples.length < .2) return false;
  const xs = visible.map(([x]) => x * definition.width), ys = visible.map(([,y]) => y * definition.height);
  return Math.max(...xs) - Math.min(...xs) >= 16 && Math.max(...ys) - Math.min(...ys) >= 12;
};
