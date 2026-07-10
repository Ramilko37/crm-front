# Backend Changelog: Trip Loading Points

Date: 2026-07-10

## Context

Frontend now uses one loading-point flow for factories and forwarders:

```text
country -> city -> source
```

The flow is used both when creating a trip point and when editing an existing
trip point.

## Required Lookup Contract

All endpoints are under `/api/v1` and require the normal Bearer token.

### Countries

```http
GET /api/v1/countries?query=<text>
```

The `query` parameter searches the country name. The response must remain
compatible with the existing country lookup shape (`id`, `name_ru`, `name_en`,
`iso2`, `iso3`).

### Factory cities

```http
GET /api/v1/trips/lookups/cities?country_id=<id>&query=<text>
```

Return only cities available for factories in the selected country.

### Factories

```http
GET /api/v1/factories?country_id=<id>&city=<city>&query=<text>
```

Filter by `country_id`, exact selected `city`, and text query. The response
must contain the factory `id` and the fields needed for the standard factory
label.

### Forwarder cities

```http
GET /api/v1/trips/lookups/forwarder-cities?country_id=<id>&query=<text>
```

Return only cities where active users with role `forwarder` exist. This is a
separate lookup from the global city registry.

### Forwarders

```http
GET /api/v1/trips/lookups/forwarders?country_id=<id>&city=<city>&query=<text>
```

Filter active forwarder users by country, exact city, and query against:

- `full_name`
- `email`
- `phone`
- `company_name`

The response must expose the user id and a display `label`.

## Trip Point Write Contract

The frontend uses the unified endpoints:

```http
POST  /api/v1/trips/{trip_id}/points
PATCH /api/v1/trips/{trip_id}/points/{trip_point_id}
```

### Factory loading point

```json
{
  "sequence": 1,
  "is_loading_point": true,
  "factory_id": 7
}
```

### Forwarder loading point

```json
{
  "sequence": 2,
  "is_loading_point": true,
  "forwarder_user_id": 25
}
```

For loading points the backend must validate:

- `is_loading_point` is `true`;
- `sequence` is present and unique within the trip;
- exactly one source is present: `factory_id` or `forwarder_user_id`;
- both source ids are rejected;
- a missing source id is rejected;
- the selected factory/forwarder exists and is allowed for the selected country/city.

The frontend no longer sends these fields for loading-point writes:

- `name`
- `address`
- `postcode`
- `country`
- `city`
- `contact_name`
- `phone`

The backend should derive or populate the returned point snapshot from the
linked source where the `LoadingPointRead` response requires those display
fields.

## Editing Existing Points

`PATCH /api/v1/trips/{trip_id}/points/{trip_point_id}` must support changing a
loading point source from factory to forwarder and from forwarder to factory.
The previous source must be cleared so the stored point never contains both
`factory_id` and `forwarder_user_id`.

Existing points created with the legacy snapshot fields must remain readable.
When edited through the new flow, they must be normalized to the source-only
contract.

## Error Contract

Use `422 Unprocessable Entity` for validation failures, including:

- both source ids supplied;
- no source supplied;
- invalid source id;
- duplicate sequence;
- invalid source/country/city combination.

## Acceptance Checklist

- [ ] Country search accepts `query`.
- [ ] Factory city lookup is country-scoped and queryable.
- [ ] Factory lookup accepts `country_id`, `city`, and `query`.
- [ ] Forwarder city lookup returns only cities with active forwarders.
- [ ] Forwarder lookup searches all four documented user fields.
- [ ] Minimal factory payload is accepted.
- [ ] Minimal forwarder payload is accepted.
- [ ] Backend rejects zero or two source ids.
- [ ] PATCH can switch the source and clears the old source id.
- [ ] Existing legacy points remain readable.
- [ ] `LoadingPointRead` contains enough source/snapshot data for the trip UI.
