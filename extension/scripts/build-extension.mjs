import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionRoot = path.resolve(__dirname, "..");
const distDir = path.join(extensionRoot, "dist");

function runWebpack(config) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      compiler.close(() => {});
      if (err) return reject(err);
      const info = stats?.toJson({ all: false, warnings: true, errors: true });
      if (stats?.hasErrors()) return reject(new Error((info?.errors || []).map((e) => e.message).join("\n")));
      if (stats?.hasWarnings()) {
        // eslint-disable-next-line no-console
        console.warn((info?.warnings || []).map((w) => w.message).join("\n"));
      }
      resolve();
    });
  });
}

async function copyStatic() {
  await fs.mkdir(distDir, { recursive: true });

  await fs.copyFile(path.join(extensionRoot, "manifest.json"), path.join(distDir, "manifest.json"));
  await fs.mkdir(path.join(distDir, "popup"), { recursive: true });
  await fs.copyFile(path.join(extensionRoot, "popup", "popup.html"), path.join(distDir, "popup", "popup.html"));
  await fs.copyFile(path.join(extensionRoot, "popup", "popup.css"), path.join(distDir, "popup", "popup.css"));

  await fs.rm(path.join(distDir, "assets"), { recursive: true, force: true });
  await fs.cp(path.join(extensionRoot, "assets"), path.join(distDir, "assets"), { recursive: true });
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await copyStatic();

  // webpack.config.js is CommonJS, so import via createRequire
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const config = require(path.join(extensionRoot, "webpack.config.js"));
  await runWebpack(config);

  // eslint-disable-next-line no-console
  console.log(`Built extension to ${distDir}`);
}

await main();

