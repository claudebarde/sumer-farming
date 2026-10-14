import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MapCuneiformLabel from "../../src/client/components/MapCuneiformLabel";

it.each([
  ["Road", "𒆜"], ["Ground", "𒅖"], ["Arable ground", "𒄒"],
  ["Barley", "𒊺"], ["Farm", "𒂍"], ["Granary", "𒉌𒁾"],
  ["Warehouse", "𒉌𒁾"], ["Mill", "𒂍𒄯"], ["Brewery", "𒂍𒋆"],
  ["Bread oven", "𒌅𒊒𒈾"], ["River", "𒀀𒇉"], ["Irrigation canal", "𒀀"],
  ["Farmer", "𒀳"], ["Barley market", "𒆠𒇴𒊺𒀀"],
  ["Beer market", "𒆠𒇴𒁉𒀀"], ["Baking market", "𒆠𒇴𒃻𒀀"],
])("preserves the flat-map cuneiform for %s", (element, glyphs) => {
  expect(renderToStaticMarkup(createElement(MapCuneiformLabel, { element })))
    .toBe(`<span class="cuneiforms" aria-hidden="true">${glyphs}</span>`);
});

it.each(["Reeds", "Rocks", "Bush", "Small shrine", "Date palm", "Market"])("does not invent a translation for %s", element => {
  expect(renderToStaticMarkup(createElement(MapCuneiformLabel, { element }))).toBe("");
});
