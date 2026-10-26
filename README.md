# ShelfSignal

**The open store index for AI agents.**

Local merchants list what they actually sell. AI agents find real food and real products nearby, score how likely each item is actually in stock, and check a validation receipt before they send a human across town. Merchants pay one flat price to get listed. Nobody takes 30% of their food.

DoorDash and the delivery apps built a closed index: they own the customer, scrape or rent the menu, charge the merchant 15-30% per order, and still cannot tell you whether the kitchen has the thing you want. ShelfSignal is the opposite shape:

- **Merchant-owned listing.** The store submits its own stuff, its own prices, its own stock. The listing belongs to the merchant, not the platform.
- **Built for agents, not ads.** One MCP server any agent can query: find stores, find items, check stock, validate the listing. No sponsored placement, ever.
- **Stock is a scored signal, not a claim.** Every item carries a last-confirmed date. The likelihood engine turns that evidence into a 0-100 score with printed reasons, so agents stop bluffing "they have it" and start saying "confirmed today, likely in stock."
- **Validation receipts.** Every listing carries checks an agent can verify: complete profile, real prices, fresh inventory, declared fulfillment. Tier: VERIFIED, LISTED, STALE, or INCOMPLETE.
- **Flat money.** $100 Starter Store, one time, listed and validated. No per-order commission. See [docs/PRICING.md](docs/PRICING.md).

## Quick start

```bash
npm install
npm run build
npm test

node dist/cli.js coverage
node dist/cli.js search "birria" --city "San Francisco"
node dist/cli.js stock sf-mission-taqueria-demo "Birria tacos"
node dist/cli.js nearby 37.7599 -122.4148 --radius 5
node dist/cli.js ping sf-sunset-bakery-demo "Cardamom knot" in
node dist/cli.js validate sf-mission-taqueria-demo
node dist/cli.js doctor
node dist/cli.js mcp        # run the MCP server (stdio)
```

## MCP tools

| Tool | What it does |
|---|---|
| `search_stores` | Find stores by text, city, category, or type (with open-now signal) |
| `find_nearby` | Stores near a lat/lng point, nearest first, with distance and open-now |
| `search_items` | Find a food or product across stores, every hit carrying its stock verdict |
| `get_store` | Full listing: hours, address, fulfillment, items, stock |
| `check_stock` | Stock-likelihood verdict (score, band, reasons) for one item |
| `validate_store` | Validation receipt and tier for one listing |
| `submit_store` | Validate a merchant intake and preview its listing + receipt |
| `list_coverage` | Cities, categories, and store count in the index |

## For merchants

You run a store in the city. For $100 you get listed where the agents look:

1. Fill the intake (10 minutes): who you are, where you are, your hours, and the stuff you sell with real prices. Template: [examples/submission.example.json](examples/submission.example.json), field guide: [docs/INTAKE.md](docs/INTAKE.md).
2. We validate it and your listing goes live with its first receipt.
3. Update stock whenever it changes with one command or one message. Fresh listings rank as VERIFIED; stale ones decay honestly instead of lying to customers.

No commission. No tablet on your counter. No competing with your own listing.

## How it works

- The registry is the source of truth: `registry/stores.json` (v0.1, git-backed, every change reviewable).
- The likelihood engine is deterministic: merchant-reported status, confirmation freshness, staple vs specialty. No model guesses.
- The management layer is freshness: listings decay, validation re-runs on every read, and merchants see exactly what an agent sees. Roadmap in [docs/MANAGEMENT.md](docs/MANAGEMENT.md).
- Full design: [docs/SPEC.md](docs/SPEC.md). Why this beats the delivery model: [docs/VS-DOORDASH.md](docs/VS-DOORDASH.md).

Bundled stores are sample data and are flagged `demo: true` in every response. Real merchants are never marked demo, and demo stores are never presented as real.

## License

MIT
