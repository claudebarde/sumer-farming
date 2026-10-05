import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProductionStoreButton from "../../src/client/components/ProductionStoreButton";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { TileActionsBusy } from "../../src/client/components/tileActionsBusy";
import type { PorterItem } from "../../src/game-data/porter";

const id = "00000000-0000-4000-8000-000000000001";
const render = (stored: number, warehouse = false, reserved = 0, complete = true, busy = false, item: PorterItem = "bread", flour?: number) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
      household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      production: { pending: {}, baking: {}, delivery: null, porter: reserved ? {
        hiredAt: 0, expiresAt: 100000, checkedAt: 0, position: { column: 0, row: 0 },
        job: { buildingId: id, itemKey: item, quantity: reserved, startedAt: 0, pickupAt: 5000, completesAt: 10000, path: [], pickupIndex: 0 }
      } : null }
    },
    inventory: [{ itemKey: item, quantity: stored }, ...(flour === undefined ? [] : [{ itemKey: "flour", quantity: flour }])], crops: [], improvements: [], objects: [], groundItems: [],
    buildings: warehouse ? [{ id, type: "warehouse", column: 0, row: 0, startedAt: new Date(0).toISOString(), completesAt: new Date(complete ? 1 : 10000).toISOString(), storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }] : []
  });
  return renderToStaticMarkup(createElement(TileActionsBusy.Provider, { value: busy }, createElement(ProductionStoreButton, { snapshot, item, items: flour === undefined ? undefined : ["flour", "brewersGroats"], now: 1000, disabled: false, onClick: () => {} })));
};

describe("finished production storage button", () => {
  it("disables full groats storage, including reserved space, but permits partial collections", () => {
    expect(render(10, false, 0, true, false, "brewersGroats")).toContain('disabled="">No storage space');
    expect(render(18, true, 2, true, false, "brewersGroats")).toContain("No storage space");
    expect(render(19, true, 0, true, false, "brewersGroats")).toBe("<button>Store</button>");
  });
  it("permits mixed bags when either present resource fits", () => {
    expect(render(20, true, 0, true, false, "brewersGroats", 19)).toBe("<button>Store</button>");
    expect(render(19, true, 0, true, false, "brewersGroats", 20)).toBe("<button>Store</button>");
    expect(render(20, true, 0, true, false, "brewersGroats", 20)).toContain("No storage space");
  });
  it("disables collection when farm storage is full", () => {
    expect(render(10)).toBe('<button disabled="">No storage space</button>');
  });
  it("uses all completed warehouse capacity, allowing partial collections", () => {
    expect(render(10, true)).toBe("<button>Store</button>");
    expect(render(19, true)).toBe("<button>Store</button>");
    expect(render(20, true)).toBe('<button disabled="">No storage space</button>');
    expect(render(21, true)).toContain("No storage space");
    expect(render(10, true, 0, false)).toContain("No storage space");
  });
  it("accounts for porter reservations and becomes available when space is freed", () => {
    expect(render(18, true, 2)).toContain("No storage space");
    expect(render(17, true, 2)).toBe("<button>Store</button>");
  });
  it("uses the same rule for beer and preserves hidden busy actions", () => {
    expect(render(20, true, 0, true, false, "beer")).toContain("No storage space");
    expect(render(20, true, 0, true, true)).toBe("");
  });
});
