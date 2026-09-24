# WebSpecs

WebSpecs is an open-source, self-hosted analytics tool that separates real
human page traffic from ordinary crawlers, AI training crawlers, agent-triggered
fetches, unidentified bots, and suspicious browser impersonation.

The project is designed to run next to the adopter's site. The default
configuration makes no third-party network calls and sends no telemetry to a
WebSpecs service.

## Current scaffold

The first build includes the reusable request contracts and a local dashboard:

- `@workspace/webspecs-classifier` — dependency-free, importable classification
  engine with local, versioned JSON signature and datacenter range files.
- `@workspace/webspecs-middleware` — Express middleware that records every
  request through a storage callback, hashes IPs, identifies static assets, and
  creates a short-lived correlation ID.
- `@workspace/webspecs-snippet` — framework-free browser signal snippet with no
  cookies and no third-party requests.
- `@workspace/db` — PostgreSQL and SQLite-compatible `webspecs_events` and
  `webspecs_rollups` schemas.
- `/api/dashboard` — a same-instance HTML dashboard with a locally served
  Chart.js runtime and hourly category counts.

The local dashboard is served by the same instance at `/api/dashboard`. It
reads only the adopter's `webspecs_rollups` table and serves its Chart.js
runtime locally, so the page makes no hosted or third-party requests. The
dashboard shows hourly request counts for human traffic, training crawlers,
agent fetches, unidentified bots, and suspicious/spoofed traffic. Persistence
adapters can still be adopted independently.

## Classification logic

Classification is deterministic and auditable:

1. Every incoming request is logged server-side. This path does not depend on
   JavaScript, so a crawler that never renders a page is still recorded.
2. The User-Agent is compared case-insensitively against the checked-in
   `lib/webspecs-classifier/data/bot-signatures.json` file. A known match is
   classified immediately:
   - `training_crawler` means the crawler is independently collecting or
     indexing content, such as `GPTBot`, `ClaudeBot`, `CCBot`, or Googlebot.
   - `agent_fetch` means the request identifies a fetch performed for a live
     user interaction, such as `ChatGPT-User`, `Claude-User`, or
     `Perplexity-User`.
3. If there is no known match, a page request waits for the browser signal
   until the integration's timeout window. If no signal arrives, it becomes
   `unidentified_bot`. Static assets remain useful raw events but do not need a
   browser signal.
4. If the signal arrives, WebSpecs scores observable risk:
   - `navigator.webdriver === true`: 3 points.
   - no mouse, scroll, or touch activity in the first three seconds: 1 point.
   - impossible navigation timing: 2 points.
   - implausible screen dimensions: 1 point.
   - a source IP in a checked-in cloud/datacenter range: 1 point.
5. A score of 2 or more is `suspicious_spoofed`; otherwise it is `human`.
   Datacenter location alone is never enough to call a request a bot.

This is a classification aid, not an identity guarantee. Signatures and ranges
are versioned local inputs so site owners can audit and review every change.

## Install the middleware

The standalone package accepts a storage adapter instead of forcing a database:

```ts
import express from "express";
import { createWebSpecsMiddleware } from "@workspace/webspecs-middleware";

const app = express();
app.use(
  createWebSpecsMiddleware({
    store: { insert: (event) => myEventStore.insert(event) },
    hashSalt: process.env.WEBSPECS_HASH_SALT!,
  }),
);
```

Use a stable secret salt owned by the adopter. WebSpecs stores a one-way IP hash
by default, never the original address.

To correlate the browser signal, render the middleware's request ID into the
page as `<meta name="webspecs-request-id" content="...">`, then include:

```html
<script async src="/analytics/snippet.js"></script>
```

The snippet must be served by the adopter's own instance. It is not a CDN
dependency.

## One-click / one-tap website integration

Open the local dashboard at `/api/dashboard`. The **Add WebSpecs to your site**
panel has copy buttons for both integration steps and a **Copy all setup**
button that works with a mouse click or a touch tap:

1. Copy the server middleware into the Express app that receives the site's
   requests.
2. Copy the browser tag into the page template. The tag is served by the same
   WebSpecs instance at `/api/snippet.js`; it does not contact a third-party
   domain.
3. Render `res.locals.webSpecsRequestId` into the
   `webspecs-request-id` meta tag so the browser signal is correlated with the
   server request.

The local instance also exposes the snippet directly:

```sh
curl http://localhost:5000/api/snippet.js
```

If the adopter reverse-proxies WebSpecs under another same-origin path, use
that path in the copied script tag. The dashboard generates the path from the
route where it is mounted.

## Self-host with Docker Compose

The compose file provides a local PostgreSQL service and the API service:

```sh
cp .env.example .env
docker compose up --build
```

For a small site, use the SQLite schema instead of PostgreSQL and point the
storage adapter at a local file. No hosted dashboard account is required.

## View the local dashboard

After the instance has persisted hourly rollups, open
`http://localhost:5000/api/dashboard` (or the equivalent path where the
instance is mounted). Choose a time range to see stacked hourly request
counts. The page fills missing hours with zeroes and shows an empty state
until rollups exist.

## Optional signature updates

The update flag is intentionally off by default. If a future updater is
enabled, it must be a one-way pull from a canonical URL chosen by the adopter.
It must never send event data, IPs, or telemetry. Reviewed updates can always
be applied manually by editing the checked-in JSON files.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm --filter @workspace/api-server run dev
```

See `CONTRIBUTING.md` for the signature-list review process.