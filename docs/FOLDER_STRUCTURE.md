# Folder structure

Two packages (no npm workspaces yet):

```text
prime-detailer-fs-demo/
  docs/                 # Architecture, standards, API, testing, branch scoping
  frontend/             # Next.js app
  backend/              # Express + Prisma API
  README.md
  render.yaml
```

## Frontend (`frontend/src/`)

```text
app/                    # App Router — keep pages thin
features/               # High-churn domains (e.g. booking-wizard)
components/
  ui/                   # Primitives (Button, Dialog, …)
  shared/               # Cross-feature (DataTable, EmptyState, …)
  <domain>/             # Feature UI (parties, job-cards, quotations, …)
hooks/                  # Shared hooks only
store/                  # Zustand (one aggregate ≈ one file)
lib/                    # API client, domain helpers, formatters
  payroll/              # Pure payroll calculations
  tabular-import/       # Shared CSV/Excel parse shell
  party/ customer-import/ vehicle-import/ reports/ …
types/                  # Domain type modules + barrel index.ts
```

**Where new code goes**

| Change | Prefer |
|--------|--------|
| New screen | Thin `app/(dashboard)/…/page.tsx` + `components/<domain>/` |
| Booking/job create wizard | `features/booking-wizard/` |
| Pure money/status rules | `lib/` (+ unit test) |
| Shared UI used 3+ times | `components/shared/` or `components/ui/` |

## Backend (`backend/src/`)

```text
routes/ → controllers/ → services/ → Prisma
middleware/             # auth, uploads, error-handler
validations/            # Zod collection payload schemas
constants/              # json-collections, collection-permissions, permission-keys
lib/                    # prisma, rbac, app-error, party-ledger
config/env.ts
```

`prisma/` holds schema, migrations, seed.

## Docs map

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System mental model |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Naming + PR checklist |
| [API_CONVENTIONS.md](./API_CONVENTIONS.md) | Envelope + errors + collections |
| [TESTING.md](./TESTING.md) | How/what to test |
| [BRANCH_SCOPING.md](./BRANCH_SCOPING.md) | Future server-side branch isolation design |
