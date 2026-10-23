const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { execFile } = require("node:child_process");

// U2: the store reads EasyBuy's catalog with a service token (Shortwork/AGENTS.md §2) and
// falls back to the public catalog if that fails. Each scenario runs in its own process,
// because the platform clients are built from the environment when the module loads.

const startFakePlatform = async (internalStatus) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/oauth/token") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        seen[seen.length - 1].form = Object.fromEntries(new URLSearchParams(body));
        res.end(JSON.stringify({ access_token: "svc-token", token_type: "Bearer", expires_in: 300 }));
      });
      return;
    }
    if (req.url.startsWith("/api/v1/internal/catalog")) {
      res.statusCode = internalStatus;
      res.end(
        JSON.stringify({
          provider: "aurapay",
          unit: "kobo",
          models: [{ model: "iPhone 13", imageUrl: "x", capacities: ["128GB"], allowedPlans: ["Weekly"], downPaymentPercentage: 40, pricesByCapacity: { "128GB": 42000050 } }],
          planRules: { monthlyDurations: [1], weeklyDurations: [8], monthlyMarkupMultipliers: { 1: 1.2 }, weeklyMarkupMultipliers: { 8: 1.4 } },
        }),
      );
      return;
    }
    if (req.url.startsWith("/api/v1/public/easybuy-catalog")) {
      res.end(JSON.stringify({ data: { models: [{ model: "public-fallback", pricesByCapacity: {} }], planRules: {} } }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, seen, base: `http://127.0.0.1:${server.address().port}` };
};

const runCatalogFetch = (base) =>
  new Promise((resolve, reject) => {
    const modulePath = path.resolve(__dirname, "../dist/utils/easyBuyCatalog.js");
    execFile(
      process.execPath,
      ["-e", `require(${JSON.stringify(modulePath)}).fetchPublicEasyBuyCatalog().then((c) => process.stdout.write(JSON.stringify(c)))`],
      {
        env: {
          ...process.env,
          AUTH_ISSUER: base,
          SERVICE_CLIENT_ID: "svc-store",
          SERVICE_CLIENT_SECRET: "store-secret",
          EASYBUY_API_URL: base,
          EASYBUY_TRACKER_BASE_URL: base,
        },
        timeout: 20_000,
      },
      (error, stdout) => (error ? reject(error) : resolve(JSON.parse(stdout))),
    );
  });

test("reads the catalog with a service token and converts kobo back to naira", async () => {
  const { server, seen, base } = await startFakePlatform(200);
  try {
    const catalog = await runCatalogFetch(base);
    assert.equal(catalog.models[0].pricesByCapacity["128GB"], 420000.5);
    const tokenRequest = seen.find((call) => call.url === "/oauth/token");
    assert.equal(tokenRequest.form.grant_type, "client_credentials");
    assert.equal(tokenRequest.form.audience, "easybuy");
    assert.equal(tokenRequest.form.scope, "easybuy:catalog.read");
    const catalogRequest = seen.find((call) => call.url.startsWith("/api/v1/internal/catalog"));
    assert.equal(catalogRequest.authorization, "Bearer svc-token");
    assert.equal(seen.some((call) => call.url.startsWith("/api/v1/public")), false);
  } finally {
    server.close();
  }
});

test("falls back to the public catalog when the service-token call fails", async () => {
  const { server, seen, base } = await startFakePlatform(403);
  try {
    const catalog = await runCatalogFetch(base);
    assert.equal(catalog.models[0].model, "public-fallback");
    assert.ok(seen.some((call) => call.url.startsWith("/api/v1/public/easybuy-catalog")));
  } finally {
    server.close();
  }
});
