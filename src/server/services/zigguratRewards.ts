import { match } from "ts-pattern";
import { sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";

type RewardScope =
  | { readonly type: "player"; readonly playerId: string }
  | { readonly type: "neighbourhood"; readonly neighbourhoodId: string }
  | { readonly type: "global" };

/** Never wait on parent-row locks held by other farm/neighbourhood actions.
 * Busy awards are retried on the next read; unique awards make retries safe.
 * Lock parents before inserting so foreign-key checks cannot invert lock order. */
export const settleZigguratRewards = async (tx: DatabaseTransaction, scope: RewardScope) => {
  const projectFilter = match(scope)
    .with({ type: "neighbourhood" }, ({ neighbourhoodId }) => sql`neighbourhood_id = ${neighbourhoodId}`)
    .with({ type: "player" }, ({ playerId }) => sql`neighbourhood_id IN (
      SELECT neighbourhood_id FROM ziggurat_donations WHERE player_id = ${playerId}
    )`)
    .with({ type: "global" }, () => sql`true`)
    .exhaustive();
  const winnerFilter = scope.type === "player" ? sql`r.player_id = ${scope.playerId}` : sql`true`;
  await tx.execute(sql`
    WITH completed AS (
      SELECT neighbourhood_id, (later_stages->'3'->>'completesAt')::timestamptz AS completed_at
      FROM ziggurat_projects
      WHERE ${projectFilter}
        AND foundations_complete_at <= now()
        AND (later_stages->'1'->>'completesAt')::timestamptz <= now()
        AND (later_stages->'2'->>'completesAt')::timestamptz <= now()
        AND (later_stages->'3'->>'completesAt')::timestamptz <= now()
    ), totals AS (
      SELECT d.neighbourhood_id, d.player_id, c.completed_at, sum(d.points) AS points
      FROM ziggurat_donations d JOIN completed c USING (neighbourhood_id)
      GROUP BY d.neighbourhood_id,d.player_id,c.completed_at
    ), ranked AS (
      SELECT *, rank() OVER (PARTITION BY neighbourhood_id ORDER BY points DESC) AS rank FROM totals
    ), available AS MATERIALIZED (
      SELECT r.player_id, r.neighbourhood_id, r.completed_at
      FROM ranked r
      JOIN players p ON p.id = r.player_id
      JOIN neighbourhoods n ON n.id = r.neighbourhood_id
      WHERE r.rank = 1 AND r.points > 0 AND ${winnerFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ziggurat_rewards reward
          WHERE reward.player_id = r.player_id AND reward.neighbourhood_id = r.neighbourhood_id
        )
      ORDER BY r.neighbourhood_id, r.player_id
      FOR KEY SHARE OF n, p SKIP LOCKED
    ) INSERT INTO ziggurat_rewards (player_id,neighbourhood_id,awarded_at)
      SELECT player_id,neighbourhood_id,completed_at FROM available
      ORDER BY neighbourhood_id,player_id
      ON CONFLICT (player_id,neighbourhood_id) DO NOTHING
  `);
};
