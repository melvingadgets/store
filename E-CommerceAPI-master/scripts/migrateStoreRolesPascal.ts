/**
 * migrate-store-roles-pascal — rewrite stored store roles to the canonical platform spelling.
 *
 * Before this, the store kept its own lowercase enum (`user | admin | superadmin`) while auth
 * and every other service used `User | Admin | SuperAdmin` (AGENTS.md §4.4). Two spellings of
 * one enum is what let `toStoreRole` exist at all, and it was the place a bad role quietly
 * became `user`.
 *
 * From now on the store stores and compares the canonical spelling only. Old store JWTs minted
 * before this carry the lowercase value and will stop satisfying `requirePermission` — so run
 * this and deploy the matching code back to back (see docs/rbac-unification.md, runbook).
 *
 * Idempotent: `User`/`Admin`/`SuperAdmin` rows are counted and left alone, so a second run
 * changes nothing. Anything unrecognised is reported and NOT rewritten — a value nobody
 * planned for is a question for a person, not something to guess at.
 *
 * Run (dry run first, and take a backup — this rewrites live `users.role`):
 *   node dist/scripts/migrateStoreRolesPascal.js --dry-run
 *   ...then drop --dry-run to write.
 *
 * Prints a before/after reconciliation count (§7.3). Never logs emails (§6.3).
 */
import mongoose from "mongoose";
import Db from "../database/database";
import userModel from "../model/userModel";

const DRY_RUN = process.argv.includes("--dry-run");

const CANONICAL = ["User", "Admin", "SuperAdmin"] as const;
type Canonical = (typeof CANONICAL)[number];

const LEGACY_MAP: Readonly<Record<string, Canonical>> = {
  user: "User",
  admin: "Admin",
  superadmin: "SuperAdmin",
};

/** Every distinct role value in the collection, with how many rows hold it. */
const roleCounts = async (): Promise<Array<{ role: unknown; count: number }>> => {
  const rows = await userModel.collection
    .aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    .toArray();
  return rows.map((row) => ({ role: row._id, count: row.count as number }));
};

const describe = (role: unknown): string =>
  role === undefined ? "(missing)" : role === null ? "(null)" : JSON.stringify(role);

const main = async () => {
  await Db;

  const before = await roleCounts();
  console.log(`${DRY_RUN ? "[dry run] " : ""}before: ${JSON.stringify(before.map((r) => [describe(r.role), r.count]))}`);

  let changed = 0;
  const unmapped: Array<{ role: unknown; count: number }> = [];

  for (const { role, count } of before) {
    if (typeof role === "string" && (CANONICAL as readonly string[]).includes(role)) {
      continue; // already canonical — idempotent
    }
    const target = typeof role === "string" ? LEGACY_MAP[role.trim().toLowerCase()] : undefined;
    if (!target) {
      unmapped.push({ role, count });
      continue;
    }
    console.log(`${DRY_RUN ? "[dry run] " : ""}${describe(role)} -> ${target}: ${count} row(s)`);
    if (!DRY_RUN) {
      const result = await userModel.collection.updateMany({ role }, { $set: { role: target } });
      changed += result.modifiedCount;
    } else {
      changed += count;
    }
  }

  const after = DRY_RUN ? null : await roleCounts();
  if (after) {
    console.log(`after:  ${JSON.stringify(after.map((r) => [describe(r.role), r.count]))}`);
  }
  console.log(`${DRY_RUN ? "would change" : "changed"}: ${changed} row(s)`);

  if (unmapped.length > 0) {
    // Not a silent pass: these rows cannot satisfy a `requirePermission` check, so their
    // owners are locked out until a person decides what they should be.
    console.error(
      `unmapped role values left untouched (someone must decide these): ${JSON.stringify(
        unmapped.map((r) => [describe(r.role), r.count]),
      )}`,
    );
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`migrate-store-roles-pascal failed: ${error instanceof Error ? error.message : String(error)}`);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
