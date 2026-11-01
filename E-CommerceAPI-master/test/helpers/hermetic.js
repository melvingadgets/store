// Preloaded by `npm test` (node --require) so the suite can never reach a live service.
// config/env.ts defaults the EasyBuy catalog to production EasyBuy, and controllers that present
// catalog images (cart, products, the assistant) call it. Point it at a closed local port unless a
// test sets it on purpose; a test that needs a catalog stubs fetchPublicEasyBuyCatalog or starts
// its own fake server (easyBuyCatalog.platform.test.js).
process.env.EASYBUY_TRACKER_BASE_URL ??= "http://127.0.0.1:9";
