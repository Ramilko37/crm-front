import { describe, expect, it } from "vitest";

import {
  buildTripPointPayload,
  hasDuplicateTripPointSequence,
} from "@/shared/lib/trip-point-forms";
import type { Factory, UserAdmin } from "@/shared/types/entities";

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

const forwarder: UserAdmin = {
  id: 25,
  company_id: null,
  personal_manager_id: null,
  full_name: "Forwarder One",
  login: "forwarder",
  email: "forwarder@example.com",
  phone: "+7",
  country: "Russia",
  city: "Moscow",
  address: "Tverskaya 1",
  role_name: "forwarder",
  is_active: true,
  total_orders: null,
  last_order_date: null,
};

describe("trip point form helpers", () => {
  it("builds factory loading point payload with its source id only", () => {
    const payload = buildTripPointPayload(
      {
        point_kind: "loading",
        loading_source: "factory",
        factory_id: factory.id,
        sequence: 1,
        is_completed: false,
      },
      { factories: [factory], forwarders: [forwarder] },
    );

    expect(payload).toEqual({
      sequence: 1,
      is_loading_point: true,
      factory_id: factory.id,
      planned_at: null,
      actual_at: null,
      is_completed: false,
    });
  });

  it("builds forwarder loading point payload with its source id only", () => {
    const payload = buildTripPointPayload(
      {
        point_kind: "loading",
        loading_source: "forwarder",
        forwarder_user_id: forwarder.id,
        sequence: 2,
      },
      { factories: [factory], forwarders: [forwarder] },
    );

    expect(payload).toEqual({
      sequence: 2,
      is_loading_point: true,
      forwarder_user_id: forwarder.id,
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
        { factories: [factory], forwarders: [forwarder] },
      ),
    ).toThrow("Выберите фабрику");
  });

  it("builds path point payload with is_loading_point false", () => {
    const payload = buildTripPointPayload(
      {
        point_kind: "path",
        path_point_id: 3,
        sequence: 3,
        is_completed: true,
      },
      { factories: [factory], forwarders: [forwarder] },
    );

    expect(payload).toMatchObject({
      is_loading_point: false,
      path_point_id: 3,
      sequence: 3,
      is_completed: true,
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
});
