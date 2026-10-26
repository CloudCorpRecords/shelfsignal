# Email intake: how a store joins ShelfSignal by email

Most independent merchants will never run a CLI, open a developer tool, or fill a web form with 40 fields. They will answer an email. Email intake is built for that reality, on one rule: **nothing a merchant emails becomes a public listing automatically.** Every submission passes validation, lands in a human-reviewed queue, and only goes live after approval and payment.

## The merchant experience

1. The merchant receives the template (in person during the pilot walk-in, from the leave-behind, or forwarded by us) and fills it in right inside their email app. Ten minutes, no account, no password.
2. They send it to the intake address with a subject starting `[ShelfSignal]`.
3. They get a reply with their listing preview and validation receipt: what agents will see, what tier they earned, and anything missing, named plainly.
4. The reply confirms the listing and covers the $100 Starter payment. Payment tooling is deliberately parked until the rest of the system is done (Rene's call, 2026-10-25): for now payment is arranged manually after approval, no link in the email. When a payment link is wired later, it slots into this step and nothing else changes.
5. On payment, the listing goes live the same day. The merchant's confirmation email doubles as their receipt and their "how to update stock" card: reply to any ShelfSignal email with lines like `Birria tacos: out` and the ping is applied after review.

## The template

`shelfsignal template` prints it. Fields are `KEY: value` lines; items are one per line as `Name | category | price | stock | staple`. The parser tolerates quoted replies, dollar signs, and plain stock words (in, low, out, sold out). Lines it cannot understand are reported by name in the review, never silently dropped.

## The operator flow

```
inbound email (subject starts with [ShelfSignal])
  -> save the body to the intake queue (email-intake/inbox/<date>-<store-slug>.txt)
  -> shelfsignal intake <file>            (parse + validate + receipt; problems named)
  -> review: fix nothing silently; if fields are missing, the reply asks for exactly those
  -> approved: reply with preview + receipt (sends are approved per standing outreach rules); payment arranged manually for now
  -> paid: shelfsignal intake <file> --write, push the registry, store is live
  -> file the thread under email-intake/reviewed/ with the receipt and payment reference
```

Queue states: `received` -> `parsed` -> `needs-info` or `ready` -> `approved` -> `paid` -> `live`. The folder the file sits in is the state; no separate tracker to keep in sync.

## Trust and safety rules

- The email attestation is dated the day it arrives (the parser stamps `lastConfirmed` accordingly). Stock claims are the merchant's own words, scored by the same likelihood engine as everything else, and they decay on the normal freshness schedule. An emailed listing earns no shortcut past validation.
- Email intake never sets `demo: true`, never invents prices, and never fills a field the merchant left blank. Blank means the validator reports it and the reply asks.
- One store per email. Chains and franchises are out of the pilot scope.
- The listing goes live only after a human review of the parsed listing and confirmed payment, so a malformed or impersonating submission can never reach the live index.
- Stock update replies from a merchant go through the same review: the address must match the store's contact on file before a `ping` is applied.

## Why email, in one paragraph

The pilot's stores are counters, not offices. Email is the one channel every one of them already has on the phone in their pocket, it leaves a written record both sides can point to (the receipts rule), and the template turns a freeform reply into structured data the validator can check line by line. The web form (roadmap) will reuse this exact parser contract, so the email channel stays the permanent fallback for the least technical merchants, not a throwaway.
