import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
vi.mock("../../src/client/components/DevelopmentPlayerSelector", () => ({ default: () => null }));
import Header from "../../src/client/components/Header";

afterEach(() => vi.unstubAllGlobals());
it.each(["", "?view=isometric", "?view=isometric-farm", "?view=flat"])("has no view selector for %s", search => {
  vi.stubGlobal("window", { location: { search } });
  const html = renderToStaticMarkup(createElement(Header));
  expect(html).toContain("A Home Between Rivers");
  expect(html).not.toContain("<select");
  expect(html).not.toContain("Flat farm");
  expect(html).not.toContain("Isometric test");
});
it.each(["IsometricFarm", "IsometricTilePopup", "IsometricTravelPopup"])("removes fallback links and text from %s", name => {
  const source = readFileSync(new URL(`../../src/client/components/${name}.tsx`, import.meta.url), "utf8");
  expect(source).not.toMatch(/flat farm|flat map|flatUrl|view=flat/i);
});
