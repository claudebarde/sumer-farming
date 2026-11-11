import type { FarmSnapshot } from "../../schemas/farm";
import { MARKET_ITEM_DEFINITIONS, marketItemKeys } from "../../game-data/marketItems";
import { marketUnlockLevel } from "../../game-data/progression";
import { storedPlantingBarley } from "../../game-core/farm/batchPlanting";
import MarketItemIcon from "./MarketItemIcon";
import bar from "../styles/IsometricTest.module.scss";
import tables from "../styles/BuildingStorageGrid.module.scss";
import styles from "../styles/MarketStockSummary.module.scss";

/** Stored estate goods only; carried goods and unfinished output cannot be sold. */
export default function MarketStockSummary({ snapshot, now }: { snapshot: FarmSnapshot; now: number }) {
  const level = snapshot.farm.progression?.level ?? 1;
  const items = marketItemKeys.filter(key => MARKET_ITEM_DEFINITIONS[key].npcMarket.canSell && level >= marketUnlockLevel(key))
    .map(key => ({ key, label: key === "brewersGroats" ? "Groats" : MARKET_ITEM_DEFINITIONS[key].label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  const columns = Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => items.slice(index * 2, index * 2 + 2));
  if (!items.length) return null;
  return <aside className={`${bar.planting} ${styles.panel}`} aria-label="Market estate stock">
    <p>Estate stock</p>
    <div className={styles.columns}>
      {columns.map((column, index) => <table key={column[0]!.key} className={tables.inventoryTable} aria-label={`Estate stock column ${index + 1}`}>
        <colgroup><col className={tables.iconColumn} /><col /><col className={tables.countColumn} /></colgroup>
        <tbody>{column.map(({ key, label }) => {
          const quantity = key === "barley" ? storedPlantingBarley(snapshot, now)
            : snapshot.inventory.find(item => item.itemKey === key)?.quantity ?? 0;
          return <tr key={key}>
            <td className={tables.tableIcon}><MarketItemIcon itemKey={key} /></td>
            <th scope="row" className={tables.tableName}>{label}</th>
            <td className={tables.tableQuantity} aria-label={`${label}: ${quantity}`}>{quantity}</td>
          </tr>;
        })}</tbody>
      </table>)}
    </div>
  </aside>;
}
