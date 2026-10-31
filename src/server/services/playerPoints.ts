import { eq, sql } from "drizzle-orm";
import { ACTION_POINTS, POINTS_RULE_VERSION, type PointAction } from "../../game-data/points";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmCrops, pointAwards, farms } from "../db/schema";

type Award = { readonly action: PointAction; readonly source: string; readonly completedAt: Date };

/** Called inside the outcome transaction. No client scores, animation callbacks,
 * read/modify/write totals, or retrospective awards. The unique source is the receipt. */
export const awardPoints = (tx: DatabaseTransaction, playerId: string, award: Award, now = new Date()) =>
  awardMany(tx, playerId, [award], now);

const awardMany = async (tx: DatabaseTransaction, playerId: string, awards: readonly Award[], now: Date) => {
  const due = awards.filter(award => award.completedAt <= now);
  if (!due.length) return;
  await tx.execute(sql`
    INSERT INTO point_awards (player_id, source, action, points, rule_version, completed_at)
    SELECT p.id, a.source, a.action, a.points, ${POINTS_RULE_VERSION}, a.completed_at
    FROM players p CROSS JOIN (VALUES ${sql.join(due.map(a => sql`(${a.source}::varchar, ${a.action}::varchar, ${ACTION_POINTS[a.action]}::integer, ${a.completedAt}::timestamptz)`), sql`, `)})
      AS a(source, action, points, completed_at)
    WHERE p.id = ${playerId} AND p.points_started_at <= a.completed_at
    ON CONFLICT (player_id, source) DO NOTHING
  `);
};

export const readPlayerPoints = async (tx: DatabaseTransaction, playerId: string) => {
  const [row] = await tx.select({ total: sql<number>`coalesce(sum(${pointAwards.points}), 0)::double precision` })
    .from(pointAwards).where(eq(pointAwards.playerId, playerId));
  return row?.total ?? 0;
};

/** Reconcile saved deadlines before lifecycle code removes completed jobs.
 * Caller holds the farm lock. Replay is safe and records the original completion time. */
export const reconcilePlayerPoints = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now: Date) => {
  const awards: Award[] = [];
  const award = (entry: Award) => { awards.push(entry); };
  const crops = await tx.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id));
  for (const crop of crops) {
    award({ action: crop.cropKey === "datePalm" ? "plantPalm" : crop.cropKey === "sesame" ? "sowSesame" : "sowBarley",
      source: crop.cropKey === "datePalm" ? `palm:${crop.column}:${crop.row}` : `sow:${crop.id}`, completedAt: crop.plantedAt });
  }
  const buildings = await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  for (const b of buildings) {
    award({ action: "firstBuilding", source: `building:${b.type}`, completedAt: b.completesAt });
    for (const upgrade of farm.production.buildingUpgrades?.[b.id] ?? []) {
      award({ action: "buildingUpgrade", source: `upgrade:${b.type}:${upgrade.level}`, completedAt: new Date(upgrade.completesAt) });
    }
    if (b.beerReadyAt) award({ action: "brewBeer", source: `beer:${b.id}:${b.beerReadyAt.toISOString()}`, completedAt: b.beerReadyAt });
  }
  if (farm.milling) {
    const job = farm.milling;
    award({ action: job.worker === "donkey" ? "millDonkey" : "millFarmer", source: `mill:${job.buildingId}:${job.startedAt}`, completedAt: new Date(job.completesAt) });
  }
  for (const [id, job] of Object.entries(farm.production.baking)) {
    award({ action: "bakeBread", source: `bake:${id}:${job.startedAt}`, completedAt: new Date(job.completesAt) });
  }
  for (const job of [farm.production.cropWork, ...(farm.production.cropWorkQueue ?? [])]) {
    if (!job || job.action === "plant") continue; // Planting uses the crop's persistent identity above.
    award({ action: job.action === "tend" ? "tendPalm" : job.cropKey === "sesame" ? "harvestSesame" : "harvestDates",
      source: `crop-work:${job.id}`, completedAt: new Date(job.workEndsAt) });
  }
  for (const [item, time] of [["fish", farm.lastFishAt], ["bread", farm.lastBreadAt], ["beer", farm.lastBeerAt],
    ["dates", farm.production.lastDatesAt ? new Date(farm.production.lastDatesAt) : null]] as const) {
    if (time) award({ action: "treat", source: `treat:${item}:${time.toISOString()}`, completedAt: time });
  }
  const blessing = farm.production.shrineBlessing;
  if (blessing) award({ action: "shrineOffering", source: `offering:${blessing.buildingId}:${blessing.startedAt}`, completedAt: new Date(blessing.startedAt) });
  await awardMany(tx, farm.playerId, awards, now);
  await reconcileZigguratPoints(tx, farm.playerId, now);
};

/** Shared-stage rewards are local to each contributor; no locks on other farms. */
export const reconcileZigguratPoints = async (tx: DatabaseTransaction, playerId?: string, now = new Date()) => {
  await tx.execute(sql`
    WITH available AS MATERIALIZED (
      SELECT id, points_started_at FROM players WHERE ${playerId ? sql`id = ${playerId}` : sql`true`}
      ORDER BY id FOR KEY SHARE SKIP LOCKED
    )
    INSERT INTO point_awards (player_id, source, action, points, rule_version, completed_at)
    SELECT DISTINCT d.player_id, 'ziggurat:' || d.neighbourhood_id::text || ':' || d.stage::text,
      'zigguratStage', ${ACTION_POINTS.zigguratStage}::integer, ${POINTS_RULE_VERSION}::integer, stage.completed_at
    FROM ziggurat_donations d JOIN ziggurat_projects z USING (neighbourhood_id)
    JOIN available p ON p.id=d.player_id
    CROSS JOIN LATERAL (SELECT CASE WHEN d.stage=0 THEN z.foundations_complete_at
      ELSE (z.later_stages->d.stage::text->>'completesAt')::timestamptz END AS completed_at) stage
    WHERE stage.completed_at <= ${now} AND stage.completed_at >= p.points_started_at
    ON CONFLICT (player_id, source) DO NOTHING
  `);
};
