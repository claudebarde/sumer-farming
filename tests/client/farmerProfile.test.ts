import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FARMER_NAMES } from "../../src/game-data/farmerNames";
import { FarmerProfileSchema, NameFarmerCommandSchema } from "../../src/schemas/farmerProfile";
import FarmerCustomization from "../../src/client/components/FarmerCustomization";

describe("farmer customization", () => {
  it.each(FARMER_NAMES)("accepts the provided name %s", name => {
    expect(NameFarmerCommandSchema.parse({ type: "name_farmer", name }).name).toBe(name);
    expect(FarmerProfileSchema.parse({ version: 1, identity: { name } }).identity.name).toBe(name);
  });
  it.each(["", "Unknown", " meskalamdug ", null])("rejects unsupported names: %s", name => {
    expect(NameFarmerCommandSchema.safeParse({ type: "name_farmer", name }).success).toBe(false);
  });
  it("offers both name groups and requires an explicit selection", () => {
    const html = renderToStaticMarkup(createElement(FarmerCustomization, { onSaved: () => {} }));
    expect(html).toContain('optgroup label="Male names"');
    expect(html).toContain('optgroup label="Female names"');
    for (const name of FARMER_NAMES) expect(html).toContain(`>${name}</option>`);
    expect(html).toContain('disabled="">Continue</button>');
  });
});
