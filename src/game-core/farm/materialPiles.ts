export const MATERIAL_PILE_LIMIT = 5;
export const canStackMaterial = (carried: string, pile: { readonly itemKey: string; readonly quantity: number }) =>
  (carried === "clay" || carried === "reed") && pile.itemKey === carried && pile.quantity < MATERIAL_PILE_LIMIT;
