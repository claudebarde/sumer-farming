import compactStyles from "../styles/PlayerMarketSell.module.scss";
import MarketItemIcon from "./MarketItemIcon";
import actionStyles from "../styles/BuildingActionButton.module.scss";
import BuildingActionIcon from "./BuildingActionIcon";
import { useEffect, useState } from "react";
import type { MarketItemKey } from "../../game-data/marketItems";
import type { MarketListingCursor, MarketListingsPage } from "../../schemas/marketListings";
import { fetchMarketListings } from "../api/marketListings";
import styles from "../styles/GameCanvas.module.scss";
import MarketTransactionPreview from "./MarketTransactionPreview";
import { MARKET_ITEM_DEFINITIONS } from "../../game-data/marketItems";

type Props = {
  readonly compact?: boolean;
  readonly itemKeys?: readonly MarketItemKey[];
  readonly availableStorageByItem?: Partial<Record<MarketItemKey, number>>;
  readonly onRefresh?: () => void;
  readonly itemKey: MarketItemKey;
  readonly action: "buy" | "sell";
  readonly quantity: number;
  readonly availableStorage: number;
  readonly balance: number;
  readonly stock: number;
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const [refresh, setRefresh] = useState(0);
  const after = cursors.at(-1);
  const itemKeysJson = JSON.stringify(props.itemKeys);
  const [response, setResponse] = useState<{
    readonly after: MarketListingCursor | undefined;
    readonly result: Result;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketListings({ itemKey, action, after, itemKeys: itemKeysJson ? JSON.parse(itemKeysJson) : undefined }, controller.signal).then(
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
  }, [itemKey, itemKeysJson, action, after, refresh, farmVersion]);

  const result = response?.after === after ? response?.result : undefined;
  const page = result?.type === "ready" ? result.page : undefined;
  const nextCursor = page?.nextCursor ?? null;
  if (props.compact) return <section className={compactStyles.listings} aria-label="Your active sell listings">
    <div className={compactStyles.listingHeader}><h4>Your active listings</h4><button className={actionStyles.button} disabled={props.pending} onClick={() => { setRefresh(value => value + 1); props.onRefresh?.(); }}><BuildingActionIcon kind="refresh" /><span>Refresh</span></button></div>
    {result === undefined ? <p role="status">Loading listings…</p> : result.type === "failed" ? <p role="alert">{result.message}</p> : result.page.orders.length === 0 ? <p>No active listings{cursors.length > 1 ? " on this page" : ""}.</p> :
      <ul className={compactStyles.orders}>{result.page.orders.map(order => {
        const resource = order.itemKey ?? itemKey;
        const space = props.availableStorageByItem?.[resource] ?? props.availableStorage;
        const minutes = order.createdAt ? Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60_000)) : null;
        const age = minutes === null ? null : minutes < 1 ? "Just listed" : minutes < 60 ? `Listed ${minutes}m ago` : minutes < 1440 ? `Listed ${Math.floor(minutes / 60)}h ${minutes % 60}m ago` : `Listed ${Math.floor(minutes / 1440)}d ago`;
        return <li className={compactStyles.order} key={order.id}>
          <div className={compactStyles.listingResource}><MarketItemIcon itemKey={resource} /><div><strong>{MARKET_ITEM_DEFINITIONS[resource].label}</strong><small>{order.remainingQuantity}{order.originalQuantity !== undefined ? ` / ${order.originalQuantity}` : ""} units remaining</small></div></div>
          <div><strong>{order.unitPrice} {order.unitPrice === 1 ? "shekel" : "shekels"}</strong><small>per unit</small></div>
          <div><span>Active</span>{age && <small>{age}</small>}</div>
          <button disabled={props.pending || space < order.remainingQuantity} onClick={() => { void props.cancel(order.id); }}>{space < order.remainingQuantity ? "Free storage to cancel" : "Cancel listing"}</button>
        </li>;
      })}</ul>}
    {(cursors.length > 1 || nextCursor !== null) && <nav className={styles["market-pagination"]} aria-label="Sell listing pages">
      <button disabled={props.pending || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button><span>Page {cursors.length}</span>
      <button disabled={props.pending || nextCursor === null} onClick={() => { if (nextCursor) setCursors(values => [...values, nextCursor]); }}>Next</button>
    </nav>}
  </section>;
  return (
    <section aria-label={action === "buy" ? "Available to buy" : "Your active sell listings"}>
      <h4>{action === "buy" ? "Available to buy" : "Your active sell listings"}</h4>
      <button className={actionStyles.button} disabled={props.pending} onClick={() => { setRefresh(value => value + 1); props.onRefresh?.(); }}><BuildingActionIcon kind="refresh" /><span>Refresh listings</span></button>
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
              {action === "buy" && <MarketTransactionPreview
                itemKey={itemKey}
                label={MARKET_ITEM_DEFINITIONS[itemKey].label}
                stock={props.stock} balance={props.balance}
                transaction={{ type: "buy", quantity: props.quantity, unitPrice: order.unitPrice }}
              />}
              {action === "sell" ? (
                <button className={actionStyles.button} disabled={props.pending || props.availableStorage < order.remainingQuantity}
                  onClick={() => { void props.cancel(order.id); }}><BuildingActionIcon kind="cancel" /><span>
                  {props.availableStorage < order.remainingQuantity ? "Free storage before cancelling" : "Cancel listing"}
                </span></button>
              ) : (
                <button className={actionStyles.button} disabled={props.pending || props.quantity > order.remainingQuantity || props.quantity > props.availableStorage || props.quantity * order.unitPrice > props.balance}
                  onClick={() => { void props.buy(order.id, order.unitPrice); }}><BuildingActionIcon kind="shekels" /><span>
                  {props.quantity > order.remainingQuantity ? "Not enough listed" : props.quantity > props.availableStorage ? "Not enough storage" : props.quantity * order.unitPrice > props.balance ? "Not enough shekels" : `Buy ${props.quantity} for ${props.quantity * order.unitPrice} ${props.quantity * order.unitPrice === 1 ? "shekel" : "shekels"}`}
                </span></button>
              )}
            </li>
          ))}
        </ul>
      )}
      <nav className={styles["market-pagination"]} aria-label={action === "buy" ? "Buy listing pages" : "Sell listing pages"}>
        <button className={actionStyles.button} disabled={props.pending || cursors.length === 1}
          onClick={() => setCursors(values => values.slice(0, -1))}><BuildingActionIcon kind="previous" /><span>Previous</span></button>
        <span aria-live="polite">Page {cursors.length}</span>
        <button className={actionStyles.button} disabled={props.pending || nextCursor === null}
          onClick={() => { if (nextCursor !== null) setCursors(values => [...values, nextCursor]); }}><BuildingActionIcon kind="next" /><span>Next</span></button>
      </nav>
    </section>
  );
}
