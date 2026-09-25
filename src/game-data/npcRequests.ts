export const REQUEST_OPEN_MS = 24 * 60 * 60 * 1000;
export const REQUEST_CYCLE_MS = 3 * REQUEST_OPEN_MS;

export type NpcRequestDefinition = {
  readonly customer: string;
  readonly description: string;
  readonly barley: number;
  readonly beer: number;
  readonly reward: number;
};

const household = { customer: "Neighbouring household", description: "Barley for the family table.", barley: 3, beer: 0, reward: 5 };
export const NPC_REQUESTS: Readonly<Record<"starter" | "brewer", readonly NpcRequestDefinition[]>> = {
  starter: [household,
    { customer: "Canal workers", description: "A small grain delivery for the work crew.", barley: 2, beer: 0, reward: 3 },
    { customer: "Local baker", description: "Grain for the next batch of bread.", barley: 4, beer: 0, reward: 6 }],
  brewer: [household,
    { customer: "Tavern keeper", description: "Two jars for the tavern's guests.", barley: 0, beer: 2, reward: 12 },
    { customer: "Feast organiser", description: "Grain and beer for a household celebration.", barley: 4, beer: 2, reward: 18 }]
};
