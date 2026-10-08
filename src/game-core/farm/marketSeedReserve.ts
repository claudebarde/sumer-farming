export const BARLEY_RESERVE_MESSAGE = "You must keep 1 barley in your farm";

/** Stored stock only: crops, carried goods and listed goods do not replace this reserve. */
export const violatesBarleyReserve = (itemKey: string, stock: number, quantity: number): boolean =>
  itemKey === "barley" && stock - quantity < 1;
