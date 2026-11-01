import { expect, it } from "vitest";
import { canDeliverRequest, selectMerchantRequests } from "../../src/game-core/market/npcRequests";
import { MERCHANT_OFFERS, merchantOfferRequest } from "../../src/game-data/npcRequests";

it("offers three distinct eligible products, stable within a visit", () => {
  for (const level of [7, 8, 9, 10]) {
    const seen = new Set<string>();
    for (let cycle = 0; cycle < 30; cycle++) {
      const offers = selectMerchantRequests("farm", cycle, level);
      expect(offers).toEqual(selectMerchantRequests("farm", cycle, level));
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map(offer => offer.customer)).size).toBe(3);
      for (const offer of offers) {
        seen.add(offer.customer);
        expect(MERCHANT_OFFERS.find(entry => entry.customer === offer.customer)!.level).toBeLessThanOrEqual(level);
      }
    }
    expect(seen.size).toBe(MERCHANT_OFFERS.filter(offer => offer.level <= level).length);
  }
});
it("prefers different products on the next visit", () => {
  const previous = selectMerchantRequests("farm", 0, 10);
  const next = selectMerchantRequests("farm", 1, 10, previous);
  expect(next.every(offer => !previous.some(old => old.customer === offer.customer))).toBe(true);
});
it.each(MERCHANT_OFFERS)("checks all $product stock before enabling delivery", offer => {
  const request = merchantOfferRequest(offer);
  expect(canDeliverRequest(request, { [offer.product]: offer.quantity - 1 })).toBe(false);
  expect(canDeliverRequest(request, { [offer.product]: offer.quantity })).toBe(true);
});
