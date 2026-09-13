import { z } from "zod";

export const gatherableResourceKeys = ["reed", "clay"] as const;

export const GatherableResourceKeySchema = z.enum(gatherableResourceKeys);

export type GatherableResourceKey = z.infer<
  typeof GatherableResourceKeySchema
>;

export const RESOURCE_DEFINITIONS = {
  reed: {
    gatheringDurationMs: 10_000,
    sourceObjectType: "reeds",
    groundSprite: "reedBundle"
  },
  clay: {
    gatheringDurationMs: 10_000,
    sourceObjectType: null,
    groundSprite: "brickPile"
  }
} as const satisfies Record<
  GatherableResourceKey,
  {
    readonly gatheringDurationMs: number;
    readonly sourceObjectType: "reeds" | null;
    readonly groundSprite: "reedBundle" | "brickPile";
  }
>;
