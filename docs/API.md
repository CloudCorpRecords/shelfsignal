# Hosted registry API

The read-only HTTP face of the store index. Agents that cannot run the MCP server, and any plain HTTP client, can read the same live registry over HTTP. It uses only the Node standard library, reads the same `registry/stores.json`, and runs the same search, stock, and validation code as the CLI and MCP server, so there is one source of truth.

## Run it

```bash
npm install
npm run build
node dist/cli.js serve                 # http://0.0.0.0:8787
node dist/cli.js serve --port 3000 --host 127.0.0.1
```

Or from code: `createApiServer()` / `startApiServer(port, host)` in `src/api.ts`. With no fixed registry injected, the registry file is re-read on every request, so a registry update pushed to the host goes live without a restart.

## Live only

A listing carries a `status` field that mirrors the intake queue in [EMAIL-INTAKE.md](EMAIL-INTAKE.md): `received`, `parsed`, `needs-info`, `ready`, `approved`, `paid`, then `live`. Only `live` listings are served, on every route. A listing in any other state is excluded from list and search results, and its detail route returns 404, exactly like an unknown id. Nothing in the queue can leak through the API before approval and payment. Listings with no `status` field predate it: the registry file has only ever held live listings, so an absent status counts as live. New submissions are created with `status: "ready"`, and only the paid write path (`shelfsignal intake --write` / `submit --write`) marks a listing `live`.

## Routes

All responses are JSON. The unversioned paths are aliases of the `/v1` paths.

| Route | What it returns |
|---|---|
| `GET /health` | `{ ok, service, stores }` with the live store count |
| `GET /v1/stores` | Live listings: `{ count, stores }`. Filters: `q` (or `query`), `city`, `category`, `type`. Each store carries an `openNow` signal (null when unknown) |
| `GET /v1/stores/<id>` | One live listing: `{ store, receipt }`, where receipt is the validation receipt. 404 for unknown or non-live ids |
| `GET /v1/search?q=<term>` | `{ query, category, count, stores, items }`: live stores matching the term, plus scored item hits (every hit carries its stock verdict). Also accepts `category`, `city`, and `type`; a `category` alone is a valid search |

Examples:

```bash
curl localhost:8787/v1/stores?city=San%20Francisco
curl localhost:8787/v1/stores/sf-mission-taqueria-demo
curl "localhost:8787/v1/search?q=birria"
curl "localhost:8787/v1/search?category=bakery"
```

## Rules

- Read-only: any non-GET method returns 405. There is no write route; listings change through the intake flow and a registry push, never through the API.
- Errors are JSON with an `error` field: 400 for a search with no term or category, 404 for unknown routes and ids, 405 for writes, 500 for a broken registry file.
- Responses carry `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`: the index is public, and stock freshness should never be served stale from a cache.
- Demo stores are served like any other live listing and stay flagged `demo: true` in every response. They are never presented as real merchants.
