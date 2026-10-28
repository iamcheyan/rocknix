import { readFile, readdir, stat, open } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";

const repo = resolve(process.cwd());
const staticRoot = join(repo, "tools/pocketshell-dev");
const clientRoot = resolve(process.env.POCKETSHELL_CLIENT_ROOT ?? "/tmp/pocketshell-library-pocketjs-scratch");
const hostRoot = join(clientRoot, "node_modules/@pocketjs/framework/hosts/web");
const roots = ["/storage/docs", "/storage/books", "/storage/reports", "/storage/library"];
const fixtures = roots.map((_, i) => join(repo, "projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/fixtures"));
const states = new Map();
const mime = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".pak": "application/octet-stream", ".css": "text/css" };

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/") { response.setHeader("content-type", "text/html"); response.end(await readFile(join(staticRoot, "library.html"))); return; }
  if (url.pathname === "/library-harness.js") { response.setHeader("content-type", "text/javascript"); response.end(await readFile(join(staticRoot, "library-harness.js"))); return; }
  if (url.pathname === "/dist/library.js") { response.setHeader("content-type", "text/javascript"); response.end(await readFile(join(clientRoot, "dist", "library.js"))); return; }
  if (url.pathname === "/dist/library.pak") { response.setHeader("content-type", "application/octet-stream"); createReadStream(join(clientRoot, "dist", "library.pak")).pipe(response); return; }
  if (url.pathname.startsWith("/host/")) {
    const file = resolve(hostRoot, url.pathname.slice(6));
    if (!file.startsWith(hostRoot + sep)) { response.writeHead(403).end(); return; }
    try { response.setHeader("content-type", mime[file.slice(file.lastIndexOf("."))] ?? "application/javascript"); createReadStream(file).pipe(response); return; } catch {}
  }
  // Serve any host file at root path (engine.js, wasm-ops.js, hud.js, audio.js, net.js, pocketjs.wasm, etc.)
  const hostFile = resolve(hostRoot, url.pathname.slice(1));
  if (hostFile.startsWith(hostRoot + sep) && existsSync(hostFile)) {
    try { response.setHeader("content-type", mime[hostFile.slice(hostFile.lastIndexOf("."))] ?? "application/javascript"); createReadStream(hostFile).pipe(response); return; } catch {}
  }
  if (url.pathname === "/fixture-api/list") {
    const virtual = url.searchParams.get("root") ?? "";
    const i = Number(virtual.match(/^\/fixture-(\d+)/)?.[1]);
    const base = fixtures[i];
    const relative = virtual.replace(/^\/fixture-\d+/, "").replace(/^\//, "");
    const dir = resolve(base, relative);
    if (!dir.startsWith(base)) { response.writeHead(403).end("[]"); return; }
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const rows = await Promise.all(entries.map(async (entry) => {
        const path = join(dir, entry.name);
        return { path: `/storage/${["docs", "books", "reports", "library"][i]}/${relative ? relative + "/" : ""}${entry.name}`, directory: entry.isDirectory(), size: (await stat(path)).size };
      }));
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify(rows));
    } catch { response.setHeader("content-type", "application/json"); response.end("[]"); }
    return;
  }
  if (url.pathname === "/fixture-api/read") {
    const virtual = url.searchParams.get("path") ?? "";
    const i = Number(virtual.match(/^\/fixture-(\d+)/)?.[1]);
    const base = fixtures[i];
    const relative = virtual.replace(/^\/fixture-\d+/, "").replace(/^\//, "");
    const filePath = resolve(base, relative);
    if (!filePath.startsWith(base)) { response.writeHead(403).end(); return; }
    try {
      const handle = await open(filePath, "r");
      const wanted = Math.min(Number(url.searchParams.get("length")) || 0, 16 * 1024);
      const buffer = Buffer.alloc(wanted);
      const { bytesRead } = await handle.read(buffer, 0, wanted, Number(url.searchParams.get("offset")) || 0);
      await handle.close();
      response.setHeader("content-type", "text/plain; charset=utf-8"); response.end(buffer.subarray(0, bytesRead));
    } catch { response.writeHead(404).end(); }
    return;
  }
  if (url.pathname === "/state") {
    response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ states: [...states.entries()] }));
    return;
  }
  response.writeHead(404).end("not found");
});

const port = Number(process.env.PORT ?? 8137);
server.listen(port, "127.0.0.1", () => console.log(`PocketJS Library harness: http://127.0.0.1:${port}`));