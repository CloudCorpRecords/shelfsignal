# Management system

ShelfSignal's management system is built around one idea: **the registry is the business, and freshness is the operations job.**

## Source of truth

`registry/stores.json` holds every listing. In v0.1 it lives in git: every new store, price change, and stock refresh is a diff a human reviewed. That is a feature at pilot scale (25-100 stores): zero infrastructure, full audit trail, no database to babysit.

## The daily loop

1. **Freshness scan**: `shelfsignal validate-all` re-scores every listing. Stores sliding from VERIFIED to LISTED (nothing confirmed in 8+ days) get a nudge list.
2. **Merchant nudges**: one short message per stale store: "Your eggs were last confirmed 12 days ago; agents now see you as uncertain. Reply with today's stock to recover VERIFIED." The reply updates `lastConfirmed` and the affected items.
3. **Intake queue**: new submissions run through `shelfsignal submit` before merge; failures go back to the merchant with the named problems from the validator, not a form rejection.
4. **Agent-traffic log** (roadmap, Growth tier): record every `search_items` / `check_stock` query, aggregate weekly per store: what agents looked for, what the store had, what it missed. Misses are the merchant's best restock list and the sales proof for renewal.

## Roles

- **Operator (Rene)**: owns the registry, Stripe link, and merchant relationships. Approves merges.
- **Merchants**: own their data. They can update or delist at any time; a delisted store leaves the registry in the next commit.
- **Agents**: read-only. An agent can validate and quote receipts; it cannot edit a listing.

## When it outgrows git

At roughly 500 stores or the second city, move the same JSON schema into a hosted store (Postgres or a document DB) behind the same MCP tools, keep git as the export format, and give merchants the dashboard: stock board, freshness alerts, agent-traffic report. The MCP contract does not change, so agents never notice the move.
