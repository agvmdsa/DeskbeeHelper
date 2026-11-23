import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, isNewer } from "../lib/version.js";

test("compareVersions orders numerically, not as text", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
});

test("compareVersions accepts a leading v and missing parts", () => {
  assert.equal(compareVersions("v1.2", "1.2.0"), 0);
  assert.equal(compareVersions("v1.2.1", "1.2"), 1);
});

test("isNewer is false for invalid versions", () => {
  assert.equal(isNewer("v1.1.0", "1.0.0"), true);
  assert.equal(isNewer("1.0.0", "1.0.0"), false);
  assert.equal(isNewer("latest", "1.0.0"), false);
  assert.equal(isNewer(undefined, "1.0.0"), false);
});
