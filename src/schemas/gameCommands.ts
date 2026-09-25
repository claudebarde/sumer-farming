import { z } from "zod";

import { CropKeySchema } from "../game-data/crops";
import { InventoryItemKeySchema } from "../game-data/inventoryItems";
import { GatherableResourceKeySchema } from "../game-data/resources";
import { MarketItemKeySchema } from "../game-data/marketItems";

const FarmCoordinateSchema = z.object({
  column: z.int(),
  row: z.int()
});

export const GameCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("give_farmer_beer"),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("brewery_supply"),
    action: z.enum(["collect_water", "pour_water", "deliver", "stock_jars", "start_brewing", "collect_beer", "give_beer"]),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("build_irrigation"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("build_brewery"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("build_granary"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("destroy_irrigation"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("plant_crop"),
    crop: CropKeySchema,
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("start_harvest_crop"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("complete_harvest_crop"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("start_gather_resource"),
    itemKey: GatherableResourceKeySchema,
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("complete_gather_resource"),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("pickup_ground_item"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("drop_carried_item"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("deposit_carried_item"),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("deposit_carried_item_in_granary"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("withdraw_inventory_item"),
    itemKey: InventoryItemKeySchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("withdraw_barley_from_granary"),
    target: FarmCoordinateSchema,
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("buy_from_npc_market"),
    itemKey: MarketItemKeySchema,
    quantity: z.int().positive(),
    expectedUnitPrice: z.int().positive(),
    idempotencyKey: z.uuid(),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("sell_to_npc_market"),
    itemKey: MarketItemKeySchema,
    quantity: z.int().positive(),
    expectedUnitPrice: z.int().positive(),
    idempotencyKey: z.uuid(),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("create_market_sell_order"),
    itemKey: MarketItemKeySchema,
    quantity: z.int().positive(),
    unitPrice: z.int().positive(),
    idempotencyKey: z.uuid(),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("cancel_market_sell_order"),
    orderId: z.uuid(),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("buy_market_sell_order"),
    orderId: z.uuid(),
    quantity: z.int().positive().max(2147483647),
    expectedUnitPrice: z.int().positive().max(2147483647),
    idempotencyKey: z.uuid(),
    expectedFarmVersion: z.int().positive()
  })
]);

export type GameCommand = z.infer<typeof GameCommandSchema>;
