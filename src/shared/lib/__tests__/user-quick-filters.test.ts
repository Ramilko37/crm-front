import {
  getUserQuickFilters,
  getUserQuickFilterPatch,
  type UserQuickFilterCode,
} from "@/shared/lib/user-quick-filters";
import type { UserFilterParams } from "@/shared/types/entities";

describe("user quick filters", () => {
  it("marks all supported quick filters from current params", () => {
    const filters = getUserQuickFilters({
      is_active: true,
      role_name: "logist",
      has_company: false,
    });

    expect(filters.map((filter) => [filter.code, filter.checked])).toEqual([
      ["active", true],
      ["logist", true],
      ["manager", false],
      ["without_company", true],
    ]);
  });

  it.each<{
    code: UserQuickFilterCode;
    current: UserFilterParams;
    expected: Record<string, string | number | boolean | null>;
  }>([
    {
      code: "active",
      current: {},
      expected: { is_active: true, page: 1 },
    },
    {
      code: "active",
      current: { is_active: true },
      expected: { is_active: null, page: 1 },
    },
    {
      code: "logist",
      current: { role_name: "manager" },
      expected: { role_name: "logist", page: 1 },
    },
    {
      code: "manager",
      current: { role_name: "manager" },
      expected: { role_name: null, page: 1 },
    },
    {
      code: "without_company",
      current: {},
      expected: { has_company: false, page: 1 },
    },
    {
      code: "without_company",
      current: { has_company: false },
      expected: { has_company: null, page: 1 },
    },
  ])("builds URL patch for $code", ({ code, current, expected }) => {
    expect(getUserQuickFilterPatch(code, current)).toEqual(expected);
  });
});
