import { expect, it } from "vitest";
import { attend, attendanceAt, type Attendance } from "../../src/game-data/attendance";
const day = 86400000, start = Date.UTC(2026, 0, 1);
it("unlocks on five distinct consecutive UTC days, not repeated requests", () => {
  let state: Attendance | undefined;
  for (let i = 0; i < 5; i++) {
    state = attend(state, start + i * day);
    expect(state.streak).toBe(i + 1);
    expect(state.unlocked).toBe(i === 4);
    expect(attend(state, start + i * day + 1000)).toEqual(state);
  }
});
it("resets an unfinished streak after a missed day", () => {
  const state = attend(attend(undefined, start), start + day);
  expect(attendanceAt(state, start + 3 * day).streak).toBe(0);
  expect(attend(state, start + 3 * day).streak).toBe(1);
});
it("allows one missed day after unlocking, expires after two, and can be earned again", () => {
  let state: Attendance | undefined;
  for (let i = 0; i < 5; i++) state = attend(state, start + i * day);
  expect(attendanceAt(state, start + 7 * day - 1).unlocked).toBe(true);
  expect(attend(state, start + 6 * day).unlocked).toBe(true);
  state = attendanceAt(state, start + 7 * day);
  expect(state.unlocked).toBe(false);
  for (let i = 7; i < 12; i++) state = attend(state, start + i * day);
  expect(state.unlocked).toBe(true);
});
it("uses UTC boundaries and never moves backwards", () => {
  const before = attend(undefined, start - 1);
  expect(attend(before, start).streak).toBe(2);
  expect(attend(before, start - day)).toEqual(before);
});
