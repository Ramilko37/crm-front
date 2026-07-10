# Trip Loading Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make factory and forwarder loading points use remote country, city, and source selection when creating or editing a trip point.

**Architecture:** Keep the trip detail page as the owner of lookup-query state and React Query requests. Keep `TripPointFormFields` presentational: it renders the three dependent controls and emits search text through callbacks. Simplify the form helper so a loading-point payload contains its source id only; the backend owns its source snapshot.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, Ant Design, Vitest.

## Global Constraints

- Route-point form and payload behaviour remain unchanged.
- A loading-point payload has `is_loading_point: true`, `sequence`, and exactly one of `factory_id` or `forwarder_user_id`.
- Loading-point payloads do not send `name`, `address`, `postcode`, `country`, `city`, `contact_name`, or `phone`.
- Factory city lookup uses `/api/trips/lookups/cities`; forwarder city lookup uses `/api/trips/lookups/forwarder-cities`.
- Lookup calls include `query` and do not run until their parent selection exists.

---

## File Structure

- Modify `src/shared/lib/trip-point-forms.ts`: form types and source-only loading-point payload creation.
- Modify `src/shared/lib/__tests__/trip-point-forms.test.ts`: expected minimal payload and source exclusivity.
- Modify `src/features/trips/trip-point-form-fields.tsx`: remote-search inputs, dependent clearing, and removal of manual snapshot population.
- Modify `src/app/(app)/trips/[id]/page.tsx`: lookup search state, query-aware React Query calls, and selected-source fallback during editing.

### Task 1: Build source-only loading point payloads

**Files:**
- Modify: `src/shared/lib/trip-point-forms.ts`
- Modify: `src/shared/lib/__tests__/trip-point-forms.test.ts`

**Interfaces:**
- Consumes: `TripPointFormValues` with `point_kind`, `loading_source`, `factory_id`, `forwarder_user_id`, and dates.
- Produces: `buildTripPointPayload(values): TripPointWritePayload` with no lookup context parameter.

- [ ] **Step 1: Write the failing tests**

Replace the factory and forwarder assertions with exact source-only expectations. Add a test for stale source ids:

```ts
expect(payload).toEqual({
  sequence: 1,
  is_loading_point: true,
  factory_id: factory.id,
  planned_at: null,
  actual_at: null,
  is_completed: false,
});

expect(() =>
  buildTripPointPayload({
    point_kind: "loading",
    loading_source: "factory",
    forwarder_user_id: forwarder.id,
    sequence: 1,
  }),
).toThrow("Выберите фабрику");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/shared/lib/__tests__/trip-point-forms.test.ts`

Expected: FAIL because current factory and forwarder payloads include snapshot fields and require lookup context.

- [ ] **Step 3: Implement the minimal helper change**

In `buildTripPointPayload`, remove the `context` argument and lookup-based source validation. For loading points, validate the selected id directly and return only:

```ts
return {
  sequence,
  is_loading_point: true,
  factory_id: values.factory_id,
  planned_at: toTripPointDateIso(values.planned_at),
  actual_at: toTripPointDateIso(values.actual_at),
  is_completed: values.is_completed ?? false,
};
```

Use the matching `forwarder_user_id` shape for forwarder mode. Remove manual snapshot properties from `TripPointFormValues` because loading points no longer write them.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/shared/lib/__tests__/trip-point-forms.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper change**

```bash
git add src/shared/lib/trip-point-forms.ts src/shared/lib/__tests__/trip-point-forms.test.ts
git commit -m "Simplify trip loading point payloads"
```

### Task 2: Add remote lookup controls to the loading-point form

**Files:**
- Modify: `src/features/trips/trip-point-form-fields.tsx`

**Interfaces:**
- Consumes: `onCountrySearch(value: string)`, `onCitySearch(value: string)`, `onFactorySearch(value: string)`, and `onForwarderSearch(value: string)` callbacks in addition to the existing option arrays and loading booleans.
- Produces: Ant Design selects that invoke the matching callback with search text and clear lower-level form state when their parent value changes.

- [ ] **Step 1: Write the failing UI test**

Create `src/features/trips/__tests__/trip-point-form-fields.test.tsx` that renders a loading point form with a country selected, types `mil` into the city select, and asserts `onCitySearch` was called. Add a second test that changes the source from factory to forwarder and asserts `city`, `factory_id`, and `forwarder_user_id` are cleared.

```tsx
await user.click(screen.getByLabelText("Город"));
await user.keyboard("mil");
expect(onCitySearch).toHaveBeenLastCalledWith("mil");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/trips/__tests__/trip-point-form-fields.test.tsx`

Expected: FAIL because the component does not expose search callbacks.

- [ ] **Step 3: Implement remote-search selects**

Add the four callback props. For country, city, factory, and forwarder selects set `filterOption={false}` and connect `onSearch` to the relevant callback. Keep source-specific city and entity controls disabled until their parent fields are selected. Remove `applyFactorySnapshot` and `applyForwarderSnapshot`; selecting an entity must only set its id.

Ensure source, country, and city handlers clear dependent ids. Do not render manual address, postcode, contact, or phone controls for loading points.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/features/trips/__tests__/trip-point-form-fields.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the form change**

```bash
git add src/features/trips/trip-point-form-fields.tsx src/features/trips/__tests__/trip-point-form-fields.test.tsx
git commit -m "Add remote loading point lookups"
```

### Task 3: Connect query-aware lookups to trip point create and edit flows

**Files:**
- Modify: `src/app/(app)/trips/[id]/page.tsx`
- Modify: `src/shared/lib/query-keys.ts`

**Interfaces:**
- Consumes: the callbacks from `TripPointFormFields` and the existing BFF routes.
- Produces: query keys and requests carrying `{ country_id, city, query, page: 1, page_size }`; both create and edit modal flows use the same data path.

- [ ] **Step 1: Write the failing unit test for lookup query parameters**

Extract a pure `buildTripPointLookupQuery` helper into `src/shared/lib/trip-point-forms.ts` and test it in `src/shared/lib/__tests__/trip-point-forms.test.ts`:

```ts
expect(buildTripPointLookupQuery({ countryId: 1, city: "Milan", query: "main" })).toEqual({
  country_id: 1,
  city: "Milan",
  query: "main",
  page: 1,
  page_size: 50,
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/shared/lib/__tests__/trip-point-forms.test.ts`

Expected: FAIL because `buildTripPointLookupQuery` does not exist.

- [ ] **Step 3: Implement query state and React Query requests**

Add four `useState("")` values for country, city, factory, and forwarder search text. Reset dependent search text together with dependent field ids. Pass the corresponding `query` parameter to:

```ts
apiRequest<PaginatedResponse<Country>>("/api/countries", { query: { page: 1, page_size: 50, query: countrySearch } })
apiRequest<PaginatedResponse<TripCityLookupItem>>("/api/trips/lookups/cities", { query: { country_id: pointCountryId, query: citySearch, page: 1, page_size: 50 } })
apiRequest<PaginatedResponse<TripCityLookupItem>>("/api/trips/lookups/forwarder-cities", { query: { country_id: pointCountryId, query: citySearch, page: 1, page_size: 50 } })
apiRequest<PaginatedResponse<Factory>>("/api/factories", { query: { country_id: pointCountryId, city: pointCity, query: factorySearch, page: 1, page_size: 50 } })
apiRequest<PaginatedResponse<TripForwarderLookupItem>>("/api/trips/lookups/forwarders", { query: { country_id: pointCountryId, city: pointCity, query: forwarderSearch, page: 1, page_size: 50 } })
```

Include each search value in its `queryKeys` parameters. Preserve selected factories and forwarders in the edit modal by merging a fallback option synthesized from the stored `TripPoint` with the lookup result. Keep country-id resolution from saved country text. Call `buildTripPointPayload({ ...values, sequence })` without lookup context.

- [ ] **Step 4: Run focused tests and static checks**

Run:

```bash
npm test -- src/shared/lib/__tests__/trip-point-forms.test.ts src/features/trips/__tests__/trip-point-form-fields.test.tsx
npm run typecheck
./node_modules/.bin/eslint src/app/'(app)'/trips/'[id]'/page.tsx src/features/trips/trip-point-form-fields.tsx src/shared/lib/trip-point-forms.ts
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Build and run the full test suite**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the production build completes.

- [ ] **Step 6: Commit the integration**

```bash
git add src/app/'(app)'/trips/'[id]'/page.tsx src/shared/lib/query-keys.ts src/shared/lib/trip-point-forms.ts src/shared/lib/__tests__/trip-point-forms.test.ts
git commit -m "Unify trip loading point selection"
```

## Plan Self-Review

- Spec coverage: Tasks 1-3 cover source-only payloads, both city endpoints, remote search, dependency clearing, and create/edit behaviour.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation steps remain.
- Type consistency: `TripPointFormFields` owns UI callbacks, the page owns query state, and `buildTripPointPayload` receives only form values in every consuming task.
