/* eslint-env node */

const path = require("path");

const extensionRoot = __dirname;
const distDir = path.join(extensionRoot, "dist");

/** @type {import('webpack').Configuration} */
const base = {
  mode: "production",
  devtool: false,
  resolve: {
    extensions: [".js"]
  },
  output: {
    path: distDir,
    filename: "[name].js",
    iife: true
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false
  },
  performance: { hints: false }
};

/** @type {import('webpack').Configuration} */
const background = {
  ...base,
  name: "background",
  target: "webworker",
  entry: {
    background: path.join(extensionRoot, "background.js")
  }
};

/** @type {import('webpack').Configuration} */
const uiAndContent = {
  ...base,
  name: "ui-and-content",
  target: "web",
  entry: {
    content: path.join(extensionRoot, "content.js"),
    "popup/popup": path.join(extensionRoot, "popup", "popup.js")
  }
};

module.exports = [background, uiAndContent];
