/**
 * migrate-store — link existing store users to their auth-service personId.
 *
 * Once the store accepts unified tokens, a token carries the personId. Legacy
 * store rows have their own _id, so this stamps `personId` on each, matched by
 * email through the auth ADMIN API — never by reading auth's database
 * (Shortwork/AGENTS.md §1, BACKEND-UNIFICATION §12.4). First unified logins are
 * also linked lazily by the Verify middleware; this is the bulk/offline pass.
 *
 * Run (dry run first; back up live data before the real run):
 *   AUTH_ISSUER=... AUTH_ADMIN_TOKEN=<admin access token> \
 *     node dist/scripts/migrateStore.js --dry-run
 *   ...then drop --dry-run to write.
 *
 * Prints a before/after reconciliation count (§7.3). Never logs emails (§6.3).
 */
import mongoose from "mongoose";
import Db from "../database/database";
import { env } from "../config/env";
import userModel from "../model/userModel";

const DRY_RUN = process.argv.includes("--dry-run");
const adminToken = String(process.env.AUTH_ADMIN_TOKEN ?? "").trim();

type AuthServiceUser = { _id: string; email: string; role: string };

const findAuthUserByEmail = async (email: string): Promise<AuthServiceUser | null> => {
  const base = env.platform.authIssuer;
  if (!base) throw new Error("AUTH_ISSUER is required");
  const url = new URL("/api/v1/auth/admin/users", `${base}/`);
  url.searchParams.set("search", email);
  url.searchParams.set("limit", "50");
  url.searchParams.set("page", "1");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`auth admin lookup failed (${response.status})`);
  }
  const body = (await response.json()) as { data?: AuthServiceUser[] };
  const candidates = Array.isArray(body.data) ? body.data : [];
  return candidates.find((candidate) => candidate.email.toLowerCase() === email) ?? null;
};

async function run(): Promise<void> {
  if (!adminToken) {
    throw new Error("AUTH_ADMIN_TOKEN is required: an auth-service Admin/SuperAdmin access token used to look users up by email");
  }

  console.log(`Connecting to store database${DRY_RUN ? " (dry run)" : ""}...`);
  await Db;

  const totalBefore = await userModel.countDocuments({});
  const linkedBefore = await userModel.countDocuments({ personId: { $ne: null } });

  const pending = await userModel
    .find({ email: { $exists: true, $ne: null }, $or: [{ personId: null }, { personId: { $exists: false } }] })
    .select({ _id: 1, email: 1 })
    .lean();

  console.log(`Users total: ${totalBefore}, already linked: ${linkedBefore}, to check: ${pending.length}`);

  let linked = 0;
  let notFound = 0;
  let conflicts = 0;
  let lookupErrors = 0;

  for (const row of pending) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;

    let authUser: AuthServiceUser | null = null;
    try {
      authUser = await findAuthUserByEmail(email);
    } catch (error) {
      lookupErrors++;
      console.error(`  ! lookup failed for user ${String(row._id)}: ${(error as Error).message}`);
      continue;
    }

    if (!authUser) {
      notFound++;
      continue;
    }

    const owner = await userModel.findOne({ personId: authUser._id }).select({ _id: 1 }).lean();
    if (owner && String(owner._id) !== String(row._id)) {
      conflicts++;
      console.warn(`  ~ conflict: personId ${authUser._id} already linked to ${String(owner._id)} (skipping ${String(row._id)})`);
      continue;
    }

    if (!DRY_RUN) {
      await userModel.updateOne({ _id: row._id }, { $set: { personId: authUser._id } });
    }
    linked++;
  }

  const linkedAfter = DRY_RUN ? linkedBefore : await userModel.countDocuments({ personId: { $ne: null } });

  console.log("── reconciliation ──────────────────────────────");
  console.log(`  linked ${DRY_RUN ? "(would link)" : ""}: ${linked}`);
  console.log(`  no auth user found:               ${notFound}`);
  console.log(`  personId conflicts (skipped):     ${conflicts}`);
  console.log(`  lookup errors:                    ${lookupErrors}`);
  console.log(`  linked before → after:            ${linkedBefore} → ${linkedAfter}`);
  console.log("────────────────────────────────────────────────");

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  void mongoose.disconnect().finally(() => process.exit(1));
});
