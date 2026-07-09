import http from "node:http";

// A minimal local HTTP server standing in for GitHub Releases in tests — no real network calls,
// per the "geen echte GitHub-calls in tests" requirement. `routes` maps an exact request path to
// either a Buffer/string body or a function `(req, res) => void` for custom behaviour (redirects,
// slow responses, etc).
export function startTestServer(routes) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const route = routes[req.url];
      if (!route) {
        res.writeHead(404).end("not found");
        return;
      }
      if (typeof route === "function") {
        route(req, res);
        return;
      }
      const body = typeof route === "string" ? Buffer.from(route) : route;
      res.writeHead(200, { "Content-Length": String(body.length) }).end(body);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}
