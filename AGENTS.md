# Mel Store — agent notes

**Read first:** the platform rules in `C:\Users\HP\Desktop\Shortwork\AGENTS.md` (`../AGENTS.md` from here). They're canonical and override anything below.

- **Role:** the `store` service (`E-CommerceAPI-master/`). It owns products, stock, carts, orders, guest checkouts and the assistant (its own Atlas cluster). It reads EasyBuy prices only through EasyBuy's API.
- **Request log:** `E-CommerceAPI-master/Middleware/requestLog.ts`, mounted first in `mainApp.ts`. Keep its fields identical to the other services (rules §6). `morgan` is for local development only.
- **Database user:** in production, connect as `store_api` with `readWrite` on the store database only. See `Shortwork/SECURITY-LOCKDOWN.md`.
- **Roles:** this API uses lowercase `admin`/`superadmin`. Map auth's `Admin`/`SuperAdmin` in one place only (rules §4.4).
- **Web app:** `src/` is the storefront. It embeds in Melvin OS through `src/lib/melvinBridge.ts` (see melvin-os `AGENTS.md`). It only uses the OS token once its backend accepts it (`src/lib/bridgeGate.ts`): a 401 is treated as expiry once, and if the refreshed token is refused too the store goes back to its own login. `npm test` runs the gate's tests (`node --test`, no extra dependencies).
- **Tests:** `test/middleware.verify.test.js` needs `JWT_SECRET` set (any value) to pass. Two tests fail on `main` already: `capabilityRegistry searches products…` and `createProduct…`. They're about product names and images, not the platform work.
- **Calling EasyBuy (U2):** `utils/platformClients.ts` builds the service-token client from `AUTH_ISSUER`, `SERVICE_CLIENT_ID`, `SERVICE_CLIENT_SECRET` and `EASYBUY_API_URL`.
  - `utils/easyBuyCatalog.ts` reads EasyBuy's internal catalog (kobo) and converts it to naira for existing callers.
  - It falls back to the public catalog until the platform settings exist.
  - `fetchEasyBuyQuote` returns EasyBuy's quote in kobo.
- **Consuming events (U3):** when `AUTH_ISSUER`, `AUTH_JWKS_URL` and `RELAY_JWKS_URL` are set, the store mounts `/internal/events` (`utils/platformReceiver.ts`) and applies `easybuy.price.updated` into the read-only `easybuypricecache` (model `easyBuyPriceCache.ts`) — exactly once, in order, through the inbox transaction. The cache carries `source`/`sourceSeq`/`asOf` and is rebuildable by replaying events (never hand-written). The consumer test needs a replica set (27028).
- **Reseller programme (2026-10-26, branch `feat/reseller-programme`; `Shortwork/RESELLER-PLAN.md` §8a):**
  - **Fees:** vendor prices carry no markup. Orders get `subtotalKobo`, `deliveryFeeKobo` (the courier's quote), `serviceFeeKobo` (2.5 × delivery, never refunded) and `totalKobo`; `bill` is unchanged.
  - **`STORE_FEES_ENABLED`:** stays **off** until a real courier exists. `services/courier.ts` only has a MOCK provider (see `Shortwork/MOCK-DATA-REVIEW.md`).
  - **Quote route:** `POST /api/v1/delivery-quote` gives the web checkout its fee lines.
  - **Order lifecycle:** `PATCH /api/v1/orders/:orderId/status` (admin) with `mark_paid | complete | cancel | reject_at_delivery | refund`. It's a state machine of conditional updates; each step writes its `store.order.*` event in the same transaction when `EVENTS_ENABLED=true` (`utils/platformMessaging.ts`).
  - **Reseller read route:** `GET /internal/people/:personId/orders` (scope `store:orders.read`).
  - **Orders carry the buyer's `personId`,** taken from their account, never the body.
  - **Known bug, not fixed here:** `getCartProductId` recurses forever on a mongoose ObjectId (its `_id` is itself). The cancel compensation reads ids directly instead.

## Engineering Standards & Testing Discipline
1. **No Fake, Tautological, or Vacuous Tests:**
   - Never write tests that merely assert tautologies, mock out the very behaviors under test without exercising system logic, or exist solely to artificially inflate pass counts or coverage.
   - Tests must execute real application code paths, exercise genuine business logic, and validate actual state changes, edge cases, and failure modes against authoritative contracts and models.
   - Every test must be capable of failing if the code breaks or regresses.
2. **Error Handling & Information Leakage Prevention:**
   - Maintain disciplined, robust error handling across all layers.
   - Use explicit types, readable formatting, and sanitized user-facing errors.
   - **Zero leakage of sensitive internals:** Never expose stack traces, database errors, internal system paths, environment values, credentials, tokens, or sensitive user data in client responses or unauthenticated error payloads.
3. **Repository Documentation & CI/CD Synchronization:**
   - Each repository's `AGENTS.md` is self-contained and authoritative locally. Read it before starting work.
   - Maintain repository-specific `docs/` as the canonical documentation for that repository.
   - Keep repository `docs/`, `README.md`, secrets references, and deployment guides strictly synchronized after every change.
   - Maintain each repository's own GitHub Actions CI/CD workflows. Do not reintroduce a root git repository or root workflow without explicit user authorization.
   - When cross-repository layout changes occur, update the workspace overview accordingly.
   - Run relevant repository verification and affected shared contract checks before finishing.
   - Rebuild only affected consumers and verify health. Preserve composed identities, data volumes, existing credentials, and retained rollback histories.
4. **Hierarchical CI/CD Pipeline & Neo-Cloud Deployment Gating:**
   - Every repository must maintain its own dedicated GitHub Actions CI/CD workflow (`.github/workflows/ci-cd.yml`).
   - **System Build Verification:** Clean build of the application or service artifacts (`npm run build`, `tsc`, or container build) with zero unresolved errors or broken assets.
   - **Hierarchical Test Progression:** Tests must be structured and executed in strict hierarchical tiers:
     1. *Unit Tests*: Fast, isolated tests verifying pure functions, models, domain calculations, and finite state machines.
     2. *Integration Tests*: Component-level and database/cache/service integrations executing actual application code paths with genuine transactions and state changes.
     3. *End-to-End (E2E) & Contract Tests*: Full critical path flows and producer-consumer schema conformance tests against authoritative shared contracts.
   - **Code Quality & Disciplined Linting:** Enforce strict static analysis, type checking (`tsc --noEmit`), and linting rules across all commits and pull requests.
   - **Vulnerability & Dependency Auditing:** Automated security auditing of codebase and packages (`npm audit --audit-level=high`, `pip audit` for Python components, and vulnerability scanning). Detect, block, and resolve security advisories before artifact promotion.
   - **Gated Neo-Cloud Deployment:**
     - Deployments run only after build verification, quality linting, vulnerability audits, and all hierarchical test tiers succeed completely (100% green).
     - **Backends** (`unified-auth-service`, `EasybuytrackerBackend`, `store`, `reseller-service`, `invoice-service`, `whatsapp-backend`) deploy to **Railway**.
     - **Frontends** (`melvin-os`, `EasybuyFrontend`, `computer-village`) deploy to **Vercel**.
     - Shared contracts and libraries (`melvin-platform-kit`) run CI verification and contract validation prior to consumer usage.

## Bug Audit Output Location & Persistent Severity-Based QA Reporting
1. **Audit Output Location:**
   - Every repository must write all bug audit reports and findings exclusively to its own ignored `qa-report/bug-audit/` folder. Create it when needed.
   - **Explicit Exception to Documentation Placement:** Never write bug audits to `docs/` or any other documentation folder, `qa-reports/bug-audit/`, or directly to `qa-report/`. Keep audits component-local and preserve existing unrelated reports.
2. **Persistent Severity-Based QA Ledger:**
   - Keep active bugs, functional/UI issues, reliability gaps, and security vulnerabilities in the repository's ignored `qa-report/bug-audit/` directory, exclusively in four reusable severity files:
     - `Critical.md`: Immediate severe compromise or widespread irreversible loss.
     - `High.md`: Major security, authorization, financial, or core-workflow failures.
     - `Medium.md`: Material but limited-impact failures.
     - `Low.md`: Minor usability, visual, or low-impact defects.
   - Create this fixed set once and reuse it for all later audits. Do not create per-audit, per-date, per-feature, or per-issue Markdown reports, and never place audit findings in `docs/`.
   - Identify the issue category within the entry; all categories share these severity files.
   - If a severity file has no open issues, retain the reusable file with a brief statement: `No open issues`. Remove that statement when adding a new issue.
   - These files represent the cumulative active QA ledger, not a claim that untested areas have no bugs.
3. **Issue Entry Format & Discovery Timestamps:**
   - Give every new issue its own heading containing a clear title and its actual discovery date/time in Africa/Lagos, including the UTC offset:
     `## <Issue Title> — YYYY-MM-DD HH:mm WAT (UTC+01:00)`
   - Do not invent discovery timestamps for older findings. Preserve the original timestamp when updating an existing issue.
   - Each entry records:
     - Affected component / files or flow
     - Reproducible evidence (sanitized: never include credentials, tokens, or unnecessary personal information)
     - Actual impact
     - Verification criteria needed to close it
   - Update an existing entry for the same root cause instead of duplicating it on subsequent audits. Move the entry if its severity changes.
4. **Lifecycle & Closure Discipline:**
   - After fixing an issue and passing the relevant verification, delete that issue's entire section from its severity file, preserving unrelated open findings.
   - Do not keep resolved entries, strike-through histories, or duplicate fixed-issue reports in the active ledger.
   - Keep an issue open when verification is incomplete or blocked, and state what remains.
   - Publish and verify replacement severity entries before removing superseded audit reports. Remove fixed findings only after their relevant fix verification passes; retain unresolved or blocked findings with honest status. Consolidating historical reports must not invent discovery timestamps, convert acceptance gaps into confirmed exploits, or silently erase unresolved findings.
5. **Strict Directory Cleanliness:**
   - After every bug audit, `qa-report/bug-audit/` must contain **only** the four persistent severity files: `Critical.md`, `High.md`, `Medium.md`, and `Low.md`.
   - Do not retain any other files or subfolders there: no dated summaries, separate issue reports, screenshots, logs, JSON, traces, HTML, or evidence archives.
   - Temporary audit scratch output may be used while working, but remove audit-generated scratch artifacts before concluding. Do not relocate extra bug-audit reports/artifacts into `docs/` or another QA directory to evade this rule.
