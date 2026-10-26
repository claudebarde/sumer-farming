import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-carrying-jars-idle.webp";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-carrying-jars-walk-01.webp";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-carrying-jars-walk-02.webp";

export const FARMER_JAR_SOURCES = {
  "farmer-jars-idle": idle,
  "farmer-jars-walk-0": walk01,
  "farmer-jars-walk-1": walk02,
} as const;

// Walking exports share registration; do not fit individual strides separately.
export const farmerJarBounds = (key: string) => key === "farmer-jars-idle"
  ? { left: 0, top: 48, right: 705, bottom: 1280 }
  : { left: 100, top: 90, right: 930, bottom: 1470 };

export const farmerJarCarryTexture = (distance: number, moving: boolean): string =>
  moving ? `farmer-jars-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-jars-idle";

export const carryingLiquidJars = (
  carried: { itemKey: string; quantity: number } | null,
  delivery: { itemKey: string; quantity: number } | null,
) => (carried?.itemKey === "water" && carried.quantity > 0) ||
  (delivery?.itemKey === "beer" && delivery.quantity > 0);
