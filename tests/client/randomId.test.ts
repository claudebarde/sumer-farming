import { afterEach, expect, it, vi } from "vitest";
import { randomId } from "../../src/client/randomId";
import { MarketPresenceCommandSchema } from "../../src/schemas/marketPresence";

afterEach(() => vi.unstubAllGlobals());
it("uses the native UUID generator when available", () => {
  const uuid = "00000000-0000-4000-8000-000000000001";
  vi.stubGlobal("crypto", { randomUUID: () => uuid });
  expect(randomId()).toBe(uuid);
});
it("creates valid distinct visit IDs on HTTP LAN origins without randomUUID", () => {
  const native = crypto;
  vi.stubGlobal("crypto", { getRandomValues: native.getRandomValues.bind(native) });
  const ids = Array.from({ length: 100 }, randomId);
  expect(new Set(ids).size).toBe(100);
  for (const sessionId of ids) {
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(MarketPresenceCommandSchema.safeParse({ type: "leave", sessionId }).success).toBe(true);
  }
});
