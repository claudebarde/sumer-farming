import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import LeaderboardTable from "../../src/client/components/LeaderboardTable";
import { LeaderboardContent } from "../../src/client/components/LeaderboardDialog";
import { LeaderboardQuerySchema, type LeaderboardResponse } from "../../src/schemas/leaderboard";
import { requestLeaderboard } from "../../src/client/api/leaderboard";

const row = { playerId: "00000000-0000-4000-8000-000000000001", name: "Meskalamdug", city: "lagash", neighbourhood: "Reed quarter", rank: 1, score: 9, isYou: true };
const board: LeaderboardResponse = { scope: "local", metric: "level", entries: [row], self: row, total: 1, updatedAt: new Date().toISOString() };
afterEach(() => vi.unstubAllGlobals());
describe("leaderboard presentation", () => {
  it("offers only local rankings in the neighbourhood while retaining all three metrics", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardContent, { localOnly: true }));
    expect(html).not.toContain("All Sumer");
    expect(html).not.toContain("Your current estate level.");
    expect(html).not.toContain("Latest saved progress.");
    expect(html).not.toContain('role="tab"');
    for (const value of ["level", "shekels", "harvestedBarley"]) expect(html).toContain(`value="${value}"`);
    expect(html).toContain('value="level" selected');
  });
  it("shows farm level alongside the selected score in the compact table", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      compact: true, board: { ...board, metric: "shekels", entries: [{ ...row, level: 7, score: 123 }] },
    }));
    for (const text of ["Lvl 7", "123", "Meskalamdug", "(You)"]) expect(html).toContain(text);
    expect(html).not.toContain("Reed quarter");
    expect(html).not.toContain("Sample farm");
    expect(html).toContain("farmer-idle-approved-design.webp");
    expect(html).toContain("head-and-shoulders portrait");
    expect(html).not.toContain("farmer-stand-staff-1.png");
  });
  it("uses market-style scope tabs and keeps only the ranking select", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardContent));
    expect(html).toContain('aria-label="Leaderboard scope"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-selected="true"[^>]*>Your neighbourhood/);
    expect(html).toMatch(/aria-selected="false"[^>]*>All Sumer/);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toContain("Rank by");
    expect(html).toContain("Refresh");
    expect(html).toContain('role="tabpanel"');
  });
  it("shows rank, portrait, identity, location, score and self marker", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, { board }));
    for (const text of ["Meskalamdug", "(You)", "Lagash", "Reed quarter", "Estate level", "<img", "Top 1 of 1"]) expect(html).toContain(text);
    expect(html).not.toContain("Your rank:");
    expect(html).toContain("farmer-idle-approved-design.webp");
  });
  it("shows own rank outside top ten", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, { board: { ...board, entries: [{ ...row, isYou: false, playerId: "00000000-0000-4000-8000-000000000002" }], total: 20, self: { ...row, rank: 15 } } }));
    expect(html).toContain("Your rank: 15 of 20");
  });
  it("handles empty rankings and invalid options", () => {
    expect(renderToStaticMarkup(createElement(LeaderboardTable, { board: { ...board, entries: [], self: null, total: 0 } }))).toContain("No farmers are ranked yet");
    expect(LeaderboardQuerySchema.parse({})).toEqual({ scope: "local", metric: "level" });
    expect(LeaderboardQuerySchema.safeParse({ metric: "password" }).success).toBe(false);
    expect(LeaderboardQuerySchema.safeParse({ scope: "another-neighbourhood" }).success).toBe(false);
  });
  it("requests validated data and surfaces failures", async () => {
    vi.stubGlobal("window", { location: { search: "?devPlayer=primary" } });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => board });
    vi.stubGlobal("fetch", fetcher);
    expect(await requestLeaderboard({ scope: "local", metric: "level" })).toEqual(board);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/leaderboard?scope=local&metric=level");
    fetcher.mockResolvedValue({ ok: false });
    await expect(requestLeaderboard({ scope: "global", metric: "shekels" })).rejects.toThrow("could not be loaded");
  });
});
