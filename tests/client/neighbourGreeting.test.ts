import { describe, expect, it } from "vitest";
import { advanceNeighbourGreeting, initialNeighbourGreeting } from "../../src/client/game/phaser/neighbourGreeting";

describe("neighbour greetings", () => {
  it("greets on approach and expires without repeating while neighbours stay together", () => {
    const initial = initialNeighbourGreeting();
    expect(advanceNeighbourGreeting(initial, 3, 100).startedAt).toBeNull();
    const greeting = advanceNeighbourGreeting(initial, 1.5, 100);
    expect(greeting.startedAt).toBe(100);
    const expired = advanceNeighbourGreeting(greeting, 1, 4100);
    expect(expired.startedAt).toBeNull();
    expect(advanceNeighbourGreeting(expired, 1, 20000).startedAt).toBeNull();
  });
  it("requires separation and cooldown before another greeting", () => {
    const greeting = advanceNeighbourGreeting(initialNeighbourGreeting(), 1, 100);
    expect(advanceNeighbourGreeting(greeting, 1.7, 200).greeted).toBe(true);
    const separated = advanceNeighbourGreeting(greeting, 2.1, 300);
    expect(separated.startedAt).toBeNull();
    expect(advanceNeighbourGreeting(separated, 1, 400).startedAt).toBeNull();
    expect(advanceNeighbourGreeting(separated, 1, 8100).startedAt).toBe(8100);
  });
  it("expires a greeting across elapsed time without replaying it", () => {
    const greeting = advanceNeighbourGreeting(initialNeighbourGreeting(), 1, 100);
    expect(advanceNeighbourGreeting(greeting, 1, 100000).startedAt).toBeNull();
  });
});
