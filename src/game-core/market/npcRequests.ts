import { REQUEST_CYCLE_MS, REQUEST_OPEN_MS, type NpcRequestDefinition } from "../../game-data/npcRequests";

export const getRequestWindow = (anchor: number, now: number) => {
  const cycle = Math.max(0, Math.floor((now - anchor) / REQUEST_CYCLE_MS));
  const opensAt = anchor + cycle * REQUEST_CYCLE_MS;
  const closesAt = opensAt + REQUEST_OPEN_MS;
  return { cycle, opensAt, closesAt, nextOpensAt: opensAt + REQUEST_CYCLE_MS,
    open: now >= opensAt && now < closesAt };
};

export const canDeliverRequest = (request: NpcRequestDefinition, stock: { readonly barley: number; readonly beer: number }) =>
  stock.barley >= request.barley && stock.beer >= request.beer;
