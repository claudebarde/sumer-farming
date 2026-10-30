import { z } from "zod";
import { ZIGGURAT_RESOURCES } from "../game-data/ziggurat";
const quantities = { clay: z.number().int().min(0).max(60).default(0), reed: z.number().int().min(0).max(15).default(0), barley: z.number().int().min(0).max(30).default(0), bread: z.number().int().min(0).max(24).default(0), beer: z.number().int().min(0).max(18).default(0), dates: z.number().int().min(0).max(12).default(0), shekels: z.number().int().min(0).max(250).default(0) };
export const ZigguratInterestCommandSchema = z.object({ interested: z.boolean() }).strict();
export const ZigguratDonationCommandSchema = z.object({ idempotencyKey: z.uuid(), stage: z.number().int().min(0).max(3).default(0), ...quantities }).strict().refine(value => ZIGGURAT_RESOURCES.some(key => value[key] > 0), "Choose materials to donate.");
export type ZigguratDonationCommand = z.input<typeof ZigguratDonationCommandSchema>;
const materials = z.object({ clay: z.number().int().nonnegative(), reed: z.number().int().nonnegative(), barley: z.number().int().nonnegative(), bread: z.number().int().nonnegative(), beer: z.number().int().nonnegative(), dates: z.number().int().nonnegative(), shekels: z.number().int().nonnegative() });
export const ZigguratReceiptSchema = materials.extend({ points: z.number().int().nonnegative() });
export const ZigguratSchema = z.object({
 state: z.discriminatedUnion("type", [
  z.object({ type: z.literal("interest") }),
  z.object({ type: z.literal("fundraising"), stage: z.number().int().min(0).max(3), openedAt: z.iso.datetime() }),
  z.object({ type: z.literal("building"), stage: z.number().int().min(0).max(3), startedAt: z.iso.datetime(), completesAt: z.iso.datetime() }),
  z.object({ type: z.literal("complete"), completedAt: z.iso.datetime() })
 ]),
 eligibleCount: z.number().int().nonnegative(), canParticipate: z.boolean(), interested: z.boolean(),
 supporters: z.array(z.object({ slot: z.number().int(), name: z.string(), isYou: z.boolean() })),
 stock: materials, funded: materials, serverTime: z.iso.datetime(),
 deliveries: z.array(z.object({ id: z.uuid(), slot: z.number().int().min(1).max(10), startsAt: z.iso.datetime(), completesAt: z.iso.datetime() })),
 contributionPoints: z.number().int().nonnegative()
});
export const ZigguratDonationResponseSchema = z.object({ data: ZigguratSchema, receipt: ZigguratReceiptSchema });
export type Ziggurat = z.infer<typeof ZigguratSchema>;
