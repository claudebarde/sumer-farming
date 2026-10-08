import { and, asc, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { Database, DatabaseTransaction } from "../db/client";
import { neighbourhoods, neighbourhoodMembers, players } from "../db/schema";
import type { Residence, ResidenceCommand } from "../../schemas/residence";
import { SUMER_CITIES } from "../../game-data/sumer";

export class ResidencePersistenceError extends Data.TaggedError("ResidencePersistenceError")<{ readonly cause: unknown }> {}
type SelectionResult = { readonly type: "ok"; readonly residence: Residence } | { readonly type: "rejected"; readonly message: string };

export const readResidence = async (db: Database | DatabaseTransaction, playerId: string): Promise<Residence | null> => {
  const [home] = await db.select({ neighbourhood: neighbourhoods }).from(neighbourhoodMembers)
    .innerJoin(neighbourhoods, eq(neighbourhoodMembers.neighbourhoodId, neighbourhoods.id))
    .where(eq(neighbourhoodMembers.playerId, playerId));
  if (!home) return null;
  const members = await db.select().from(neighbourhoodMembers).where(eq(neighbourhoodMembers.neighbourhoodId, home.neighbourhood.id));
  return { city: home.neighbourhood.city, neighbourhoodId: home.neighbourhood.id, name: home.neighbourhood.name,
    private: home.neighbourhood.private, members: members.length, inviteCode: home.neighbourhood.inviteCode };
};

export const chooseResidence = (db: Database, playerId: string, command: ResidenceCommand) => Effect.tryPromise({
  try: (): Promise<SelectionResult> => db.transaction(async tx => {
    // All automatic assignments serialize; slots also enforce the cap in SQL.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(74832001)`);
    const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");
    if (!player) return { type: "rejected", message: "Load your player before choosing a city." };
    const existing = await readResidence(tx, playerId);
    if (existing) return existing.city === command.city
      ? { type: "ok", residence: existing }
      : { type: "rejected", message: "Your city is already chosen. Relocation is not available yet." };
    const candidates = await tx.select().from(neighbourhoods)
      .where(and(eq(neighbourhoods.city, command.city), eq(neighbourhoods.private, false)))
      .orderBy(asc(neighbourhoods.createdAt), asc(neighbourhoods.id));
    for (const candidate of candidates) {
      const occupied = await tx.select({ slot: neighbourhoodMembers.slot }).from(neighbourhoodMembers).where(eq(neighbourhoodMembers.neighbourhoodId, candidate.id));
      const slot = Array.from({ length: 10 }, (_, i) => i + 1).find(i => !occupied.some(member => member.slot === i));
      if (slot === undefined) continue;
      await tx.insert(neighbourhoodMembers).values({ playerId, neighbourhoodId: candidate.id, slot });
      return { type: "ok", residence: (await readResidence(tx, playerId))! };
    }
    const cityName = SUMER_CITIES.find(city => city.id === command.city)!.name;
    const [created] = await tx.insert(neighbourhoods).values({ city: command.city,
      name: `${cityName} neighbourhood ${candidates.length + 1}`,
      private: false }).returning();
    await tx.insert(neighbourhoodMembers).values({ playerId, neighbourhoodId: created!.id, slot: 1 });
    return { type: "ok", residence: (await readResidence(tx, playerId))! };
  }),
  catch: cause => new ResidencePersistenceError({ cause })
});
