import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
vi.mock("../../src/client/components/DevelopmentPlayerSelector", () => ({ default: () => null }));
import Header from "../../src/client/components/Header";

afterEach(() => vi.unstubAllGlobals());
it.each(["isometric-farm", "isometric"])("does not offer flat-map switching in %s", view => {
  vi.stubGlobal("window", { location: { search: `?view=${view}` } });
  const html = renderToStaticMarkup(createElement(Header));
  expect(html).not.toContain("Flat farm");
  expect(html).not.toContain('value="flat"');
  expect(html).toContain('value="isometric-farm"');
  expect(html).toContain('value="isometric"');
});
it("preserves the existing legacy view until its retirement task", () => {
  vi.stubGlobal("window", { location: { search: "" } });
  expect(renderToStaticMarkup(createElement(Header))).toContain('value="flat"');
});
it.each(["IsometricFarm", "IsometricTilePopup", "IsometricTravelPopup"])("removes fallback links and text from %s", name => {
  const source = readFileSync(new URL(`../../src/client/components/${name}.tsx`, import.meta.url), "utf8");
  expect(source).not.toMatch(/flat farm|flat map|flatUrl|view=flat/i);
});
