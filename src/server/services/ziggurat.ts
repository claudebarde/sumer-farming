import { settleZigguratRewards } from "./zigguratRewards";
import { deliveryPlan } from "../../game-data/zigguratDelivery";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Database, DatabaseTransaction } from "../db/client";
import { players, farmInventory, farms, neighbourhoodMembers, neighbourhoods, zigguratInterests, zigguratProjects, zigguratDonations, zigguratDeliveries } from "../db/schema";
import { ZigguratSchema, ZigguratDonationCommandSchema, type Ziggurat, type ZigguratDonationCommand } from "../../schemas/ziggurat";
import { ZIGGURAT_STAGES, ZIGGURAT_RESOURCES, ZIGGURAT_POINTS, emptyMaterials, type ZigguratMaterials } from "../../game-data/ziggurat";
import { setStoredQuantity } from "./physicalStorage";
import { advanceFarmLifecycle } from "./farmLifecycle";

import { loadMarketItemStorage, removeFromMarketItemStorage } from "./marketItemStorage";

const projectProgress = (project: typeof zigguratProjects.$inferSelect | undefined, now: Date) => {
  if (!project?.fundraisingOpenedAt) return { state: { type: "interest" as const }, funded: emptyMaterials() };
  let openedAt = project.fundraisingOpenedAt.toISOString();
  for (let stage = 0; stage < ZIGGURAT_STAGES.length; stage++) {
    const saved = stage === 0 ? { funded: { ...emptyMaterials(), clay: project.foundationClay, reed: project.foundationReed },
      startedAt: project.foundationsStartedAt?.toISOString(), completesAt: project.foundationsCompleteAt?.toISOString() } : project.laterStages[String(stage)];
    const funded = saved?.funded ?? emptyMaterials();
    if (!saved?.startedAt || !saved.completesAt) return { state: { type: "fundraising" as const, stage, openedAt }, funded };
    if (Date.parse(saved.completesAt) > now.getTime()) return { state: { type: "building" as const, stage, startedAt: saved.startedAt, completesAt: saved.completesAt }, funded };
    openedAt = saved.completesAt;
  }
  return { state: { type: "complete" as const, completedAt: openedAt }, funded: emptyMaterials() };
};

type Result = { readonly ok: true; readonly data: Ziggurat } |
  { readonly ok: false; readonly message: string };

const readState = async (tx: DatabaseTransaction, home: string, playerId: string): Promise<Ziggurat> => {
  await settleZigguratRewards(tx, { type: "neighbourhood", neighbourhoodId: home });
  const members = await tx.select({ slot: neighbourhoodMembers.slot, playerId: farms.playerId, level: farms.level,
    profile: farms.farmerProfile }).from(neighbourhoodMembers)
    .innerJoin(farms, eq(farms.playerId, neighbourhoodMembers.playerId))
    .where(eq(neighbourhoodMembers.neighbourhoodId, home)).orderBy(asc(neighbourhoodMembers.slot));
  const interests = await tx.select().from(zigguratInterests).where(eq(zigguratInterests.neighbourhoodId, home));
  const [project] = await tx.select().from(zigguratProjects).where(eq(zigguratProjects.neighbourhoodId, home));
  const stock = await tx.select({ itemKey: farmInventory.itemKey, quantity: farmInventory.quantity }).from(farmInventory)
    .innerJoin(farms, eq(farms.id, farmInventory.farmId)).where(eq(farms.playerId, playerId));
  const donations = await tx.select({ points: zigguratDonations.points }).from(zigguratDonations)
    .where(and(eq(zigguratDonations.neighbourhoodId, home), eq(zigguratDonations.playerId, playerId)));
  const serverTime = new Date();
  const deliveries = await tx.select().from(zigguratDeliveries).where(and(eq(zigguratDeliveries.neighbourhoodId, home), gt(zigguratDeliveries.completesAt, serverTime))).orderBy(asc(zigguratDeliveries.startsAt));
  const [player] = await tx.select().from(players).where(eq(players.id, playerId));
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId));
  const barley = farm ? await loadMarketItemStorage(tx, farm.id, "barley", serverTime) : null;
  const eligible = members.filter(member => member.level >= 10);
  const supporters = eligible.filter(member => interests.some(interest => interest.playerId === member.playerId));
  return ZigguratSchema.parse({
    ...projectProgress(project, serverTime),
    serverTime: serverTime.toISOString(),
    deliveries: deliveries.map(job => ({id:job.id,slot:job.slot,startsAt:job.startsAt.toISOString(),completesAt:job.completesAt.toISOString()})),
    eligibleCount: eligible.length, canParticipate: eligible.some(member => member.playerId === playerId),
    interested: supporters.some(member => member.playerId === playerId),
    supporters: supporters.map(member => ({ slot: member.slot, name: member.profile?.identity.name ?? "Farmer", isYou: member.playerId === playerId })),
    stock: Object.fromEntries(ZIGGURAT_RESOURCES.map(key => [key, key === "shekels" ? player?.shekelBalance ?? 0 : key === "barley" ? barley?.storedQuantity ?? 0 : stock.find(item => item.itemKey === key)?.quantity ?? 0])),
    contributionPoints: donations.reduce((total, donation) => total + donation.points, 0)
  });
};

/** The neighbourhood row serializes opening and interest changes across all players. */
export const zigguratInterest = (db: Database, playerId: string, interested?: boolean): Promise<Result> => db.transaction(async tx => {
  const [membership] = await tx.select().from(neighbourhoodMembers).where(eq(neighbourhoodMembers.playerId, playerId));
  if (!membership) return { ok: false, message: "Join a neighbourhood first." };
  const home = membership.neighbourhoodId;
  await tx.select().from(neighbourhoods).where(eq(neighbourhoods.id, home)).for("update");
  const [viewer] = await tx.select({ level: farms.level }).from(neighbourhoodMembers)
    .innerJoin(farms, eq(farms.playerId, neighbourhoodMembers.playerId))
    .where(and(eq(neighbourhoodMembers.playerId, playerId), eq(neighbourhoodMembers.neighbourhoodId, home)));
  if (!viewer || viewer.level < 7) return { ok: false, message: "Reach level 7 to view the ziggurat." };
  await tx.insert(zigguratProjects).values({ neighbourhoodId: home }).onConflictDoNothing();
  const state = await readState(tx, home, playerId);
  if (interested === undefined) return { ok: true, data: state };
  if (viewer.level < 10) return { ok: false, message: "Reach level 10 to take part." };
  // Retried registration after the third vote returns the committed state.
  if (state.state.type !== "interest") return { ok: true, data: state };
  if (interested) await tx.insert(zigguratInterests).values({ neighbourhoodId: home, playerId }).onConflictDoNothing();
  else await tx.delete(zigguratInterests).where(and(eq(zigguratInterests.neighbourhoodId, home), eq(zigguratInterests.playerId, playerId)));
  const next = await readState(tx, home, playerId);
  if (next.supporters.length >= 3) {
    await tx.update(zigguratProjects).set({ fundraisingOpenedAt: new Date() }).where(eq(zigguratProjects.neighbourhoodId, home));
    return { ok: true, data: await readState(tx, home, playerId) };
  }
  return { ok: true, data: next };
});

type DonationResult = { readonly ok: true; readonly data: Ziggurat;
  readonly receipt: ZigguratMaterials & { readonly points: number } } |
  { readonly ok: false; readonly message: string };

export const donateZiggurat = async (db: Database, playerId: string, input: ZigguratDonationCommand): Promise<DonationResult> => {
  const parsed = ZigguratDonationCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose valid material quantities to donate." };
  const command = parsed.data;
  return db.transaction(async tx => {
    const fail = (message: string) => ({ ok: false as const, message });
    const [membership] = await tx.select().from(neighbourhoodMembers).where(eq(neighbourhoodMembers.playerId, playerId));
    if (!membership) return fail("Join a neighbourhood first.");
    const home = membership.neighbourhoodId;
    // Consistent lock order: shared neighbourhood, then donating farm. Farm
    // actions use the same farm lock, so concurrent spending cannot overspend.
    await tx.select().from(neighbourhoods).where(eq(neighbourhoods.id, home)).for("update");
    const [currentMembership] = await tx.select().from(neighbourhoodMembers).where(eq(neighbourhoodMembers.playerId, playerId)).for("share");
    if (currentMembership?.neighbourhoodId !== home) return fail("Your neighbourhood changed. Please reopen the ziggurat.");
    const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!loaded || loaded.level < 10) return fail("Reach level 10 to contribute.");
    const [previous] = await tx.select().from(zigguratDonations).where(and(
      eq(zigguratDonations.playerId, playerId), eq(zigguratDonations.idempotencyKey, command.idempotencyKey)));
    const requested = Object.fromEntries(ZIGGURAT_RESOURCES.map(key => [key, command[key]])) as ZigguratMaterials;
    if (previous) {
      const original = previous.requestedMaterials ?? { ...emptyMaterials(), clay: previous.requestedClay, reed: previous.requestedReed };
      if (previous.neighbourhoodId !== home || previous.stage !== command.stage || ZIGGURAT_RESOURCES.some(key => original[key] !== requested[key]))
        return fail("This donation reference was already used for different materials.");
      return { ok: true, data: await readState(tx, home, playerId), receipt: { ...(previous.acceptedMaterials ?? { ...emptyMaterials(), clay: previous.clay, reed: previous.reed }), points: previous.points } };
    }
    const [project] = await tx.select().from(zigguratProjects).where(eq(zigguratProjects.neighbourhoodId, home));
    const now = new Date();
    const progress = projectProgress(project, now);
    if (!project || progress.state.type !== "fundraising") return fail("This stage is not accepting donations.");
    if (progress.state.stage !== command.stage) return fail("Construction has advanced. Reopen the ziggurat to donate to the current stage.");
    const definition = ZIGGURAT_STAGES[command.stage]!;
    if (ZIGGURAT_RESOURCES.some(key => requested[key] > 0 && definition.materials[key] === 0)) return fail("These materials are not needed for this stage.");
    const accepted = Object.fromEntries(ZIGGURAT_RESOURCES.map(key => [key, Math.min(requested[key], definition.materials[key] - progress.funded[key])])) as ZigguratMaterials;
    if (!ZIGGURAT_RESOURCES.some(key => accepted[key] > 0)) return fail("These materials have already been funded.");
    const farm = await advanceFarmLifecycle(tx, loaded, now);
    const stock = await tx.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
    const barley = await loadMarketItemStorage(tx, farm.id, "barley", now);
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).for("update");
    for (const key of ZIGGURAT_RESOURCES) {
      const available = key === "shekels" ? player!.shekelBalance : key === "barley" ? Math.max(0, barley.storedQuantity - 1) : stock.find(item => item.itemKey === key)?.quantity ?? 0;
      if (accepted[key] > available) return fail(key === "barley" ? "Keep at least one stored barley for planting." : "Not enough stored materials or shekels. Review your quantities.");
    }
    for (const key of ZIGGURAT_RESOURCES) {
      if (!accepted[key]) continue;
      if (key === "shekels") await tx.update(players).set({ shekelBalance: player!.shekelBalance - accepted[key], updatedAt: now }).where(eq(players.id, playerId));
      else if (key === "barley") await removeFromMarketItemStorage(tx, barley, accepted[key], now);
      else await setStoredQuantity(tx, farm.id, key, (stock.find(item => item.itemKey === key)?.quantity ?? 0) - accepted[key], now);
    }
    const points = ZIGGURAT_RESOURCES.reduce((sum, key) => sum + accepted[key] * ZIGGURAT_POINTS[key], 0);
    await tx.insert(zigguratDonations).values({ neighbourhoodId: home, playerId, idempotencyKey: command.idempotencyKey,
      stage: command.stage, requestedMaterials: requested, acceptedMaterials: accepted,
      requestedClay: command.clay, requestedReed: command.reed, clay: accepted.clay, reed: accepted.reed, points, donatedAt: now });
    const funded = Object.fromEntries(ZIGGURAT_RESOURCES.map(key => [key, progress.funded[key] + accepted[key]])) as ZigguratMaterials;
    const complete = ZIGGURAT_RESOURCES.every(key => funded[key] === definition.materials[key]);
    const completesAt = new Date(now.getTime() + definition.hours * 3600000);
    if (command.stage === 0) await tx.update(zigguratProjects).set({ foundationClay: funded.clay, foundationReed: funded.reed,
      ...(complete ? { foundationsStartedAt: now, foundationsCompleteAt: completesAt } : {}) }).where(eq(zigguratProjects.neighbourhoodId, home));
    else await tx.update(zigguratProjects).set({ laterStages: { ...project.laterStages, [String(command.stage)]: {
      funded, ...(complete ? { startedAt: now.toISOString(), completesAt: completesAt.toISOString() } : {})
    } } }).where(eq(zigguratProjects.neighbourhoodId, home));
    // One saved cosmetic trip per contributor while queued/active. The same
    // neighbourhood lock serializes this shared donkey without delaying goods.
    const queue = await tx.select().from(zigguratDeliveries).where(and(eq(zigguratDeliveries.neighbourhoodId, home), gt(zigguratDeliveries.completesAt, now)));
    if (!queue.some(job => job.playerId === playerId)) {
      const startsAt = new Date(Math.max(now.getTime(), ...queue.map(job => job.completesAt.getTime())));
      await tx.insert(zigguratDeliveries).values({neighbourhoodId:home,playerId,slot:currentMembership.slot,startsAt,
        completesAt:new Date(startsAt.getTime()+deliveryPlan(currentMembership.slot).duration)});
    }
    await tx.update(farms).set({ version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id));
    return { ok: true, data: await readState(tx, home, playerId), receipt: { ...accepted, points } };
  });
};
