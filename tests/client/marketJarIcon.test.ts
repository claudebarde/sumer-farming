import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, it } from "vitest";
import MarketJarIcon from "../../src/client/components/MarketJarIcon";
import { MARKET_ITEM_DEFINITIONS } from "../../src/game-data/marketItems";
import { beerMarketBuyOrder } from "../../src/client/stores/marketUiStore";
import { readFileSync } from "node:fs";

it("distinguishes brewing equipment from beer packaging with names and artwork", () => {
  expect(MARKET_ITEM_DEFINITIONS.brewingVessels.label).toBe("Brewing jars");
  expect(MARKET_ITEM_DEFINITIONS.emptyBeerJar.label).toBe("Empty beer jars");
  expect(MARKET_ITEM_DEFINITIONS.beer.label).toBe("Beer");
  const brewing = renderToStaticMarkup(createElement(MarketJarIcon, { itemKey: "brewingVessels" }));
  expect(brewing).toContain("brewery-left-bottom-jar.png");
  expect(brewing).not.toContain("viewBox");
  expect(brewing).not.toContain('width="1024"');
  expect(brewing).toContain('width="48" height="48"');
  expect(brewing).toContain("object-fit:contain");
  const packaging = renderToStaticMarkup(createElement(MarketJarIcon, { itemKey: "emptyBeerJar" }));
  expect(packaging).toContain("/beer-jars-empty-isometric.webp");
  expect(packaging).not.toContain("brewery-left-bottom-jar");
  const beer = renderToStaticMarkup(createElement(MarketJarIcon, { itemKey: "beer" }));
  expect(beer).toContain("/beer-jars-full-isometric.webp");
});

it("orders brewing jars before empty jars and beer without removing groats", () => {
  expect(["beer", "brewersGroats", "emptyBeerJar", "brewingVessels"]
    .sort((a, b) => beerMarketBuyOrder(a) - beerMarketBuyOrder(b)))
    .toEqual(["brewingVessels", "emptyBeerJar", "beer", "brewersGroats"]);
  expect(["brewingVessels", "emptyBeerJar", "beer"].map(key =>
    MARKET_ITEM_DEFINITIONS[key as keyof typeof MARKET_ITEM_DEFINITIONS].npcMarket.buyPrice))
    .toEqual([6, 2, 8]);
});

it("does not hide brewing equipment when a brewery already exists", () => {
  const source = readFileSync(new URL("../../src/client/components/MarketDialog.tsx", import.meta.url), "utf8");
  expect(source).not.toContain('buildings.some(b => b.type === "brewery") ? 0');
  expect(source).not.toContain("missingBrewingJars > 0");
  expect(source).toContain('missingBrewingJars === 0');
});
