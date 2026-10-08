import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { match } from "ts-pattern";
import type { Database } from "../db/client";
import { farms, neighbourhoodMembers } from "../db/schema";
import { LeaderboardResponseSchema, type LeaderboardQuery, type LeaderboardResponse } from "../../schemas/leaderboard";

export class LeaderboardError extends Data.TaggedError("LeaderboardError")<{ readonly cause: unknown }> {}
type Result = { readonly type: "ok"; readonly leaderboard: LeaderboardResponse }
  | { readonly type: "rejected"; readonly message: string };

/** Read-only rankings of persisted progress; never simulates or mutates other farms. */
export const readLeaderboard = (db: Database, playerId: string, query: LeaderboardQuery) => Effect.tryPromise({
  try: (): Promise<Result> => db.transaction(async tx => {
    const [viewer] = await tx.select({ neighbourhoodId: neighbourhoodMembers.neighbourhoodId,
      level: farms.level, profile: farms.farmerProfile }).from(farms)
      .innerJoin(neighbourhoodMembers, eq(neighbourhoodMembers.playerId, farms.playerId))
      .where(eq(farms.playerId, playerId));
    if (!viewer?.profile || viewer.level < 3) return { type: "rejected", message: "Choose a home and farmer, and reach level 3 to view the leaderboard." };
    const score = match(query.metric)
      .with("level", () => sql`f.level`)
      .with("shekels", () => sql`p.shekel_balance`)
      .with("harvestedBarley", () => sql`coalesce((f.progression_stats->>'harvestedBarley')::integer, 0)`)
      .exhaustive();
    // Equal scores share rank. Stable IDs bound the list to ten, even at a tie.
    // Rank, count and the viewer row all come from one SQL snapshot.
    const result = await tx.execute(sql`
      WITH scores AS (
        SELECT p.id AS "playerId", f.farmer_profile->'identity'->>'name' AS name,
          n.city, n.name AS neighbourhood, ${score} AS score
        FROM players p JOIN farms f ON f.player_id = p.id
        JOIN neighbourhood_members m ON m.player_id = p.id
        JOIN neighbourhoods n ON n.id = m.neighbourhood_id
        WHERE f.farmer_profile->'identity'->>'name' IS NOT NULL
          AND ${query.scope === "local" ? sql`m.neighbourhood_id = ${viewer.neighbourhoodId}` : sql`true`}
      ), ranked AS (
        SELECT *, rank() OVER (ORDER BY score DESC)::integer AS rank,
          row_number() OVER (ORDER BY score DESC, "playerId")::integer AS position,
          count(*) OVER ()::integer AS total FROM scores
      ) SELECT * FROM ranked WHERE position <= 10 OR "playerId" = ${playerId} ORDER BY position
    `);
    const rows: Array<Record<string, unknown> & { isYou: boolean }> = result.rows.map(row => ({ ...row, isYou: row.playerId === playerId }));
    const leaderboard = LeaderboardResponseSchema.parse({ ...query,
      entries: rows.filter(row => Number(row.position) <= 10), self: rows.find(row => row.isYou) ?? null,
      total: rows[0]?.total ?? 0, updatedAt: new Date().toISOString() });
    return { type: "ok", leaderboard };
  }),
  catch: cause => new LeaderboardError({ cause })
});
