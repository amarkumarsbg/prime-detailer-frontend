# SaaS branch limits & platform owner — support runbook

## Two logins (do not mix)

| Role | Who | Access |
|------|-----|--------|
| `PLATFORM_OWNER` | **You** (software vendor) | `/saas-admin/*` — all customers, plans, branch limits, notes |
| `SUPER_ADMIN` | Customer studio owner | Normal app only — their organization |

Customers must never receive the platform login.

## Ensure your platform login (production)

Env on the API service (Render → Environment):

```
PLATFORM_OWNER_EMAIL=you@yourcompany.com
PLATFORM_OWNER_PASSWORD=use-a-strong-secret
# optional:
# PLATFORM_OWNER_NAME=Platform Owner
# PLATFORM_OWNER_PHONE=+919876543210
# PLATFORM_ADMIN_API_KEY=long-random-key-for-CLI
```

Then in **Render Shell** (API service):

```bash
cd backend   # or the folder that contains package.json
npm run saas:ensure-platform-owner
```

This upserts only the platform user. It does **not** re-seed or wipe customer data.

Local defaults (if env unset): `platform@prime.local` / `ChangeMe!PlatformOwner1`.

## Raise a studio’s branch limit

1. Customer hits “Branch limit reached” → Contact support.
2. Sign in as platform owner → `/saas-admin/organizations` → open the studio.
3. Set `maxBranchesOverride` (e.g. `2`) and/or change plan → **Save**.
4. Ask the studio to refresh Locations / re-login.

## Automation CLI (optional)

```bash
cd backend
PLATFORM_ADMIN_API_KEY=… npx tsx scripts/saas-set-branch-limit.ts --org org-default --max 3
```

## Force one branch (testing only)

```bash
CONFIRM=YES npm run saas:force-one-branch -- --keep br-main
```

## Demo seed note

`npm run db:seed` sets Starter `maxBranches = 1`, keeps primary branch, and creates platform owner from env. Prefer `saas:ensure-platform-owner` on production instead of full seed.
