/** Extend this catalogue when another completed product can represent a farm. */
export const SPECIALTY_PRODUCTS = { bread: "Bread", beer: "Beer", oil: "Oil" } as const;
export type SpecialtyProduct = keyof typeof SPECIALTY_PRODUCTS;
export type ProductionSpecialty = {
  readonly quantities: Readonly<Partial<Record<SpecialtyProduct, number>>>;
  readonly leader?: SpecialtyProduct;
};
