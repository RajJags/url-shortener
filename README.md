# URL Shortener

A lightweight TypeScript + Express URL shortener with simple deployment options, durable Postgres support, optional Redis caching, redirect tracking, and basic analytics.

## Features

- Create shortened links from long URLs
- Use the built-in web UI to create, browse, copy, and delete links
- Support optional custom aliases such as `/docs`
- Reuse an existing generated short code for the same URL
- Redirect users from short links to their destination
- Track clicks, last access time, and recent visit timestamps
- Set optional expiration dates on links
- Persist data locally in `data/urls.json`
- Use Postgres for simple cloud deployment with durable storage
- Support Redis as the hot-path cache for redirect traffic
- Flush analytics from cache to durable storage in the background
- Inspect links through REST endpoints

## Quick Start

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3000` by default.

For the simplest local durable setup, use Docker Compose:

```bash
docker compose up --build
```

## Environment Variables

Copy `.env.example` to `.env` if you want to override defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `BASE_URL` | empty | Public base URL used when generating short links |
| `DATA_FILE` | `data/urls.json` | Where URL data is stored |
| `STORAGE_MODE` | `file` locally, `postgres` when `DATABASE_URL` exists | Select `file` or `postgres` storage |
| `DATABASE_URL` | empty | Postgres connection string for deployable durable storage |
| `DATABASE_SSL` | `false` | Set to `true` for managed Postgres providers that require SSL |
| `CODE_LENGTH` | `6` | Length of generated short codes |
| `RECENT_VISIT_LIMIT` | `10` | Number of recent visit timestamps to retain |
| `CACHE_MODE` | `memory` | `memory` for local development, `redis` for low-latency cached redirects |
| `REDIS_URL` | empty | Required when `CACHE_MODE=redis` |
| `ANALYTICS_INGEST_INTERVAL_MS` | `250` | How often in-process visit events are flushed into the cache |
| `ANALYTICS_FLUSH_INTERVAL_MS` | `5000` | How often cached analytics are written back to durable storage |

## API

### `GET /`

Serves the built-in frontend.

### `GET /api`

Returns a small service overview and route map.

### `GET /health`

Returns a basic health response.

### `POST /api/urls`

Create a short URL.

Request body:

```json
{
  "url": "https://example.com/some/very/long/path",
  "customAlias": "docs",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Notes:

- `url` is required
- `customAlias` is optional
- `expiresAt` is optional and must be a future ISO date

### `GET /api/urls`

List all stored links.

### `GET /api/urls/:code`

Get one stored link by short code.

### `GET /api/urls/:code/stats`

Get analytics-friendly metadata for one link.

### `DELETE /api/urls/:code`

Delete a short link.

### `GET /:code`

Redirect to the original destination and increment analytics.

## Example cURL

```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://openai.com\",\"customAlias\":\"openai\"}"
```

## Deployment

The simplest deployable setup is:

- `STORAGE_MODE=postgres`
- `DATABASE_URL` set from your hosting provider
- `CACHE_MODE=memory`

That gives you a durable, single-service deployment without needing Redis yet.

### Docker First

For local app + Postgres:

```bash
docker compose up --build
```

This uses:

- [docker-compose.yml](C:/Users/rajag/OneDrive/Desktop/url-shortener/docker-compose.yml:1)
- [.env.production.example](C:/Users/rajag/OneDrive/Desktop/url-shortener/.env.production.example:1)

For a plain container deploy, build and run:

```bash
docker build -t url-shortener .
docker run -p 3000:3000 --env-file .env url-shortener
```

### Recommended First Deployment Shape

- Run the app container from [Dockerfile](C:/Users/rajag/OneDrive/Desktop/url-shortener/Dockerfile:1)
- Use managed Postgres from your host or cloud provider
- Set `STORAGE_MODE=postgres`
- Set `DATABASE_URL`
- Keep `CACHE_MODE=memory`

That is the lowest-complexity deployable version of this project.

## Future Upgrades

- Add QR code generation
- Add auth for link ownership and protected deletes
- Add rate limiting and abuse prevention

## Performance Notes

The redirect hot path is now designed to avoid writing the file store on every request:

- Cache hits resolve from memory or Redis
- Redirect analytics are queued in-process and flushed to the cache asynchronously
- A background flusher writes dirty analytics back to durable storage

For a later higher-throughput version, you should run with:

- `CACHE_MODE=redis`
- Redis on the same low-latency network as the app
- Postgres behind the repository layer instead of the JSON file store for multi-instance production use

The current JSON-backed repository is still useful for local development. For real deployment, Postgres is the better default.
