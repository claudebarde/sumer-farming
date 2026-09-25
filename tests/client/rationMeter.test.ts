import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RationMeter from "../../src/client/components/RationMeter";

describe("ration meter", () => {
  const now = Date.parse("2026-09-25T00:00:00Z");
  const render = (hours: number | null, hungry = false) => renderToStaticMarkup(createElement(RationMeter, {
    now, hungry, nextRationAt: hours === null ? null : new Date(now + hours * 3600000).toISOString()
  }));
  it("uses a 24-hour scale and compact stacked time", () => {
    expect(render(12)).toContain('aria-valuenow="50"');
    expect(render(12)).toContain("<span>12h</span><span>0m</span>");
    expect(render(24)).toContain('stroke-dashoffset="0"');
  });
  it("shows due for overdue or hungry farmers", () => {
    expect(render(-1)).toContain(">Due</span>");
    expect(render(24, true)).toContain('aria-valuenow="0"');
  });
  it("does not invent a countdown before cultivation starts", () => {
    expect(render(null)).toContain(">—</span>");
    expect(render(null)).toContain("Automatic feeding begins after cultivation starts");
  });
});
