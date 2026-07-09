// A minimal NO_PROXY implementation. Every corporate proxy setup that sets HTTPS_PROXY also sets
// NO_PROXY for internal/loopback hosts (curl, git, npm all honour it) — without this, a proxy-
// aware zero-dependency client would try to tunnel *every* request, including ones to localhost
// or an internal mirror, through the proxy, which typically can't route there at all.
function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function matchesCidr(hostname, cidr) {
  const [range, bitsString] = cidr.split("/");
  const bits = Number(bitsString);
  const hostInt = ipv4ToInt(hostname);
  const rangeInt = ipv4ToInt(range);
  if (hostInt === null || rangeInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (hostInt & mask) === (rangeInt & mask);
}

export function parseNoProxy(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function shouldBypassProxy(hostname, noProxyValue) {
  const patterns = parseNoProxy(noProxyValue);
  return patterns.some((pattern) => {
    if (pattern === "*") {
      return true;
    }
    if (pattern.includes("/")) {
      return matchesCidr(hostname, pattern);
    }
    const normalized = pattern.startsWith(".") ? pattern.slice(1) : pattern;
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}
