/** Estate total includes packaging staged at breweries, without making it spendable twice. */
export const estateEmptyJars = (snapshot: {
  readonly inventory: readonly { itemKey: string; quantity: number }[];
  readonly buildings: readonly { type: string; emptyBeerJars: number }[];
}) => (snapshot.inventory.find(i => i.itemKey === "emptyBeerJar")?.quantity ?? 0)
  + snapshot.buildings.reduce((total, building) => total + (building.type === "brewery" ? building.emptyBeerJars : 0), 0);
