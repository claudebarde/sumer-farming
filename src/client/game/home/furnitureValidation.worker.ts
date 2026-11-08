import { furnitureLayoutError } from "../../../game-core/home/furniture";
import type { FurniturePlacement } from "../../../game-data/homeFurniture";
import type { InteriorPoint } from "../../../game-core/home/interiorNavigation";
self.onmessage = (event: MessageEvent<{ id: number; items: FurniturePlacement[]; farmer: InteriorPoint }>) => {
  const { id, items, farmer } = event.data;
  self.postMessage({ id, error: furnitureLayoutError(items, farmer) });
};
