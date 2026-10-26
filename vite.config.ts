import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Phaser ships as one prebuilt module. Keep its budget separate so it cannot
// conceal growth in application code or other dependencies.
const clientSizeBudget = (): Plugin => ({
  name: "client-size-budget",
  apply: "build",
  generateBundle(_options, bundle) {
    if (this.environment.name !== "client") return;
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== "chunk") continue;
      const limit = chunk.name === "phaser" ? 1_450_000 : 500_000;
      const size = Buffer.byteLength(chunk.code, "utf8");
      if (size > limit) {
        this.error(`${chunk.fileName} is ${(size / 1000).toFixed(1)} kB; its budget is ${limit / 1000} kB.`);
      }
    }
  }
});

export default defineConfig({
  plugins: [react(), cloudflare(), clientSizeBudget()],
  environments: {
    client: {
      build: {
        // The plugin above enforces the stricter 500 kB budget for other chunks.
        chunkSizeWarningLimit: 1450,
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                { name: "phaser", test: /node_modules[/\\]phaser[/\\]/, priority: 30 },
                { name: "ui-vendor", test: /node_modules[/\\](?:react|react-dom|scheduler|@radix-ui)[/\\]/, priority: 20 },
                { name: "vendor", test: /node_modules/, priority: 10 }
              ]
            }
          }
        }
      }
    }
  }
});
