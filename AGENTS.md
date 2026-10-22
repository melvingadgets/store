# Mel Store — agent notes

**Read first:** the platform rules in `C:\Users\HP\Desktop\Shortwork\AGENTS.md` (`../AGENTS.md` from here). They're canonical and override anything below.

- **Role:** the `store` service (`E-CommerceAPI-master/`). It owns products, stock, carts, orders, guest checkouts and the assistant (its own Atlas cluster). It reads EasyBuy prices only through EasyBuy's API.
- **Request log:** `E-CommerceAPI-master/Middleware/requestLog.ts`, mounted first in `mainApp.ts`. Keep its fields identical to the other services (rules §6). `morgan` is for local development only.
- **Database user:** in production, connect as `store_api` with `readWrite` on the store database only. See `Shortwork/SECURITY-LOCKDOWN.md`.
- **Roles:** this API uses lowercase `admin`/`superadmin`. Map auth's `Admin`/`SuperAdmin` in one place only (rules §4.4).
- **Web app:** `src/` is the storefront. It embeds in Melvin OS through `src/lib/melvinBridge.ts` (see melvin-os `AGENTS.md`).
- **Tests:** `test/middleware.verify.test.js` needs `JWT_SECRET` set (any value) to pass.
