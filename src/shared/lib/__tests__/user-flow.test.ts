import { describe, expect, it } from "vitest";

import { buildUserWritePayload, isForwarderRole, requiredWhenForwarder } from "@/shared/lib/user-flow";

describe("user flow helpers", () => {
  it("builds forwarder write payload without legacy frontend-only fields", () => {
    const legacyValues = {
        company_name: " Forwarder LLC ",
        full_name: "Forwarder Milan",
        login: "forwarder-milan",
        password: "password123",
        role_name: "forwarder",
        personal_manager_id: 2,
        email: "forwarder@example.com",
        phone: "+3900000001",
        country: "Italy",
        city: "Milan",
        address: "Via Roma 1",
        is_active: false,
        is_logist: true,
        selectedCountryId: 15,
      };

    const payload = buildUserWritePayload(legacyValues, { includeCompanyName: true, isManagerActor: true });

    expect(payload).toEqual({
      company_name: "Forwarder LLC",
      full_name: "Forwarder Milan",
      login: "forwarder-milan",
      password: "password123",
      role_name: "forwarder",
      personal_manager_id: 2,
      email: "forwarder@example.com",
      phone: "+3900000001",
      country: "Italy",
      city: "Milan",
      address: "Via Roma 1",
      is_active: true,
    });
    expect(payload).not.toHaveProperty("is_logist");
    expect(payload).not.toHaveProperty("selectedCountryId");
  });

  it("detects forwarder role by normalized role_name only", () => {
    expect(isForwarderRole("forwarder")).toBe(true);
    expect(isForwarderRole("logist")).toBe(false);
    expect(isForwarderRole(undefined)).toBe(false);
  });

  it("accepts a selected numeric country id for a forwarder", async () => {
    const rule = requiredWhenForwarder("forwarder", "Выберите страну");

    await expect(rule.validator(undefined, 39)).resolves.toBeUndefined();
    await expect(rule.validator(undefined, undefined)).rejects.toThrow("Выберите страну");
  });
});
