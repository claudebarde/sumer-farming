import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import ShekelBalance from "../../src/client/components/ShekelBalance";

it.each([0, 77, 123456])("shows only the icon and raw balance %i with an accessible label", amount => {
  const html = renderToStaticMarkup(createElement(ShekelBalance, { amount }));
  expect(html).toContain("/shekels.png");
  expect(html).toContain(`aria-label="${amount} shekels"`);
  expect(html).toContain(`<span>${amount}</span>`);
  expect(html).not.toContain("<button");
});
