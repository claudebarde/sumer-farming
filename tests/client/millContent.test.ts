import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MillContent from "../../src/client/components/MillContent";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const now = Date.parse("2026-10-01T12:00:00Z");
const render = (owned: boolean, barley = 6, working = false, level = 7, clock = now) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance: 0 },
    farm: {
      id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
      progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
      household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      carriedItem: null, gathering: null,
      milling: working ? { buildingId: "00000000-0000-4000-8000-000000000003", worker: "donkey", recipe: "flour", barley: 6, output: 3,
        startedAt: new Date(now - 450000).toISOString(), completesAt: new Date(now + 450000).toISOString() } : null
    },
    inventory: [{ itemKey: "barley", quantity: barley }, ...(owned ? [{ itemKey: "donkey", quantity: 1 }] : [])],
    objects: [], groundItems: [], crops: [], improvements: [], buildings: []
  });
  return renderToStaticMarkup(createElement(MillContent, { snapshot, target: { column: 3, row: 3, posX: 192, posY: 192 }, now: clock, addCommand: () => {} }));
};
describe("donkey mill popup", () => {
  it.each([
    [786, "13m 6s remaining."],
    [60, "1m 0s remaining."],
    [9, "0m 9s remaining."],
    [-1, "0m 0s remaining."]
  ] as const)("formats %i remaining seconds as minutes and seconds", (seconds, label) => {
    expect(render(true, 0, true, 7, now + 450000 - seconds * 1000)).toContain(label);
  });
  it.each([5, 6])("shows a concise farmer-only table at level %i", level => {
    const html = render(false, 2, false, level);
    expect(html).toContain('<th scope="row">Farmer</th><td>2</td><td>1</td><td>5 min</td>');
    expect(html.toLowerCase()).not.toContain("donkey");
    expect(html).not.toContain("Choose who produces it");
    expect(html).not.toContain('role="combobox"');
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain("disabled=");
  });
  it("keeps the farmer-only view until a donkey is purchased", () => {
    expect(render(false)).not.toContain("Choose who produces it");
    expect(render(false)).not.toContain('<th scope="row">Donkey</th>');
    expect(render(true)).toContain("Choose who produces it");
  });
  it("groups worker choices into two recipe selects", () => {
    expect(render(false)).not.toContain("Use donkey");
    const html = render(true);
    expect(html).toContain("Produce flour");
    expect(html).toContain("Produce groats");
    expect(html.match(/role="combobox"/g)).toHaveLength(2);
    expect(html).toContain('<th scope="row">Farmer</th><td>2</td><td>1</td><td>5 min</td>');
    expect(html).toContain('<th scope="row">Donkey</th><td>6</td><td>3</td><td>15 min</td>');
    expect(html).toContain("Per batch · flour or groats");
    expect(html).not.toContain("he works here for the whole job");
    expect(html.lastIndexOf("</p>")).toBeLessThan(html.indexOf("<button"));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain("disabled=");
  });
  it("keeps recipe selects enabled when manual milling is available, and disables them without seeds", () => {
    expect(render(true, 5)).not.toContain("disabled=");
    expect(render(false, 2)).not.toContain("disabled=");
    expect(render(true, 0).match(/<button[^>]* disabled=""/g)).toHaveLength(2);
  });
  it("shows the busy donkey, free farmer, and halfway progress without start buttons", () => {
    const html = render(true, 0, true);
    expect(html).toContain("The donkey is producing 3 Flour");
    expect(html).toContain("The farmer is free to work elsewhere.");
    expect(html).toContain('max="100" value="50"');
    expect(html).not.toContain("<button");
  });
});
