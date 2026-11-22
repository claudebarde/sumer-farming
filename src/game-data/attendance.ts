/** UTC calendar days; one missed day is allowed only after unlocking. */
export type Attendance = { readonly lastDay?: number; readonly streak: number; readonly unlocked: boolean; readonly activeUntil?: number };
export const utcDay = (now: number) => Math.floor(now / 86_400_000);
export const attendanceAt = (state: Attendance | undefined, now: number): Attendance => {
  const previous = state ?? { streak: 0, unlocked: false };
  const gap = previous.lastDay === undefined ? 0 : utcDay(now) - previous.lastDay;
  return gap >= (previous.unlocked ? 3 : 2) ? { ...previous, streak: 0, unlocked: false } : previous;
};
export const attend = (state: Attendance | undefined, now: number): Attendance => {
  const current = attendanceAt(state, now), day = utcDay(now);
  if (current.lastDay !== undefined && day <= current.lastDay) return current;
  const streak = current.lastDay === day - 1 ? Math.min(5, current.streak + 1) : 1;
  return { ...current, lastDay: day, streak, unlocked: current.unlocked || streak >= 5 };
};
