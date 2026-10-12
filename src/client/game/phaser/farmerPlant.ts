import plant01 from "../../../assets/sprite_assets/pngs/v2/planting-test/farmer-plant-01.png";
import plant02 from "../../../assets/sprite_assets/pngs/v2/planting-test/farmer-plant-02.png";
import plant04 from "../../../assets/sprite_assets/pngs/v2/planting-test/farmer-plant-04.png";

export const FARMER_PLANT_SOURCES = [plant01, plant02, plant04] as const;
// 01 → 02 → 04 → 02 → 01, with the endpoint shared between loops.
export const FARMER_PLANT_CYCLE = [0, 1, 2, 1] as const;
export const FARMER_PLANT_FRAME_MS = 320;
export const farmerPlantTexture = (elapsed: number): string =>
  `farmer-plant-v2-${FARMER_PLANT_CYCLE[Math.floor(Math.max(0, elapsed) / FARMER_PLANT_FRAME_MS) % FARMER_PLANT_CYCLE.length]}`;

/** Same normalized framing for the 512px originals and the 1254px replacement.
 * Preserve padding and pose scale; never fit the seed trail or individual silhouette.
 */
export const farmerPlantBounds = (size: number) => ({
  left: Math.round(size * 32 / 512),
  top: Math.round(size * 32 / 512),
  right: Math.round(size * 480 / 512) - 1,
  bottom: Math.round(size * 480 / 512) - 1
});
