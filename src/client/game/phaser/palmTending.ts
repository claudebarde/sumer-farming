import reach from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-tend-palm-01.png";
import loosen from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-tend-palm-02.png";
import drawBack from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-tend-palm-03.png";

export const PALM_TENDING_SOURCES = { "farmer-tend-0": reach, "farmer-tend-1": loosen, "farmer-tend-2": drawBack } as const;
// Full common canvas preserves head, knees and tool registration across frames.
export const PALM_TENDING_BOUNDS = { left: 0, top: 0, right: 1253, bottom: 1253 } as const;
export const PALM_TENDING_ORIGIN = { x: 0.65, y: 0.86 } as const;
const frames = [0, 1, 2, 1] as const;
export const palmTendingTexture = (elapsed: number, reducedMotion = false) =>
  `farmer-tend-${reducedMotion ? 0 : frames[Math.floor(Math.max(0, elapsed) / 350) % frames.length]}`;
