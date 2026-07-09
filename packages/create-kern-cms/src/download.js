import { createHash } from "node:crypto";
import { createWriteStream, existsSync, unlinkSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { pipeline } from "node:stream/promises";
import tls from "node:tls";
import { URL } from "node:url";
import { USER_AGENT } from "./constants.js";
import { shouldBypassProxy } from "./no-proxy.js";

export class HttpError extends Error {
  constructor(statusCode, url) {
    super(`HTTP ${statusCode} bij het ophalen van ${url}`);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.url = url;
  }
}

function proxyUrlFor(target) {
  if (shouldBypassProxy(target.hostname, process.env.NO_PROXY ?? process.env.no_proxy)) {
    return null;
  }
  if (target.protocol === "https:") {
    return process.env.HTTPS_PROXY || process.env.https_proxy || null;
  }
  return process.env.HTTP_PROXY || process.env.http_proxy || null;
}

// node:https has no built-in proxy support (unlike e.g. curl respecting HTTPS_PROXY) — this is
// the one thing a zero-dependency installer has to hand-roll: a CONNECT tunnel to the proxy, then
// a TLS handshake with the real target over that tunnel.
function connectViaProxy(target, proxyUrlString) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyUrlString);
    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`,
      headers: { Host: `${target.hostname}:${target.port || 443}` },
    });
    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        reject(
          new Error(
            `De proxy (${proxyUrlString}) weigerde de verbinding (status ${res.statusCode}).`,
          ),
        );
        return;
      }
      const tlsSocket = tls.connect({ socket, servername: target.hostname }, () =>
        resolve(tlsSocket),
      );
      tlsSocket.on("error", reject);
    });
    connectReq.on("error", reject);
    connectReq.end();
  });
}

// Follows redirects itself (GitHub Releases assets 302 to a signed object-storage URL) and
// respects HTTPS_PROXY/HTTP_PROXY. Returns the final response stream (still unconsumed).
export function request(urlString, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const target = new URL(urlString);

    const onResponse = (res) => {
      if (
        res.statusCode !== undefined &&
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Te veel doorverwijzingen bij ${urlString}`));
          return;
        }
        const nextUrl = new URL(res.headers.location, target).toString();
        resolve(request(nextUrl, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== undefined && res.statusCode >= 400) {
        res.resume();
        reject(new HttpError(res.statusCode, urlString));
        return;
      }
      resolve(res);
    };

    const proxyUrlString = proxyUrlFor(target);
    if (proxyUrlString && target.protocol === "https:") {
      connectViaProxy(target, proxyUrlString)
        .then((socket) => {
          const req = https.request(
            {
              socket,
              agent: false,
              hostname: target.hostname,
              path: `${target.pathname}${target.search}`,
              headers: { Host: target.hostname, "User-Agent": USER_AGENT },
            },
            onResponse,
          );
          req.on("error", reject);
          req.end();
        })
        .catch(reject);
      return;
    }

    const lib = target.protocol === "https:" ? https : http;
    const req = lib.get(target, { headers: { "User-Agent": USER_AGENT } }, onResponse);
    req.on("error", reject);
  });
}

export async function fetchText(urlString) {
  const res = await request(urlString);
  const chunks = [];
  for await (const chunk of res) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Streams to `${destPath}.download`, hashing while it goes, so an interrupted/failed download
// never leaves a file at the final path — the caller only renames it into place after the
// checksum has verified.
export async function downloadToFile(urlString, destPath, { onProgress } = {}) {
  const res = await request(urlString);
  const total = Number(res.headers["content-length"] ?? 0);
  let received = 0;
  const hash = createHash("sha256");
  res.on("data", (chunk) => {
    hash.update(chunk);
    received += chunk.length;
    onProgress?.(received, total);
  });

  const tmpPath = `${destPath}.download`;
  try {
    await pipeline(res, createWriteStream(tmpPath));
  } catch (error) {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
    throw error;
  }
  return { tmpPath, sha256: hash.digest("hex") };
}
