import { z } from "zod";
import { SPECIALTY_PRODUCTS } from "../game-data/productionSpecialty";
export const SpecialtyProductSchema = z.enum(Object.keys(SPECIALTY_PRODUCTS) as [keyof typeof SPECIALTY_PRODUCTS, ...(keyof typeof SPECIALTY_PRODUCTS)[]]);
export const ProductionSpecialtySchema = z.object({
  quantities: z.partialRecord(SpecialtyProductSchema, z.int().nonnegative()),
  leader: SpecialtyProductSchema.optional(),
});
