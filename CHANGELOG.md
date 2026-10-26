# Changelog

## 0.3.1 - 2026-10-25

Hosted registry API: the read-only HTTP face of the store index.

- **HTTP API** (`src/api.ts`): Node standard library only, no new dependencies. `GET /health`, `GET /v1/stores` (filters: q, city, category, type), `GET /v1/stores/<id>` (listing plus validation receipt), and `GET /v1/search` (term or category, with scored item hits). Run it with `shelfsignal serve [--port n] [--host h]`; the registry file is re-read per request, so a pushed registry update goes live without a restart. Full reference: docs/API.md.
- **Live-only rule**: listings now carry a `status` field mirroring the intake queue states. Only `live` listings are served; every other state is excluded from list and search, and returns 404 on the detail route. A missing status counts as live (the registry has only ever held live listings). New submissions are created as `ready`, and only the paid write path marks a listing `live`. The bundled demo stores are now explicitly `live`.
- Tests: 15 -> 24 (API list, filters, detail with receipt, unknown-id 404, search by term and category, health, write rejection, and non-live exclusion across list, detail, and search).

## 0.3.0 - 2026-10-25

Email intake: the submission channel for merchants who live in their inbox.

- **Intake parser** (`src/intake.ts`): a filled plain-text email template becomes the exact submission shape the validator already trusts. Tolerates quoted replies, dollar signs, and plain stock words (in, low, out, sold out). Anything it cannot understand is reported by name; nothing is silently dropped or guessed. The email itself stamps the confirmation date: the merchant attested to this stock today.
- **CLI**: `shelfsignal template` prints the merchant template; `shelfsignal intake <email.txt> [--write]` parses, validates, and returns the receipt (and appends on --write after approval).
- **docs/EMAIL-INTAKE.md**: the full system - merchant experience, operator queue states, and the trust rules (nothing auto-publishes, the payment link only follows a human review, no field is ever invented).
- Adversarial battery fixes: a ping with a non-numeric price could write a null price into the registry (now rejected); a blank item query matched the first item in a store (shared findItem helper, blank matches nothing in CLI, MCP, and ping); verified a corrupt registry already fails cleanly with exit 1.
- Tests: 12 -> 15 (intake happy path with reported bad lines, blank template, findItem blank-query regression).

## 0.2.0 - 2026-10-25

Quality pass before any merchant outreach (Rene's direction: make the project really good first).

- **Registry install fix**: server.json npm package now carries runtimeHint (npx) and the `mcp` package argument, so an agent installing from the MCP Registry actually gets an MCP server instead of CLI usage text. OCI entry gained docker runtime arguments.
- **Geo**: stores can carry lat/lng; new `find_nearby` MCP tool and `nearby` CLI command return stores by distance with haversine scoring. Stores without coordinates are excluded, never placed by guess.
- **Open-now signal**: optional structured hours per store; `openNow` (true / false / null for unknown) is attached to search, nearby, and store results. Midnight-crossing ranges and closed days handled, evaluated in the store's city timezone.
- **Scored item search**: `search_items` and the CLI `search` now return a stock verdict on every hit, sorted by score, so agents stop at one call.
- **Merchant stock ping**: `shelfsignal ping <store> <item> <in|low|out> [--price n]` performs the one-command stock update the management docs promised, restamps freshness, persists to the registry, and prints the new verdict the merchant can show customers.
- **Operator doctor**: `shelfsignal doctor` reports registry health (tiers, stale stores, coverage, geo/hours completeness).
- Intake now preserves lat/lng and structured hours through submission.
- Tests: 8 -> 12 (geo, open-now incl. midnight spill, ping recovery, scored ordering).

## 0.1.0 - 2026-10-25

- Registry schema and SF demo pack (4 sample stores, all flagged demo).
- Deterministic stock-likelihood engine: score, band, and printed reasons.
- Validation engine: 10 checks, receipt, VERIFIED / LISTED / STALE / INCOMPLETE tiers.
- Merchant intake: `submit` validates a $100 Starter Store submission and previews its receipt.
- CLI: list, search, store, stock, validate, validate-all, submit, coverage.
- MCP server (stdio): search_stores, search_items, get_store, check_stock, validate_store, submit_store, list_coverage.
- Docs: spec, pricing ($100 Starter Store), intake guide, management system, delivery-app comparison.
