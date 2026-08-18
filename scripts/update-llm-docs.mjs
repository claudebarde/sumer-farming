import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const docs = [
  {
    name: "Cloudflare Workers",
    url: "https://developers.cloudflare.com/workers/llms.txt",
    output: "docs/llm/cloudflare-workers.txt"
  },
  {
    name: "Cloudflare Hyperdrive",
    url: "https://developers.cloudflare.com/hyperdrive/llms.txt",
    output: "docs/llm/cloudflare-hyperdrive.txt"
  },
  {
    name: "Hono",
    url: "https://hono.dev/llms.txt",
    output: "docs/llm/hono.txt"
  }
];

async function downloadDoc({ name, url, output }) {
  const outputPath = resolve(output);

  console.log(`Downloading ${name}...`);

  const response = await fetch(url, {
    headers: {
      "user-agent": "sumer-game-docs-updater/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download ${name}: ${response.status} ${response.statusText}`
    );
  }

  const content = await response.text();

  await mkdir(dirname(outputPath), {
    recursive: true
  });

  await writeFile(outputPath, content, "utf8");

  console.log(`✓ ${name} → ${output}`);
}

async function main() {
  const results = await Promise.allSettled(docs.map(doc => downloadDoc(doc)));

  const failures = results.filter(result => result.status === "rejected");

  if (failures.length > 0) {
    console.error("\nSome documentation downloads failed:");

    for (const failure of failures) {
      console.error(`- ${failure.reason?.message ?? failure.reason}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("\nAll LLM documentation updated successfully.");
}

await main();
