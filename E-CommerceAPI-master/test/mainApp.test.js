const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");

const { mainApp } = require("../dist/mainApp");

function request(server, routePath) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: routePath,
        method: "GET",
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body,
            headers: res.headers,
          });
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

test("mainApp serves the API readiness and health endpoints", async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", path.resolve(process.cwd(), "Views"));
  mainApp(app);

  const server = await new Promise((resolve) => {
    const activeServer = app.listen(0, () => resolve(activeServer));
  });

  try {
    const apiResponse = await request(server, "/api");
    const healthResponse = await request(server, "/health");

    assert.equal(apiResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(apiResponse.body), {
      success: 1,
      message: "api is ready",
    });
    assert.equal(healthResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(healthResponse.body), {
      success: 1,
      message: "ok",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("mainApp renders the verification view route", async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", path.resolve(process.cwd(), "Views"));
  mainApp(app);

  const server = await new Promise((resolve) => {
    const activeServer = app.listen(0, () => resolve(activeServer));
  });

  try {
    const response = await request(server, "/page/data/user-123");

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Linda/);
    assert.match(response.body, /user-123/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
