import type Phaser from "phaser";
import working from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/oil-mill-isometric-working-base.png";
import { MILL_ACTIVE_SIZE, renderMillAnimation, type MillAnimationImages } from "./millAnimation";

/** Move the whole assembly a little toward its loading road, staying inside its footprint. */
export const oilMillVisualCell = (cell: { column: number; row: number; loadingTile?: { column: number; row: number } | null }) => {
  const road = cell.loadingTile;
  if (!road) return cell;
  const dx = road.column - (cell.column + 0.5), dy = road.row - (cell.row + 0.5);
  const distance = Math.max(Math.abs(dx), Math.abs(dy), 1);
  return { column: cell.column + dx / distance * 0.4, row: cell.row + dy / distance * 0.4 };
};

export const OIL_MILL_SOURCE = { key: "oil-mill-working", url: working };

/** Oil pressing presentation: retain the approved lever/operator choreography. */
export const renderOilMillAnimation = (scene: Phaser.Scene, images: MillAnimationImages,
  cell: { column: number; row: number; loadingTile?: { column: number; row: number } | null }, elapsed: number | null, farmer: boolean) => {
  renderMillAnimation(scene, images, oilMillVisualCell(cell), elapsed, true, farmer);
  // Idle shares the flour mill framing; the wider working masonry needs a small correction.
  const size = MILL_ACTIVE_SIZE * (elapsed === null ? 1 : 0.9);
  images.base.setTexture(OIL_MILL_SOURCE.key).setDisplaySize(size, size);
  images.bowl.setVisible(false);
  images.bags.setVisible(false);
  if (elapsed === null) { images.base.setTexture("oilMill"); images.flour.clear().setVisible(false); return; }
  const point = (x: number, y: number) => ({
    x: images.base.x + (x / 1254 - images.base.originX) * size,
    y: images.base.y + (y / 1254 - images.base.originY) * size,
  });
  const outlet = point(508, 868), jar = point(505, 899);
  const flow = images.flour.clear().setVisible(true).setDepth(images.base.depth + 3.1);
  flow.lineStyle(3, 0xd39b27, 0.95).lineBetween(outlet.x, outlet.y, jar.x, jar.y);
  flow.lineStyle(1.2, 0xffdc74, 0.9).lineBetween(outlet.x - 0.4, outlet.y, jar.x - 0.4, jar.y);
  const fraction = (Math.max(0, elapsed) % 700) / 700;
  flow.fillStyle(0xffe49a, 0.8).fillCircle(outlet.x + (jar.x - outlet.x) * fraction,
    outlet.y + (jar.y - outlet.y) * fraction, 0.9);
  // A small expanding ring makes the impact readable despite the short fall.
  // Stay inside the jar's opening rather than drawing over its painted rim.
  const ripple = (Math.max(0, elapsed) % 1000) / 1000;
  flow.lineStyle(0.7, 0xffdc74, (1 - ripple) * 0.8)
    .strokeEllipse(jar.x, jar.y, 1.5 + ripple * 4, 0.7 + ripple * 1.5);
};
