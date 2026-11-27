/* Minimal static file server for the ApplyLogics Studio site (no dependencies). */
const path = require("path");
const http = require("http");
const fs = require("fs");

const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
/* fingerprint-free assets that rarely change can be cached; pages and code revalidate */
const longLived = new Set([".woff2", ".png", ".jpg", ".webp", ".ico", ".mp4", ".svg"]);

function send(res, status, file, data) {
  const ext = path.extname(file);
  res.writeHead(status, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": longLived.has(ext) ? "public, max-age=86400" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(data);
}

http
  .createServer((req, res) => {
    let p;
    try {
      p = decodeURIComponent(req.url.split("?")[0]);
    } catch (e) {
      res.writeHead(400);
      return res.end("Bad request");
    }
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, path.normalize(p));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (!err) return send(res, 200, file, data);
      fs.readFile(path.join(root, "404.html"), (err2, page) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end("Not found");
        }
        send(res, 404, "404.html", page);
      });
    });
  })
  .listen(process.env.PORT || 8643, () => console.log("up"));
