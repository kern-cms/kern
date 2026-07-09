import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { run } from "../src/cli.js";
import { startTestServer } from "./helpers/test-server.js";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function collector() {
  const lines = [];
  return { write: (chunk) => lines.push(chunk), text: () => lines.join("") };
}

const FAKE_BINARY = Buffer.from("stub-binary-contents-not-executable");
const VERSION = "1.0.2"; // matches packages/create-kern-cms/package.json

let ctx;
let tmpDir;
let originalBaseUrl;

before(async () => {
  ctx = await startTestServer({
    [`/v${VERSION}/checksums.txt`]: `${sha256(FAKE_BINARY)}  kern-linux-x64\n`,
    [`/v${VERSION}/kern-linux-x64`]: FAKE_BINARY,
  });
  originalBaseUrl = process.env.KERN_INSTALLER_BASE_URL;
  process.env.KERN_INSTALLER_BASE_URL = ctx.baseUrl;
});

after(async () => {
  await ctx.close();
  if (originalBaseUrl === undefined) {
    process.env.KERN_INSTALLER_BASE_URL = undefined;
  } else {
    process.env.KERN_INSTALLER_BASE_URL = originalBaseUrl;
  }
});

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

function withLinuxPlatform(fn) {
  const originalPlatform = process.platform;
  const originalArch = process.arch;
  Object.defineProperty(process, "platform", { value: "linux" });
  Object.defineProperty(process, "arch", { value: "x64" });
  return Promise.resolve(fn()).finally(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  });
}

test("--help prints usage and exits 0", async () => {
  const out = collector();
  const exitCode = await run({ argv: ["--help"], stdout: out, stderr: collector() });
  assert.equal(exitCode, 0);
  assert.match(out.text(), /Gebruik: create-kern-cms/);
});

test("--version prints the installer's own version and exits 0", async () => {
  const out = collector();
  const exitCode = await run({ argv: ["--version"], stdout: out, stderr: collector() });
  assert.equal(exitCode, 0);
  assert.equal(out.text().trim(), VERSION);
});

test("an unknown flag exits 1 with an error and the help text on stderr", async () => {
  const err = collector();
  const exitCode = await run({ argv: ["--bestaat-niet"], stdout: collector(), stderr: err });
  assert.equal(exitCode, 1);
  assert.match(err.text(), /Onbekende optie: "--bestaat-niet"/);
  assert.match(err.text(), /Gebruik: create-kern-cms/);
});

test("refuses a non-empty target directory without --force, leaving it untouched", async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-"));
  writeFileSync(join(tmpDir, "bestaand-bestand.txt"), "ik was hier al");

  const err = collector();
  const exitCode = await run({ argv: [tmpDir, "--no-init"], stdout: collector(), stderr: err });

  assert.equal(exitCode, 1);
  assert.match(err.text(), /bestaat al en is niet leeg/);
  assert.deepEqual(readdirSync(tmpDir), ["bestaand-bestand.txt"]);
});

test("--force overrides the non-empty-directory refusal and installs anyway", async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-force-"));
  writeFileSync(join(tmpDir, "bestaand-bestand.txt"), "ik was hier al");

  await withLinuxPlatform(async () => {
    const out = collector();
    const exitCode = await run({
      argv: [tmpDir, "--force", "--no-init"],
      stdout: out,
      stderr: collector(),
    });
    assert.equal(exitCode, 0);
    assert.ok(existsSync(join(tmpDir, "kern")), "binary should be placed under --force");
  });
});

test("--no-init places the binary but never attempts to run it", async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-noinit-"));

  await withLinuxPlatform(async () => {
    const out = collector();
    const exitCode = await run({ argv: [tmpDir, "--no-init"], stdout: out, stderr: collector() });

    assert.equal(exitCode, 0);
    const binaryPath = join(tmpDir, "kern");
    assert.ok(existsSync(binaryPath));
    assert.deepEqual(readFileSync(binaryPath), FAKE_BINARY);
    // schema.yaml/data/ are what a real `kern init` would create — their absence proves init
    // never ran (the stub binary above isn't executable, so a real spawn attempt would fail
    // loudly rather than silently, but this is the more direct assertion of intent).
    assert.ok(!existsSync(join(tmpDir, "schema.yaml")));
    assert.ok(!existsSync(join(tmpDir, "data")));
  });
});

test("creates a missing target directory instead of requiring it to pre-exist", async () => {
  const parent = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-mkdir-"));
  tmpDir = join(parent, "nieuwe-map", "die-nog-niet-bestaat");

  await withLinuxPlatform(async () => {
    const exitCode = await run({
      argv: [tmpDir, "--no-init"],
      stdout: collector(),
      stderr: collector(),
    });
    assert.equal(exitCode, 0);
    assert.ok(existsSync(join(tmpDir, "kern")));
  });
  rmSync(parent, { recursive: true, force: true });
  tmpDir = undefined;
});

test("an unsupported platform/arch exits 1 with a manual-download instruction", async () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;
  Object.defineProperty(process, "platform", { value: "freebsd" });
  Object.defineProperty(process, "arch", { value: "x64" });

  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-unsupported-"));
  try {
    const err = collector();
    const exitCode = await run({
      argv: [tmpDir, "--no-init"],
      stdout: collector(),
      stderr: err,
    });
    assert.equal(exitCode, 1);
    assert.match(err.text(), /Geen kern-binary beschikbaar voor freebsd\/x64/);
    assert.match(err.text(), /github\.com\/kern-cms\/kern\/releases/);
    assert.deepEqual(
      readdirSync(tmpDir),
      [],
      "nothing should be written for an unsupported platform",
    );
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  }
});

test("a checksum mismatch exits 1 and leaves no binary or leftover temp file", async () => {
  const badCtx = await startTestServer({
    [`/v${VERSION}/checksums.txt`]: `${sha256(Buffer.from("expected"))}  kern-linux-x64\n`,
    [`/v${VERSION}/kern-linux-x64`]: Buffer.from("actually-different-bytes"),
  });
  const previous = process.env.KERN_INSTALLER_BASE_URL;
  process.env.KERN_INSTALLER_BASE_URL = badCtx.baseUrl;
  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-cli-test-badchecksum-"));

  try {
    await withLinuxPlatform(async () => {
      const err = collector();
      const exitCode = await run({
        argv: [tmpDir, "--no-init"],
        stdout: collector(),
        stderr: err,
      });
      assert.equal(exitCode, 1);
      assert.match(err.text(), /Checksum-mismatch/);
      assert.deepEqual(
        readdirSync(tmpDir),
        [],
        "no partial install should remain after a mismatch",
      );
    });
  } finally {
    process.env.KERN_INSTALLER_BASE_URL = previous;
    await badCtx.close();
  }
});
