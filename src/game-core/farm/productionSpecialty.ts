import { SPECIALTY_PRODUCTS, type ProductionSpecialty, type SpecialtyProduct } from "../../game-data/productionSpecialty";

/** Credit completed output only. Old progression totals are intentionally not imported. */
export const recordSpecialtyProduction = (
  previous: ProductionSpecialty | undefined,
  output: Readonly<Partial<Record<SpecialtyProduct, number>>>,
): ProductionSpecialty => {
  const quantities = { ...previous?.quantities };
  for (const key of Object.keys(SPECIALTY_PRODUCTS) as SpecialtyProduct[]) {
    const amount = output[key] ?? 0;
    if (amount > 0) quantities[key] = (quantities[key] ?? 0) + amount;
  }
  let leader = previous?.leader;
  for (const key of Object.keys(SPECIALTY_PRODUCTS) as SpecialtyProduct[]) {
    if ((quantities[key] ?? 0) > (leader ? quantities[leader] ?? 0 : 0)) leader = key;
  }
  return { quantities, ...(leader ? { leader } : {}) };
};
