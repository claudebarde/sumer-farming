import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import type { CropKey } from "../../game-data/crops";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import type { GatherableResourceKey } from "../../game-data/resources";
import { farmBuildingTypes } from "../../game-data/buildings";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { farmObjectTypes } from "../../game-data/farmObjects";
import { farmImprovementTypes } from "../../game-data/farmImprovements";
import { FARMER_CARRY_CAPACITY } from "../../game-data/storage";
import { shekelTransactionTypes } from "../../game-data/shekelTransactions";

export const farmObjectType = pgEnum("farm_object_type", farmObjectTypes);
export const farmImprovementType = pgEnum(
  "farm_improvement_type",
  farmImprovementTypes
);
export const farmBuildingType = pgEnum(
  "farm_building_type",
  farmBuildingTypes
);
export const shekelTransactionType = pgEnum(
  "shekel_transaction_type",
  shekelTransactionTypes
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 50 }).notNull(),
    shekelBalance: integer("shekel_balance").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    check("players_shekel_balance_nonnegative", sql`${table.shekelBalance} >= 0`)
  ]
);

export const shekelTransactions = pgTable(
  "shekel_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    type: shekelTransactionType("type").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    itemKey: varchar("item_key", { length: 50 })
      .$type<InventoryItemKey>()
      .notNull(),
    itemQuantity: integer("item_quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    unique("shekel_transactions_player_idempotency_unique").on(
      table.playerId,
      table.idempotencyKey
    ),
    index("shekel_transactions_player_created_at_idx").on(
      table.playerId,
      table.createdAt
    ),
    check("shekel_transactions_delta_nonzero", sql`${table.delta} <> 0`),
    check(
      "shekel_transactions_balance_after_nonnegative",
      sql`${table.balanceAfter} >= 0`
    ),
    check(
      "shekel_transactions_item_quantity_positive",
      sql`${table.itemQuantity} > 0`
    ),
    check(
      "shekel_transactions_unit_price_positive",
      sql`${table.unitPrice} > 0`
    ),
    check(
      "shekel_transactions_delta_matches_trade",
      sql`abs(${table.delta}) = ${table.itemQuantity} * ${table.unitPrice}`
    ),
    check(
      "shekel_transactions_direction_matches_type",
      sql`(${table.type} = 'market_sale' AND ${table.delta} > 0) OR (${table.type} = 'market_purchase' AND ${table.delta} < 0)`
    )
  ]
);

export const farms = pgTable(
  "farms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .unique()
      .references(() => players.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    carriedItemKey: varchar("carried_item_key", { length: 50 }).$type<
      InventoryItemKey
    >(),
    carriedItemQuantity: integer("carried_item_quantity").default(0).notNull(),
    carriedItemExpiresAt: timestamp("carried_item_expires_at", {
      withTimezone: true
    }),
    cultivationStartedAt: timestamp("cultivation_started_at", {
      withTimezone: true
    }),
    nextBarleyConsumptionAt: timestamp("next_barley_consumption_at", {
      withTimezone: true
    }),
    hungrySince: timestamp("hungry_since", { withTimezone: true }),
    gatheringItemKey: varchar("gathering_item_key", { length: 50 }).$type<
      GatherableResourceKey
    >(),
    gatheringColumn: integer("gathering_column"),
    gatheringRow: integer("gathering_row"),
    gatheringStartedAt: timestamp("gathering_started_at", {
      withTimezone: true
    }),
    gatheringCompletesAt: timestamp("gathering_completes_at", {
      withTimezone: true
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    check(
      "farms_carried_item_quantity_in_range",
      sql`${table.carriedItemQuantity} >= 0 AND ${table.carriedItemQuantity} <= ${sql.raw(String(FARMER_CARRY_CAPACITY))}`
    ),
    check(
      "farms_carried_item_key_matches_quantity",
      sql`(${table.carriedItemKey} IS NULL) = (${table.carriedItemQuantity} = 0)`
    ),
    check(
      "farms_gathering_fields_together",
      sql`(${table.gatheringItemKey} IS NULL AND ${table.gatheringColumn} IS NULL AND ${table.gatheringRow} IS NULL AND ${table.gatheringStartedAt} IS NULL AND ${table.gatheringCompletesAt} IS NULL) OR (${table.gatheringItemKey} IS NOT NULL AND ${table.gatheringColumn} IS NOT NULL AND ${table.gatheringRow} IS NOT NULL AND ${table.gatheringStartedAt} IS NOT NULL AND ${table.gatheringCompletesAt} IS NOT NULL)`
    ),
    check(
      "farms_gathering_completion_after_start",
      sql`${table.gatheringCompletesAt} IS NULL OR ${table.gatheringCompletesAt} > ${table.gatheringStartedAt}`
    )
  ]
);

export const farmGroundItems = pgTable(
  "farm_ground_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    itemKey: varchar("item_key", { length: 50 })
      .$type<InventoryItemKey>()
      .notNull(),
    quantity: integer("quantity").default(1).notNull(),
    column: integer("column").notNull(),
    row: integer("row").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    unique("farm_ground_items_farm_position_unique").on(
      table.farmId,
      table.column,
      table.row
    ),
    check("farm_ground_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "farm_ground_items_barley_has_expiry",
      sql`${table.itemKey} <> 'barley' OR ${table.expiresAt} IS NOT NULL`
    )
  ]
);

export const farmCrops = pgTable(
  "farm_crops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    cropKey: varchar("crop_key", { length: 50 }).$type<CropKey>().notNull(),
    column: integer("column").notNull(),
    row: integer("row").notNull(),
    sowingStartedAt: timestamp("sowing_started_at", {
      withTimezone: true
    }).notNull(),
    plantedAt: timestamp("planted_at", { withTimezone: true }).notNull(),
    growthCompletesAt: timestamp("growth_completes_at", {
      withTimezone: true
    }).notNull(),
    harvestStartedAt: timestamp("harvest_started_at", {
      withTimezone: true
    }),
    harvestCompletesAt: timestamp("harvest_completes_at", {
      withTimezone: true
    })
  },
  table => [
    unique("farm_crops_farm_position_unique").on(
      table.farmId,
      table.column,
      table.row
    ),
    check(
      "farm_crops_planting_after_sowing_start",
      sql`${table.plantedAt} > ${table.sowingStartedAt}`
    ),
    check(
      "farm_crops_growth_completion_after_planting",
      sql`${table.growthCompletesAt} > ${table.plantedAt}`
    ),
    check(
      "farm_crops_harvest_dates_together",
      sql`(${table.harvestStartedAt} IS NULL) = (${table.harvestCompletesAt} IS NULL)`
    ),
    check(
      "farm_crops_harvest_completion_after_start",
      sql`${table.harvestCompletesAt} IS NULL OR ${table.harvestCompletesAt} > ${table.harvestStartedAt}`
    )
  ]
);

export const farmObjects = pgTable(
  "farm_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    type: farmObjectType("type").notNull(),
    column: integer("column").notNull(),
    row: integer("row").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    unique("farm_objects_farm_position_unique").on(
      table.farmId,
      table.column,
      table.row
    )
  ]
);

export const farmInventory = pgTable(
  "farm_inventory",
  {
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    itemKey: varchar("item_key", { length: 50 })
      .$type<InventoryItemKey>()
      .notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  table => [
    primaryKey({
      name: "farm_inventory_pkey",
      columns: [table.farmId, table.itemKey]
    }),
    check("farm_inventory_quantity_nonnegative", sql`${table.quantity} >= 0`)
  ]
);

export const farmBuildings = pgTable(
  "farm_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    type: farmBuildingType("type").notNull(),
    column: integer("column").notNull(),
    row: integer("row").notNull(),
    storedBarley: integer("stored_barley").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completesAt: timestamp("completes_at", { withTimezone: true }).notNull()
  },
  table => [
    unique("farm_buildings_farm_position_unique").on(
      table.farmId,
      table.column,
      table.row
    ),
    check(
      "farm_buildings_completion_after_start",
      sql`${table.completesAt} > ${table.startedAt}`
    ),
    check(
      "farm_buildings_stored_barley_in_range",
      sql`${table.storedBarley} >= 0 AND ${table.storedBarley} <= ${sql.raw(String(FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus))}`
    )
  ]
);

export const farmImprovements = pgTable(
  "farm_improvements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    type: farmImprovementType("type").notNull(),
    column: integer("column").notNull(),
    row: integer("row").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completesAt: timestamp("completes_at", { withTimezone: true }).notNull(),
    destroyStartedAt: timestamp("destroy_started_at", { withTimezone: true }),
    destroyCompletesAt: timestamp("destroy_completes_at", {
      withTimezone: true
    })
  },
  table => [
    unique("farm_improvements_farm_position_unique").on(
      table.farmId,
      table.column,
      table.row
    ),
    check(
      "farm_improvements_completion_after_start",
      sql`${table.completesAt} > ${table.startedAt}`
    ),
    check(
      "farm_improvements_destruction_dates_together",
      sql`(${table.destroyStartedAt} IS NULL) = (${table.destroyCompletesAt} IS NULL)`
    ),
    check(
      "farm_improvements_destruction_completion_after_start",
      sql`${table.destroyCompletesAt} IS NULL OR ${table.destroyCompletesAt} > ${table.destroyStartedAt}`
    )
  ]
);
