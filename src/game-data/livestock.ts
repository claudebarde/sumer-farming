import { z } from "zod";

export const LAMB_PRICE = 24;
export const PEN_CAPACITY = 3;
const Cell = z.object({ column: z.number(), row: z.number() });
export const LivestockSchema = z.object({
  animals: z.array(z.object({ id: z.uuid(), purchaseId: z.uuid(), penId: z.uuid(), age: z.enum(["lamb", "adult"]), purchasedAt: z.number(), arrivesAt: z.number(), care: z.object({ growthMs: z.number().nonnegative(), fedAt: z.number().nullable(), needsFeedAt: z.number() }).optional() })).max(PEN_CAPACITY),
  fleece: z.object({ remainingMs: z.number().nonnegative(), updatedAt: z.number() }).optional(),
  shearing: z.object({ id: z.uuid(), penId: z.uuid(), animalIds: z.array(z.uuid()).min(1).max(3), quantity: z.int().positive(), warehouseId: z.uuid(), startedAt: z.number(), shearsAt: z.number(), shearedAt: z.number(), completesAt: z.number(), stepMs: z.number().positive(), outbound: z.array(Cell).min(1), inbound: z.array(Cell).min(1), settled: z.boolean() }).optional(),
  feeding: z.object({ id: z.uuid(), penId: z.uuid(), startedAt: z.number(), completesAt: z.number(), stepMs: z.number().positive(), path: z.array(Cell).min(1), pickups: z.array(z.object({ storageId: z.string(), quantity: z.int().positive(), pickupAt: z.number() })) }).optional(),
  losses: z.array(z.object({ id: z.uuid(), lostAt: z.number() })).optional(),
  delivery: z.object({ id: z.uuid(), penId: z.uuid(), quantity: z.int().min(1).max(3), startedAt: z.number(), farmStartsAt: z.number(), completesAt: z.number(), stepMs: z.number().positive(), marketPath: z.array(Cell).min(1), farmPath: z.array(Cell).min(1) }).nullable()
});
export type Livestock = z.infer<typeof LivestockSchema>;
export type LambDelivery = NonNullable<Livestock["delivery"]>;
export const emptyLivestock = (): Livestock => ({ animals: [], delivery: null });
export const lambDeliveryActive = (state: Livestock | undefined, now = Date.now()) => !!state?.delivery && now < state.delivery.completesAt;
export const lambPurchaseLimit = (animals: number, shekels: number) => Math.max(0, Math.min(PEN_CAPACITY - animals, Math.floor(shekels / LAMB_PRICE)));
export const BuyLambsSchema = z.object({ quantity: z.int().min(1).max(PEN_CAPACITY), expectedFarmVersion: z.int().positive(), idempotencyKey: z.uuid() });
/** Shared timeline sampling: reloads never restart a delivery. */
export const livestockPathPose = (path: readonly { column: number; row: number }[], elapsed: number, stepMs: number) => {
  const progress = Math.max(0, Math.min(path.length - 1, elapsed / stepMs));
  const index = Math.min(path.length - 1, Math.floor(progress)), a = path[index]!, b = path[Math.min(path.length - 1, index + 1)]!;
  const fraction = progress - index;
  return { position: { column: a.column + (b.column - a.column) * fraction, row: a.row + (b.row - a.row) * fraction }, walking: progress < path.length - 1,
    flipX: (b.column - a.column) - (b.row - a.row) < 0, progress };
};

export const FEED_PERIOD_MS = 12 * 60 * 60 * 1000;
export const FEED_GRACE_MS = 48 * 60 * 60 * 1000;
export const FEED_BARLEY = 2;
export const FEED_STOP_MS = 3000;
export type Sheep = Livestock["animals"][number];
export const sheepGrowth = (animal: Sheep, now: number) => Math.min(2 * FEED_PERIOD_MS,
  (animal.care?.growthMs ?? (animal.age === "adult" ? 2 * FEED_PERIOD_MS : 0)) +
  (animal.care?.fedAt == null ? 0 : Math.max(0, Math.min(FEED_PERIOD_MS, now - animal.care.fedAt))));
export const sheepStage = (animal: Sheep, now: number) => sheepGrowth(animal, now) >= 2 * FEED_PERIOD_MS ? "Adult" : sheepGrowth(animal, now) >= FEED_PERIOD_MS ? "Growing" : "Lamb";
export const flockFeedDue = (state: Livestock, now: number) => state.animals.length > 0 &&
  !state.animals.some(a => a.arrivesAt > now) &&
  !(state.feeding && state.feeding.completesAt > now) &&
  state.animals.every(a => !a.care || a.care.needsFeedAt <= now);
export const FeedFlockSchema = z.object({ penId: z.uuid(), expectedFarmVersion: z.int().positive(), idempotencyKey: z.uuid(), farmerPosition: z.object({ column: z.int(), row: z.int() }) });

export const SHEAR_MS = 60_000;
export const WOOL_PER_SHEEP = 2;
export const WOOL_REGROW_MS = 24 * 60 * 60 * 1000;
export const ShearFlockSchema = FeedFlockSchema;
export const fleeceRemaining = (state: Livestock, now: number): number => {
  if (!state.fleece) return 0;
  const fedUntil = Math.min(...state.animals.map(a => a.care?.needsFeedAt ?? state.fleece!.updatedAt));
  return Math.max(0, state.fleece.remainingMs - Math.max(0, Math.min(now, fedUntil) - state.fleece.updatedAt));
};
export const readySheep = (state: Livestock, now: number) =>
  (state.shearing && !state.shearing.settled) || fleeceRemaining(state, now) > 0 ? []
    : state.animals.filter(a => a.arrivesAt <= now && sheepStage(a, now) === "Adult");
