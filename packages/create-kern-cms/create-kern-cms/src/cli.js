import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ArgError, parseArgs } from "./args.js";
import { ChecksumMismatchError, parseChecksums, verifyChecksum } from "./checksums.js";
import { REPO, getReleaseBaseUrl } from "./constants.js";
import { downloadToFile, fetchText } from "./download.js";
import { UnsupportedPlatformError, assetName, detectTarget, localBinaryName } from "./platform.js";

const PACKAGE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Node 18 only understands the old `assert { type: "json" }` import-attribute syntax, while
// newer Node requires `with` — reading the file directly sidesteps that version skew entirely,
// which matters here since `engines.node` promises >=18.
function readPackageVersion() {
  const raw = readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf-8");
  return JSON.parse(raw).version;
}

const HELP_TEXT = `create-kern-cms — installeert Kern CMS in een nieuwe of lege map

Gebruik: create-kern-cms [map] [opties]

  map                       doelmap (default: huidige map); wordt aangemaakt als hij niet bestaat

Opties:
  --force                   sta toe dat de doelmap al bestanden bevat
  --no-init                 plaats alleen de binary, sla "kern init" over
  -v, --version             toont de installer-versie
  -h, --help                toont deze hulptekst

De installer downloadt de bij deze installer-versie horende kern-binary van GitHub Releases
(https://github.com/${REPO}/releases), verifieert de SHA-256-checksum uit checksums.txt, en
draait daarna "kern init" in de doelmap. Vereist alleen Node.js >= 18 — Kern CMS zelf gebruikt
géén Node-runtime: de gedownloade binary is een standalone Bun-executable.`;

function isDirNonEmpty(dir) {
  return existsSync(dir) && readdirSync(dir).length > 0;
}

function formatProgress(received, total) {
  if (total > 0) {
    const pct = Math.min(100, Math.round((received / total) * 100));
    return `${pct}% (${received}/${total} bytes)`;
  }
  return `${received} bytes`;
}

function networkErrorMessage(error, url) {
  return `Netwerkfout bij ${url}: ${error.message}\nDownload de binary handmatig via die URL als alternatief (zie ook docs/deployment.md).\nAchter een corporate proxy: zet HTTPS_PROXY (of HTTP_PROXY) en probeer opnieuw.\n`;
}

function runKernInit(binaryPath, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, ["init"], { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function printNextSteps(out, targetDir, target, noInit) {
  const runPrefix = target.startsWith("windows-") ? "" : "./";
  const binName = localBinaryName(target);
  const steps = [`cd ${targetDir}`];
  if (noInit) {
    steps.push(`${runPrefix}${binName} init`);
  }
  steps.push(`${runPrefix}${binName} start`);
  steps.push("log in op http://localhost:3000/admin");

  out.write("\nVervolgstappen:\n");
  steps.forEach((step, index) => out.write(`  ${index + 1}. ${step}\n`));
  out.write(
    `\nZie https://github.com/${REPO}/tree/main/examples/astro-blog voor een referentiefrontend (Astro) die tegen de content-API draait.\n`,
  );
}

export async function run({ argv, cwd, stdout, stderr } = {}) {
  const args = argv ?? process.argv.slice(2);
  const workingDir = cwd ?? process.cwd();
  const out = stdout ?? process.stdout;
  const err = stderr ?? process.stderr;

  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    if (error instanceof ArgError) {
      err.write(`${error.message}\n\n${HELP_TEXT}\n`);
      return 1;
    }
    throw error;
  }

  if (parsed.help) {
    out.write(`${HELP_TEXT}\n`);
    return 0;
  }
  if (parsed.version) {
    out.write(`${readPackageVersion()}\n`);
    return 0;
  }

  const targetDir = path.resolve(workingDir, parsed.targetDir ?? ".");

  if (isDirNonEmpty(targetDir) && !parsed.force) {
    err.write(
      `De map "${targetDir}" bestaat al en is niet leeg. Gebruik --force om toch te installeren, of kies een andere/lege map.\n`,
    );
    return 1;
  }

  let target;
  try {
    target = detectTarget();
  } catch (error) {
    if (error instanceof UnsupportedPlatformError) {
      err.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }

  mkdirSync(targetDir, { recursive: true });

  const version = readPackageVersion();
  const asset = assetName(target);
  const releaseBaseUrl = getReleaseBaseUrl();
  const binaryUrl = `${releaseBaseUrl}/v${version}/${asset}`;
  const checksumsUrl = `${releaseBaseUrl}/v${version}/checksums.txt`;
  const finalBinaryPath = path.join(targetDir, localBinaryName(target));

  out.write(`Platform gedetecteerd: ${target}\n`);
  out.write(`Checksums ophalen: ${checksumsUrl}\n`);

  let checksums;
  try {
    checksums = parseChecksums(await fetchText(checksumsUrl));
  } catch (error) {
    err.write(networkErrorMessage(error, checksumsUrl));
    return 1;
  }

  out.write(`Binary downloaden: ${binaryUrl}\n`);
  let downloaded;
  try {
    downloaded = await downloadToFile(binaryUrl, finalBinaryPath, {
      onProgress: (received, total) => {
        out.write(`\rDownloaden: ${formatProgress(received, total)}`);
      },
    });
    out.write("\n");
  } catch (error) {
    out.write("\n");
    err.write(networkErrorMessage(error, binaryUrl));
    return 1;
  }

  try {
    verifyChecksum(asset, downloaded.sha256, checksums);
  } catch (error) {
    if (existsSync(downloaded.tmpPath)) {
      unlinkSync(downloaded.tmpPath);
    }
    if (error instanceof ChecksumMismatchError) {
      err.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }

  renameSync(downloaded.tmpPath, finalBinaryPath);
  if (process.platform !== "win32") {
    chmodSync(finalBinaryPath, 0o755);
  }
  out.write(`Binary geplaatst: ${finalBinaryPath}\n`);

  if (!parsed.noInit) {
    const initExitCode = await runKernInit(finalBinaryPath, targetDir);
    if (initExitCode !== 0) {
      err.write(`"kern init" gaf foutcode ${initExitCode} terug.\n`);
      return initExitCode;
    }
  }

  printNextSteps(out, targetDir, target, parsed.noInit);
  return 0;
}
