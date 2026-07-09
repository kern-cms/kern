// The installer downloads exactly one repo's release assets: the PUBLIC org repo where
// release-build.yml publishes the platform binaries + checksums.txt (kern-cms/kern). It is
// deliberately NOT the private monorepo (dkortekaas/kern-cms) — that repo has no public
// releases, so pointing here would 404 for anyone running `npx create-kern-cms`.
// `KERN_INSTALLER_BASE_URL` is an undocumented override (no dependency, no config file — a
// single env var) so tests can point the whole flow at a local HTTP server instead of GitHub,
// and so an operator behind a mirror/artifact-proxy can redirect it without a code change.
export const REPO = "kern-cms/kern";

// A function, not a top-level constant: it must re-read the env var on every call (not just once
// at import time) so tests can set KERN_INSTALLER_BASE_URL after this module has already loaded.
export function getReleaseBaseUrl() {
  return process.env.KERN_INSTALLER_BASE_URL || `https://github.com/${REPO}/releases/download`;
}

export const USER_AGENT = "create-kern-cms-installer";
