import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import BarleyWorkProgress from "../../src/client/components/BarleyWorkProgress";

it.each(["Sowing", "Harvesting"] as const)("shows the shared %s work meter", action => {
  const html = renderToStaticMarkup(createElement(BarleyWorkProgress, {
    action, total: 4, progress: { completed: 1, totalMs: 40000, percentage: 37 }
  }));
  expect(html).toContain(`${action} barley...`);
  expect(html).toContain("wheat-sheaf.png");
  expect(html).toContain('width="48" height="48"');
  expect(html.indexOf('<img ')).toBeLessThan(html.indexOf('<section>'));
  expect(html).toContain("1/4 fields");
  expect(html).toContain('role="progressbar"');
  expect(html).toContain('aria-valuenow="37"');
  expect(html).toContain('viewBox="0 0 100 100"');
  expect(html).toContain('stroke-dashoffset="63"');
  expect(html).toContain('>37%</span>');
  expect(html).toContain("40s");
});
it("retains the completed count and meter when storing barley", () => {
  const html = renderToStaticMarkup(createElement(BarleyWorkProgress, {
    action: "Harvesting", total: 4, delivering: true, progress: { completed: 4, totalMs: 40000, percentage: 100 }
  }));
  expect(html).toContain("Storing barley...");
  expect(html).toContain("4/4 fields");
  expect(html).toContain('aria-valuenow="100"');
});
