import { useEffect, useState } from "react";
import type { MarketItemKey } from "../../game-data/marketItems";
import type { MarketListingCursor, MarketListingsPage } from "../../schemas/marketListings";
import { fetchMarketListings } from "../api/marketListings";
import styles from "../styles/GameCanvas.module.scss";

type Props = {
  readonly itemKey: MarketItemKey;
  readonly action: "buy" | "sell";
  readonly quantity: number;
  readonly availableStorage: number;
  readonly balance: number;
  readonly pending: boolean;
  readonly farmVersion: number;
  readonly buy: (id: string, unitPrice: number) => Promise<void>;
  readonly cancel: (id: string) => Promise<void>;
};
type Result =
  | { readonly type: "ready"; readonly page: MarketListingsPage }
  | { readonly type: "failed"; readonly message: string };

export default function MarketListings(props: Props) {
  const { itemKey, action, farmVersion } = props;
  const [cursors, setCursors] = useState<readonly (MarketListingCursor | undefined)[]>([undefined]);
  const [refresh, setRefresh] = useState(0);
  const after = cursors.at(-1);
  const [response, setResponse] = useState<{
    readonly after: MarketListingCursor | undefined;
    readonly result: Result;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketListings({ itemKey, action, after }, controller.signal).then(
      page => {
        if (!controller.signal.aborted) setResponse({ after, result: { type: "ready", page } });
      },
      error => {
        if (!controller.signal.aborted) setResponse({ after, result: {
          type: "failed", message: error instanceof Error ? error.message : "Listings could not be loaded"
        } });
      }
    );
    return () => controller.abort();
  }, [itemKey, action, after, refresh, farmVersion]);

  const result = response?.after === after ? response?.result : undefined;
  const page = result?.type === "ready" ? result.page : undefined;
  const nextCursor = page?.nextCursor ?? null;
  return (
    <section aria-label={action === "buy" ? "Available to buy" : "Your active sell listings"}>
      <h4>{action === "buy" ? "Available to buy" : "Your active sell listings"}</h4>
      <button disabled={props.pending} onClick={() => setRefresh(value => value + 1)}>Refresh listings</button>
      {result === undefined ? <p role="status">Loading listings…</p> : result.type === "failed" ? (
        <p role="alert">{result.message}</p>
      ) : result.page.orders.length === 0 ? (
        <p>{cursors.length > 1 ? "No listings remain on this page. Try Previous." : action === "buy"
          ? "No other players are selling this item right now."
          : "You have no active sell listings for this item."}</p>
      ) : (
        <ul className={styles["market-order-list"]}>
          {result.page.orders.map(order => (
            <li key={order.id}>
              <span>{order.remainingQuantity} at {order.unitPrice} {order.unitPrice === 1 ? "shekel" : "shekels"} each</span>
              {action === "sell" ? (
                <button disabled={props.pending || props.availableStorage < order.remainingQuantity}
                  onClick={() => { void props.cancel(order.id); }}>
                  {props.availableStorage < order.remainingQuantity ? "Free storage before cancelling" : "Cancel listing"}
                </button>
              ) : (
                <button disabled={props.pending || props.quantity > order.remainingQuantity || props.quantity > props.availableStorage || props.quantity * order.unitPrice > props.balance}
                  onClick={() => { void props.buy(order.id, order.unitPrice); }}>
                  {props.quantity > order.remainingQuantity ? "Not enough listed" : props.quantity > props.availableStorage ? "Not enough storage" : props.quantity * order.unitPrice > props.balance ? "Not enough shekels" : `Buy ${props.quantity} for ${props.quantity * order.unitPrice} ${props.quantity * order.unitPrice === 1 ? "shekel" : "shekels"}`}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <nav className={styles["market-pagination"]} aria-label={action === "buy" ? "Buy listing pages" : "Sell listing pages"}>
        <button disabled={props.pending || cursors.length === 1}
          onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button>
        <span aria-live="polite">Page {cursors.length}</span>
        <button disabled={props.pending || nextCursor === null}
          onClick={() => { if (nextCursor !== null) setCursors(values => [...values, nextCursor]); }}>Next</button>
      </nav>
    </section>
  );
}
