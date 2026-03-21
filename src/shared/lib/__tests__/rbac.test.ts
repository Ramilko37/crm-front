import { isBackOfficeRole, normalizeRoleName } from "@/shared/lib/rbac";

describe("rbac helpers", () => {
  it("maps manager to administrator", () => {
    expect(normalizeRoleName("manager")).toBe("administrator");
  });

  it("resolves known roles and falls back to anonymous", () => {
    expect(normalizeRoleName("warehouse")).toBe("warehouse");
    expect(normalizeRoleName("unexpected_role")).toBe("anonymous");
  });

  it("checks back-office access with superuser override", () => {
    expect(isBackOfficeRole("warehouse", false)).toBe(true);
    expect(isBackOfficeRole("client", false)).toBe(false);
    expect(isBackOfficeRole("client", true)).toBe(true);
  });
});
