import type { IsoCell } from "./isometricProjection";

/** Two approved views, mirrored to put the gate on any of the four road edges. */
export const sheepPenAppearance = (building: IsoCell, loading: IsoCell | null | undefined) => {
  if (loading && loading.column < building.column) return { texture: "sheepPenRear", flipX: false };
  if (loading && loading.row < building.row) return { texture: "sheepPenRear", flipX: true };
  return { texture: "sheepPen", flipX: !!loading && loading.column > building.column + 1 };
};
