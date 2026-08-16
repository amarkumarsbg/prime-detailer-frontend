# Testing

## Quick run

From repo root:

```bash
npm test
```

Runs frontend Vitest + backend security/check scripts.

| Command | Scope |
|---------|--------|
| `npm run test:frontend` / `cd frontend && npm test` | All frontend Vitest suites |
| `cd frontend && npm run test:unit` | `src/lib/**` unit tests only |
| `npm run test:backend` / `cd backend && npm run test:security` | Collection permissions, permission keys, payload schemas, RBAC, job-card pricing guard |

## What to test (priorities)

Prefer pure domain logic over thin UI wrappers:

1. **Money** — ledger paid/outstanding, GST split/rate normalize, service line pricing
2. **Payroll** — `lib/payroll/calculations.ts` base pay + advance recovery plan
3. **Edit/lock policies** — job card + quotation
4. **RBAC** — nav permission helpers (FE) + role allowlists (BE)
5. **Import validation** — customer/vehicle row validators (already covered)
6. **Pickup/drop flow** — already covered

Avoid testing every button wrapper or page layout.

## Backend check scripts

```bash
cd backend
npm run test:collection-permissions
npm run test:permission-keys
npm run test:collection-payloads   # needs DB with seed data
npm run test:rbac
npm run test:data-scope
npm run test:bootstrap-thin
npm run test:list-scope
```

`test:collection-payloads` requires Postgres + seeded rows.

Bootstrap is **thin** (branches + branding + entitlement). Domain data loads via permission-scoped collection/entity APIs; `test:bootstrap-thin` and `test:data-scope` guard that contract.

## Future E2E (not wired yet)

Optional Playwright smoke (manual candidate):

1. Login
2. Create job card / walk-in booking
3. Advance status → invoice
4. Open public invoice URL

Do not block PRs on E2E until a stable CI browser job exists.

## Adding a unit test

1. Put `*.test.ts` next to the module under `frontend/src/lib/`
2. Import via `@/` alias (see `vitest.config.ts`)
3. Freeze fixtures — assert current rounding/behavior; do not “improve” formulas in the same PR as the test unless fixing a known bug
