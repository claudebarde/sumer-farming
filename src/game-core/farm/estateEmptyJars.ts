/** Estate total includes packaging staged at breweries, without making it spendable twice. */
export const estateEmptyJars = (snapshot: {
  readonly inventory: readonly { itemKey: string; quantity: number }[];
  readonly buildings: readonly { type: string; emptyBeerJars: number }[];
  readonly farm?: { production: { porter?: { job: { itemKey: string; quantity: number } | null } | null } };
}) => (snapshot.inventory.find(i => i.itemKey === "emptyBeerJar")?.quantity ?? 0)
  + snapshot.buildings.reduce((total, building) => total + (building.type === "brewery" ? building.emptyBeerJars : 0), 0)
  + (snapshot.farm?.production.porter?.job?.itemKey === "emptyBeerJar" ? snapshot.farm.production.porter.job.quantity : 0);
