import { test } from "node:test";
import assert from "node:assert/strict";
import { can, hasMinRole, resolvePermissions } from "../src/lib/access.ts";

// The store web app's copy of the access engine, evaluated exactly as `RequirePermission` and
// the three admin pages evaluate it. `src/lib/access.ts` is vendored verbatim from
// melvin-platform-kit; `node scripts/check-access-sync.mjs` at the workspace root proves it has
// not drifted, and this file proves the behaviour the store screens rely on.
//
// Run with `npm test` (Node runs the TypeScript directly).

test("a SuperAdmin reaches the admin screens", () => {
  // `/admin` used to sit under plain authentication, and the pages tested
  // `role === "admin" || role === "superadmin"`. A SuperAdmin passes either way; the old
  // lowercase comparison is what decided it, and the API now answers the same question.
  assert.equal(can({ role: "SuperAdmin" }, "store.admin.access"), true);
  assert.equal(hasMinRole({ role: "SuperAdmin" }, "Admin"), true);
});

test("an Admin reaches the admin screens and the catalog", () => {
  assert.equal(can({ role: "Admin" }, "store.admin.access"), true);
  assert.equal(can({ role: "Admin" }, "store.catalog.write"), true);
  assert.equal(can({ role: "Admin" }, "store.orders.manage"), true);
});

test("a customer can place an order and nothing staff-side", () => {
  assert.equal(can({ role: "User" }, "store.orders.create"), true);
  assert.equal(can({ role: "User" }, "store.admin.access"), false);
  assert.equal(can({ role: "User" }, "store.catalog.write"), false);
  assert.equal(can({ role: "User" }, "store.orders.manage"), false);
});

test("a stored or bridged role the app cannot read grants nothing", () => {
  // The bridge forwards a role string and the API returns one in the user record. Either is
  // attacker-influenced, so every unrecognised value must hide the admin shell rather than
  // render it with failing requests.
  for (const role of ["admin", "superadmin", "owner", "", "  Admin  ", 1, null, undefined, {}]) {
    assert.deepEqual(resolvePermissions({ role } as never), [], JSON.stringify(role) ?? "undefined");
    assert.equal(can({ role } as never, "store.admin.access"), false);
  }
  assert.equal(can(null, "store.admin.access"), false);
  assert.equal(hasMinRole(undefined, "User"), false);
});
