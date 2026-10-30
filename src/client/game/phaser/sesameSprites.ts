import young from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-young.png";
import growing from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-growing.png";
import flowering from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-flowering.png";
import ripe from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-isometric-ripe.png";

/** Approved crop artwork shared by the preview and the future saved crop cycle.
 * Stage timing belongs to server-owned crop rules, not these asset definitions. */
export const SESAME_SOURCES = { sesameYoung: young, sesameGrowing: growing, sesameFlowering: flowering, sesameRipe: ripe };
export const SESAME_LAYOUT = { offsetX: -4, offsetY: 2, originX: 0.5, originY: 84 / 128, size: 98, depthOffset: 3 } as const;
