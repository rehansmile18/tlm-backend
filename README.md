# TLM Backend

Backend service for the TLM (Time & Labor Management) platform's **site-operations** surface: the
API a site manager's UI calls to manage employees, sites, schedules, punches, and timesheets day
to day.

This service is the **sole public CRUD owner** of Employee, EmployeeGroup, Site, Task,
PayPeriodConfig, PayrollCalendar, Punch, EmployeeSiteAssignment, and Schedule (planned shifts).
Two sibling services sit either side of it:

- **[TLM](../TLM)** (Rule Repository) remains the single auth authority for every user of every
  role — this service verifies TLM-issued JWTs locally and resolves live role/clientId/siteIds/
  permissions from TLM's `GET /users/me`. It never mints its own tokens.
- **[tlm-punch-processor](../tlm-punch-processor)** is the internal calculation engine: this
  service proxies to it (as a trusted service account, not the original caller's own JWT) to
  trigger payroll processing and to read/void the timesheets it produces. Punch-processor's own
  public CRUD for the master-data resources above is retired once this service replaces it.

This service uses **two MongoDB connections**:
- TLM's own database (`tlm_rule_repository`) holds Employee/EmployeeGroup/Site/Task/
  PayPeriodConfig/PayrollCalendar/Punch/EmployeeSiteAssignment — client-owned master data that
  belongs alongside the Client/User/Policy records TLM already owns. Reached via a second
  Mongoose connection (`RULE_REPO_MONGODB_URI`); this service is their sole public CRUD owner but
  doesn't own the database itself.
- This service's own database (`tlm_backend`, `MONGODB_URI`) holds only `ScheduledShift` —
  high-churn, site-ops-specific operational state, same reasoning that keeps `Timesheet`/
  `ProcessingRun` in punch-processor's own database rather than TLM's.

## Requirements

- Node.js 20+
- MongoDB 6+ (local install, Docker, or Atlas) for this service's own Schedule state
- Access to TLM's own MongoDB database (`tlm_rule_repository`) — this service reads/writes the
  master-data collections there directly, so it must be the SAME database instance TLM itself uses
- A reachable TLM instance (auth) and a reachable tlm-punch-processor instance (processing/
  timesheet proxy)

## Quick start (local Node + local/Docker MongoDB)

```bash
npm install
cp .env.example .env        # edit if you're not using the defaults

# Start this service's own MongoDB if you don't already have one running (bound to localhost only):
docker run -d --name tlm-backend-mongo -p 127.0.0.1:27019:27017 mongo:7
# then set MONGODB_URI=mongodb://localhost:27019/tlm_backend in .env

# Point RULE_REPO_MONGODB_URI in .env at TLM's OWN MongoDB instance/database — this service reads/
# writes Employee/EmployeeGroup/Site/Task/PayPeriodConfig/PayrollCalendar/Punch/
# EmployeeSiteAssignment there directly, not in a database of its own.

npm run dev                 # starts the API on http://localhost:4200
```

Check it's up:

```bash
curl http://localhost:4200/health
```

### Setting up the punch-processor service account

This service calls tlm-punch-processor's own API outbound (trigger processing, read/void
timesheets) using a dedicated `PLATFORM_ADMIN` service-account user in TLM — not a human's login
token. Unlike a pre-minted JWT, this service logs into that account itself at runtime whenever its
cached token is missing or near expiry (see `clients/punchProcessorClient.ts`), so there's nothing
to periodically re-mint — just make sure the account exists and its credentials are in `.env`.
`npm run seed` automates this (see below); to do it by hand against a running TLM instance:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<TLM SEED_ADMIN_PASSWORD>"}'
# -> { "token": "<admin token>", "user": {...} }

curl -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"email":"svc-tlm-backend@internal","password":"<a real password>","role":"PLATFORM_ADMIN"}'
# -> set PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL/PASSWORD in .env to this email/password
```

### Seeding

```bash
SEED_SERVICE_ACCOUNT_PASSWORD=<a real password> \
TLM_BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
TLM_BOOTSTRAP_ADMIN_PASSWORD=<TLM SEED_ADMIN_PASSWORD> \
npm run seed
```

Creates (or confirms, if it already exists) the `PLATFORM_ADMIN` service-account user this service
uses for its outbound punch-processor calls, and prints the `PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL`/
`PUNCH_PROCESSOR_SERVICE_ACCOUNT_PASSWORD` to set in `.env`. Optionally also seeds demo
`CLIENT_ADMIN`/`SITE_MANAGER`/`VIEWER` users — with permissions drawn from
`GET /permissions/catalog`'s recommended defaults — if `SEED_DEMO_CLIENT_ID` (and, for the
`SITE_MANAGER`, `SEED_DEMO_SITE_ID`) point at an existing Client/Site already created in TLM/this
service.

```bash
npm test                    # vitest + mongodb-memory-server, no external database needed
npm run lint
npm run typecheck
```

## Quick start (Docker Compose — API + its own MongoDB together)

```bash
docker compose up -d --build
```

Brings up this service's own MongoDB (bound to `127.0.0.1:27019`, holding only `ScheduledShift`)
and the API (bound to `127.0.0.1:4200`). By default it assumes TLM is reachable on the host at
`http://host.docker.internal:4000/api/v1` and tlm-punch-processor at
`http://host.docker.internal:4100/api/v1` — override `RULE_REPO_BASE_URL`/`PUNCH_PROCESSOR_BASE_URL`
if either lives elsewhere. It also assumes TLM's own MongoDB is reachable on the host at
`host.docker.internal:27017` with TLM's own compose-default credentials — override
`RULE_REPO_MONGODB_URI` otherwise. See the comments in `docker-compose.yml` for how to point
everything at real instances and supply real `JWT_SECRET`/`PUNCH_PROCESSOR_SERVICE_ACCOUNT_PASSWORD`/
`PUNCH_INGEST_API_KEY` values — the app refuses to boot on placeholder secrets outside
`NODE_ENV=development`/`test`, same as TLM and punch-processor.

## Environment variables

See [`.env.example`](.env.example) for the full list with explanations. Notable ones:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | This service's own MongoDB connection string — currently just `ScheduledShift` |
| `RULE_REPO_MONGODB_URI` | TLM's own MongoDB connection string — Employee/EmployeeGroup/Site/Task/PayPeriodConfig/PayrollCalendar/Punch/EmployeeSiteAssignment live there; must point at the SAME database TLM itself uses |
| `JWT_SECRET` | Must be the **same value** as TLM's `JWT_SECRET` — this service verifies the identical human-login JWTs TLM issues, it does not mint its own |
| `RULE_REPO_BASE_URL` | Base URL of the TLM API this service calls for `GET /users/me` only (include `/api/v1`) |
| `PUNCH_PROCESSOR_BASE_URL` | Base URL of the tlm-punch-processor API this service proxies processing/timesheet calls to (include `/api/v1`) |
| `PUNCH_PROCESSOR_SERVICE_ACCOUNT_EMAIL` / `_PASSWORD` | Credentials for a `PLATFORM_ADMIN` service-account user seeded in TLM, used only for this service's own outbound calls to punch-processor — this service logs in fresh on demand, so these never expire the way a pre-minted JWT would |
| `PUNCH_INGEST_API_KEY` | Shared secret for kiosk/upstream time-clock systems submitting punches — a separate auth path from human JWTs |
| `USER_PROFILE_CACHE_MS` | How long a cached TLM `GET /users/me` lookup (role/clientId/siteIds/permissions/status) is trusted before re-checking |
| `CORS_ORIGIN` | Comma-separated allowlist of browser origins; unset allows all |

## Auth model

Every human user, of every role, authenticates identically: a normal TLM-issued JWT, verified
locally against `JWT_SECRET` (proves *who* cheaply, no network call), with role/clientId/siteIds/
permissions/status resolved **live** from TLM's `GET /users/me` — this service has no `User`
collection of its own — cached per-token for `USER_PROFILE_CACHE_MS` (default 60s).

Two orthogonal, composable authorization layers sit on top, both enforced here (TLM's own routes
are untouched):

- **Permission gate** (`requirePermission(...keys)`, `middleware/permissions.ts`) — "can this user
  do this kind of thing at all." A fixed, code-defined catalog of `resource:action` keys (see
  `GET /permissions/catalog`); individually toggleable per user via TLM's `User.permissions` field
  (set/edited through TLM's own `POST /users` / `PATCH /users/:id`), not a fixed per-role
  capability set — two users with the same role can have different permissions. `PLATFORM_ADMIN`
  always bypasses.
- **Scope gate** (`middleware/tenantScope.ts`) — "on whose data." `getReadClientFilter`/
  `assertSameClient` restrict every non-`PLATFORM_ADMIN` role to their own `clientId`;
  `getReadSiteFilter`/`assertSameSite` additionally restrict `SITE_MANAGER` to their own
  `siteIds` for resources that carry a top-level `siteId` (Schedule; Punch/EmployeeSiteAssignment
  checks are inline in their own controllers).

A third, narrower credential exists for kiosk/upstream time-clock systems: `PUNCH_INGEST_API_KEY`,
sent as the `x-punch-ingest-key` header on punch endpoints only (`middleware/punchIngestAuth.ts`).
It authenticates as a synthetic `PUNCH_INGEST` principal that can create/read punches but carries
no `permissions` array — the two ingestion routes bypass `requirePermission` specifically for that
role (see `modules/punch/punch.routes.ts`), every other route still requires it normally, which
naturally rejects `PUNCH_INGEST`. A request without the header falls through to the normal
human-JWT check, so a permitted human user can also submit punches directly.

## API surface

All routes below are mounted under `/api/v1`, except `/health` which is at the root.

| Resource | Routes | Permission |
|---|---|---|
| Employees | `GET/POST /employees`, `GET/PATCH /employees/:id`, `GET/POST /employees/:id/sites`, `DELETE /employees/:id/sites/:siteId` | `employee:read`/`write`, `employeeSiteAssignment:read`/`write` |
| Employee groups | `GET/POST /employee-groups`, `GET/PATCH /employee-groups/:id` | `employeeGroup:read`/`write` |
| Sites | `GET/POST /sites`, `GET/PATCH /sites/:id` | `site:read`/`write` |
| Tasks | `GET/POST /tasks`, `GET/PATCH /tasks/:id` | `task:read`/`write` |
| Pay period configs | `GET/POST /pay-period-configs`, `GET/PATCH /pay-period-configs/:id` | `payPeriodConfig:read`/`write` |
| Payroll calendars | `GET/POST /payroll-calendars`, `GET/PATCH /payroll-calendars/:id` | `payrollCalendar:read`/`write` |
| Punches | `POST /punches`, `POST /punches/bulk`, `GET /punches`, `GET /punches/:id`, `PATCH /punches/:id` (correction) | `punch:read`/`write` (or punch-ingest key for create/bulk) |
| Schedule | `POST /schedules`, `POST /schedules/bulk`, `GET /schedules`, `GET /schedules/:id`, `PATCH /schedules/:id`, `POST /schedules/:id/cancel`, `GET /schedules/adherence` | `schedule:read`/`write` |
| Timesheets (proxy) | `GET /timesheets`, `GET /timesheets/:id`, `GET /timesheets/:id/audit-trail`, `POST /timesheets/:id/void` | `timesheet:read`, `timesheet:void` |
| Processing (proxy) | `POST /processing/runs` | `processing:trigger` |
| Permissions | `GET /permissions/catalog` — fixed key list + descriptions + recommended per-role defaults | none (any logged-in user) |
| Health | `GET /health` — this service's own DB, the rule-repo DB connection, and a short-timeout non-blocking reachability probe of punch-processor | none |

## Architecture notes

- **EmployeeSiteAssignment** is a many-to-many join collection (not a field on `Employee`),
  living in TLM's database alongside the master data it relates — mirrors TLM's own `Assignment`
  join-table idiom. Employee/Site references use external string ids (`Employee.employeeId`/
  `Site.siteId`), matching `Punch`'s existing convention, not Mongo `_id` refs.
- **Schedule** (`ScheduledShift`) is a planned shift: a specific employee at a specific site for a
  specific time slot on a specific date. Double-booking is rejected at write time (application-
  level overlap check, not atomic — acceptable for human-paced roster building, not a payroll-
  correctness race). Creating a shift requires an active `EmployeeSiteAssignment` for that
  employee/site pair.
- **Adherence** (no-show/late/early/on-time) is computed **on-demand** by `GET
  /schedules/adherence`, joining `ScheduledShift` and `Punch` for the requested range — not
  stored, since both sides can be corrected after the fact and a cached field would need its own
  staleness tracking (like `Timesheet.stale`) for no real benefit at site-manager-view scale.
- **Timesheet/processing proxy**: this service has no direct DB access to `Timesheet`/
  `ProcessingRun` — they live in punch-processor's own database. Every outbound call authenticates
  as the trusted service account, so punch-processor applies no tenant filter on this service's
  behalf; the real tenant boundary is enforced here, either by forwarding the caller's own
  resolved `clientId` as a query param (list) or by fetching then checking the returned document's
  `clientId` (get/audit/void).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run typecheck` | Type-check `src/` and `tests/` with no emit |
| `npm run lint` | ESLint over the project |
| `npm test` | Run the automated test suite (`vitest` + ephemeral in-memory MongoDB — no external database needed) |
| `npm run seed` | Bootstrap the punch-processor service account (and optionally demo users) — see "Seeding" above |

## Docker

```bash
docker compose up -d --build
```

Brings up this service's own MongoDB and the API — see "Quick start (Docker Compose)" above for
what's configured by default and how to point it at real TLM/punch-processor instances and real
secrets.
