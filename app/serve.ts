import { resolve, sep } from "node:path";
import { readConfig } from "./server/config";

readConfig();

const root = resolve("app/dist/client");
const serverPath = resolve("app/dist/server/server.js");
const { default: handler } = (await import(serverPath)) as {
  default: { fetch(request: Request): Promise<Response> };
};
Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/healthz") return Response.json({ ok: true });
    let path: string;
    try {
      path = resolve(root, `.${decodeURIComponent(pathname)}`);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (path.startsWith(root + sep) && pathname !== "/") {
      const file = Bun.file(path);
      if (await file.exists())
        return new Response(file, {
          headers: {
            "Cache-Control": pathname.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
    }
    const response = await handler.fetch(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  },
});
