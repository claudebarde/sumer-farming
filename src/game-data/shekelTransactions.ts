import { z } from "zod";

export const shekelTransactionTypes = [
  "market_sale",
  "market_purchase",
  "request_reward",
  "porter_hire",
  "building_upgrade"
] as const;

export const ShekelTransactionTypeSchema = z.enum(shekelTransactionTypes);

export type ShekelTransactionType = z.infer<
  typeof ShekelTransactionTypeSchema
>;
