# IT Support Ticket API

A portfolio-ready **REST API** for managing IT support tickets. Built with **TypeScript, Deno 2, PostgreSQL, and Docker Compose**. It demonstrates layered backend design, typed validation, parameterized SQL, automated testing, database persistence, and GitHub Actions CI.

> **Project status:** Local development/demo backend. There is **no authentication or authorization**; do not expose this service to the public Internet or use it with sensitive production data. The passwords in Docker Compose are intentionally for local development only.

## Features

- Create tickets with a title, optional description and priority.
- List tickets with filtering by status/priority and paginated results.
- View an individual ticket by UUID.
- Update a ticket's status and/or priority.
- Delete a ticket.
- Validate input and return consistent JSON errors.
- Use parameterized PostgreSQL queries, UUID identifiers and timestamps.
- Offer liveness (`/health`) and database-readiness (`/ready`) endpoints.
- Run unit tests and PostgreSQL integration tests in GitHub Actions.

### Technology stack

| Layer | Technology |
| --- | --- |
| Language and runtime | TypeScript, Deno 2 |
| HTTP | Native `Deno.serve()` and Web `Request` / `Response` |
| Database | PostgreSQL 17, `postgres.js` driver |
| Containers | Dockerfile, Docker Compose |
| Testing | Node-compatible `node:test` and `node:assert` executed with Deno |
| CI | GitHub Actions (lint, type-check, tests) |

## Run in Docker (easiest)

Install [Docker Desktop](https://docs.docker.com/get-docker/) or Docker Engine with Compose, then run:

```bash
docker compose up --build -d
```

Compose starts PostgreSQL, waits for database readiness, runs the schema migration, then starts the API on **http://localhost:8000**.

Check it:

```bash
curl http://localhost:8000/health
# {"status":"ok"}

curl http://localhost:8000/ready
# {"status":"ready"}
```

To see logs:

```bash
docker compose logs -f api
```

To stop containers without removing stored tickets:

```bash
docker compose down
```

To **also erase all local database data**, run `docker compose down -v` (destructive).

If ports 8000 or 5432 are already occupied, change their **left-hand host port** in `docker-compose.yml`.

## Run with Deno for development

Install [Deno 2](https://docs.deno.com/runtime/getting_started/installation/) and Docker.

Start only the database:

```bash
docker compose up -d postgres
cp .env.example .env
# The sample .env uses the same localhost credentials as Docker Compose.
deno task migrate
deno task dev
```

The `dev` task uses watch mode and loads `.env`. The development server listens on http://127.0.0.1:8000. In another terminal, make the API requests below.

The database migration is safe to rerun (`IF NOT EXISTS`). Changes to an existing schema should be done with new versioned migrations rather than editing the original migration.

## Example API usage

**Create a ticket**

```bash
curl -i -X POST http://localhost:8000/api/tickets \
  -H 'Content-Type: application/json' \
  -d '{"title":"Office printer is offline","description":"3rd-floor printer","priority":"high"}'
```

Expected HTTP status: `201 Created`. The response contains a generated `id` and an initial `status` of `open`.

**List tickets**, optionally filtered and paginated:

```bash
curl 'http://localhost:8000/api/tickets?status=open&priority=high&page=1&limit=10'
```

**Fetch a ticket** (replace `TICKET_ID` with the `id` returned by POST):

```bash
curl http://localhost:8000/api/tickets/TICKET_ID
```

**Update a ticket**:

```bash
curl -X PATCH http://localhost:8000/api/tickets/TICKET_ID \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress","priority":"medium"}'
```

**Delete a ticket**:

```bash
curl -i -X DELETE http://localhost:8000/api/tickets/TICKET_ID
# HTTP 204 No Content
```

### API endpoints

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| GET | `/health` | Liveness | 200 |
| GET | `/ready` | PostgreSQL readiness | 200 |
| POST | `/api/tickets` | Create ticket | 201 |
| GET | `/api/tickets` | List/filter/paginate | 200 |
| GET | `/api/tickets/:id` | Fetch by UUID | 200 |
| PATCH | `/api/tickets/:id` | Update status/priority | 200 |
| DELETE | `/api/tickets/:id` | Delete ticket | 204 |

`status`: `open`, `in_progress`, `resolved`.

`priority`: `low`, `medium`, `high` (defaults to `medium`).

`page`: positive integer (defaults to `1`, maximum `10000`).

`limit`: positive integer (defaults to `20`, maximum `100`).

Ticket `title`: 3–120 characters. `description`: optional; up to 2000 characters.

For a complete request/response contract, see [`docs/openapi.yaml`](docs/openapi.yaml).

### JSON response format

For a successful single-ticket request:

```json
{
  "data": {
    "id": "d8481cd4-6c8e-4bb4-9618-605ee38250cb",
    "title": "Office printer is offline",
    "description": "3rd-floor printer",
    "status": "open",
    "priority": "high",
    "createdAt": "2026-10-27T12:00:00.000Z",
    "updatedAt": "2026-10-27T12:00:00.000Z"
  }
}
```

*Illustrative response with example ID/timestamps.* List requests return `{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`.

Errors have a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title must contain 3 to 120 characters."
  }
}
```

## Testing and quality checks

With Deno installed:

```bash
deno task test               # Unit tests; does not require PostgreSQL
deno task check              # deno lint, deno check
deno task format             # optional: auto-format source files
```

To run integration tests:

```bash
docker compose up -d postgres
cp .env.example .env
# Deno does not load .env automatically for this command:
export DATABASE_URL='postgres://tickets:tickets@localhost:5432/tickets_db'
deno task migrate
deno task test:integration
```

On Windows PowerShell, use `$env:DATABASE_URL='postgres://tickets:tickets@localhost:5432/tickets_db'` instead of `export ...`.

The `.github/workflows/ci.yml` workflow sets up PostgreSQL and runs both test suites on pushes and pull requests. After your first local Deno run, commit the automatically generated `deno.lock` for more reproducible dependencies.

## Project structure

```text
it-support-ticket-api/
├── .github/workflows/ci.yml
├── db/migrations/001_create_tickets.sql
├── docs/openapi.yaml
├── scripts/migrate.ts
├── src/
│   ├── app.ts                 # HTTP routing and JSON responses
│   ├── errors.ts              # Structured HTTP errors
│   ├── main.ts                # Server bootstrap / database readiness
│   ├── postgres_repository.ts # Parameterized SQL queries
│   ├── repository.ts          # Storage interface for dependency injection
│   ├── types.ts               # Domain types
│   └── validation.ts          # Input and query validation
├── tests/
│   ├── helpers/in_memory_repository.ts
│   ├── integration/postgres_repository.test.ts
│   └── unit/
│       ├── app.test.ts
│       └── validation.test.ts
├── .env.example
├── deno.json
├── Dockerfile
└── docker-compose.yml
```

## Design decisions and trade-offs

- **Native Deno HTTP server:** Keeps dependencies minimal while demonstrating the Web API.
- **Repository interface:** Separates the HTTP API from PostgreSQL and allows fast unit testing with an in-memory fake.
- **Parameterized queries:** Never construct SQL by concatenating ticket input.
- **Startup readiness:** The app checks the database connection and table before listening.
- **Basic validation:** Explicitly rejects invalid fields, unknown query parameters and malformed UUIDs.
- **Simple schema migration:** An idempotent initial SQL file is adequate for a demo. A real production service would need tracked migration versions and rollback planning.
- **No auth:** Suitable only as a local portfolio demonstration. A production version would require authentication, authorization, per-user ticket access, rate limiting, observability and secret management.

## Upload to GitHub

1. Create a new **empty** GitHub repository named `it-support-ticket-api` (do not create a remote README, `.gitignore` or license).
2. In this project directory, run:

```bash
git init
git add .
git commit -m "Build TypeScript Deno support ticket API"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/it-support-ticket-api.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. GitHub will ask you to sign in as necessary (typically via credential manager or a personal access token, not your account password).

Before putting the project on your CV, run it, understand its behavior, make improvements of your own and confirm the GitHub Actions checks pass. Never commit your real `.env` or passwords.

## Next improvements

- Token authentication and per-user permission checks.
- A ticket assignee, category and comment history.
- OpenAPI validation and automated contract tests.
- Structured request logs, error tracking and metrics.
- Full database migration tooling and keyset pagination for larger workloads.
