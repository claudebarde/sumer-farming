import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import HappinessMeter from "../../src/client/components/HappinessMeter";

describe("circular happiness meter", () => {
  it.each([
    [0, "unhappy"], [39, "unhappy"], [40, "content"],
    [69, "content"], [70, "happy"], [95, "happy"], [100, "happy"]
  ] as const)("renders %i percent with the correct mood", (value, mood) => {
    const html = renderToStaticMarkup(createElement(HappinessMeter, { value }));
    expect(html).toContain('role="meter"');
    expect(html).toContain(`aria-valuenow="${value}"`);
    expect(html).toContain(`data-mood="${mood}"`);
    expect(html).toContain(`stroke-dashoffset="${100 - value}"`);
    expect(html).toContain(`>${value}%</span>`);
  });
});
