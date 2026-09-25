import type { TradeHistory } from "../../../schemas/tradeHistory";

type Trade = TradeHistory["trades"][number];

// Walk back to the last observation so a busy market cannot lose transactions
// merely because more than one page arrived between polls.
export const collectNewTrades = async (
  fetchPage: (before?: string) => Promise<TradeHistory>,
  previousId: string | null | undefined
): Promise<{ readonly newestId: string | null; readonly trades: readonly Trade[] }> => {
  const first = await fetchPage();
  const newestId = first.trades[0]?.id ?? null;
  if (previousId === undefined) return { newestId, trades: [] };

  const trades: Trade[] = [];
  let page = first;
  while (true) {
    for (const trade of page.trades) {
      if (trade.id === previousId) return { newestId, trades: trades.toReversed() };
      trades.push(trade);
    }
    if (page.nextCursor === null) return { newestId, trades: trades.toReversed() };
    page = await fetchPage(page.nextCursor);
  }
};
