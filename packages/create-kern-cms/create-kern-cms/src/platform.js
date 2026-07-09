import { REPO } from "./constants.js";

// The five build targets from docs/adr/004-multi-platform-binaries.md; process.platform/arch map
// onto them 1:1 (Node and Bun agree on these platform/arch string values).
const TARGET_BY_PLATFORM_ARCH = {
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "darwin-x64": "macos-x64",
  "darwin-arm64": "macos-arm64",
  "win32-x64": "windows-x64",
};

export class UnsupportedPlatformError extends Error {
  constructor(platform, arch) {
    super(
      `Geen kern-binary beschikbaar voor ${platform}/${arch}. Ondersteund: linux (x64/arm64), macOS (x64/arm64) en Windows (x64). Download handmatig een binary voor je platform via https://github.com/${REPO}/releases en volg de instructies in docs/deployment.md.`,
    );
    this.name = "UnsupportedPlatformError";
    this.platform = platform;
    this.arch = arch;
  }
}

export function detectTarget(platform = process.platform, arch = process.arch) {
  const target = TARGET_BY_PLATFORM_ARCH[`${platform}-${arch}`];
  if (!target) {
    throw new UnsupportedPlatformError(platform, arch);
  }
  return target;
}

export function assetName(target) {
  return target.startsWith("windows-") ? `kern-${target}.exe` : `kern-${target}`;
}

export function localBinaryName(target) {
  return target.startsWith("windows-") ? "kern.exe" : "kern";
}
