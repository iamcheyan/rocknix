const root = "/tmp/lv2/chrome";
const mime: Record<string,string> = { html:"text/html", js:"text/javascript", wasm:"application/wasm", pak:"application/octet-stream", png:"image/png" };
const server = Bun.serve({
  port: 8199,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(root + path);
    if (!(await file.exists())) return new Response("not found: " + path, { status: 404 });
    return new Response(file, { headers: { "content-type": mime[path.split(".").pop() ?? ""] ?? "application/octet-stream" } });
  },
});
console.log("serving", server.url.href);
