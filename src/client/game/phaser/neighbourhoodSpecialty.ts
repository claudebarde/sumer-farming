import type { SpecialtyProduct } from "../../../game-data/productionSpecialty";

/** Reuse the farm's prepared textures, including its sharpening and linear filtering.
 * The farm prepares these before the neighbourhood opens, like its building textures.
 * Adding a specialty requires a matching prepared product texture here. */
export const SPECIALTY_TEXTURES = { bread: "baking-8", beer: "beer", oil: "oil" } satisfies Record<SpecialtyProduct, string>;
export type SpecialtyHover = { product: SpecialtyProduct; x: number; y: number } | null;
