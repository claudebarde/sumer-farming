import { SaveFurnitureSchema } from "../../schemas/homeFurniture";
import { furnitureLayoutError } from "../../game-core/home/furniture";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import { HomeAppearanceSchema, type HomeAppearance } from "../../schemas/homeAppearance";
import { readFarmSnapshot } from "./farmSnapshot";
export const saveHomeAppearance = (db: Database, playerId: string, input: HomeAppearance) => db.transaction(async tx => {
  const appearance = HomeAppearanceSchema.parse(input);
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
  if (!farm) return { ok: false as const, message: "Farm not found." };
  const snapshot = await readFarmSnapshot(tx, farm, false);
  if ((snapshot.farm.progression?.level ?? 1) < 9) return { ok: false as const, message: "Home customization unlocks at level 9." };
  const [updated] = await tx.update(farms).set({ homeAppearance: { ...appearance, visibility: farm.homeAppearance.visibility, furniture: farm.homeAppearance.furniture, furnitureRevision: farm.homeAppearance.furnitureRevision }, version: sql`${farms.version}+1`, updatedAt: new Date() }).where(eq(farms.id, farm.id)).returning();
  return { ok: true as const, snapshot: await readFarmSnapshot(tx, updated!, false) };
});


/** Separate locked update so exterior and interior changes never overwrite each other. */
export const saveHomeFurniture = (db: Database, playerId: string, input: unknown) => db.transaction(async tx => {
  const command = SaveFurnitureSchema.parse(input);
  const invalid = furnitureLayoutError(command.items);
  if (invalid) return { ok: false as const, message: invalid };
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
  if (!farm) return { ok: false as const, message: "Farm not found." };
  if (farm.production.cooking?.interior && Date.parse(farm.production.cooking.completesAt) > Date.now()) return { ok: false as const, message: "Finish cooking before moving furniture." };
  if (command.items.some(item => item.key === "indoor-kitchen")) {
    const snapshot = await readFarmSnapshot(tx, farm, false);
    if ((snapshot.farm.progression?.level ?? 1) < 11) return { ok: false as const, message: "The kitchen unlocks at level 11." };
  }
  if ((farm.homeAppearance.furnitureRevision ?? 0) !== command.revision) return { ok: false as const, message: "Your furniture changed in another tab. Reopen the house and try again." };
  const [updated] = await tx.update(farms).set({
    homeAppearance: { ...farm.homeAppearance, furniture: command.items, furnitureRevision: command.revision + 1 },
    version: sql`${farms.version}+1`, updatedAt: new Date(),
  }).where(eq(farms.id, farm.id)).returning();
  return { ok: true as const, snapshot: await readFarmSnapshot(tx, updated!, false) };
});
