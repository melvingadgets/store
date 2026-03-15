# Make Assistant Faster

Last updated: 2026-03-15

## Purpose
This file tracks the assistant speed and accuracy work so context can be recovered later without rereading the whole codebase.

Use it to answer:
- what was changed
- why it was changed
- which files carry the current behavior
- what is already verified
- what still remains

## Goal
Make assistant replies faster and more accurate by:
1. measuring backend timing
2. lowering model latency
3. caching repeatable tool results
4. caching repeatable tool results
5. reducing prompt/history payload
6. templating deterministic replies
7. improving product matching quality
8. tightening tool boundaries
9. asking direct clarifying questions earlier
10. keeping swap explanations high-level and backend-shaped

## Current Status
Overall status: `implemented`

Verified:
- backend tests pass
- frontend build passes

## Implemented Changes

### 1. Lowered model reasoning effort
Status: `implemented`

What changed:
- OpenAI `Responses` requests now use `reasoning.effort = "low"`

Implemented in:
- `E-CommerceAPI-master/assistant/openAiProvider.ts`

### 2. Added backend timing logs
Status: `implemented`

What it logs:
- session lookup
- fast-path attempt
- provider setup
- each provider turn
- each tool execution
- session save
- total request time

Implemented in:
- `E-CommerceAPI-master/assistant/assistantService.ts`

Output shape:
- JSON `console.info` log with `type = "assistant_timing"`

### 3. Added TTL cache for repeatable tool responses
Status: `implemented`

What it caches:
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

Implemented in:
- `E-CommerceAPI-master/assistant/toolRegistry.ts`

Cache details:
- TTL: `60 seconds`
- max entries: `250`
- key: normalized tool name + arguments + route/product context

### 4. Reduced context sent to OpenAI
Status: `implemented`

What changed:
- history reduced to last `6` messages
- each message is compacted and truncated before being sent to the model

Implemented in:
- `E-CommerceAPI-master/assistant/assistantService.ts`

### 5. Improved product matching and normalization
Status: `implemented`

What changed:
- keyword alias expansion for common customer vocabulary
- improved search token expansion
- better searchable product text composition
- stronger ranking signals for best-match results

Implemented in:
- `E-CommerceAPI-master/assistant/productFoundation.ts`

Examples:
- `phone` expands to `phones`, `smartphone`, `iphone`, `device`
- `cheap` expands to `budget`, `affordable`, `under`
- `camera` expands to related photo terms

### 6. Tightened tool boundaries
Status: `implemented`

What changed:
- prompts now explicitly prefer backend tools or backend-shaped clarifying questions before freeform reasoning
- product facts must go through the tool path first

Implemented in:
- `E-CommerceAPI-master/assistant/prompts/rules.md`
- `E-CommerceAPI-master/assistant/prompts/output.md`
- `E-CommerceAPI-master/assistant/prompts/examples.md`

### 7. Kept swap explanations high-level and templated
Status: `implemented`

What changed:
- swap explanations remain backend-built and customer-safe
- no internal mechanics are exposed

Implemented in:
- `E-CommerceAPI-master/assistant/swapFoundation.ts`
- `E-CommerceAPI-master/assistant/toolRegistry.ts`
- assistant prompt files

## Files Changed In This Pass
- `E-CommerceAPI-master/assistant/assistantService.ts`
- `E-CommerceAPI-master/assistant/timingTelemetry.ts`
- `E-CommerceAPI-master/assistant/openAiProvider.ts`
- `E-CommerceAPI-master/assistant/toolRegistry.ts`
- `E-CommerceAPI-master/assistant/productFoundation.ts`
- `E-CommerceAPI-master/controller/assistantController.ts`
- `E-CommerceAPI-master/router/assistantRouter.ts`
- `E-CommerceAPI-master/assistant/prompts/rules.md`
- `E-CommerceAPI-master/assistant/prompts/output.md`
- `E-CommerceAPI-master/assistant/prompts/examples.md`
- `E-CommerceAPI-master/test/assistant.telemetry.test.js`
- `E-CommerceAPI-master/test/assistant.service.test.js`
- `E-CommerceAPI-master/test/assistant.tools.test.js`
- `E-CommerceAPI-master/test/controllers.assistant.test.js`
- `E-CommerceAPI-master/test/routers.test.js`
- `src/redux/shopApi.ts`
- `src/types/domain.ts`
- `src/pages/Admin.tsx`

## Verification
- `npm.cmd test` in `E-CommerceAPI-master`
- `npm run build` in frontend

## Important Notes
- Frontend artificial reply delay has already been removed in `src/component/common/AssistantChat.tsx`
- Admin telemetry now exists at `GET /api/v1/assistant/admin/timings`
- Assistant timing is stored in an in-memory ring buffer on the backend for recent analysis
- If replies are still slow after this pass, the next likely bottlenecks are:
  - OpenAI network latency
  - Render cold starts
  - MongoDB response time
  - swap/catalog external fetches when caches are cold

## Next Diagnostic Steps
If more speed work is needed later:
1. inspect `assistant_timing` logs in backend runtime
2. measure tool-call latency vs provider latency from the admin timing page
3. consider assistant endpoint rate limiting and Redis for multi-instance cache sharing
4. consider reducing provider roundtrips for tool-heavy answers
5. improve prompt/tool quality if accuracy still lags

## Resume Checklist
When regaining context:
1. read this file first
2. confirm assistant timing telemetry still exists in `assistantService.ts` and `timingTelemetry.ts`
3. confirm tool cache is still active in `toolRegistry.ts`
4. confirm reasoning effort is still `low`
5. check backend timing logs or admin telemetry before changing anything else
