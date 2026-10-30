import { and, desc, eq, gt, gte, lt, ne } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { Database } from "../db/client";
import { farms, marketPresence, neighbourhoodMembers } from "../db/schema";
import { MARKET_PRESENCE_TTL_MS, MARKET_PRESENCE_UNLOCK_LEVEL, MarketPositionSchema, MarketPresenceCommandSchema, type MarketPresenceCommand, type MarketVisitor } from "../../schemas/marketPresence";

export class MarketPresenceError extends Data.TaggedError("MarketPresenceError")<{ readonly cause: unknown }> {}
type Result = { readonly type: "ok"; readonly visitors: readonly MarketVisitor[] }
  | { readonly type: "rejected"; readonly message: string };

export const updateMarketPresence = (db: Database, playerId: string, input: MarketPresenceCommand) => Effect.tryPromise({
  try: (): Promise<Result> => db.transaction(async tx => {
    const parsed = MarketPresenceCommandSchema.safeParse(input);
    if (!parsed.success) return { type: "rejected", message: "Invalid market visit." };
    const command = parsed.data;
    const [home] = await tx.select({ neighbourhoodId: neighbourhoodMembers.neighbourhoodId, profile: farms.farmerProfile, level: farms.level })
      .from(neighbourhoodMembers).innerJoin(farms, eq(farms.playerId, neighbourhoodMembers.playerId))
      .where(eq(neighbourhoodMembers.playerId, playerId));
    if (!home?.profile || home.level < MARKET_PRESENCE_UNLOCK_LEVEL) return { type: "rejected", message: "Choose a home and farmer, and reach level 10 before joining the shared market." };
    const now = new Date();
    const key = and(eq(marketPresence.playerId, playerId), eq(marketPresence.sessionId, command.sessionId));
    // A leave creates a tombstone even if it beats the initial join request.
    // Late requests cannot resurrect this visit, nor remove a newer tab's visit.
    if (command.type === "leave") {
      await tx.insert(marketPresence).values({ playerId, sessionId: command.sessionId, position: { column: -3, row: 5 }, closed: true, seenAt: now })
        .onConflictDoUpdate({ target: [marketPresence.playerId, marketPresence.sessionId], set: { closed: true, seenAt: now } });
      return { type: "ok", visitors: [] };
    }
    if (command.type === "join") await tx.insert(marketPresence)
      .values({ playerId, sessionId: command.sessionId, position: command.position, seenAt: now }).onConflictDoNothing();
    const updated = await tx.update(marketPresence).set({ position: command.position, seenAt: now })
      .where(and(key, eq(marketPresence.closed, false))).returning({ id: marketPresence.playerId });
    if (!updated.length) return { type: "rejected", message: "This market visit has ended." };
    // Expired entries never appear; old sessions are cleaned lazily, scoped to
    // their owner, without a background process or touching other game data.
    await tx.delete(marketPresence).where(and(eq(marketPresence.playerId, playerId), lt(marketPresence.seenAt, new Date(now.getTime() - 86_400_000))));
    const rows = await tx.select({ playerId: marketPresence.playerId, position: marketPresence.position, profile: farms.farmerProfile })
      .from(marketPresence).innerJoin(neighbourhoodMembers, eq(neighbourhoodMembers.playerId, marketPresence.playerId))
      .innerJoin(farms, eq(farms.playerId, marketPresence.playerId))
      .where(and(eq(neighbourhoodMembers.neighbourhoodId, home.neighbourhoodId), ne(marketPresence.playerId, playerId),
        gte(farms.level, MARKET_PRESENCE_UNLOCK_LEVEL), eq(marketPresence.closed, false), gt(marketPresence.seenAt, new Date(now.getTime() - MARKET_PRESENCE_TTL_MS))))
      .orderBy(desc(marketPresence.seenAt), marketPresence.sessionId);
    const visitors = new Map<string, MarketVisitor>();
    for (const row of rows) if (row.profile && !visitors.has(row.playerId) && visitors.size < 9 && MarketPositionSchema.safeParse(row.position).success) visitors.set(row.playerId,
      { playerId: row.playerId, name: row.profile.identity.name, position: row.position });
    return { type: "ok", visitors: [...visitors.values()] };
  }),
  catch: cause => new MarketPresenceError({ cause })
});
