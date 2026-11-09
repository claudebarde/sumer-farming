import { expect, it } from "vitest";
import { kitchenActorDepth } from "../../src/client/game/home/kitchenActorDepth";

it.each(["original", "mirrored"] as const)("sorts both ends of the %s kitchen by its front edge", orientation => {
  const kitchen = { key: "indoor-kitchen", x: 800, y: 500, orientation } as const;
  const sign = orientation === "mirrored" ? -1 : 1;
  for (const localX of [-100, -60, 10, 85]) {
    const x = kitchen.x + sign * localX;
    expect(kitchenActorDepth({ x, y: 500 + localX * .5 + 10 }, kitchen, 1.2, 1.3)).toBeGreaterThan(1.3);
    expect(kitchenActorDepth({ x, y: 500 + localX * .5 - 10 }, kitchen, 1.4, 1.3)).toBeLessThan(1.3);
  }
  expect(kitchenActorDepth({ x: 200, y: 500 }, kitchen, 1.2, 1.3)).toBe(1.2);
});
