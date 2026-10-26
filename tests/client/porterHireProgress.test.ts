import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import PorterHireProgress from "../../src/client/components/PorterHireProgress";
import { PORTER_HIRE_MS } from "../../src/game-data/porter";

const porter = { hiredAt: 1000, expiresAt: 1000 + PORTER_HIRE_MS, checkedAt: 1000, position: { column: 1, row: 1 }, job: null };
const render = (now: number) => renderToStaticMarkup(createElement(PorterHireProgress, { porter, now }));
it("shows the saved 24-hour hire, elapsed progress and remaining time", () => {
  expect(render(1000)).toContain("24h 0m 0s remaining");
  expect(render(1000)).toContain('value="0"');
  expect(render(1000 + PORTER_HIRE_MS / 2)).toContain("12h 0m 0s remaining");
  expect(render(1000 + PORTER_HIRE_MS / 2)).toContain('value="50"');
});
it("clamps elapsed hire time after returning offline", () => {
  expect(render(porter.expiresAt + 5000)).toContain("0s remaining");
  expect(render(porter.expiresAt + 5000)).toContain('value="100"');
});
