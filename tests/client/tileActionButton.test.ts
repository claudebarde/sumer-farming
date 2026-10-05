import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TileActionButton from "../../src/client/components/TileActionButton";
import { TileActionsBusy } from "../../src/client/components/tileActionsBusy";

describe("tile popup actions during farmer work", () => {
  it("keeps tile details and removes all actions, including already disabled ones", () => {
    const html = renderToStaticMarkup(createElement(TileActionsBusy.Provider, { value: true },
      createElement("section", null, createElement("h2", null, "Arable ground"), createElement("p", null, "Fertile soil suitable for farming."),
        createElement(TileActionButton, null, "Plant Barley"), createElement(TileActionButton, { disabled: true }, "No seeds"))));
    expect(html).toContain("Arable ground");
    expect(html).toContain("Fertile soil suitable for farming.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("The farmer is busy");
    expect(html).not.toContain("Plant Barley");
    expect(html).not.toContain("No seeds");
  });
  it("preserves normal labels and resource restrictions when idle", () => {
    expect(renderToStaticMarkup(createElement(TileActionButton, null, "Plant Barley"))).toBe("<button>Plant Barley</button>");
    expect(renderToStaticMarkup(createElement(TileActionButton, { disabled: true }, "No seeds"))).toBe('<button disabled="">No seeds</button>');
  });
  it("does not disable the popup close button", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(TileActionsBusy.Provider, { value: true }, createElement(TileActionButton, null, "Collect")),
      createElement("button", { "aria-label": "Close" }, "Close")));
    expect(html).toContain('<button aria-label="Close">Close</button>');
  });
});
