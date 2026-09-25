import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { TradeHistory } from "../../schemas/tradeHistory";
import { fetchTradeHistory } from "../api/tradeHistory";
import styles from "../styles/TradeHistory.module.scss";
import { MARKET_ITEM_DEFINITIONS } from "../../game-data/marketItems";

type HistoryResult =
  | { readonly type: "ready"; readonly page: TradeHistory }
  | { readonly type: "failed"; readonly message: string };

const useTradeHistory = (limit: number, before: string | undefined, refresh: number) => {
  const [response, setResponse] = useState<{
    readonly before: string | undefined;
    readonly result: HistoryResult;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTradeHistory({ limit, before }, controller.signal).then(
      page => {
        if (!controller.signal.aborted) setResponse({ before, result: { type: "ready", page } });
      },
      error => {
        if (!controller.signal.aborted) setResponse({ before, result: {
          type: "failed", message: error instanceof Error ? error.message : "Trade history is unavailable"
        } });
      }
    );
    return () => controller.abort();
  }, [limit, before, refresh]);

  return response !== null && response.before === before ? response.result : null;
};

const shekels = (amount: number) => `${amount} ${amount === 1 ? "shekel" : "shekels"}`;

function TradeList({ trades }: { readonly trades: TradeHistory["trades"] }) {
  if (trades.length === 0) return <p>No completed trades yet.</p>;
  return (
    <ol className={styles.trades}>
      {trades.map(trade => (
        <li key={trade.id}>
          <div className={styles.summary}>
            <strong>{trade.type === "market_sale" ? "Sold" : "Bought"} {trade.quantity} {trade.itemKey === "beer" ? (trade.quantity === 1 ? "beer jar" : "beer jars") : trade.itemKey === "brewingVessels" || trade.itemKey === "emptyBeerJar" ? MARKET_ITEM_DEFINITIONS[trade.itemKey].label.toLowerCase() : trade.itemKey}</strong>
            <span>{trade.type === "market_sale" ? "+" : "−"}{shekels(trade.total)}</span>
          </div>
          <div className={styles.details}>
            <span>{trade.source === "npc" ? "NPC market" : "Player market"} · {shekels(trade.unitPrice)} each</span>
            <time dateTime={trade.createdAt}>{new Date(trade.createdAt).toLocaleString(undefined, {
              dateStyle: "medium", timeStyle: "short"
            })}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HistoryPage({ result, retry }: { readonly result: HistoryResult | null; readonly retry: () => void }) {
  if (result === null) return <p role="status">Loading trades…</p>;
  if (result.type === "failed") return <div><p role="alert">{result.message}</p><button onClick={retry}>Retry</button></div>;
  return <TradeList trades={result.page.trades} />;
}

function FullTradeHistory() {
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [refresh, setRefresh] = useState(0);
  const result = useTradeHistory(20, cursors.at(-1), refresh);
  const nextCursor = result?.type === "ready" ? result.page.nextCursor : null;

  return (
    <>
      <button onClick={() => { setCursors([undefined]); setRefresh(value => value + 1); }}>Refresh latest trades</button>
      <HistoryPage result={result} retry={() => setRefresh(value => value + 1)} />
      <nav className={styles.navigation} aria-label="Trade history pages">
        <button disabled={cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Newer</button>
        <span>Page {cursors.length}</span>
        <button disabled={nextCursor === null} onClick={() => {
          if (nextCursor !== null) setCursors(values => [...values, nextCursor]);
        }}>Older</button>
      </nav>
    </>
  );
}

export default function MarketTradeHistory({ refresh }: { readonly refresh: number }) {
  const [retry, setRetry] = useState(0);
  const result = useTradeHistory(5, undefined, refresh + retry);
  return (
    <section className={styles.history} aria-label="Recent trades">
      <h3>Recent trades</h3>
      <HistoryPage result={result} retry={() => setRetry(value => value + 1)} />
      <Dialog.Root>
        <Dialog.Trigger asChild><button>View all trades</button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.dialog}>
            <Dialog.Title>Trade history</Dialog.Title>
            <Dialog.Description>Your completed purchases and sales, newest first. Dates use your local time.</Dialog.Description>
            <FullTradeHistory />
            <Dialog.Close asChild>
              <button className={styles.close} aria-label="Close trade history"><Cross2Icon /></button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
