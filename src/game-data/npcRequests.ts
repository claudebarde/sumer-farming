export const REQUEST_OPEN_MS = 24 * 60 * 60 * 1000;
export const REQUEST_CYCLE_MS = 3 * REQUEST_OPEN_MS;
export const MERCHANT_TRAVEL_MS = 15_000;

export type NpcRequestDefinition = {
  readonly customer: string;
  readonly description: string;
  readonly barley: number;
  readonly beer: number;
  readonly reward: number;
  readonly flour?: number;
  readonly brewersGroats?: number;
  readonly bread?: number;
  readonly dates?: number;
  readonly sesame?: number;
  readonly oil?: number;
};

const household = { customer: "Neighbouring household", description: "Barley for the family table.", barley: 3, beer: 0, reward: 5 };
// Legacy offers are retained only for visits already open before the new catalogue.
export const NPC_REQUESTS: Readonly<Record<"starter" | "brewer", readonly NpcRequestDefinition[]>> = {
  starter: [household,
    { customer: "Canal workers", description: "A small grain delivery for the work crew.", barley: 2, beer: 0, reward: 3 },
    { customer: "Local baker", description: "Grain for the next batch of bread.", barley: 4, beer: 0, reward: 6 }],
  brewer: [household,
    { customer: "Tavern keeper", description: "Two jars for the tavern's guests.", barley: 0, beer: 2, reward: 12 },
    { customer: "Feast organiser", description: "Grain and beer for a household celebration.", barley: 4, beer: 2, reward: 18 }]
};

export const MERCHANT_PRODUCTS = ["barley", "flour", "brewersGroats", "bread", "beer", "dates", "sesame", "oil"] as const;
export type MerchantProduct = typeof MERCHANT_PRODUCTS[number];
export type MerchantStock = Partial<Readonly<Record<MerchantProduct, number>>>;

export const MERCHANT_OFFERS = [
  { product: "barley", level: 7, quantity: 4, reward: 5, customer: "Neighbouring household", description: "Barley for the family table." },
  { product: "flour", level: 7, quantity: 3, reward: 10, customer: "Local baker", description: "Flour for tomorrow’s bread." },
  { product: "brewersGroats", level: 7, quantity: 3, reward: 10, customer: "Town brewer", description: "Groats for a fresh batch of beer." },
  { product: "bread", level: 7, quantity: 3, reward: 17, customer: "Canal workers", description: "Bread for the work crew." },
  { product: "beer", level: 7, quantity: 2, reward: 18, customer: "Tavern keeper", description: "Two jars for the tavern’s guests." },
  { product: "dates", level: 9, quantity: 4, reward: 9, customer: "Travelling household", description: "Dates for the journey ahead." },
  { product: "sesame", level: 10, quantity: 4, reward: 5, customer: "Oil maker", description: "Sesame for the next pressing." },
  { product: "oil", level: 10, quantity: 2, reward: 18, customer: "Household cook", description: "Oil for the household kitchen." },
] as const;

export const merchantOfferRequest = (offer: typeof MERCHANT_OFFERS[number]): NpcRequestDefinition => ({
  barley: 0, beer: 0, [offer.product]: offer.quantity,
  customer: offer.customer, description: offer.description, reward: offer.reward,
});
