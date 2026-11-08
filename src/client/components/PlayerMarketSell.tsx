import type { MarketQuotes } from "../../schemas/market";
import QuantityInput from "./QuantityInput";
import MarketItemIcon from "./MarketItemIcon";
import BuildingActionIcon from "./BuildingActionIcon";
import { BARLEY_RESERVE_MESSAGE, violatesBarleyReserve } from "../../game-core/farm/marketSeedReserve";
import styles from "../styles/PlayerMarketSell.module.scss";
import actionStyles from "../styles/BuildingActionButton.module.scss";

type Props = {
  item: MarketQuotes["items"][number]; quantity: number; price: number; stock: number;
  limit: number; availableStorage: number; balance: number; pending: boolean; farmVersion: number;
  onQuantity: (quantity: number) => void; onPrice: (price: number) => void;
  onRefresh: () => void; onSell: () => void; onCancel: (id: string) => Promise<void>;
};
const priceLabel = (value: number) => `${Number(value.toFixed(1))} ${value === 1 ? "shekel" : "shekels"}`;

export default function PlayerMarketSell(props: Props) {
  const { item, quantity, price, stock, pending } = props;
  const market = item.playerMarket;
  const reserveBlocked = violatesBarleyReserve(item.itemKey, stock, quantity);
  const blocked = reserveBlocked ? BARLEY_RESERVE_MESSAGE : stock < quantity ? "Not enough stock" : !market.canCreateSellOrder ? "Listings unavailable" : null;
  return <section className={styles.sell} aria-label={`Sell ${item.label}`}>
    <div className={styles.resource}>
      <div className={styles.identity}><MarketItemIcon itemKey={item.itemKey} /><div><h3>{item.label}</h3><small>You have {stock}</small></div></div>
      <div className={styles.quantity}><span>Quantity</span><QuantityInput label={`${item.label} quantity to sell`} value={quantity} min={1} max={Math.max(1, props.limit)} disabled={pending || stock === 0} onChange={props.onQuantity} /></div>
    </div>
    <div className={styles.prices}>
      <div className={styles.panel}><span>Price per unit · shekels</span><QuantityInput label={`${item.label} price per unit`} min={1} max={2147483647} value={price} disabled={pending} onChange={props.onPrice} /></div>
      <div className={styles.panel}><span>Current player prices · per unit</span>
        {market.lowestSellPrice === null ? <><strong>No active listings</strong><small>Starting suggestion: {priceLabel(market.suggestedSellPrice)}</small></> : <><strong>From {priceLabel(market.lowestSellPrice)}</strong><small>Average {priceLabel(market.weightedAverageSellPrice ?? market.lowestSellPrice)}</small></>}
      </div>
    </div>
    <div className={styles.summary} aria-label="Market summary">
      <span><strong>{market.totalSellQuantity}</strong> units for sale</span>
      <span><strong>{market.recentTradeQuantity ?? 0}</strong> units traded in 24h</span>
      {market.recentTradeAveragePrice !== null && <span>Last 24h average: <strong>{priceLabel(market.recentTradeAveragePrice)}</strong></span>}
    </div>
    <div className={styles.submit}><span>Total asking value <strong>{priceLabel(quantity * price)}</strong></span>
      <button className={actionStyles.button} disabled={pending || blocked !== null} onClick={props.onSell}><BuildingActionIcon kind="shekels" /><span>{pending ? "Listing…" : blocked ?? "List for sale"}</span></button>
    </div>
  </section>;
}
