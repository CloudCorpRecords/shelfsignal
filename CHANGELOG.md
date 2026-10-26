# Changelog

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
