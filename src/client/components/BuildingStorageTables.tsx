import sesameIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import { sharedStorageAllocation } from "../../game-core/farm/storageDisplay";
import { FARM_STORAGE_CAPACITY } from "../../game-data/storage";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { FISH_CAPACITY } from "../../game-data/fishing";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import styles from "../styles/GameCanvas.module.scss";
import gridStyles from "../styles/BuildingStorageGrid.module.scss";
import { FARM_SPRITES } from "../../assets/farmSprites";
import datesIcon from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";
import breadImage from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import flourImage from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import beerImage from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.webp";
import groatsImage from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";

const storageImages: Record<string, string> = {
  Bread: breadImage, Beer: beerImage, Flour: flourImage, Groats: groatsImage,
  Barley: FARM_SPRITES.harvestedBarley, Fish: FARM_SPRITES.fish,
  Reed: FARM_SPRITES.reedBundle, Clay: FARM_SPRITES.brickPile,
  "Date baskets": datesIcon, Sesame: sesameIcon
};

type Props = {
  readonly location: "farm" | "warehouse";
  readonly inventory: readonly { readonly itemKey: InventoryItemKey; readonly quantity: number; readonly locations?: Readonly<Record<string, number>> | null }[];
  readonly warehouseId?: string;
  readonly barley: number;
  readonly warehouseComplete: boolean;
  readonly showFish?: boolean;
  readonly showDates?: boolean;
  readonly showSesame?: boolean;
  readonly visual?: boolean;
};

export default function BuildingStorageTables({ location, inventory, barley, warehouseComplete, warehouseId, showFish = false, showDates = false, showSesame = false, visual = false }: Props) {
  const quantity = (key: InventoryItemKey) => inventory.find(item => item.itemKey === key)?.quantity ?? 0;
  const shared = (key: Parameters<typeof sharedStorageAllocation>[0], label: string) => ({ label, ...sharedStorageAllocation(key, quantity(key), warehouseComplete, inventory.find(i => i.itemKey === key)?.locations, warehouseId)[location] });
  const groups = [
    { label: "Processed food storage", items: [shared("bread", "Bread"), shared("beer", "Beer"), shared("flour", "Flour"), shared("brewersGroats", "Groats")] },
    { label: "Barley and building material storage", items: [
      { label: "Barley", quantity: barley, capacity: location === "farm" ? FARM_STORAGE_CAPACITY : warehouseComplete ? FARM_BUILDING_DEFINITIONS.warehouse.barleyStorageBonus : 0 },
      ...(location === "farm" && showFish ? [{ label: "Fish", quantity: quantity("fish"), capacity: FISH_CAPACITY }] : []),
      ...(showDates && location === "warehouse" ? [shared("dates", "Date baskets")] : []),
      ...(showSesame && location === "warehouse" ? [shared("sesame", "Sesame")] : []),
      shared("reed", "Reed"), shared("clay", "Clay")
    ] }
  ];
  if (visual) {
    const items = groups.flatMap(group => group.items);
    const foodLabels = new Set(["Bread", "Beer", "Flour", "Groats", "Date baskets", "Fish"]);
    const tables = [
      { label: "Food and drink", items: items.filter(item => foodLabels.has(item.label)) },
      { label: "Crops and materials", items: items.filter(item => !foodLabels.has(item.label)) }
    ];
    return <div className={gridStyles.tableColumns} aria-label={`${location} inventory`}>
      {tables.map(group => <table key={group.label} className={gridStyles.inventoryTable} aria-label={group.label}>
        <colgroup><col className={gridStyles.iconColumn} /><col className={gridStyles.nameColumn} /><col /><col className={gridStyles.countColumn} /></colgroup>
        <tbody>{group.items.map(item => <tr key={item.label}>
          <td className={gridStyles.tableIcon}><img src={storageImages[item.label]} alt="" width={36} height={36} draggable={false} /></td>
          <th scope="row" className={gridStyles.tableName}>{item.label === "Date baskets" ? "Dates" : item.label}</th>
          <td className={gridStyles.tableCapacity}><progress value={Math.min(item.quantity, item.capacity)} max={Math.max(1, item.capacity)}
            aria-label={`${item.label} storage`} aria-valuetext={`${item.quantity} of ${item.capacity}`} /></td>
          <td className={gridStyles.tableQuantity}>{item.quantity}/{item.capacity}</td>
        </tr>)}</tbody>
      </table>)}
    </div>;
  }
  return <>{groups.map(group => (
    <table key={group.label} className={styles["warehouse-storage-table"]} aria-label={`${location} ${group.label}`}>
      <thead><tr>{group.items.map(item => <th key={item.label} scope="col">{item.label}</th>)}</tr></thead>
      <tbody><tr>{group.items.map(item => <td key={item.label}>{item.quantity}/{item.capacity}</td>)}</tr></tbody>
    </table>
  ))}</>;
}
