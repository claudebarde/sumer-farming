import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SUMER_CITIES, sumerMapFrame } from "../../src/game-data/sumer";
import { sumerMapStore } from "../../src/client/stores/sumerMapStore";
import SumerMapControls from "../../src/client/components/SumerMapControls";
vi.mock("zustand", () => ({ useStore: (store: { getState: () => unknown }, selector: (state: unknown) => unknown) => selector(store.getState()) }));
afterEach(() => sumerMapStore.setState({ selectedCity: null, residence: null }));
describe("Sumer map", () => {
  it.each([[320, 568], [768, 1024], [1440, 800]])("fits the map into %i by %i with room for navigation", (width, height) => {
    const frame = sumerMapFrame(width, height);
    expect(frame.x).toBeGreaterThanOrEqual(20);
    expect(frame.x + frame.width).toBeLessThanOrEqual(width - 20);
    expect(frame.y + frame.height).toBeLessThan(height - 120);
    for (const city of SUMER_CITIES) {
      expect(city.x).toBeGreaterThan(0); expect(city.x).toBeLessThan(1);
      expect(city.y).toBeGreaterThan(0); expect(city.y).toBeLessThan(1);
    }
    expect(new Set(SUMER_CITIES.map(c => c.id)).size).toBe(SUMER_CITIES.length);
  });
  it("requires choosing a city without offering a way to skip onboarding", () => {
    sumerMapStore.getState().selectCity("ur");
    const html = renderToStaticMarkup(createElement(SumerMapControls, { onBack: () => {} }));
    expect(html).not.toContain("Back to your farm");
    expect(html).toContain("Exploring Ur.");
    expect(html).toContain("automatically join a public neighbourhood");
    expect(html).toContain("up to 10 players");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Create a neighbourhood");
    expect(html).not.toContain("Join friends");
    expect(html).toContain("Start your farm in Ur");
    expect(html).toContain('aria-pressed="true">Ur</button>');
    for (const city of SUMER_CITIES) expect(html).toContain(`>${city.name}</button>`);
  });
  it("shows the actual home even while browsing a different city", () => {
    sumerMapStore.setState({ selectedCity: "ur", residence: { city: "lagash", neighbourhoodId: "00000000-0000-4000-8000-000000000001", name: "Lagash neighbours", members: 1, private: false, inviteCode: null } });
    const html = renderToStaticMarkup(createElement(SumerMapControls, { onBack: () => {} }));
    expect(html).toContain("Back to your farm");
    expect(html).toContain("Your estate: Lagash");
    expect(html).toContain("Exploring Ur.");
    expect(html).not.toContain("Start your farm");
  });
});
