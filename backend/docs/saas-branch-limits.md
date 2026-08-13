# SaaS branch limits — support runbook

## Who can change commercial limits

- **Platform owner** (`PLATFORM_OWNER` role): sign in and open `/saas-admin/organizations`.
- **Automation**: `PATCH /api/platform/organizations/:orgId/subscription` with header `X-Platform-Admin-Key: $PLATFORM_ADMIN_API_KEY`.
- Studio `SUPER_ADMIN` / `ADMIN` **cannot** raise branch limits (Settings → Plan & billing is read-only).

## Seeded platform owner (local)

Defaults (override with env):

- Email: `platform@prime.local`
- Password: `ChangeMe!PlatformOwner1`

Env keys: `PLATFORM_OWNER_EMAIL`, `PLATFORM_OWNER_PASSWORD`, `PLATFORM_ADMIN_API_KEY`.

## Raise a studio’s branch limit

1. Customer hits “Branch limit reached” → Contact Us.
2. Sign in as platform owner → **Organizations** → open the studio.
3. Set `maxBranchesOverride` (e.g. `3`) and/or change plan code → **Save**.
4. Ask the studio user to refresh Locations / Settings (or re-login). Entitlement comes from bootstrap / `GET /api/organization/subscription`.

## CLI (optional)

```bash
cd backend
PLATFORM_ADMIN_API_KEY=… npx tsx scripts/saas-set-branch-limit.ts --org org-default --max 3
```

## Demo seed note

Seed sets **Starter `maxBranches = 1`** and keeps only the primary seed location (`br-main` / Delhi). Extra locations in `seed-data.json` are remapped onto that branch so the demo matches a real Starter plan.
