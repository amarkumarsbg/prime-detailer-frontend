# Branch scoping design (future)

**Status:** design only — do not implement in a drive-by refactor.  
**Risk:** High (breaks “all branches” admin views and bootstrap consumers).

## Current behavior

- JWT includes `branchId` for the signed-in user.
- UI filters many lists via `useBranchScope` / `use-scoped-data` (client-side).
- Most API list/CRUD endpoints (bootstrap, collections, customers) return **org-wide** data for any authenticated user with the right permission.
- Attendance public punch already verifies staff branch vs punch branch.

This is acceptable for a single-garage demo; it is **not** sufficient for multi-branch SaaS isolation.

## Goals

1. Staff with a branch assignment only read/write data for that branch (plus explicit exceptions).
2. `SUPER_ADMIN` / selected org roles can opt into “all branches”.
3. Existing UI “All branches” filter continues to work for privileged roles only.
4. No silent data loss — denied access returns `403` with `FORBIDDEN`, not empty lists that look like “no data”.

## Proposed rules (when implemented)

| Actor | List/read | Mutate |
|-------|-----------|--------|
| `SUPER_ADMIN` | All branches | All branches |
| `ADMIN` (org) | All branches (or configurable) | All branches |
| `BRANCH_MANAGER` / `MANAGER` tied to branch | Own branch (+ optional child branches later) | Own branch |
| Other staff | Own branch | Own branch where permission allows |

JSON documents (`jobCards`, `invoices`, …) must carry a reliable `branchId` (already common). Relational rows use `User.branchId`, `Attendance.branchId`, etc.

## Implementation sketch

1. **Helper** `assertBranchAccess(auth, resourceBranchId)` in `backend/src/lib/branch-scope.ts`.
2. **Collections** — filter `listCollectionItems` by `payload.branchId` unless actor is all-branches; reject PUT when body branch ≠ allowed set.
3. **Bootstrap** — either scoped payload or keep full hydrate only for all-branches roles (product choice).
4. **Customers/vehicles** — decide: global CRM vs branch-tagged (product). Prefer not inventing `customer.branchId` without a migration plan.
5. **Frontend** — keep client filters as UX; never treat them as security.

## Rollout

1. Feature flag `BRANCH_SCOPE_ENFORCE=true` (default off).
2. Audit which collections lack `branchId`; backfill or deny-write.
3. Enable for one staging org; compare counts vs UI filters.
4. Document role matrix in staff settings UI.

## Explicitly out of scope here

- Organization / multi-tenant `orgId` isolation (separate SaaS project; empty migration folder already exists).
- Rewriting AppJsonRow into per-branch relational tables.
