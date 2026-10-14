import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
vi.mock("../../src/client/components/Header", () => ({ default: () => null }));
vi.mock("../../src/client/components/Canvas", () => ({ default: () => createElement("div", null, "flat-farm") }));
vi.mock("../../src/client/components/IsometricFarm", () => ({ default: () => createElement("div", null, "isometric-farm") }));
vi.mock("../../src/client/components/IsometricTest", () => ({ default: () => createElement("div", null, "art-sandbox") }));
vi.mock("../../src/client/components/CityOnboarding", () => ({ default: ({ children }: { children: ReactNode }) => createElement("section", null, children) }));
vi.mock("../../src/client/components/TradeNotifications", () => ({ default: () => createElement("aside", null, "notification-host") }));
import App from "../../src/client/App";
afterEach(() => vi.unstubAllGlobals());
it.each(["", "?view=isometric-farm"])("mounts exactly one notification host for live farm %s", search => {
  vi.stubGlobal("window", { location: { search } });
  const html = renderToStaticMarkup(createElement(App));
  expect(html.match(/notification-host/g)).toHaveLength(1);
  expect(html).toContain(search ? "isometric-farm" : "flat-farm");
});
it("does not mount gameplay notifications in the isolated art sandbox", () => {
  vi.stubGlobal("window", { location: { search: "?view=isometric" } });
  expect(renderToStaticMarkup(createElement(App))).not.toContain("notification-host");
});
