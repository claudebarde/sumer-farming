import { advanceFarmLifecycle } from "./farmLifecycle";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { farms, neighbourhoodMembers, neighbourhoods, zigguratRewards } from "../db/schema";
import { HomeAppearanceSchema, HomeVisibilitySchema } from "../../schemas/homeAppearance";
import { PlayerHomeSchema, PlayerProfileSchema } from "../../schemas/playerHome";
import { homeVisitUnavailable } from "../../game-core/home/visiting";
import { readFarmSnapshot } from "./farmSnapshot";
import { sql } from "drizzle-orm";

/** Public profile data only; never return an owner's farm snapshot or inventory. */
export const readPlayerHome = async (db: Database, viewerId: string, ownerId: string, includeInterior: boolean) => {
  const [viewer] = await db.select({level: farms.level}).from(farms).where(eq(farms.playerId, viewerId));
  const [owner] = await db.select({
    playerId: farms.playerId, level: farms.level, profile: farms.farmerProfile,
    appearance: farms.homeAppearance, neighbourhood: neighbourhoods.name,
  }).from(farms)
    .leftJoin(neighbourhoodMembers, eq(neighbourhoodMembers.playerId, farms.playerId))
    .leftJoin(neighbourhoods, eq(neighbourhoods.id, neighbourhoodMembers.neighbourhoodId))
    .where(eq(farms.playerId, ownerId));
  if (!viewer || !owner?.profile) return { ok: false as const, message: "Farmer not found." };
  const resolvedAppearance = includeInterior ? await db.transaction(async tx => {
    const [farm] = await tx.select().from(farms).where(eq(farms.playerId, ownerId)).for("update");
    return farm ? (await advanceFarmLifecycle(tx, farm, new Date())).homeAppearance : owner.appearance;
  }) : owner.appearance;
  const appearance = HomeAppearanceSchema.parse(resolvedAppearance);
  const unavailableReason = homeVisitUnavailable(viewer.level, owner.level, appearance.visibility, viewerId === ownerId);
  if (includeInterior && unavailableReason) return { ok: false as const, message: unavailableReason };
  const [reward] = await db.select({id: zigguratRewards.id}).from(zigguratRewards).where(eq(zigguratRewards.playerId, ownerId)).limit(1);
  const profile = PlayerProfileSchema.parse({
    playerId: owner.playerId, name: owner.profile.identity.name, level: owner.level,
    neighbourhood: owner.neighbourhood ?? "", zigguratPatron: !!reward,
    canVisit: !unavailableReason, unavailableReason,
  });
  return includeInterior
    ? { ok: true as const, data: PlayerHomeSchema.parse({ profile, appearance: { furniture: appearance.furniture ?? [], wallTablet: appearance.wallTablet ?? "none" } }) }
    : { ok: true as const, data: profile };
};

/** Keep visibility independent of exterior/interior writes from stale tabs. */
export const saveHomeVisibility = (db: Database, playerId: string, input: unknown) => db.transaction(async tx => {
  const visibility = HomeVisibilitySchema.parse(input);
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
  if (!farm) return { ok: false as const, message: "Farm not found." };
  if (farm.level < 10) return { ok: false as const, message: "Home visits unlock at level 10." };
  const [updated] = await tx.update(farms).set({
    homeAppearance: { ...farm.homeAppearance, visibility }, version: sql`${farms.version}+1`, updatedAt: new Date(),
  }).where(eq(farms.id, farm.id)).returning();
  return { ok: true as const, snapshot: await readFarmSnapshot(tx, updated!, false) };
});
