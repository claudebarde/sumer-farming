import { MERCHANT_PRODUCTS, MERCHANT_OFFERS, merchantOfferRequest, REQUEST_CYCLE_MS, REQUEST_OPEN_MS, type MerchantStock, type NpcRequestDefinition } from "../../game-data/npcRequests";

export const getRequestWindow = (anchor: number, now: number) => {
  const cycle = Math.max(0, Math.floor((now - anchor) / REQUEST_CYCLE_MS));
  const opensAt = anchor + cycle * REQUEST_CYCLE_MS;
  const closesAt = opensAt + REQUEST_OPEN_MS;
  return { cycle, opensAt, closesAt, nextOpensAt: opensAt + REQUEST_CYCLE_MS,
    open: now >= opensAt && now < closesAt };
};

export const canDeliverRequest = (request: NpcRequestDefinition, stock: MerchantStock) =>
  MERCHANT_PRODUCTS.every(product => (stock[product] ?? 0) >= (request[product] ?? 0));

// Stable per farm and visit, with previously requested products sorted last.
const offerRank = (seed: string) => {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
};
export const selectMerchantRequests = (farmId: string, cycle: number, level: number,
  previous: readonly NpcRequestDefinition[] = []): readonly NpcRequestDefinition[] => {
  const used = new Set(MERCHANT_PRODUCTS.filter(product => previous.some(request => (request[product] ?? 0) > 0)));
  return MERCHANT_OFFERS.filter(offer => level >= offer.level)
    .toSorted((a, b) => Number(used.has(a.product)) - Number(used.has(b.product))
      || offerRank(`${farmId}:${cycle}:${a.product}`) - offerRank(`${farmId}:${cycle}:${b.product}`)
      || a.product.localeCompare(b.product))
    .slice(0, 3).map(merchantOfferRequest);
};
