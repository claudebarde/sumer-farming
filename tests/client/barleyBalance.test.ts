import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import BarleyBalance from "../../src/client/components/BarleyBalance";

it.each([0, 20, 123])("renders barley balance %i with the shared balance style", amount => {
  const html = renderToStaticMarkup(createElement(BarleyBalance, { amount }));
  expect(html).toContain("wheat-sheaf.png");
  expect(html).toContain(`aria-label="${amount} barley stored in the estate"`);
  expect(html).toContain(`<span>${amount}</span>`);
  expect(html).toContain('width="36" height="36"');
  expect(html).toContain("barleyBalanceIcon");
});
