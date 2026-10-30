// Static server for the Launcher V2 browser harness.
//
//   bun server.ts              # serves this directory  -> http://127.0.0.1:8199
//   PORT=8200 bun server.ts    # another port
//
// It serves the directory it lives in, so the harness can be assembled anywhere
// (see README). Requests are confined to that directory: the resolved path must
// stay under it, so `..` cannot escape.

import { join, normalize, resolve, sep } from "node:path";

const root = resolve(new URL(".", import.meta.url).pathname);
const mime: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  wasm: "application/wasm",
  pak: "application/octet-stream",
  png: "image/png",
};

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8199),
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const path = join(root, normalize(requested));
    if (path !== root && !path.startsWith(root + sep)) {
      return new Response("forbidden", { status: 403 });
    }
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response(`not found: ${requested}`, { status: 404 });
    return new Response(file, {
      headers: { "content-type": mime[path.split(".").pop() ?? ""] ?? "application/octet-stream" },
    });
  },
});
console.log("serving", server.url.href);
