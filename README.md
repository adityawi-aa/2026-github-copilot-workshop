# Procurement MVP Copilot Workshop

Hands-on 5-hour workshop to build a web-based procurement MVP and practice Copilot across SDLC.

## Workshop Scope
- Baseline provided in repo: database schema + Home/Dashboard + PR module (list/create/detail + PR APIs)
- Participant implementation backlog: PO module only (list/create/detail + PO APIs + PO validations)
- GR module: implemented in this repo as a further-exploration reference (list/create/detail + GR APIs + GR validations)
- Optional extension: bookmark feature (`PR`, `PO`, `GR`) as post-backlog exercise

See [docs/refs/PROGRESS.md](docs/refs/PROGRESS.md) for the current implementation status and full API reference of the PO and GR modules.

Canonical workshop document: [docs/plan.md](docs/plan.md)

## Tech Stack
- Backend: Fastify + REST API (JavaScript)
- Database: PostgreSQL in Docker
- Frontend: Vue 3 + Vite (JavaScript)
- Testing: Jest (unit) + Playwright (e2e)

## Repository Hygiene
- Generated test artifacts are intentionally ignored and should not be committed.
- Ignored outputs include `playwright-report/`, `test-results/`, `backend/coverage/`, and `frontend/coverage/`.
- If you need to share test evidence in the workshop, share screenshots or logs outside the repository commit history.

## Quick Start

### 1) Start PostgreSQL
```bash
docker compose up -d db
```

## DB Bootstrap for Participants

The PostgreSQL container now initializes the workshop baseline automatically:
- Runs schema migration: `db/migrations/001_init_procurement_mvp.sql`
- Runs sample seed data: `db/seeds/002_seed_procurement_mvp.sql`
- Uses Docker init script: `docker/postgres/init/00-init-mvp-db.sh`

Cross-platform notes (Windows/macOS/Linux):
- Init script and SQL files are normalized to LF via `.gitattributes`.
- The init script is committed as executable so PostgreSQL can run it from `/docker-entrypoint-initdb.d`.
- If bootstrap still fails on a local machine, re-apply file mode and reset DB:

```bash
chmod +x docker/postgres/init/00-init-mvp-db.sh
docker compose down -v
docker compose up -d db
```

Use this when starting fresh:

```bash
docker compose down -v
docker compose up -d db
```

Verify database is ready:

```bash
docker compose exec -T db psql -U workshop -d procurement_mvp -c "SELECT pr_number, status FROM purchase_requisitions ORDER BY pr_number;"
```

### Troubleshooting: DB init failed

Symptoms:
- `relation "purchase_requisitions" does not exist`
- `bad interpreter: Permission denied` from `00-init-mvp-db.sh`

Quick fix:

```bash
chmod +x docker/postgres/init/00-init-mvp-db.sh
docker compose down -v
docker compose up -d db
docker compose logs --no-color db | tail -n 120
```

Expected in logs:
- `[initdb] Running baseline migration...`
- `[initdb] Seeding sample data...`
- `[initdb] Database initialization complete.`

### 2) Backend (to be scaffolded in workshop)
```bash
cd backend
npm install
npm run dev
```

### 3) Frontend (to be scaffolded in workshop)
```bash
cd frontend
npm install
npm run dev
```

## Validation Rules
1. PO allocation qty must not exceed PR line remaining qty.
2. PO status transition rules must be enforced.
3. GR received qty must not exceed the PO line's open qty; a GR can only be created against a `SUBMITTED` PO and only posted once, from `DRAFT` to `POSTED`.

## Suggested Workshop Output
- Running baseline PR module + participant-completed PO module on Docker PostgreSQL
- PO happy path demo: create PO from approved PR open lines, submit, and view detail
- GR happy path demo (further exploration): create GR from a submitted PO's open lines, post it, and confirm PO/PR quantities update
- Focused Jest tests for PO business validations (over-allocation + status transition)
- Playwright coverage focused on PO flow integrated with baseline PR data
