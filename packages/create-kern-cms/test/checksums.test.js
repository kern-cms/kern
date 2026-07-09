import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ChecksumMismatchError, parseChecksums, verifyChecksum } from "../src/checksums.js";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

test("parseChecksums reads sha256sum-format lines into a name -> hash map", () => {
  const hashA = sha256("a");
  const hashB = sha256("b");
  const text = `${hashA}  kern-linux-x64\n${hashB}  kern-windows-x64.exe\n`;

  const map = parseChecksums(text);

  assert.equal(map.get("kern-linux-x64"), hashA);
  assert.equal(map.get("kern-windows-x64.exe"), hashB);
  assert.equal(map.size, 2);
});

test("parseChecksums tolerates the sha256sum binary-mode '*' prefix and blank lines", () => {
  const hash = sha256("x");
  const text = `\n${hash}  *kern-macos-x64\n\n`;

  const map = parseChecksums(text);

  assert.equal(map.get("kern-macos-x64"), hash);
});

test("parseChecksums is case-insensitive on the hex digest", () => {
  const hash = sha256("x");
  const text = `${hash.toUpperCase()}  kern-linux-arm64\n`;

  assert.equal(parseChecksums(text).get("kern-linux-arm64"), hash);
});

test("verifyChecksum passes silently when the digest matches", () => {
  const hash = sha256("x");
  const checksums = new Map([["kern-linux-x64", hash]]);
  assert.doesNotThrow(() => verifyChecksum("kern-linux-x64", hash, checksums));
});

test("verifyChecksum throws ChecksumMismatchError on a tampered/corrupt download", () => {
  const checksums = new Map([["kern-linux-x64", sha256("expected-bytes")]]);
  assert.throws(
    () => verifyChecksum("kern-linux-x64", sha256("tampered-bytes"), checksums),
    (error) => {
      assert.ok(error instanceof ChecksumMismatchError);
      assert.equal(error.fileName, "kern-linux-x64");
      assert.match(error.message, /Checksum-mismatch/);
      return true;
    },
  );
});

test("verifyChecksum throws a clear error when the file isn't listed in checksums.txt at all", () => {
  assert.throws(
    () => verifyChecksum("kern-linux-x64", sha256("x"), new Map()),
    /Geen checksum gevonden/,
  );
});
