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
