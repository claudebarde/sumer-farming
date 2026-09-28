import type { InventoryItemKey } from "../../game-data/inventoryItems";

export type DevelopmentFixture = {
  readonly shekels: number;
  readonly inventory: readonly { readonly itemKey: InventoryItemKey; readonly quantity: number }[];
};

// Applied once on creation. Edit these values to prepare new test scenarios.
// Both local players use the same ordinary starting economy for progression testing.
export const DEVELOPMENT_FIXTURES = {
  primary: { shekels: 0, inventory: [] },
  second: { shekels: 0, inventory: [] }
} as const satisfies Record<string, DevelopmentFixture>;
