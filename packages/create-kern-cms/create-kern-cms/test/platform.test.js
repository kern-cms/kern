import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UnsupportedPlatformError,
  assetName,
  detectTarget,
  localBinaryName,
} from "../src/platform.js";

const KNOWN = [
  ["linux", "x64", "linux-x64"],
  ["linux", "arm64", "linux-arm64"],
  ["darwin", "x64", "macos-x64"],
  ["darwin", "arm64", "macos-arm64"],
  ["win32", "x64", "windows-x64"],
];

for (const [platform, arch, expected] of KNOWN) {
  test(`detectTarget maps ${platform}/${arch} to ${expected}`, () => {
    assert.equal(detectTarget(platform, arch), expected);
  });
}

test("detectTarget throws UnsupportedPlatformError for an unknown platform/arch combo", () => {
  assert.throws(
    () => detectTarget("freebsd", "x64"),
    (error) => {
      assert.ok(error instanceof UnsupportedPlatformError);
      assert.match(error.message, /Geen kern-binary beschikbaar voor freebsd\/x64/);
      assert.match(error.message, /github\.com\/kern-cms\/kern\/releases/);
      return true;
    },
  );
});

test("detectTarget rejects a known platform with an unsupported arch (win32/arm64)", () => {
  assert.throws(() => detectTarget("win32", "arm64"), UnsupportedPlatformError);
});

test("assetName appends .exe only for the windows target", () => {
  assert.equal(assetName("linux-x64"), "kern-linux-x64");
  assert.equal(assetName("macos-arm64"), "kern-macos-arm64");
  assert.equal(assetName("windows-x64"), "kern-windows-x64.exe");
});

test("localBinaryName is kern[.exe] regardless of target suffix", () => {
  assert.equal(localBinaryName("linux-x64"), "kern");
  assert.equal(localBinaryName("windows-x64"), "kern.exe");
});
