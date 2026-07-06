# Frontend Changelog For Backend

Date: 2026-07-06

## Context

Frontend was updated according to:

- `API_USAGE (7).md`
- `trips_countries (1).md`

Production frontend:

- `http://195.133.35.150:3001/login`

Backend used by frontend:

- `BASE_BACKEND_URL=http://195.133.35.150:8000`
- `/api/v1` is added by the frontend BFF internally.

Backend docs:

- `http://195.133.35.150:8000/docs`
- `http://195.133.35.150:8000/openapi.json`

## Orders: Pickup Window

Replaced legacy pickup date flow with the new pickup window contract.

Removed frontend usage of:

- `POST /api/v1/orders/{order_id}/pickup-date`
- `POST /api/v1/orders/{order_id}/cancel-pickup`
- `POST /api/v1/orders/bulk/pickup-date`
- `POST /api/v1/orders/bulk/cancel-pickup`

Added/used instead:

- `POST /api/v1/orders/{order_id}/pickup-window`
- `POST /api/v1/orders/{order_id}/clear-pickup-window`
- `POST /api/v1/orders/bulk/pickup-window`
- `POST /api/v1/orders/bulk/clear-pickup-window`

Frontend payload now sends:

```json
{
  "pickup_date_from": "YYYY-MM-DD",
  "pickup_date_to": "YYYY-MM-DD or null"
}
```

UI changes:

- List page action changed from single pickup date to pickup window.
- Bulk action changed from single pickup date to pickup window.
- Order detail page now edits `pickup_date_from` and `pickup_date_to`.
- Tables/cards display pickup as a range: `from - to`; if `to` is empty, only `from` is shown.

Compatibility note:

- Frontend still reads legacy `pickup_date` as a fallback for display/pre-fill if backend sends it, but all writes now use the new window endpoints.

## Client Orders: Pickup Window

Added BFF routes for client self-service pickup window endpoints:

- `POST /api/client/orders/{orderId}/pickup-window`
- `POST /api/client/orders/{orderId}/clear-pickup-window`

These proxy to:

- `POST /api/v1/client/orders/{order_id}/pickup-window`
- `POST /api/v1/client/orders/{order_id}/clear-pickup-window`

## Orders List UI: Excalidraw Table Update

Orders list table was rebuilt to match the Excalidraw layout more closely.

Visible columns now follow the expected order:

- documents icon/count
- `id`
- `order_number`
- client
- `country`
- factory
- forwarder
- `invoice_number`
- `declared_volume_m3`
- `volume_m3`
- `actual_volume_m3`
- `status_name`
- `days_in_current_status` with fallback to `days_same_status`
- `order_date`
- `ready_date`
- pickup window (`pickup_date_from` / `pickup_date_to`)
- description
- `user_comment`
- `forwarder_comment`
- special tariff
- `warehouse_comment`
- certificate status/download
- actions

Frontend now uses these list fields from `OrderListItemRead` when present:

- `declared_volume_m3`
- `documents_count`
- `is_factory_payment_via_company`
- `is_factory_payment_completed`
- `certificate_processed`
- `contact_name_snapshot`
- `contact_phone_snapshot`
- `contact_email_snapshot`
- `additional_description`
- `booking_comment`
- `special_tariff_currency_other_label`

Interactive cells:

- documents cell opens a popover with order documents and download actions;
- client cell opens client/contact info;
- factory cell opens factory/loading-address info when available;
- forwarder cell opens assigned forwarder info;
- invoice cell opens the full invoice value with copy support;
- status cell opens status/comment/trip context;
- description cell opens full description and goods lines;
- certificate cell opens certificate info and download action.

Implementation note:

- Popovers lazy-load `GET /api/v1/orders/{order_id}` through the frontend BFF.
- If the detail response does not include the richer nested block, frontend falls back to the data already present in `OrderListItemRead`.

## Trips: Lookups And Points

Added frontend BFF routes for new trip loading point flow:

- `GET /api/trips/lookups/cities`
- `GET /api/trips/lookups/forwarder-cities`
- `GET /api/trips/lookups/forwarders`
- `GET /api/trips/{tripId}/points`
- `POST /api/trips/{tripId}/points`
- `PATCH /api/trips/{tripId}/points/{tripPointId}`
- `GET /api/trips/{tripId}/orders`

These proxy to backend:

- `GET /api/v1/trips/lookups/cities`
- `GET /api/v1/trips/lookups/forwarder-cities`
- `GET /api/v1/trips/lookups/forwarders`
- `GET /api/v1/trips/{trip_id}/points`
- `POST /api/v1/trips/{trip_id}/points`
- `PATCH /api/v1/trips/{trip_id}/points/{trip_point_id}`
- `GET /api/v1/trips/{trip_id}/orders`

Removed old nested trip BFF routes:

- `/api/trips/{tripId}/path-points`
- `/api/trips/{tripId}/path-points/{tripPathPointId}`
- `/api/trips/{tripId}/loading-points`
- `/api/trips/{tripId}/loading-points/{loadingPointId}`

Global `/api/path-points` remains unchanged because backend contract still includes the path-points directory resource.

## Trips UI: Excalidraw Route Screen Update

Trips page was rebuilt toward the Excalidraw route-management layout.

Visible list behavior:

- top status tabs: all, new, in transit, Moscow warehouse, unloaded;
- persistent bulk action strip for selected trips;
- table columns now emphasize:
  - trip id;
  - trip name;
  - status;
  - trip type;
  - current route point;
  - truck number;
  - transport company;
  - date;
  - orders in trip;
  - trip actions.

Interactive cells/actions:

- trip name/current point opens a route drawer;
- orders button opens a drawer with `GET /api/v1/trips/{trip_id}/orders`;
- route drawer loads `GET /api/v1/trips/{trip_id}/points`;
- route drawer displays route/loading points with planned/actual dates and completion checkbox;
- completion checkbox patches `PATCH /api/v1/trips/{trip_id}/points/{trip_point_id}`;
- route drawer can add loading/path points through `POST /api/v1/trips/{trip_id}/points`.

Point create/update payload fields used by frontend:

- `sequence`
- `is_loading_point`
- `name`
- `country`
- `city`
- `address`
- `postcode`
- `contact_name`
- `phone`
- `planned_at`
- `actual_at`
- `is_completed`
- `forwarder_user_id` is supported in payload, but not yet exposed as a lookup selector in the modal.

## Trip List Types/UI

Frontend types were extended for enriched trip response:

- `created_at`
- `current_stage`
- `points`

Trip list now displays:

- current stage from `current_stage.point_name` when present;
- fallback to `current_point_name`;
- `created_at` column.

Trip filters/types now include:

- `quick_tab`
- `created_at_from`
- `created_at_to`

## Verification

Local checks:

```bash
npm exec --yes pnpm@10.34.4 -- vitest run
npm exec --yes pnpm@10.34.4 -- typecheck
```

Results:

- Vitest: 10 test files passed, 29 tests passed.
- Typecheck: passed.

Server/container checks:

- Production Docker build: passed.
- Frontend container recreated and running.
- Container port mapping: `3001 -> 3000`.

Smoke checks:

- `GET http://195.133.35.150:3001/login` -> `200 OK`
- `POST http://195.133.35.150:3001/api/orders/1/pickup-window` without token -> `401 Unauthorized`
- `GET http://195.133.35.150:3001/api/trips/lookups/cities?country_id=1` without token -> `401 Unauthorized`
- `POST http://195.133.35.150:3001/api/orders/1/pickup-date` -> `404 Not Found`

The `401` responses are expected because these endpoints require auth.

## Deployment Notes

Frontend was rebuilt and redeployed on:

- `195.133.35.150`
- project path: `/opt/crm-front`
- service/container: `crm-front`

Dockerfile note:

- `pnpm@10.34.4` is pinned in Docker build.
- Reason: latest `pnpm 11` requires Node 22+, while the production Docker image uses `node:20-alpine`.
- `next/font/google` was removed from `src/app/layout.tsx`; the server Docker build was retrying Google font downloads during `next build`.
- Current deployed container was built from a prebuilt standalone artifact with `Dockerfile.prebuilt` to avoid running the heavy Next build on the low-memory VPS.
