import { describe, expect, it } from "vitest";

import {
  buildTripPointLookupQuery,
  buildTripPointPayload,
  hasDuplicateTripPointSequence,
} from "@/shared/lib/trip-point-forms";
import type { Factory, PathPoint, TripForwarderLookupItem } from "@/shared/types/entities";

const factory: Factory = {
  id: 7,
  country_id: null,
  name: "Factory A",
  country: "Italy",
  city: "Milan",
  address: "Via Roma 1",
  postcode: "20100",
  phone: "+39",
  primary_email: null,
  certificate_status: null,
};

const forwarder: TripForwarderLookupItem = {
  id: 25,
  company_id: null,
  full_name: "Forwarder One",
  company_name: "Forwarder Company",
  country: "Russia",
  city: "Moscow",
  label: "Forwarder Company · Forwarder One",
};

const pathPoint: PathPoint = {
  id: 3,
  name_ru: "Погранпереход",
  name_it: null,
  name_en: "Border crossing",
  country: "Poland",
  city: "Warsaw",
};

const pointContext = {
  factories: [factory],
  forwarders: [forwarder],
  pathPoints: [pathPoint],
};

describe("trip point form helpers", () => {
  it("copies the selected factory snapshot into a loading point payload", () => {
    const payload = buildTripPointPayload({
      point_kind: "loading",
      loading_source: "factory",
      factory_id: factory.id,
      sequence: 1,
      is_completed: false,
    }, pointContext);

    expect(payload).toEqual({
      sequence: 1,
      is_loading_point: true,
      factory_id: factory.id,
      name: "Factory A",
      address: "Via Roma 1",
      postcode: "20100",
      country: "Italy",
      city: "Milan",
      phone: "+39",
      planned_at: null,
      actual_at: null,
      is_completed: false,
    });
  });

  it("copies the selected forwarder snapshot into a loading point payload", () => {
    const payload = buildTripPointPayload({
      point_kind: "loading",
      loading_source: "forwarder",
      forwarder_user_id: forwarder.id,
      sequence: 2,
    }, pointContext);

    expect(payload).toEqual({
      sequence: 2,
      is_loading_point: true,
      forwarder_user_id: forwarder.id,
      name: "Forwarder Company",
      address: "Russia, Moscow",
      country: "Russia",
      city: "Moscow",
      contact_name: "Forwarder One",
      planned_at: null,
      actual_at: null,
      is_completed: false,
    });
  });

  it("rejects a loading point whose selected source id does not match its mode", () => {
    expect(() =>
      buildTripPointPayload(
        {
          point_kind: "loading",
          loading_source: "factory",
          forwarder_user_id: forwarder.id,
          sequence: 1,
        },
        pointContext,
      ),
    ).toThrow("Выберите фабрику");
  });

  it("copies the selected path point snapshot into a route point payload", () => {
    const payload = buildTripPointPayload({
      point_kind: "path",
      path_point_id: pathPoint.id,
      sequence: 3,
      is_completed: true,
    }, pointContext);

    expect(payload).toMatchObject({
      is_loading_point: false,
      path_point_id: 3,
      sequence: 3,
      is_completed: true,
      name: "Погранпереход",
      country: "Poland",
      city: "Warsaw",
    });
    expect(payload.factory_id).toBeUndefined();
    expect(payload.forwarder_user_id).toBeUndefined();
  });

  it("detects duplicate sequence except for the edited point", () => {
    const points = [
      { id: 1, sequence: 1 },
      { id: 2, sequence: 2 },
    ];

    expect(hasDuplicateTripPointSequence(2, points)).toBe(true);
    expect(hasDuplicateTripPointSequence(2, points, 2)).toBe(false);
    expect(hasDuplicateTripPointSequence(3, points)).toBe(false);
  });

  it("builds a query-aware lookup request for a loading point", () => {
    expect(buildTripPointLookupQuery({ countryId: 1, city: "Milan", query: "main" })).toEqual({
      country_id: 1,
      city: "Milan",
      query: "main",
      page: 1,
      page_size: 50,
    });
  });
});
