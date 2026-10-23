/** Cosmetic, fixed scattering; no road or merchant interaction tiles are occupied. */
export const marketScenery = [
  ...[[-4, 1], [0, 0], [4, 0], [8, 1], [11, 3],
    [-4, 7], [11, 9], [-2, 12], [3, 13], [8, 13]].map(([column, row], i) => ({
    column: column!, row: row!, texture: i % 2 ? "bush02" : "bush01",
  })),
  ...[[-2, 0], [2, 0], [6, 0], [10, 0], [11, 7],
    [-3, 9], [-4, 13], [1, 13], [6, 13], [11, 12]].map(([column, row], i) => ({
    column: column!, row: row!, texture: i % 2 ? "rocks02" : "rocks01",
  })),
] as const;
