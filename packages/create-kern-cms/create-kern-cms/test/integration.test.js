// The one true end-to-end test: builds the real kern binary for the host platform (via bun, the
// only place in this Node-only test suite that touches Bun — it's needed to produce the fixture,
// not to run the installer), serves it from a local HTTP fixture server standing in for GitHub
// Releases, then runs the actual bin/create-kern-cms.js as a real `node` child process (proving
// the installer itself needs nothing but plain Node) and finishes with a working `kern
// --version`.
//
// The fixture server runs as its own child process (test/helpers/fixture-server.mjs), a sibling
// of the installer subprocess, rather than listening in this test-runner process itself: some
// sandboxes intercept/namespace outbound connections per-process in a way that breaks a *nested*
// child process connecting back to a socket its own parent holds, while two independent sibling
// processes talk over loopback fine. Two subprocess spawns is a little more ceremony, but it's the
// topology that actually works everywhere, not just on an unconstrained machine.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { assetName, detectTarget, localBinaryName } from "../src/platform.js";

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = join(PACKAGE_DIR, "..", "..");
const SERVER_DIR = join(REPO_ROOT, "packages", "server");
const MANIFEST_PATH = join(SERVER_DIR, "src", "admin", "manifest.generated.ts");
const BUILT_BINARY_PATH = join(SERVER_DIR, "dist", "kern");
const INSTALLER_VERSION = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "package.json"), "utf-8"),
).version;

function bunAvailable() {
  return spawnSync("bun", ["--version"], { stdio: "ignore" }).status === 0;
}

function startFixtureServer(routes) {
  return new Promise((resolve, reject) => {
    const configPath = join(tmpdir(), `create-kern-cms-fixture-${process.pid}-${Date.now()}.json`);
    writeFileSync(configPath, JSON.stringify({ routes }));
    const child = spawn(
      process.execPath,
      [join(PACKAGE_DIR, "test", "helpers", "fixture-server.mjs"), configPath],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    child.on("error", reject);
    let buffered = "";
    child.stdout.on("data", (chunk) => {
      buffered += chunk.toString();
      const match = buffered.match(/PORT=(\d+)/);
      if (match) {
        resolve({
          baseUrl: `http://127.0.0.1:${match[1]}`,
          close: () => {
            child.kill();
            rmSync(configPath, { force: true });
          },
        });
      }
    });
  });
}

let ctx;
let tmpDir;
let skipReason = null;

before(async () => {
  if (!bunAvailable()) {
    skipReason = "bun is niet beschikbaar in deze omgeving — kan geen echte binary bouwen";
    return;
  }

  const build = spawnSync("bun", ["run", "build:binary"], { cwd: SERVER_DIR, stdio: "inherit" });
  if (build.status !== 0 || !existsSync(BUILT_BINARY_PATH)) {
    throw new Error(
      "kon de kern-binary niet bouwen voor de integratietest (`bun run build:binary` faalde)",
    );
  }

  const target = detectTarget();
  const asset = assetName(target);
  const binaryBytes = readFileSync(BUILT_BINARY_PATH);
  const sha256 = createHash("sha256").update(binaryBytes).digest("hex");

  ctx = await startFixtureServer({
    [`/v${INSTALLER_VERSION}/checksums.txt`]: { text: `${sha256}  ${asset}\n` },
    [`/v${INSTALLER_VERSION}/${asset}`]: { file: BUILT_BINARY_PATH },
  });
});

after(async () => {
  if (ctx) {
    ctx.close();
  }
  // `bun run build:binary` embeds the real admin build into manifest.generated.ts; restore the
  // committed placeholder the same way every other rooktest in this repo does (see
  // docs/release-checklist.md step 4 / `check:manifest-placeholder`).
  spawnSync("git", ["checkout", "--", MANIFEST_PATH], { cwd: REPO_ROOT });
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("clean dir -> installer flow against the local fixture server -> working kern --version", async (t) => {
  if (skipReason) {
    t.skip(skipReason);
    return;
  }

  tmpDir = mkdtempSync(join(tmpdir(), "create-kern-cms-integration-"));

  const binPath = join(PACKAGE_DIR, "bin", "create-kern-cms.js");
  // Spawned with the real `node` executable (not required(), not Bun) — this is the acceptance
  // criterion "bin-script draait aantoonbaar onder kale Node" in its most literal form.
  const result = spawnSync(process.execPath, [binPath, tmpDir], {
    encoding: "utf-8",
    env: { ...process.env, KERN_INSTALLER_BASE_URL: ctx.baseUrl },
  });

  assert.equal(
    result.status,
    0,
    `installer moet slagen.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  const target = detectTarget();
  const binaryPath = join(tmpDir, localBinaryName(target));
  assert.ok(existsSync(binaryPath), "binary moet in de doelmap staan");
  assert.ok(
    existsSync(join(tmpDir, "schema.yaml")),
    "kern init moet schema.yaml hebben geschreven",
  );
  assert.ok(existsSync(join(tmpDir, "data")), "kern init moet de datamap hebben aangemaakt");

  const versionOutput = execFileSync(binaryPath, ["--version"], { encoding: "utf-8" }).trim();
  assert.match(versionOutput, /^\d+\.\d+\.\d+$/);
});
