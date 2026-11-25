# Mel Store

This README reflects the work implemented after the previous commit. The backend is now treated as the source of truth for store data and assistant behavior, and the assistant/admin experience has been expanded significantly.

## Overview

The project now includes:

- a backend-owned AI assistant tool system with verified tool coverage
- backend-first swap, pricing, product, and image behavior
- Paystack checkout, server-side transaction verification, and HMAC-SHA512 webhook settlement for signed-in and guest orders
- user session telemetry with admin visibility
- dedicated admin session monitoring routes and UI
- custom error boundary and 404 handling
- deployed SPA rewrite support for Vercel
- a redesigned assistant chat experience with structured replies and incremental rendering

## Assistant

### Tooling and access

- The assistant has access to all 12 registered backend tools.
- The OpenAI provider path, registry exposure, and tool execution path are wired end-to-end in the backend.
- Direct test coverage was added for the full assistant tool registry.

Registered tools:

- `evaluate_swap`
- `search_products`
- `get_product_details`
- `get_product_pricing_options`
- `compare_products`
- `find_best_match_product`
- `check_product_availability`
- `get_swap_requirements`
- `estimate_swap_from_partial_info`
- `explain_swap_result`
- `get_swap_eligible_models`
- `get_swap_policy_info`

### Prompt and policy rules

- Product and swap facts are backend-tool-backed.
- Unsupported actions are declined quickly.
- Low-confidence tool routing escalates instead of guessing.
- Unsupported or uncertain requests are directed to admin on `+2347086758713`.

### Assistant response contract

The backend assistant response now includes structured metadata:

- `reply`
- `intent`
- `usedTools`
- `confidence`
- `kind`
- `quickReplies`
- `handoff`

Confidence tiers:

- `high`
- `medium`
- `low`

Reply kinds:

- `product_answer`
- `swap_answer`
- `clarifier`
- `handoff`
- `general_answer`

### Assistant UX improvements

- Incremental assistant rendering was added through a stream endpoint.
- Clean admin handoff cards are shown for unsupported or uncertain cases.
- Clarifying replies can expose quick-reply chips.
- Product pages preload relevant quick prompts.
- The last user message can be edited and resent as a corrected turn.
- The assistant was redesigned as a mobile-first bottom sheet.
- The chat header and composer are anchored while the message area is the intended scroll region.

### Assistant context handling

- Assistant sessions are persisted in MongoDB by `sessionId` and `userId`.
- Session messages, intent, context, and tool calls are stored.
- The assistant now loads the last `10` messages from the active session as model context.
- Route and product context are injected at runtime so short follow-up questions can resolve against the current product.

### Important note on streaming

- The UI now renders the assistant reply incrementally from the stream endpoint.
- This is not yet true provider-token streaming from OpenAI.
- The backend still completes the assistant response first, then emits deltas to the UI.

## Backend as Source of Truth

Frontend logic that already had a backend equivalent was removed aggressively and replaced with backend-owned data.

### Swap flow

- A backend `swap/metadata` endpoint now owns swap metadata.
- The swap page consumes backend-supported models, capacities, defaults, and condition labels.
- Redundant frontend swap catalog/config logic was removed.

### Product/catalog behavior

- The storefront now renders backend product data directly instead of recomputing catalog overlays on the client.
- Product, cart, checkout, history, and order confirmation pages rely on backend values for display data.

### Images

- Backend responses now prefer image URLs from the EasyBuy backend where a catalog match exists.
- This avoids broken local upload URLs leaking into deployed storefront views.

## Admin and Session Tracking

### User session telemetry

The system now tracks user session presence and telemetry in the backend, including:

- login time
- last seen time
- logout time
- session status
- IP address
- user agent
- browser
- OS
- platform
- device type
- language
- timezone
- screen details
- referrer
- UTM data

Tracked session statuses include:

- `online`
- `idle`
- `offline`
- `logged_out`
- `expired`

### Presence behavior

- Login creates a tracked backend session.
- Frontend presence updates send heartbeats and state changes.
- Logout now marks the session as logged out in the backend.
- Offline state is inferred through presence timeout and lifecycle signals.

### Admin visibility

Backend admin endpoints were added for:

- `GET /api/v1/admin/user-sessions`
- `GET /api/v1/admin/user-sessions/summary`

Frontend admin routes now include:

- `/admin`
- `/menu`
- `/admin/sessions`

The admin UI includes:

- user presence overview
- recent session records
- live status information
- a dedicated session page
- direct navigation links to the session monitoring area

## Error Handling and Routing

### Error boundaries

- A router-level error boundary page was added.
- Route/render failures now fall back to a custom error screen instead of failing silently.

### 404 handling

- A dedicated custom 404 page was added for unmatched client-side routes.
- A Vercel SPA rewrite was added so deployed direct-route visits resolve to `index.html` before React Router handles them.

This prevents host-level `404: NOT_FOUND` responses for valid SPA routes after deploy.

## Assistant and Admin Discoverability

- Admin session monitoring was extracted into its own discoverable route: `/admin/sessions`.
- Direct links were added from the admin dashboard and admin account page.
- The admin dashboard includes shortcuts to session and assistant timing areas.

## Tests and Verification

Verified during implementation:

- backend test suite passed: `121/121`
- frontend type-check passed: `npm.cmd exec tsc -b`
- frontend production build passed: `npm.cmd run build`

Notes:

- PowerShell on this machine requires `npm.cmd` instead of `npm`.
- The frontend build still emits an existing unrelated CSS minifier warning.

## Run Commands

Frontend:

```powershell
npm.cmd install
npm.cmd run dev
```

Backend:

```powershell
cd E-CommerceAPI-master
npm.cmd install
npm.cmd run dev
```

Frontend production build:

```powershell
npm.cmd run build
```

Backend test suite:

```powershell
cd E-CommerceAPI-master
npm.cmd test
```

## Current Caveats

- Incremental assistant rendering is implemented, but true provider-token streaming is still pending.
- Offline detection is inferred rather than guaranteed, which is the normal browser limitation.
- Assistant latency is still dominated by model turns, especially on multi-turn tool flows.
