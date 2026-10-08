import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import { FarmerNameSchema, type FarmerProfile } from "../../schemas/farmerProfile";

export class FarmerProfilePersistenceError extends Data.TaggedError("FarmerProfilePersistenceError")<{ readonly cause: unknown }> {}
type Result = { readonly type: "ok"; readonly profile: FarmerProfile } | { readonly type: "rejected"; readonly message: string };

export const nameFarmer = (db: Database, playerId: string, name: unknown) => Effect.tryPromise({
  try: (): Promise<Result> => db.transaction(async tx => {
    const parsed = FarmerNameSchema.safeParse(name);
    if (!parsed.success) return { type: "rejected", message: "Choose a name from the available farmer names." };
    const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!farm) return { type: "rejected", message: "Load your farm before choosing a name." };
    if (farm.farmerProfile) return farm.farmerProfile.identity.name === parsed.data
      ? { type: "ok", profile: farm.farmerProfile }
      : { type: "rejected", message: "Your farmer already has a name. Renaming is not available yet." };
    const profile: FarmerProfile = { version: 1, identity: { name: parsed.data } };
    await tx.update(farms).set({ farmerProfile: profile, version: sql`${farms.version} + 1`, updatedAt: new Date() }).where(eq(farms.id, farm.id));
    return { type: "ok", profile };
  }),
  catch: cause => new FarmerProfilePersistenceError({ cause })
});
