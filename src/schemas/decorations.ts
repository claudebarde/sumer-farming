import { z } from "zod";
export const DecorationCommandSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("place"),rewardId:z.uuid(),target:z.object({column:z.int(),row:z.int()})}).strict(),
  z.object({type:z.literal("store"),rewardId:z.uuid()}).strict()
]);
export type DecorationCommand = z.infer<typeof DecorationCommandSchema>;
