import { z } from "zod";
import { MillRecipeSchema, MillWorkerSchema } from "../game-data/milling";
import { MAX_BATCH_HARVEST_FIELDS } from "../game-data/batchPlanting";

import { CropKeySchema } from "../game-data/crops";
import { InventoryItemKeySchema } from "../game-data/inventoryItems";
import { GatherableResourceKeySchema } from "../game-data/resources";
import { MarketItemKeySchema } from "../game-data/marketItems";

const FarmCoordinateSchema = z.object({
  column: z.int(),
  row: z.int()
});

export const GameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start_batch_planting"), targets: z.array(FarmCoordinateSchema).min(1).max(72), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("start_batch_harvesting"), targets: z.array(FarmCoordinateSchema).min(1).max(MAX_BATCH_HARVEST_FIELDS), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("advance_batch_planting"), batchId: z.uuid(), action: z.enum(["collect", "plant", "harvest", "finish", "stop"]), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("build_road"), target: FarmCoordinateSchema, expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("start_milling"), recipe: MillRecipeSchema, worker: MillWorkerSchema.optional(), target: FarmCoordinateSchema, expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("mill_delivery"), action: z.enum(["pickup", "store"]), millId: z.uuid(), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("build_mill"), target: FarmCoordinateSchema, expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("build_bread_oven"), target: FarmCoordinateSchema, expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("start_baking"), buildingId: z.uuid(), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("production_delivery"), action: z.enum(["pickup", "store"]), buildingId: z.uuid(), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("destroy_ground_material"), groundItemId: z.uuid(), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("claim_farm_level"), expectedLevel: z.int().min(1).max(10), expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("fishing"), action: z.enum(["start", "store", "release"]), target: FarmCoordinateSchema, expectedFarmVersion: z.int().positive() }),
  z.object({ type: z.literal("cast_fishing"), sessionId: z.uuid(), aim: z.number().min(0).max(1) }),
  z.object({ type: z.literal("cancel_fishing"), sessionId: z.uuid() }),
  z.object({
    type: z.literal("deliver_npc_request"),
    cycle: z.int().nonnegative(),
    slot: z.int().min(0).max(2),
    idempotencyKey: z.uuid(),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("give_farmer_bread"),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("give_farmer_beer"),
    expectedFarmVersion: z.int().positive()
  }),
  z.object({
    type: z.literal("give_farmer_fish"),
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
