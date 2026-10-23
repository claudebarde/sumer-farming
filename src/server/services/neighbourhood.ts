import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { farms, neighbourhoodMembers } from "../db/schema";
import { NeighbourhoodSchema } from "../../schemas/neighbourhood";

/** Public display data only; membership is derived from the requesting player. */
export const readNeighbourhood = (db: Database, playerId: string) => db.transaction(async tx => {
  const [viewer] = await tx.select({ home: neighbourhoodMembers.neighbourhoodId, level: farms.level })
    .from(neighbourhoodMembers).innerJoin(farms, eq(farms.playerId, neighbourhoodMembers.playerId))
    .where(eq(neighbourhoodMembers.playerId, playerId));
  if (!viewer || viewer.level < 7) return null;
  const rows = await tx.select({ slot: neighbourhoodMembers.slot, playerId: farms.playerId,
    profile: farms.farmerProfile, level: farms.level }).from(neighbourhoodMembers)
    .innerJoin(farms, eq(farms.playerId, neighbourhoodMembers.playerId))
    .where(eq(neighbourhoodMembers.neighbourhoodId, viewer.home)).orderBy(asc(neighbourhoodMembers.slot));
  return NeighbourhoodSchema.parse({ members: rows.map(row => ({
    slot: row.slot, name: row.profile?.identity.name ?? "Farmer", level: row.level, isYou: row.playerId === playerId,
  })) });
});
