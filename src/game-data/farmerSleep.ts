import { z } from "zod";
import { INITIAL_FARM_CONFIG as config } from "./initialFarm";
export const SLEEP_WINDOW_MS = 24 * 60 * 60_000;
export const SLEEP_LIMIT_MS = 8 * 60 * 60_000;
export const SLEEP_ENTRY_MS = 2500;
export const SLEEP_EXIT_MS = 1600;
export const SLEEP_HOME: { column: number; row: number } = { column: config.buildingBounds.maximumColumn, row: config.roadRow };
const Interval = z.object({ start: z.number(), end: z.number() });
export const FarmerSleepSchema = z.object({
  history: z.array(Interval),
  session: z.object({ id: z.uuid(), requestedAt: z.number(), sleepsAt: z.number(), endsAt: z.number(), wokeAt: z.number().nullable(),
    path: z.array(z.object({ column: z.int(), row: z.int() })).min(1) }).nullable(),
});
export type FarmerSleep = z.infer<typeof FarmerSleepSchema>;
export type SleepInterval = z.infer<typeof Interval>;
export const emptyFarmerSleep = (): FarmerSleep => ({ history: [], session: null });
export const sleepEnd = (s: NonNullable<FarmerSleep["session"]>) => Math.min(s.endsAt, s.wokeAt ?? s.endsAt);
export const sleepIntervals = (state?: FarmerSleep | null): readonly SleepInterval[] => !state ? [] : [
  ...state.history, ...(state.session && sleepEnd(state.session) > state.session.sleepsAt ? [{ start: state.session.sleepsAt, end: sleepEnd(state.session) }] : []),
];
export const isFarmerSleeping = (state: FarmerSleep | null | undefined, now: number) => !!state?.session && now < sleepEnd(state.session);
export const sleepRemaining = (state: FarmerSleep | null | undefined, now: number) => Math.max(0, SLEEP_LIMIT_MS - sleepIntervals(state).reduce((sum, s) => sum + Math.max(0, Math.min(s.end, now) - Math.max(s.start, now - SLEEP_WINDOW_MS)), 0));
