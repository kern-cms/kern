import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { parseChecksums, verifyChecksum } from "../src/checksums.js";
import { downloadToFile, fetchText, request } from "../src/download.js";
import { startTestServer } from "./helpers/test-server.js";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const GOOD_BINARY = Buffer.from("dit-is-de-echte-kern-binary-inhoud");
const GOOD_CHECKSUMS = `${sha256(GOOD_BINARY)}  kern-linux-x64\n`;
// The server serves different bytes than what checksums.txt promises — simulates a corrupted or
// tampered download; the installer must reject this, not just record a mismatch.
const TAMPERED_BINARY = Buffer.from("dit-zijn-andere-bytes-dan-verwacht");

let ctx;
let tmpDir;

before(async () => {
  ctx = await startTestServer({
    "/v1.0.0/checksums.txt": GOOD_CHECKSUMS,
    "/v1.0.0/kern-linux-x64": GOOD_BINARY,
    "/v1.0.0/kern-tampered": TAMPERED_BINARY,
    "/redirect-once": (_req, res) => {
      res.writeHead(302, { Location: "/v1.0.0/kern-linux-x64" }).end();
    },
    "/gone": (_req, res) => {
      res.writeHead(404).end("not found");
    },
  });
});

after(async () => {
  await ctx.close();
});

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

test("fetchText retrieves the checksums.txt body over plain HTTP", async () => {
  const text = await fetchText(`${ctx.baseUrl}/v1.0.0/checksums.txt`);
  assert.equal(text, GOOD_CHECKSUMS);
});

test("request follows redirects", async () => {
  const res = await request(`${ctx.baseUrl}/redirect-once`);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), GOOD_BINARY);
});

test("request rejects with a clear error on a 404", async () => {
  await assert.rejects(request(`${ctx.baseUrl}/gone`), /HTTP 404/);
});

test("downloadToFile + verifyChecksum accept a genuine, unmodified download", async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-download-test-"));
  const destPath = join(tmpDir, "kern-linux-x64");

  const checksums = parseChecksums(await fetchText(`${ctx.baseUrl}/v1.0.0/checksums.txt`));
  const progressEvents = [];
  const { tmpPath, sha256: actualSha256 } = await downloadToFile(
    `${ctx.baseUrl}/v1.0.0/kern-linux-x64`,
    destPath,
    { onProgress: (received, total) => progressEvents.push([received, total]) },
  );

  assert.doesNotThrow(() => verifyChecksum("kern-linux-x64", actualSha256, checksums));
  assert.deepEqual(readFileSync(tmpPath), GOOD_BINARY);
  assert.ok(progressEvents.length > 0, "onProgress should fire at least once");
});

test("a tampered download is rejected and leaves no verified file behind", async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-download-test-tampered-"));
  const destPath = join(tmpDir, "kern-linux-x64");

  // checksums.txt still names the file "kern-linux-x64" (what a real release would ship); the
  // server-side content behind that name is the tampered bytes.
  const checksums = parseChecksums(GOOD_CHECKSUMS);
  const { tmpPath, sha256: actualSha256 } = await downloadToFile(
    `${ctx.baseUrl}/v1.0.0/kern-tampered`,
    destPath,
  );

  assert.throws(
    () => verifyChecksum("kern-linux-x64", actualSha256, checksums),
    /Checksum-mismatch/,
  );
  // The CLI (see cli.test.js) is responsible for unlinking tmpPath on mismatch; downloadToFile's
  // own contract only guarantees the *final* destPath is never written before verification.
  assert.ok(!existsSync(destPath), "the final binary path must not exist before verification");
  assert.ok(existsSync(tmpPath), "the unverified download is still the caller's to clean up");
});
