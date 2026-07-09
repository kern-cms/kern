// Standalone HTTP fixture server for the integration test, run as its own child process (not
// in-process) — some sandboxes intercept/namespace network traffic per-process in a way that
// breaks a *nested* child process connecting back to a socket held by its own parent process,
// while two independent sibling processes talk over loopback just fine. Running the fixture as a
// sibling of the installer subprocess (both children of the test runner) sidesteps that.
//
// Usage: node fixture-server.mjs <config.json>
// config.json: { "routes": { "/path": { "text": "..." } | { "file": "/abs/path" } } }
import { createReadStream, readFileSync, statSync } from "node:fs";
import http from "node:http";

const configPath = process.argv[2];
const config = JSON.parse(readFileSync(configPath, "utf-8"));

const server = http.createServer((req, res) => {
  const route = config.routes[req.url];
  if (!route) {
    res.writeHead(404).end("not found");
    return;
  }
  if (route.text !== undefined) {
    const body = Buffer.from(route.text);
    res.writeHead(200, { "Content-Length": String(body.length) }).end(body);
    return;
  }
  if (route.file) {
    const { size } = statSync(route.file);
    res.writeHead(200, { "Content-Length": String(size) });
    createReadStream(route.file).pipe(res);
    return;
  }
  res.writeHead(500).end("bad fixture-server route config");
});

server.listen(0, "127.0.0.1", () => {
  // The parent process greps stdout for this line to learn the ephemeral port.
  console.log(`PORT=${server.address().port}`);
});
