export type SellOrderPricePoint = {
  readonly unitPrice: number;
  readonly remainingQuantity: number;
};

export const calculateTradeAveragePrice = (
  trades: readonly { readonly quantity: number; readonly unitPrice: number }[]
): number | null => {
  const quantity = trades.reduce((sum, trade) => sum + trade.quantity, 0);
  return quantity === 0 ? null : trades.reduce((sum, trade) => sum + trade.quantity * trade.unitPrice, 0) / quantity;
};

export type SellOrderStatistics = {
  readonly lowestSellPrice: number | null;
  readonly weightedAverageSellPrice: number | null;
  readonly totalSellQuantity: number;
};

export const calculateSellOrderStatistics = (
  orders: readonly SellOrderPricePoint[]
): SellOrderStatistics => {
  if (orders.length === 0) {
    return {
      lowestSellPrice: null,
      weightedAverageSellPrice: null,
      totalSellQuantity: 0
    };
  }

  const totalSellQuantity = orders.reduce(
    (quantity, order) => quantity + order.remainingQuantity,
    0
  );
  const totalAskingValue = orders.reduce(
    (value, order) => value + order.unitPrice * order.remainingQuantity,
    0
  );

  return {
    lowestSellPrice: Math.min(...orders.map(order => order.unitPrice)),
    weightedAverageSellPrice:
      totalSellQuantity === 0 ? null : totalAskingValue / totalSellQuantity,
    totalSellQuantity
  };
};

export const suggestSellUnitPrice = (
  statistics: SellOrderStatistics,
  fallbackPrice: number
): number =>
  Math.max(
    1,
    Math.round(statistics.weightedAverageSellPrice ?? fallbackPrice)
  );
