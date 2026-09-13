import { z } from "zod";

export const shekelTransactionTypes = [
  "market_sale",
  "market_purchase"
] as const;

export const ShekelTransactionTypeSchema = z.enum(shekelTransactionTypes);

export type ShekelTransactionType = z.infer<
  typeof ShekelTransactionTypeSchema
>;
