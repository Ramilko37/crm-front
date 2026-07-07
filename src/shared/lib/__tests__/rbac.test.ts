import { canAccessModule, getVisibleModules, isBackOfficeRole, normalizeRoleName } from "@/shared/lib/rbac";

describe("rbac helpers", () => {
  it("resolves known roles and keeps manager as own role", () => {
    expect(normalizeRoleName("manager")).toBe("manager");
    expect(normalizeRoleName("warehouse")).toBe("warehouse");
    expect(normalizeRoleName("unexpected_role")).toBe("anonymous");
  });

  it("checks order write access with superuser override", () => {
    expect(isBackOfficeRole("manager", false)).toBe(true);
    expect(isBackOfficeRole("warehouse", false)).toBe(true);
    expect(isBackOfficeRole("forwarder", false)).toBe(false);
    expect(isBackOfficeRole("client", false)).toBe(false);
    expect(isBackOfficeRole("client", true)).toBe(true);
  });

  it("checks module access for client and manager", () => {
    expect(canAccessModule("orders", "client", false)).toBe(true);
    expect(canAccessModule("profile", "client", false)).toBe(true);
    expect(canAccessModule("factories", "client", false)).toBe(false);
    expect(canAccessModule("trips", "client", false)).toBe(false);
    expect(canAccessModule("requests", "client", false)).toBe(true);
    expect(canAccessModule("client-messages", "client", false)).toBe(false);
    expect(canAccessModule("requests", "manager", false)).toBe(true);
    expect(canAccessModule("client-messages", "manager", false)).toBe(true);
    expect(canAccessModule("companies", "manager", false)).toBe(true);
    expect(canAccessModule("client-messages", "logist", false)).toBe(true);
    expect(canAccessModule("factories", "manager", false)).toBe(true);
    expect(canAccessModule("users", "manager", false)).toBe(true);
    expect(canAccessModule("users", "warehouse", false)).toBe(false);
  });

  it("builds visible modules from role", () => {
    expect(getVisibleModules("client", false)).toEqual(["orders", "requests", "profile"]);
    expect(getVisibleModules("manager", false)).toEqual([
      "orders",
      "client-messages",
      "requests",
      "companies",
      "factories",
      "trips",
      "path-points",
      "countries",
      "normative-documents",
      "email-templates",
      "users",
      "profile",
    ]);
  });
});
