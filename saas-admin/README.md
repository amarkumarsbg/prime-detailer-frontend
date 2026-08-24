# Prime Detailers — SaaS Admin Portal

A separate frontend portal for the Prime Detailers **platform owner** (SUPER_ADMIN / PLATFORM_OWNER) to manage all customer organizations, subscriptions, billing, and payments.

## Architecture

```
Workshop App (./frontend)         SaaS Admin Portal (./saas-admin)
        |                                   |
        +-----------> Backend API <---------+
                     (./backend)
                    Port 4000
```

Both frontends share the **same backend** and **same database**. No second backend was created.

## Authentication

- Login via `POST /api/auth/login` using an account with role **`PLATFORM_OWNER`** or **`SUPER_ADMIN`**.
- Token stored in `localStorage` under `admin_token`.
- Platform-level APIs (`/api/platform/*`) require `PLATFORM_OWNER` JWT or `X-Platform-Admin-Key`.
- `SUPER_ADMIN` can log in but has limited access to platform APIs (backend enforces this).

## API Reference

Swagger UI is available at: **http://localhost:4000/api/docs/**

## Setup

```bash
cd saas-admin
cp .env.example .env.local
npm install
npm run dev
```

Open: http://localhost:3001 (or the port shown in terminal)

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API | `http://localhost:4000` |

## Local Development

1. Start the backend: `cd backend && npm run dev`
2. Start the SaaS Admin: `cd saas-admin && npm run dev`
3. Log in with a PLATFORM_OWNER or SUPER_ADMIN account.

## Production

```bash
npm run build
npm start
```

Deploy to: `admin.primedetailers.com`

Workshop App at: `app.primedetailers.com`

API at: `api.primedetailers.com`

## Project Structure

```
saas-admin/src/
  app/
    (auth)/login/         # Login page
    (admin)/
      dashboard/          # Platform overview KPIs
      organizations/      # Org list + detail + subscription management
      subscriptions/       # All subscriptions table
      payments/           # Payment verification
      renewals/           # Renewal history (stub — pending backend API)
      bills/              # Bills (stub — pending backend API)
      plans/              # Plan catalog + pricing config info
      referrals/          # Referral program (stub — pending backend API)
      audit/              # Audit logs (stub — pending backend API)
  api/                    # Typed API client functions
  components/
    ui/                   # Button, Card, Input, Badge, Skeleton
    layout/               # Sidebar, Topbar
    shared/               # Status badges
  hooks/                  # use-auth (requires admin role)
  lib/                    # api-client, utils
  store/                  # auth-store (Zustand)
  types/                  # Shared TypeScript types
```

## Known Limitations & Missing Backend APIs

The following features require new backend endpoints before they can be fully implemented:

| Feature | Missing API | Notes |
|---|---|---|
| Cross-org payments list | `GET /api/platform/payments` | Currently available per-org only |
| Cross-org renewals list | `GET /api/platform/renewals` | Currently available per-org only |
| Cross-org bills list | `GET /api/platform/bills` | Currently available per-org only |
| Audit log read | `GET /api/platform/audit` | `PlatformAuditLog` model exists, no read API |
| Referral management | `GET/POST /api/platform/referrals` | Discounts work in pricing; no admin CRUD |
| Suspend/Restore org | `POST /api/platform/organizations/:id/suspend` | Currently done via `PATCH /subscription` |
| Plan config API | `GET/PUT /api/platform/plans` | Pricing is env-var driven |

## Backend APIs Used

| Feature | Endpoint |
|---|---|
| Login | `POST /api/auth/login` |
| List all orgs | `GET /api/platform/organizations` |
| Org detail | `GET /api/platform/organizations/:orgId` |
| Patch subscription | `PATCH /api/platform/organizations/:orgId/subscription` |
| Verify payment | `POST /api/platform/organizations/:orgId/subscription/verify-payment` |
| Mark paid | `POST /api/platform/organizations/:orgId/subscription/mark-paid` |
| Pricing quote | `POST /api/organization/subscription/pricing` |
