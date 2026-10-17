import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GranaryStorageCard from "../../src/client/components/GranaryStorageCard";

describe("granary storage card", () => {
  it.each([[0, 6, 15], [3, 6, 15], [20, 7, 20], [22, 7, 20]])("shows %i stored barley at farm level %i", (quantity, farmLevel, capacity) => {
    const html = renderToStaticMarkup(createElement(GranaryStorageCard, { quantity, farmLevel }));
    expect(html).toContain(`${quantity}/${capacity}`);
    expect(html).toContain('width="64" height="64"');
    expect(html).toContain(`value="${Math.min(quantity, capacity)}" max="${capacity}"`);
    expect(html).toContain(`aria-valuetext="${quantity} of ${capacity}"`);
    expect(html).toContain('aria-label="Granary inventory"');
  });
});
