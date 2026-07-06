# Frontend Changes Report — 2026-04-05

## Release info
- Commit: `e5acd5a`
- Message: `fix(frontend): align create-flow contract and gate client-forbidden lookups`
- Branch: `main`
- Deploy target: `kozpavelp1.oblaka.tech` (`84.47.150.248`)

## What was changed

### 1) BFF create-contract alignment
File: `src/server/bff/orchestration.ts`
- Removed legacy fallback mapping for contact fields in create payload builders.
- Internal order create now sends only `company_contact_id` (no fallback to legacy `contact_user_id` / `user_id`).
- Request create now sends only `company_contact_id` (no fallback to legacy `contact_user_id`).

### 2) Shared types updated for backend parity
File: `src/shared/types/entities.ts`
- `order_number` in read models switched to nullable:
  - `OrderListItem.order_number: string | null`
  - `ClientMessageInboxItem.order_number: string | null`
- Added metadata field for self-delivery selector:
  - `OrderCreateMetadata.self_delivery_forwarder_options[]`

### 3) Order create flow updated (UI + validation)
File: `src/app/(app)/orders/page.tsx`
- `order_number` in create form is optional (no required rule).
- Create form now uses metadata-driven `order_type` options without frontend hardcoded fallback.
- Self-delivery forwarder selector switched to backend metadata (`self_delivery_forwarder_options[]`).
- Added create-form validations:
  - email format for `create_factory.primary_email`
  - phone format for `create_factory.loading_address.phone`
  - required `postcode_id` and `city_id` for create-factory flow
- Factory create payload aligned to single country source of truth:
  - `create_factory.country_id` and `create_factory.loading_address.country_id` are synchronized.
- Added self-delivery parity guard:
  - if both `self_delivery_forwarder_user_id` and `assigned_forwarder_user_id` are sent, they must match.
- Added basic field-level mapping for backend `422` errors in create modal.

### 4) Removed client-forbidden lookup calls (403 noise cleanup)
Files:
- `src/app/(app)/orders/page.tsx`
- `src/app/(app)/orders/[id]/page.tsx`

Changes:
- Disabled trips lookup query for roles that should not call it.
- In order detail page, disabled operational lookups (`trips`, `forwarders`) for client role.
- Result: client session no longer triggers unnecessary `GET /api/trips` with `Insufficient permissions`.

### 5) Safe rendering for nullable order numbers
Files:
- `src/app/(app)/orders/page.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `src/app/(app)/client-messages/page.tsx`

Changes:
- Added safe fallback rendering (`—`) when `order_number` is absent.

### 6) Requests list cleanup
File: `src/app/(app)/requests/page.tsx`
- Removed legacy `contact_user_id` fallback in contact display.

### 7) Tests updated
File: `src/server/bff/__tests__/orchestration.test.ts`
- Added tests to confirm legacy contact fields are not mapped by BFF payload builders.

## Verification
Local checks:
- `pnpm typecheck` — passed
- `pnpm test` — passed (`23` tests)
- `pnpm lint` — passed

Production checks:
- Deploy completed for commit `e5acd5a`.
- Container `crm-front` restarted successfully.
- Health check: `GET /login` => `HTTP/1.1 200 OK`.
