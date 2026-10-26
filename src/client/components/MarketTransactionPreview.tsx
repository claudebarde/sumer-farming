import styles from "../styles/MarketTrade.module.scss";
import type { MarketItemKey } from "../../game-data/marketItems";
import MarketItemIcon from "./MarketItemIcon";
import shekelsImage from "../../assets/sprite_assets/pngs/shekels.webp";

type Props = {
  readonly label: string;
  readonly itemKey?: MarketItemKey;
  readonly stock: number;
  readonly balance: number;
  readonly showPrice?: boolean;
  readonly transaction?: {
    readonly type: "buy" | "sell" | "listing";
    readonly quantity: number;
    readonly unitPrice: number;
  };
};

const shekels = (amount: number) => `${amount} ${amount === 1 ? "shekel" : "shekels"}`;

/** Presentation only: server validation remains authoritative for every trade. */
export default function MarketTransactionPreview({ label, itemKey, stock, balance, transaction, showPrice = true }: Props) {
  const cost = transaction ? transaction.quantity * transaction.unitPrice : 0;
  const nextStock = transaction ? stock + (transaction.type === "buy" ? transaction.quantity : -transaction.quantity) : stock;
  const nextBalance = transaction?.type === "buy" ? balance - cost : transaction?.type === "sell" ? balance + cost : balance;
  const insufficient = nextStock < 0 || nextBalance < 0;
  const direction = (before: number, after: number) => after === before ? null : <span className={styles.direction} aria-label={after > before ? "increases" : "decreases"}>{after > before ? "↑" : "↓"}</span>;
  const resourceLabel = <>{itemKey && <MarketItemIcon itemKey={itemKey} />}{label}</>;
  const currencyLabel = <><img src={shekelsImage} alt="" width={40} height={40} />Shekels</>;
  return (
    <div className={styles.preview} aria-live="polite" aria-atomic="true">
      <div className={styles.comparison}>
        <section className={styles.block} aria-label="Current">
          <h4>Current</h4><dl><div><dt>{resourceLabel}</dt><dd>{stock}</dd></div><div><dt>{currencyLabel}</dt><dd>{balance}</dd></div></dl>
        </section>
        {transaction && <section className={`${styles.block} ${styles.after}`} aria-label={transaction.type === "listing" ? "After listing" : "After trade"}>
          <h4>{transaction.type === "listing" ? "After listing" : "After trade"}</h4>
          {insufficient ? <p>Unavailable — {nextStock < 0 ? "not enough stock" : "not enough shekels"}.</p> :
            <dl><div><dt>{resourceLabel}</dt><dd>{nextStock}{direction(stock, nextStock)}</dd></div><div><dt>{currencyLabel}</dt><dd>{nextBalance}{direction(balance, nextBalance)}</dd></div></dl>}
        </section>}
      </div>
      {transaction && showPrice && <div className={styles.price}><span>{transaction.type === "listing" ? "Asking price per item" : "Price per item"}</span><strong>{shekels(transaction.unitPrice)}</strong><span>each</span></div>}
      {transaction?.type === "listing" && !insufficient && <p>Listed goods are reserved. If all sell: {shekels(balance + cost)}.</p>}
    </div>
  );
}
