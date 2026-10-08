/** Keep a positive placeholder when stock is empty; the sale controls are disabled. */
export const marketQuantityLimit = (action: string, stock: number, purchaseLimit?: number) =>
  action === "sell" ? Math.max(1, stock) : purchaseLimit;

export const clampMarketQuantity = (quantity: number, limit?: number): number =>
  Math.min(limit ?? Infinity, Math.max(1, Number.isFinite(quantity) ? Math.floor(quantity) : 1));
