import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { transform } from "esbuild";

const source = await readFile(new URL("../src/animation.ts", import.meta.url), "utf8");
const transformed = await transform(source, {
  format: "esm",
  loader: "ts",
  target: "es2018"
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`;
const { calculateAnimationProgress } = await import(moduleUrl);

test("animation progress never becomes negative for an early RAF timestamp", () => {
  assert.equal(calculateAnimationProgress(90, 100, 120), 0);
});

test("animation progress is bounded and advances normally", () => {
  assert.equal(calculateAnimationProgress(100, 100, 120), 0);
  assert.equal(calculateAnimationProgress(160, 100, 120), 0.5);
  assert.equal(calculateAnimationProgress(220, 100, 120), 1);
  assert.equal(calculateAnimationProgress(250, 100, 120), 1);
});
