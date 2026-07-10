# Trip Loading Points Design

## Goal

Make loading points use the same country-to-city-to-source selection flow for
factories and forwarders. Apply the flow when creating and editing trip points.

## Scope

- Keep route points unchanged.
- For loading points, show a source switch: factory or forwarder.
- Select country first, then a city available for that source, then the source
  entity.
- Use remote search for countries, cities, factories, and forwarders.
- Hide manual loading-point snapshot fields: address, postcode, contact name,
  and phone.

## Data Flow

Factory mode:

1. `GET /api/v1/countries?query=<text>`
2. `GET /api/v1/trips/lookups/cities?country_id=<id>&query=<text>`
3. `GET /api/v1/factories?country_id=<id>&city=<city>&query=<text>`

Forwarder mode:

1. `GET /api/v1/countries?query=<text>`
2. `GET /api/v1/trips/lookups/forwarder-cities?country_id=<id>&query=<text>`
3. `GET /api/v1/trips/lookups/forwarders?country_id=<id>&city=<city>&query=<text>`

Changing the source, country, or city clears all dependent selections. Lookup
requests do not run until their required preceding selection exists.

## Editing Existing Points

The form derives the source mode from the saved `factory_id` or
`forwarder_user_id`. It maps the saved country name to a country id, retains
the saved city, and makes the corresponding lookup requests. The currently
saved source remains selectable even if it is absent from a refreshed lookup
result.

## Save Contract

New points use `POST /api/v1/trips/{trip_id}/points`; existing points use
`PATCH /api/v1/trips/{trip_id}/points/{trip_point_id}`.

Loading-point payloads always contain `sequence`, `is_loading_point: true`,
and exactly one source id:

- factory mode: `factory_id`
- forwarder mode: `forwarder_user_id`

They never contain both source ids and do not include manually edited snapshot
fields. Route-point payloads keep their existing behaviour.

## Validation And Tests

- Unit-test payload construction for both source modes and the exclusion of
  manual snapshot fields.
- Test that changing a loading source rejects the stale source id.
- Keep existing point-form payload and duplicate-sequence coverage green.
- Run the focused tests, project tests, type check, lint for source files, and
  a production build.
