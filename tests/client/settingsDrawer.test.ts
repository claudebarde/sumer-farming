import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Tooltip } from "radix-ui";
import SettingsDrawer from "../../src/client/components/SettingsDrawer";

it("renders an accessible icon-only settings button", () => {
  const html = renderToStaticMarkup(createElement(Tooltip.Provider, null,
    createElement(SettingsDrawer, { onOpen: () => {} })));
  expect(html).toContain('aria-label="Settings"');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain('settings-ruler-stylus.png');
  expect(html).not.toContain('type="range"');
});
