import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, "../vendor/firebase.entry.js")],
  outfile: resolve(__dirname, "../vendor/firebase.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  logLevel: "info"
});

