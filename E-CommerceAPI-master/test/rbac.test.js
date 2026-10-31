const test = require("node:test");
const assert = require("node:assert/strict");

const { requirePermission } = require("@melvingadgets/platform-kit");
const userRouter = require("../dist/router/userRouter").default;
const productRouter = require("../dist/router/productRouter").default;
const orderRouter = require("../dist/router/orderRouter").default;
const { getRouteLayer, createMockRequest, createMockResponse, createNextSpy } = require("./helpers/testUtils");

// The store half of the RBAC rollout (docs/rbac-unification.md, Phase 3).
//
// `requireAdmin` compared lowercase role strings, so a `SuperAdmin` got 403 on every admin
// route — `"SuperAdmin" !== "superadmin"`. Every one of those routes now names a permission
// from the kit, and `SuperAdmin` inherits `Admin`, so the lockout cannot come back.

/** Runs the guard mounted on a route, with `role` as the verified caller's role. */
const runGuard = (router, pathName, method, role) => {
  const layer = getRouteLayer(router, pathName);
  assert.ok(layer, `no route ${method.toUpperCase()} ${pathName}`);
  const guard = layer.route.stack
    .filter((stackLayer) => stackLayer.method === method)
    .map((stackLayer) => stackLayer.handle)
    .find((handle) => typeof handle === "function" && handle.permission !== undefined);
  assert.ok(guard, `no permission guard on ${method.toUpperCase()} ${pathName}`);

  const req = createMockRequest({ user: role === undefined ? undefined : { _id: "someone", role } });
  const res = createMockResponse();
  const next = createNextSpy();
  guard(req, res, next);
  return { res, next };
};

const DENIED = { message: "Access denied" };

test("a SuperAdmin is never locked out of an Admin route", () => {
  for (const [router, path, method] of [
    [userRouter, "/all-users", "get"],
    [userRouter, "/admin/user-sessions", "get"],
    [productRouter, "/products/:id/storage-options", "put"],
    [orderRouter, "/orders/:orderId/status", "patch"],
  ]) {
    const { res, next } = runGuard(router, path, method, "SuperAdmin");
    assert.equal(next.called(), true, `SuperAdmin refused ${method.toUpperCase()} ${path}`);
    assert.equal(res.body, undefined);
  }
});

test("an Admin still passes every Admin route", () => {
  const { res, next } = runGuard(userRouter, "/all-users", "get", "Admin");
  assert.equal(next.called(), true);
  assert.equal(res.body, undefined);
});

test("an ordinary customer is refused staff routes with 403", () => {
  for (const [router, path, method] of [
    [userRouter, "/all-users", "get"],
    [productRouter, "/products/:id/storage-options", "put"],
    [orderRouter, "/orders/:orderId/status", "patch"],
  ]) {
    const { res, next } = runGuard(router, path, method, "User");
    assert.equal(next.called(), false, `User allowed into ${method.toUpperCase()} ${path}`);
    assert.deepEqual(res.body, DENIED);
    assert.equal(res.statusCode, 403);
  }
});

test("an unverified caller is a 401, never a 403 or a default role", () => {
  const { res, next } = runGuard(userRouter, "/all-users", "get", undefined);
  assert.equal(next.called(), false);
  assert.equal(res.statusCode, 401);
});

test("a role the store cannot read is refused, not treated as a customer", () => {
  for (const role of ["admin", "superadmin", "owner", "", 1, null, {}]) {
    const { res, next } = runGuard(userRouter, "/all-users", "get", role);
    assert.equal(next.called(), false, `role ${JSON.stringify(role)} was allowed`);
    assert.equal(res.statusCode, 403);
  }
});

test("checkout is open to an ordinary customer and closed to a missing identity", () => {
  assert.equal(runGuard(orderRouter, "/order-checkout", "post", "User").next.called(), true);
  assert.equal(runGuard(orderRouter, "/order-checkout", "post", undefined).res.statusCode, 401);
});

test("every guard on a staff route names a store permission", () => {
  // A route gated on a permission from another service would pass the wrong callers; this
  // catches a copy-paste from an EasyBuy or market route.
  for (const [router, path, method] of [
    [userRouter, "/all-users", "get"],
    [productRouter, "/products/:id/storage-options", "put"],
    [orderRouter, "/orders/:orderId/status", "patch"],
    [orderRouter, "/order-checkout", "post"],
  ]) {
    const layer = getRouteLayer(router, path);
    const guard = layer.route.stack
      .filter((stackLayer) => stackLayer.method === method)
      .map((stackLayer) => stackLayer.handle)
      .find((handle) => handle.permission !== undefined);
    const permissions = [].concat(guard.permission);
    for (const permission of permissions) {
      assert.match(permission, /^store\./, `${method.toUpperCase()} ${path} needs a store permission, got ${permission}`);
    }
  }
});
