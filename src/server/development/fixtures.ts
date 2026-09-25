import type { InventoryItemKey } from "../../game-data/inventoryItems";

export type DevelopmentFixture = {
  readonly shekels: number;
  readonly inventory: readonly { readonly itemKey: InventoryItemKey; readonly quantity: number }[];
};

// Applied once on creation. Edit these values to prepare new test scenarios.
// The second player's money is a development fixture, not a gameplay reward.
export const DEVELOPMENT_FIXTURES = {
  primary: { shekels: 0, inventory: [] },
  second: { shekels: 20, inventory: [{ itemKey: "barley", quantity: 2 }] }
} as const satisfies Record<string, DevelopmentFixture>;
