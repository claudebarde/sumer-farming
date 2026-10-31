import young from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-young.png";
import growing from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-growing.png";
import flowering from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-flowering.png";
import ripe from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-ripe.png";

/** Approved crop artwork used by the saved crop cycle.
 * Stage timing belongs to server-owned crop rules, not these asset definitions. */
export const SESAME_SOURCES = { sesameYoung: young, sesameGrowing: growing, sesameFlowering: flowering, sesameRipe: ripe };
// Sesame's outer plants spread farther forward than barley's. Inset their
// shared footprint so the front and side roots stay inside the 96 × 48 tile.
export const SESAME_LAYOUT = { offsetX: -1, offsetY: -2, originX: 0.5, originY: 84 / 128, size: 86, depthOffset: 3 } as const;
// The ripe artwork sits farther back in its frame; bring it toward the tile's front-right edge.
export const SESAME_RIPE_LAYOUT = { ...SESAME_LAYOUT, offsetX: 2, offsetY: 2 } as const;
