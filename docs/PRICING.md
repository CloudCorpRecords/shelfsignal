# Pricing

## Starter Store: $100, one time

Everything a local store needs to be found by AI agents:

- Full registry listing: profile, hours, address, fulfillment, categories
- Up to 50 items with real prices and stock status
- Validation run + public receipt (VERIFIED tier when fresh)
- Stock-likelihood scoring on every item
- Agent discovery through the ShelfSignal MCP server
- Merchant update path (one command or one message to refresh stock)
- One city, one location

No commission on any sale, ever. No monthly fee to stay listed. A listing that goes stale decays in tier honestly; the merchant refreshes it for free.

## Why flat, why $100

Delivery apps charge 15-30% forever because they can. A listing is not worth 30% of a restaurant. $100 is priced so a bodega, a bakery, or a taqueria says yes in one conversation, and so 100 stores in one city is $10,000 of revenue with zero delivery fleet, zero couriers, and zero per-order cost. The business scales by city, not by order.

## Roadmap tiers (not sold yet)

- **Growth, $49/mo per location**: 500 items, multi-location, priority freshness reminders, menu and inventory file imports (CSV/POS exports), monthly agent-traffic report showing what agents searched for and whether the store had it.
- **Pro / City Partner**: API keys for chains and market halls, bulk onboarding, city launch partnerships with business associations.

Payment for Starter runs through a Stripe payment link. The repo never touches card data; `submit` validates the listing, Stripe validates the payment, the listing merges.
