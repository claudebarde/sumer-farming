import { z } from "zod";

import { CropKeySchema } from "../game-data/crops";
import { FarmObjectTypeSchema } from "../game-data/farmObjects";
import { FarmImprovementTypeSchema } from "../game-data/farmImprovements";
import { InventoryItemKeySchema } from "../game-data/inventoryItems";
import { GatherableResourceKeySchema } from "../game-data/resources";
import { FarmBuildingTypeSchema } from "../game-data/buildings";

export const FarmSnapshotSchema = z.object({
  created: z.boolean(),
  player: z.object({
    shekelBalance: z.int().nonnegative()
  }),
  farm: z.object({
    fishing: z.object({
      id: z.uuid(), seed: z.int().nonnegative(), startedAt: z.number(),
      lastCastAt: z.number().nullable(), column: z.int(), row: z.int(), serverNow: z.number()
    }).nullable().default(null),
    id: z.uuid(),
    playerId: z.uuid(),
    version: z.int().positive(),
    household: z.object({
      cultivationStartedAt: z.iso.datetime().nullable(),
      nextBarleyConsumptionAt: z.iso.datetime().nullable(),
      hungrySince: z.iso.datetime().nullable(),
      happiness: z.int().min(0).max(100),
      lastBeerAt: z.iso.datetime().nullable()
    }),
    carriedItem: z
      .object({
        itemKey: InventoryItemKeySchema,
        quantity: z.int().positive(),
        expiresAt: z.iso.datetime().nullable()
      })
      .nullable(),
    gathering: z
      .object({
        itemKey: GatherableResourceKeySchema,
        target: z.object({
          column: z.int(),
          row: z.int()
        }),
        startedAt: z.iso.datetime(),
        completesAt: z.iso.datetime()
      })
      .nullable()
  }),
  inventory: z.array(
    z.object({
      itemKey: InventoryItemKeySchema,
      quantity: z.int().nonnegative()
    })
  ),
  objects: z.array(
    z.object({
      id: z.uuid(),
      type: FarmObjectTypeSchema,
      column: z.int(),
      row: z.int()
    })
  ),
  groundItems: z.array(
    z.object({
      id: z.uuid(),
      itemKey: InventoryItemKeySchema,
      quantity: z.int().positive(),
      column: z.int(),
      row: z.int(),
      expiresAt: z.iso.datetime().nullable()
    })
  ),
  crops: z.array(
    z.object({
      id: z.uuid(),
      cropKey: CropKeySchema,
      column: z.int(),
      row: z.int(),
      sowingStartedAt: z.iso.datetime(),
      plantedAt: z.iso.datetime(),
      growthCompletesAt: z.iso.datetime(),
      harvestStartedAt: z.iso.datetime().nullable(),
      harvestCompletesAt: z.iso.datetime().nullable()
    })
  ),
  improvements: z.array(
    z.object({
      id: z.uuid(),
      type: FarmImprovementTypeSchema,
      column: z.int(),
      row: z.int(),
      startedAt: z.iso.datetime(),
      completesAt: z.iso.datetime(),
      destroyStartedAt: z.iso.datetime().nullable(),
      destroyCompletesAt: z.iso.datetime().nullable()
    })
  ),
  buildings: z.array(
    z.object({
      id: z.uuid(),
      type: FarmBuildingTypeSchema,
      column: z.int(),
      row: z.int(),
      storedBarley: z.int().nonnegative(),
      brewingBarley: z.int().nonnegative(),
      brewingWater: z.int().nonnegative(),
      emptyBeerJars: z.int().nonnegative(),
      beerReadyAt: z.iso.datetime().nullable(),
      beerServed: z.int().nonnegative(),
      startedAt: z.iso.datetime(),
      completesAt: z.iso.datetime()
    })
  )
});

export type FarmSnapshot = z.infer<typeof FarmSnapshotSchema>;
