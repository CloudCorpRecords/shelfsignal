# Merchant intake: what to submit

Ten minutes, one form. This is everything a store needs to be listed and validated. The JSON template is `examples/submission.example.json`; a hosted form that emits the same shape is on the roadmap, and until then a store can send these answers in any format and we convert them.

## About the store

- **name**: exactly as it appears on your sign
- **type**: restaurant, grocery, bakery, bodega, cafe, pharmacy, butcher, market, retail, or other
- **address**: street address where customers show up
- **city** and **neighborhood**
- **phone** or **website**: at least one way to reach you (agents check this before recommending you)
- **hours**: plain text is fine, e.g. "Mon-Sun 8am-9pm"
- **categories**: the words customers and agents use for you: "tacos", "sourdough", "produce"
- **fulfillment**: pickup, walk_in, own_delivery, curbside

## Your stuff

For each item (Starter covers up to 50):

- **name**: what a customer would ask for
- **price**: the real shelf price. Listings with missing prices fail validation.
- **stock**: in_stock, low, out (be honest; agents score this, and a store that cries wolf decays)
- **lastConfirmed**: the date you last laid eyes on it, YYYY-MM-DD
- **staple**: true for everyday items you restock routinely

## After you submit

- You get a validation receipt: your tier and the checks behind it.
- VERIFIED means complete and fresh. Keep items confirmed within 7 days to stay VERIFIED.
- Refreshing stock is one message or one command. It is always free.
