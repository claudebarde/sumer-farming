import { millingJobs, type MillingState } from "../../game-data/millingJobs";
import type { FarmSnapshot } from "../../schemas/farm";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import { porterReserved } from "../../game-data/porter";
import { estateResourceCapacity } from "../../game-data/storage";

type MillState = Pick<FarmSnapshot["farm"], "millGoods" | "milling"> & MillingState;

/** Reservations move with bags; transferring them must not reserve them twice. */
export const millStorageReserved = (farm: MillState, item: InventoryItemKey): number => {
  const reserved = millingJobs(farm).filter(job => job.recipe === item).reduce((sum, job) => sum + job.output, 0);
  if (item === "oil") return reserved;
  if (item !== "flour" && item !== "brewersGroats") return 0;
  return Object.values(farm.millGoods.pending).reduce((sum, bags) => sum + bags[item], 0)
    + (farm.millGoods.delivery?.bags[item] ?? 0)
    + reserved;
};

export const millStorageAvailable = (snapshot: FarmSnapshot, item: "flour" | "brewersGroats" | "oil", now: number): number =>
  Math.max(0, estateResourceCapacity(item, snapshot.buildings, now)
    - (snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0)
    - millStorageReserved(snapshot.farm, item)
    - porterReserved(snapshot.farm.production.porter, item));
