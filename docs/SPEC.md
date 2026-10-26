# Spec

## Problem

AI agents are becoming the way people find things in a city ("find me birria tacos near the Mission that are actually available"). The data they need does not exist in a usable form:

- Delivery apps hold menus hostage behind closed apps, ad ranking, and 15-30% commissions, with no stock information at all.
- Map listings have hours and photos but no items, no prices, no stock.
- Merchant websites are unstructured and go stale silently.

## Product

ShelfSignal is a merchant-submitted, agent-readable store index with three engines:

1. **Registry** (`registry/stores.json`): the source of truth. One record per store: identity, location, hours, categories, fulfillment, and items with price, stock status, and last-confirmed date. v0.1 is git-backed so every change is a reviewable diff. A hosted registry with the same schema is the v0.3 roadmap item.
2. **Likelihood engine** (`src/likelihood.ts`): deterministic scoring of the evidence behind "do they have it": reported status (in/low/out/unknown) adjusted by confirmation age and staple status. Output is score + band + reasons, designed to be quoted by the calling agent.
3. **Validation engine** (`src/validate.ts`): 10 checks producing a receipt and a tier (VERIFIED / LISTED / STALE / INCOMPLETE). Agents call `validate_store` before recommending an unfamiliar store; merchants see the same receipt, so the fix list is never a mystery.

Access is dual, matching the fleet pattern: one bin runs the CLI for operators and merchants, and the MCP server (`shelfsignal mcp`, stdio) for agents.

## Intake flow

1. Merchant fills the intake (JSON template in `examples/`, or a form that emits the same JSON; see INTAKE.md).
2. Merchant pays the $100 Starter via Stripe payment link.
3. `shelfsignal submit intake.json --write` validates and appends the listing; a bad intake fails with named problems, never a silent drop.
4. The listing's first validation receipt is sent to the merchant: this is what agents will see.
5. Updates: the merchant re-submits changed items or sends a stock ping; `updatedAt` and item `lastConfirmed` move, freshness recovers.

## Trust rules

- Bundled sample data is always `demo: true` and says so in every verdict.
- Scores are computed from merchant-reported evidence only; the engine never invents stock.
- An `uncertain` or `unlikely` verdict must never be presented to a human as available. The MCP tool description says this to every calling agent.
- Ranking is validation tier and freshness. There is no paid ranking and there will not be.

## Non-goals (v0.1)

- No delivery, no couriers, no payments processing inside the repo.
- No scraping of delivery apps or map platforms. Listings are merchant-submitted, period.
- No ordering. Agents discover, validate, and direct; the transaction happens with the store. (Order-ahead intents are a roadmap item once merchants ask.)

## Roadmap

- v0.2: intake form page, Stripe link wiring, SF pilot: first 25 real stores onboarded by hand.
- v0.3: hosted registry + merchant dashboard (stock board, freshness alerts, agent-traffic report).
- v0.4: imports (CSV, Square/Toast exports), photo menu OCR intake.
- v0.5: second city pack; business-association bundle pricing.
