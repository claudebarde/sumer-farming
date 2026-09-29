import { afterEach, describe, expect, it } from "vitest";
import { fetchStore } from "../../src/client/stores/fetchStore";

afterEach(() => fetchStore.getState().set("idle"));

describe("dog popup anchor", () => {
  it("opens at the dog's current canvas position and clears stale messages", () => {
    fetchStore.getState().set("result", "Previous round");
    fetchStore.getState().openMenu({ x: 32, y: 320 });
    expect(fetchStore.getState()).toMatchObject({ phase: "menu", message: "", menuPosition: { x: 32, y: 320 } });
  });
  it.each(["idle", "starting"] as const)("clears the popup anchor when switching to %s", phase => {
    fetchStore.getState().openMenu({ x: 32, y: 320 });
    fetchStore.getState().set(phase);
    expect(fetchStore.getState()).toMatchObject({ phase, menuPosition: null });
  });
});
