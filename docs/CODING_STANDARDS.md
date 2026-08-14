# Coding standards

Follow these conventions when contributing. Prefer clarity and reuse over new abstractions.

## Principles

- Reuse `components/ui` and `components/shared` before inventing new primitives.
- Keep behavior unchanged unless fixing a bug or security issue.
- Prefer small, responsibility-based extractions modules over mega-files.
- Avoid premature frameworks (no new state library, repository layer, or forced form rewrite).
- Tailwind only for styling (see root README).

## Naming

| Kind | Convention |
|------|------------|
| React components | PascalCase export; kebab-case filename (`data-table.tsx`) |
| Hooks | `useSomething` / `use-something.ts` |
| Zustand stores | `*-store.ts` |
| Backend services | `*.service.ts` |
| Controllers / routes | `*.controller.ts` / `*.routes.ts` |
| Permission keys | `SCREAMING_SNAKE` — use `permission-keys` constants. Module keys (`JOB_CARDS`) vs sub-capabilities (`JOB_CARD_PRICING` for job price fields; enforce FE + backend PUT). Assign on Staff detail. Existing DBs: `cd backend && npm run grant:job-card-pricing`. |
| Pure helpers | camelCase functions in `lib/` |

## Frontend structure

- Thin `app/` pages; non-trivial UI in `components/<domain>/` or (later) `features/`.
- Domain helpers in `lib/`; shared formatters in `lib/utils.ts`, `lib/phone.ts`, `lib/vehicle-registration.ts`.
- Types live under `types/` by domain; import from `@/types` (barrel).
- Parties feature (hooks + live API) is the preferred pattern for new high-churn CRUD.

## Backend structure

```text
Request → Route → Auth/Permission → Controller (Zod) → Service → Prisma → { data, error }
```

- Every `AppJsonRow` collection needs an entry in `constants/json-collections.ts` **and** `constants/collection-permissions.ts`.
- Run `npm run test:collection-permissions` after changing collections.
- Do not add HTTP migrate/seed endpoints.

## Formatting & money

- Currency UI: `formatCurrency` / `formatInrFull` / `formatInrTable` from `lib/utils.ts`.
- Invoice paid/outstanding (including wallet): `lib/party/ledger-math.ts`.
- CGST/SGST half-split: `splitCgstSgst` in `lib/tax-invoice-format.ts`.
- Phone last-10 digits: `normalizePhoneDigits` in `lib/phone.ts`.
- Do not copy helpers that look similar but encode different rules (e.g. staff sales `paidTotal` excludes wallet).

## Forms

- New forms: prefer React Hook Form + Zod when validation is non-trivial.
- Do not mass-migrate existing `useState` forms without a product reason.
- Phone inputs / validation: `normalizePhoneDigits` from `lib/phone.ts` (not ad-hoc `.replace(/\D/g)`).
- Brand/model “+ New” dialogs: `ensureCatalogBrand` / `ensureCatalogModel` (+ `appendExtraBrand` / `appendExtraModel`) from `lib/vehicle-catalog-extras.ts` so UI extras stay in sync with the settings catalog.
- Company branding: Settings → **Branding & Theme** (`branding-theme-panel`) for logo, login background, login hero copy (`loginHeroHeading` / `loginHeroDescription` / `loginHeroFeatures`), and `brandPrimary`. Persist on `appSettings`; apply primary via CSS vars (`lib/brand-color.ts`). Login loads `GET /api/public/branding` (safe fields only). Hero defaults: `lib/login-hero-content.ts`.
- Zustand entity updates: prefer `updateX(id, updates: Partial<T>)` like appointments / job cards / quotations.
- Recharts tooltips: spread `CHART_TOOLTIP_PROPS` from `lib/chart-tooltip.ts` (`cursor: false` + theme label/item colors).

## PR checklist

- [ ] No new business behavior unless intentional and noted
- [ ] Reused existing formatters / permission keys / import shell where applicable
- [ ] Collection + permission map updated together (if applicable)
- [ ] Frontend `npm test` (and backend `test:collection-permissions` if touched)
- [ ] Types imported from `@/types` or `@/types/<domain>`

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)
- [TESTING.md](./TESTING.md)
- Root [README.md](../README.md)
