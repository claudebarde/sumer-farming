import { z } from "zod";

export const shekelTransactionTypes = [
  "livestock_purchase",
  "market_sale",
  "market_purchase",
  "request_reward",
  "porter_hire",
  "building_upgrade",
  "building_construction",
  "crop_planting"
] as const;

export const ShekelTransactionTypeSchema = z.enum(shekelTransactionTypes);

export type ShekelTransactionType = z.infer<
  typeof ShekelTransactionTypeSchema
>;
