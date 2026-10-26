import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-idle-isometric.webp";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-01.webp";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-02.webp";
import walk03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-03.webp";
import walk04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-04.webp";
import front01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-front-01.webp";
import front02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-front-02.webp";
import front03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-front-03.webp";
import front04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-front-04.webp";
import back01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-back-01.webp";
import back02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-back-02.webp";
import back03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-back-03.webp";
import back04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-walk-back-04.webp";
import type { DonkeyWander } from "./isometricDonkey";
import { DONKEY_STEP_MS } from "./isometricDonkey";

export const DONKEY_SOURCES = {
  "isometric-donkey": idle,
  "isometric-donkey-walk-0": walk01, "isometric-donkey-walk-1": walk02,
  "isometric-donkey-walk-2": walk03, "isometric-donkey-walk-3": walk04,
  "isometric-donkey-front-0": front01, "isometric-donkey-front-1": front02,
  "isometric-donkey-front-2": front03, "isometric-donkey-front-3": front04,
  "isometric-donkey-back-0": back01, "isometric-donkey-back-1": back02,
  "isometric-donkey-back-2": back03, "isometric-donkey-back-3": back04,
} as const;
// Union of all five alpha bounds: never recrop/rescale individual strides.
export const DONKEY_FRAME_BOUNDS = { left: 70, top: 82, right: 1008, bottom: 931 } as const;
// New directional art uses the full shared canvas: do not clip the rear ears/hooves.
export const donkeyFrameBounds = (key: string) => /isometric-donkey-(front|back)-/.test(key)
  ? { left: 0, top: 0, right: 1024, bottom: 1024 } : DONKEY_FRAME_BOUNDS;
export const donkeyWanderPose = (state: DonkeyWander, reducedMotion = false) => {
  return donkeyDirectionalPose({ ...state, walking: !!state.motion, elapsed: state.motion?.elapsed ?? 0 }, reducedMotion);
};
export const donkeyDirectionalPose = (state: {
  facingBack?: boolean; facingLeft: boolean; walking: boolean; elapsed: number;
}, reducedMotion = false) => {
  const direction = state.facingBack ? "back" : "front";
  const frame = !state.walking || reducedMotion ? 0 : Math.floor(Math.max(0, state.elapsed) / (DONKEY_STEP_MS / 4)) % 4;
  return { texture: `isometric-donkey-${direction}-${frame}`, flipX: !state.facingLeft };
};
export const donkeyTexture = (elapsed: number | null, reducedMotion = false) =>
  elapsed === null || reducedMotion ? "isometric-donkey" :
    `isometric-donkey-walk-${Math.floor(Math.max(0, elapsed) / (DONKEY_STEP_MS / 4)) % 4}`;
