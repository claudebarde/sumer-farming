import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { readyProgressionBuilding } from "../../game-core/farm/buildingReadiness";

/** Claim once per ready period under the farm lock, including simultaneous tabs. */
export const claimBuildingReadiness = (db: Database, playerId: string) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
  if (!farm) return { building: null };
  const snapshot = await readFarmSnapshot(tx, farm, false);
  const building = readyProgressionBuilding(snapshot);
  if (!building) return { building: null };
  const stats = snapshot.farm.progression!.stats;
  await tx.update(farms).set({ progressionStats: { ...stats,
    buildingReadyAnnounced: [...(stats.buildingReadyAnnounced ?? []), building]
  } }).where(eq(farms.id, farm.id));
  return { building };
});
