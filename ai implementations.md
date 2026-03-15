# AI Implementations

Last updated: 2026-03-15

## Purpose
This file is the persistent implementation tracker for AI work in this project.

Use it for:
- prioritizing AI features
- recording what has already been implemented
- showing what is next
- regaining context quickly after compaction or a new session

## Current Status
Overall phase: `P2 complete`

Current stop point:
- backend AI foundation is implemented and tested
- frontend chat is wired to the real backend assistant endpoint
- only logged-in users can chat with AI
- assistant conversations are linked to authenticated user ids
- P1 sales/product assistant tools are implemented
- P2 trade-in conversation tools are implemented
- assistant tools now build on shared product and swap foundation helpers so future logic changes stay synchronized
- assistant product tools now use the same backend product read foundation as storefront product endpoints
- EasyBuy/payment-plan assistant functions are intentionally deferred

Recommended next start:
- improve P4 data/catalog quality
- then add P5 conversion and operations features
- then add P6 reliability and cost controls

## Implemented Now

### P0. Backend AI Foundation
Status: `implemented`

What exists:
- backend assistant endpoint: `POST /api/v1/assistant/message`
- backend-only orchestration service
- OpenAI-first provider integration
- MongoDB assistant session storage
- internal backend tool registry
- backend-controlled tool execution
- AI env config placeholders in backend `.env` and `.env.example`
- tests covering route, controller, service flow, tool registry, and env parsing

Implemented backend pieces:
- `assistantRouter`
- `assistantController`
- `assistantService`
- `openAiProvider`
- `toolRegistry`
- `assistantSession` Mongo model

Implemented tools:
- `evaluate_swap`
- `search_products`
- `get_product_details`
- `get_swap_requirements`

Important rules already enforced:
- AI does not calculate swap values itself
- backend remains the source of truth
- AI does not update the swap page UI
- tools are internal backend functions, not public browser actions

## Priority Features

### P1. Sales and Product Answers
Priority: `high`
Goal: make the assistant useful for real customer buying questions

Features:
- [x] `get_product_pricing_options`
  - answer storage-specific pricing questions
  - include stock and variant pricing
- [x] `compare_products`
  - compare two products using stored facts only
- [x] `find_best_match_product`
  - shortlist products based on budget or preference
- [x] `check_product_availability`
  - answer stock and variant availability questions cleanly

Why this phase matters:
- this is the fastest path to a useful sales assistant
- these questions are likely higher-frequency than advanced AI features

### P2. Trade-In Conversation Quality
Priority: `high`
Goal: make trade-in conversations smoother without exposing raw valuation logic

Features:
- [x] `estimate_swap_from_partial_info`
  - collect only missing fields
  - do not force all details upfront
- [x] `explain_swap_result`
  - translate backend valuation output into customer-friendly language
- [x] `get_swap_eligible_models`
  - answer whether a device is eligible for trade-in
- [x] `get_swap_policy_info`
  - explain inspection, estimate validity, and final confirmation rules

Why this phase matters:
- improves trust and reduces friction in trade-in conversations

### P3. Frontend Integration
Priority: `high`
Goal: connect the current chat UI to the real backend assistant

Features:
- [x] replace dummy frontend assistant replies with backend API calls
- [x] store and reuse `sessionId` on the frontend
- [x] pass route and `productId` context to the backend
- [x] render backend `reply` only
- [x] do not let the frontend invent business answers
- [x] restrict AI chat to logged-in users only

Rules for this phase:
- frontend remains a chat client only
- backend owns AI orchestration
- backend owns truth for swap and product answers

### Deferred. EasyBuy and Payment Functions
Priority: `deferred`
Goal: add financing and EasyBuy-specific assistant capability later

Features:
- [ ] `get_payment_plan_options`
  - answer weekly/monthly/down-payment questions
  - use backend pricing and EasyBuy rules only
- [ ] EasyBuy assistant functions
  - any financing-specific or installment-specific tools

Why deferred:
- current focus is only swap estimator and product enquiries
- these functions should be added after the core assistant flow is stable

### P4. Data and Catalog Quality
Priority: `medium`
Goal: improve answer quality by improving structured product data

Features:
- [ ] normalize product specification fields
  - chipset
  - battery summary
  - camera summary
  - display size
  - refresh rate
  - colors
- [x] create a shared backend product read service
- [ ] unify product pricing source selection
- [ ] improve category and keyword mapping for search

Why this phase matters:
- tool quality is limited by the quality of product data

### P5. Conversion and Operations
Priority: `medium`
Goal: turn useful answers into measurable business outcomes

Features:
- [ ] lead capture from chat
- [ ] handoff to human support
- [ ] admin chat review dashboard
- [ ] assistant analytics
  - intent frequency
  - tool usage
  - tool failure rate
  - fallback rate
- [ ] save common unanswered customer questions

Why this phase matters:
- helps the assistant generate operational value, not just chat replies

### P6. Reliability, Cost, and Performance
Priority: `medium`
Goal: make the assistant stable and affordable in production

Features:
- [ ] Redis cache for repeated tool results
- [ ] rate limiting for assistant endpoint
- [ ] prompt/version tracking
- [ ] structured logging for tool calls and failures
- [ ] retry and timeout policy for AI provider calls
- [ ] cost and token tracking

Why this phase matters:
- prevents scale and cost problems later

### P7. Advanced AI Features
Priority: `low`
Goal: expand assistant capability after core business flows are solid

Features:
- [ ] image-assisted trade-in support
- [ ] multilingual support
- [ ] streaming responses
- [ ] richer recommendation logic
- [ ] proactive follow-up workflows

Why this phase matters:
- useful later, but not the first priority

## Current Tool Inventory
These tools are available right now:

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

These are the next recommended tools to build:
1. normalize product specification fields
2. unify product pricing source selection
3. add assistant analytics
4. add Redis caching for repeated assistant tool results
5. add human support handoff

## Backend AI Contract
Current public API:
- `POST /api/v1/assistant/message`

Expected request:
- `sessionId?`
- `message`
- `userContext?`
  - `productId?`
  - `route?`

Expected response:
- `sessionId`
- `reply`
- `intent`
- `usedTools`

## Environment Variables
Backend AI env keys already added:
- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_BASE_URL`

## Resume Context Checklist
When resuming work after compaction or a new session:

1. Read this file first.
2. Confirm whether `P0 foundation complete` is still true.
3. Confirm whether frontend has already been wired to the backend assistant.
4. Check whether any new tools have been added after the four current ones.
5. Confirm the assistant product/swap foundation helpers are still the shared source used by the tool registry.
6. Continue from the highest-priority unchecked feature unless the user changes direction.

## Implementation Log

### 2026-03-14
Completed:
- backend assistant foundation
- OpenAI provider integration
- assistant session persistence in MongoDB
- internal backend tool registry
- five assistant tools

### 2026-03-15
Completed:
- shared assistant product foundation helper
- shared assistant swap foundation helper
- `compare_products`
- `find_best_match_product`
- `check_product_availability`
- `estimate_swap_from_partial_info`
- `explain_swap_result`
- `get_swap_eligible_models`
- `get_swap_policy_info`
- prompt inventory updated for new tools
- backend tests expanded for P1 and P2
- `get_product_pricing_options`
- backend tests for assistant route, controller, service, tools, and env config

Not completed:
- frontend integration to real assistant API
- additional product and swap-conversation tools
- EasyBuy and payment-plan tools
- lead capture, analytics, Redis caching, and advanced AI features

### 2026-03-15
Completed:
- frontend chat now calls the backend assistant endpoint
- frontend persists backend `sessionId`
- frontend passes route and product context to backend
- dummy frontend assistant reply logic removed
- AI chat restricted to authenticated users
- backend assistant route protected by auth
- assistant session lookup is scoped by authenticated user id
- backend AI model changed to `gpt-5-mini`
- backend OpenAI provider migrated from Chat Completions API to Responses API
- backend prompt architecture scaffolded into markdown files and startup-loaded instructions

Not completed:
- additional product and swap-conversation tools
- prompt contents are still intentionally empty
- EasyBuy and payment-plan tools
- lead capture, analytics, Redis caching, and advanced AI features
