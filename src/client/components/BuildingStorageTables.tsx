import { sharedStorageAllocation } from "../../game-core/farm/storageDisplay";
import { FARM_STORAGE_CAPACITY } from "../../game-data/storage";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { FISH_CAPACITY } from "../../game-data/fishing";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import styles from "../styles/GameCanvas.module.scss";

type Props = {
  readonly location: "farm" | "warehouse";
  readonly inventory: readonly { readonly itemKey: InventoryItemKey; readonly quantity: number }[];
  readonly barley: number;
  readonly warehouseComplete: boolean;
  readonly showFish?: boolean;
  readonly showDates?: boolean;
};

export default function BuildingStorageTables({ location, inventory, barley, warehouseComplete, showFish = false, showDates = false }: Props) {
  const quantity = (key: InventoryItemKey) => inventory.find(item => item.itemKey === key)?.quantity ?? 0;
  const shared = (key: Parameters<typeof sharedStorageAllocation>[0], label: string) => ({ label, ...sharedStorageAllocation(key, quantity(key), warehouseComplete)[location] });
  const groups = [
    { label: "Processed food storage", items: [shared("bread", "Bread"), shared("beer", "Beer"), shared("flour", "Flour"), shared("brewersGroats", "Groats")] },
    { label: "Barley and building material storage", items: [
      { label: "Barley", quantity: barley, capacity: location === "farm" ? FARM_STORAGE_CAPACITY : warehouseComplete ? FARM_BUILDING_DEFINITIONS.warehouse.barleyStorageBonus : 0 },
      ...(location === "farm" && showFish ? [{ label: "Fish", quantity: quantity("fish"), capacity: FISH_CAPACITY }] : []),
      ...(showDates && location === "warehouse" ? [shared("dates", "Date baskets")] : []),
      shared("reed", "Reed"), shared("clay", "Clay")
    ] }
  ];
  return <>{groups.map(group => (
    <table key={group.label} className={styles["warehouse-storage-table"]} aria-label={`${location} ${group.label}`}>
      <thead><tr>{group.items.map(item => <th key={item.label} scope="col">{item.label}</th>)}</tr></thead>
      <tbody><tr>{group.items.map(item => <td key={item.label}>{item.quantity}/{item.capacity}</td>)}</tr></tbody>
    </table>
  ))}</>;
}
