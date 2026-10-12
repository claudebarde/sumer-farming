import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import IsometricFarm from "../../src/client/components/IsometricFarm";

it("keeps view controls without top-level planting and harvesting shortcuts", () => {
  const html = renderToStaticMarkup(createElement(IsometricFarm));
  expect(html).toContain('aria-label="Zoom in"');
  expect(html).toContain('aria-label="Zoom out"');
  expect(html).toContain(">Fit</button>");
  expect(html).toContain(">Manage</button>");
  expect(html).toContain(">Farm level 1</button>");
  expect(html).not.toContain("Isometric preview");
  expect(html).not.toContain("Test granary placement");
  expect(html).not.toContain("Cancel granary preview");
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).not.toContain(">Refresh</button>");
  expect(html).not.toContain(">Loading…</button>");
  expect(html).not.toContain(">Plant barley</button>");
  expect(html).not.toContain(">Harvest barley</button>");
});
