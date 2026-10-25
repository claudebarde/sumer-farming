import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the porter service after building cards and outside the Farmer tab", () => {
  const source = readFileSync(new URL("../../src/client/components/EstateManagementContent.tsx", import.meta.url), "utf8");
  const build = source.match(/<Tabs.Content[^>]*value="build"[^>]*>([\s\S]*?)<\/Tabs.Content>/)?.[1] ?? "";
  const farmer = source.match(/<Tabs.Content[^>]*value="farmer"[^>]*>([\s\S]*?)<\/Tabs.Content>/)?.[1] ?? "";
  expect(build).toContain("<PorterPanel");
  expect(build.indexOf("{buildContent}")).toBeLessThan(build.indexOf("<PorterPanel"));
  expect(farmer).toContain("<FarmerPanel");
  expect(farmer).not.toContain("<PorterPanel");
});
