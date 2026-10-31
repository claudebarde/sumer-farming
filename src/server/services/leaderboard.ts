import { reconcileZigguratPoints } from "./playerPoints";
import { settleZigguratRewards } from "./zigguratRewards";
import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { match } from "ts-pattern";
import type { Database } from "../db/client";
import { farms, neighbourhoodMembers } from "../db/schema";
import { LeaderboardResponseSchema, type LeaderboardQuery, type LeaderboardResponse } from "../../schemas/leaderboard";

export class LeaderboardError extends Data.TaggedError("LeaderboardError")<{ readonly cause: unknown }> {}
type Result = { readonly type: "ok"; readonly leaderboard: LeaderboardResponse }
  | { readonly type: "rejected"; readonly message: string };

/** Rankings of persisted progress; reconciles completion awards without simulating other farms. */
export const readLeaderboard = (db: Database, playerId: string, query: LeaderboardQuery) => Effect.tryPromise({
  try: (): Promise<Result> => db.transaction(async tx => {
    const [viewer] = await tx.select({ neighbourhoodId: neighbourhoodMembers.neighbourhoodId,
      level: farms.level, profile: farms.farmerProfile }).from(farms)
      .innerJoin(neighbourhoodMembers, eq(neighbourhoodMembers.playerId, farms.playerId))
      .where(eq(farms.playerId, playerId));
    if (!viewer?.profile || viewer.level < 3) return { type: "rejected", message: "Choose a home and farmer, and reach level 3 to view the leaderboard." };
    if (query.metric === "ziggurat" && (query.scope !== "local" || viewer.level < 7))
      return { type: "rejected", message: "View ziggurat contributions in your neighbourhood from level 7." };
    await settleZigguratRewards(tx, query.scope === "local"
      ? { type: "neighbourhood", neighbourhoodId: viewer.neighbourhoodId }
      : { type: "global" });
    if (query.metric === "points") await reconcileZigguratPoints(tx);
    const score = match(query.metric)
      .with("points", () => sql`(SELECT coalesce(sum(a.points), 0)::double precision FROM point_awards a WHERE a.player_id=p.id)`)
      .with("ziggurat", () => sql`0`)
      .with("level", () => sql`f.level`)
      .with("shekels", () => sql`p.shekel_balance`)
      .with("harvestedBarley", () => sql`coalesce((f.progression_stats->>'harvestedBarley')::integer, 0)`)
      .exhaustive();
    // Equal scores share rank. Construction ties sort by farmer name, then ID.
    // Rank, count and the viewer row all come from one SQL snapshot.
    const result = await tx.execute(sql`
      WITH scores AS (
        ${query.metric === "ziggurat" ? sql`
        SELECT p.id AS "playerId", f.farmer_profile->'identity'->>'name' AS name,
          n.city, n.name AS neighbourhood, f.level AS level, coalesce(sum(d.points), 0)::integer AS score
        FROM (
          SELECT player_id FROM neighbourhood_members WHERE neighbourhood_id = ${viewer.neighbourhoodId}
          UNION
          SELECT player_id FROM ziggurat_donations WHERE neighbourhood_id = ${viewer.neighbourhoodId}
        ) participants
        JOIN players p ON p.id = participants.player_id
        JOIN farms f ON f.player_id = p.id
        JOIN neighbourhoods n ON n.id = ${viewer.neighbourhoodId}
        LEFT JOIN ziggurat_donations d ON d.player_id = p.id AND d.neighbourhood_id = n.id
        WHERE f.farmer_profile->'identity'->>'name' IS NOT NULL
        GROUP BY p.id, f.id, n.id
        ` : sql`SELECT p.id AS "playerId", f.farmer_profile->'identity'->>'name' AS name,
          n.city, n.name AS neighbourhood, f.level AS level, ${score} AS score
        FROM players p JOIN farms f ON f.player_id = p.id
        JOIN neighbourhood_members m ON m.player_id = p.id
        JOIN neighbourhoods n ON n.id = m.neighbourhood_id
        WHERE f.farmer_profile->'identity'->>'name' IS NOT NULL
          AND ${query.scope === "local" ? sql`m.neighbourhood_id = ${viewer.neighbourhoodId}` : sql`true`}
        `}
      ), ranked AS (
        SELECT *, rank() OVER (ORDER BY score DESC)::integer AS rank,
          row_number() OVER (ORDER BY score DESC, ${query.metric === "ziggurat" || query.metric === "points" ? sql`lower(name), name,` : sql``} "playerId")::integer AS position,
          count(*) OVER ()::integer AS total FROM scores
      ) SELECT *, EXISTS(SELECT 1 FROM ziggurat_rewards reward WHERE reward.player_id = ranked."playerId") AS "zigguratPatron" FROM ranked WHERE position <= 10 OR "playerId" = ${playerId} ORDER BY position
    `);
    const rows: Array<Record<string, unknown> & { isYou: boolean }> = result.rows.map(row => ({ ...row, isYou: row.playerId === playerId }));
    const leaderboard = LeaderboardResponseSchema.parse({ ...query,
      entries: rows.filter(row => Number(row.position) <= 10), self: rows.find(row => row.isYou) ?? null,
      total: rows[0]?.total ?? 0, updatedAt: new Date().toISOString() });
    return { type: "ok", leaderboard };
  }),
  catch: cause => new LeaderboardError({ cause })
});
