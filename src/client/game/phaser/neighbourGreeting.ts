import { GREETING_DURATION } from "./merchantGreeting";

export type NeighbourGreeting = Readonly<{ greeted: boolean; startedAt: number | null; nextAt: number }>;
export const initialNeighbourGreeting = (): NeighbourGreeting => ({ greeted: false, startedAt: null, nextAt: 0 });

/** Cosmetic encounter state. A wider exit radius prevents boundary jitter. */
export const advanceNeighbourGreeting = (state: NeighbourGreeting, distance: number, now: number): NeighbourGreeting => {
  if (distance > 2) return { ...state, greeted: false, startedAt: null };
  if (!state.greeted && distance <= 1.5 && now >= state.nextAt) {
    return { greeted: true, startedAt: now, nextAt: now + 8000 };
  }
  return { ...state, startedAt: state.startedAt !== null && now - state.startedAt < GREETING_DURATION ? state.startedAt : null };
};
