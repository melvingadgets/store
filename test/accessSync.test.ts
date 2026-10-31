import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// `src/lib/access.ts` is a byte-identical copy of `melvin-platform-kit/src/access.ts`. A stale
// copy is a silent authorization bug: an admin screen hidden from someone who holds the
// permission, or shown to someone whose API calls all come back 403. The workspace script
// recomputes the hash kept in the copy's header.
//
// Standalone checkouts of this repo have no sibling kit, so the check is skipped there.

const script = resolve(import.meta.dirname, "../../scripts/check-access-sync.mjs");

test("src/lib/access.ts is an unmodified copy of the kit's access.ts", (t) => {
  if (!existsSync(script)) {
    t.skip("workspace checkout not present — run from Shortwork to verify");
    return;
  }

  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ok\s+store\/src\/lib\/access\.ts/);
});
