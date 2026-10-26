import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MapCuneiformLabel from "../../src/client/components/MapCuneiformLabel";

it.each([
  ["Road", "𒆜"], ["Ground", "𒅖"], ["Arable ground", "𒄒"],
  ["Barley", "𒊺"], ["Farm", "𒂍"], ["Granary", "𒉌𒁾"],
  ["Warehouse", "𒂍𒍑𒁍𒁕"], ["Mill", "𒂍𒄯"], ["Brewery", "𒂍𒋆"],
  ["Bread oven", "𒌅𒊒𒈾"], ["River", "𒀀𒇉"], ["Irrigation canal", "𒉽𒂊"],
  ["Farmer", "𒀳"], ["Barley market", "𒆠𒇴𒊺𒀀"],
  ["Beer market", "𒆠𒇴𒁉𒀀"], ["Baking market", "𒆠𒇴𒃻𒀀"],
  ["Market", "𒆠𒇴"], ["Reeds", "𒄀"], ["Rocks", "𒎎"], ["Bush", "𒄉"],
  ["Date palm", "𒊷"], ["Merchant boat", "𒈣 𒁮𒃼𒀀"],
])("renders the configured cuneiform for %s", (element, glyphs) => {
  expect(renderToStaticMarkup(createElement(MapCuneiformLabel, { element })))
    .toBe(`<span class="cuneiforms" aria-hidden="true">${glyphs}</span>`);
});

it.each(["Small shrine", "Unknown title"])("does not invent a translation for %s", element => {
  expect(renderToStaticMarkup(createElement(MapCuneiformLabel, { element }))).toBe("");
});
