// The app shares the website's words, cottages and formatting code (frontend/src),
// so Metro watches that folder too. Imports "@/…" look in mobile/src first, then in
// frontend/src (see tsconfig.json).
const http = require("http");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../frontend/src")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

// While developing, the app calls Django through Metro itself: /api/ and /media/ on Metro's
// address go on to Django on this Mac. A phone or emulator that can load the app can then
// always sign in, whatever the network, firewall or tunnel (see src/api.ts).
const DJANGO = new URL(process.env.RANTIO_API_TARGET || "http://127.0.0.1:8100");
const PROXIED = /^\/(api|media)\//;

function toDjango(req, res) {
  const upstream = http.request(
    { hostname: DJANGO.hostname, port: DJANGO.port, path: req.url, method: req.method, headers: { ...req.headers, host: DJANGO.host } },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Rantio's server isn't running on this Mac. Start it with ./dev.sh in ~/stugora." }));
  });
  req.pipe(upstream);
}

const enhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const next = enhance ? enhance(middleware, server) : middleware;
    return (req, res, fallThrough) => (PROXIED.test(req.url || "") ? toDjango(req, res) : next(req, res, fallThrough));
  },
};

module.exports = config;
