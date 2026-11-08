import { afterEach, expect, it, vi } from 'vitest';
import { merchantUiStore } from '../../src/client/stores/merchantUiStore';
import type { NpcRequests } from '../../src/schemas/npcRequests';

const board: NpcRequests = { serverNow: new Date(1000).toISOString(), cycle: 0, open: true,
  closesAt: new Date(100000).toISOString(), nextOpensAt: new Date(300000).toISOString(),
  stock: { barley: 0, beer: 0 }, requests: [], visitCompleted: false };
afterEach(() => { merchantUiStore.getState().reset(); vi.useRealTimers(); });
it('starts departure on closing the completed visit and never restarts it on polling', () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const store = merchantUiStore.getState();
  store.setBoard(board); store.setOpen(true);
  store.setBoard({ ...board, visitCompleted: true });
  expect(merchantUiStore.getState().departureAt).toBeNull();
  store.setOpen(false);
  expect(merchantUiStore.getState().departureAt).toBe(1000);
  vi.setSystemTime(2000);
  store.setBoard({ ...board, serverNow: new Date(2000).toISOString(), visitCompleted: true });
  store.setOpen(false);
  expect(merchantUiStore.getState().departureAt).toBe(1000);
  store.reset(); store.setBoard({ ...board, visitCompleted: true });
  expect(merchantUiStore.getState().departureAt).toBeNull();
  store.setBoard({ ...board, cycle: 1 });
  expect(merchantUiStore.getState().board?.visitCompleted).toBe(false);
});
