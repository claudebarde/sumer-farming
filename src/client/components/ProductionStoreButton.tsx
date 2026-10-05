import type { FarmSnapshot } from "../../schemas/farm";
import { estateResourceCapacity } from "../../game-data/storage";
import { porterReserved, type PorterItem } from "../../game-data/porter";
import TileActionButton from "./TileActionButton";

export default function ProductionStoreButton({ snapshot, item, items, now, disabled, onClick }: {
  readonly snapshot: FarmSnapshot;
  readonly item?: PorterItem;
  readonly items?: readonly PorterItem[];
  readonly now: number;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const availableItems = items ?? (item ? [item] : []);
  // A mixed mill stack can still be collected if either present resource fits.
  const full = availableItems.length > 0 && availableItems.every(key => {
    const stored = snapshot.inventory.find(i => i.itemKey === key)?.quantity ?? 0;
    return stored + porterReserved(snapshot.farm.production.porter, key) >=
      estateResourceCapacity(key, snapshot.buildings, now);
  });
  return <TileActionButton disabled={disabled || full} onClick={onClick}>
    {full ? "No storage space" : "Store"}
  </TileActionButton>;
}
