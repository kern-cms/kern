import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldBypassProxy } from "../src/no-proxy.js";

test("bypasses an exact hostname match", () => {
  assert.equal(shouldBypassProxy("localhost", "localhost,example.com"), true);
});

test("bypasses a domain suffix match", () => {
  assert.equal(shouldBypassProxy("api.internal.example.com", ".example.com"), true);
  assert.equal(shouldBypassProxy("api.internal.example.com", "example.com"), true);
});

test("does not bypass an unrelated host", () => {
  assert.equal(shouldBypassProxy("github.com", "localhost,127.0.0.1,example.com"), false);
});

test("bypasses an IPv4 CIDR range (loopback)", () => {
  assert.equal(shouldBypassProxy("127.0.0.1", "127.0.0.0/8"), true);
  assert.equal(shouldBypassProxy("127.255.255.255", "127.0.0.0/8"), true);
  assert.equal(shouldBypassProxy("128.0.0.1", "127.0.0.0/8"), false);
});

test("'*' bypasses every host", () => {
  assert.equal(shouldBypassProxy("anything.example.com", "*"), true);
});

test("an empty/undefined NO_PROXY bypasses nothing", () => {
  assert.equal(shouldBypassProxy("localhost", undefined), false);
  assert.equal(shouldBypassProxy("localhost", ""), false);
});

test("matches the exact NO_PROXY value this sandbox sets for loopback + localhost", () => {
  const noProxy =
    "localhost,127.0.0.1,::1,127.0.0.0/8,0.0.0.0/8,::,169.254.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";
  assert.equal(shouldBypassProxy("127.0.0.1", noProxy), true);
  assert.equal(shouldBypassProxy("localhost", noProxy), true);
  assert.equal(shouldBypassProxy("github.com", noProxy), false);
});
