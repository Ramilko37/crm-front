import {
  deleteSavedOrderFilter,
  extractOrderSavedFilterParams,
  markDefaultSavedOrderFilter,
  renameSavedOrderFilter,
  upsertSavedOrderFilter,
} from "@/shared/lib/order-saved-filters";

describe("order saved filters", () => {
  it("extracts only order filter params and skips pagination and UI state", () => {
    const params = new URLSearchParams();
    params.set("query", "invoice");
    params.set("page", "4");
    params.set("page_size", "100");
    params.set("filters_open", "1");
    params.append("status_names", "new");
    params.append("status_names", "in_progress");
    params.set("company_id", "42");

    expect(extractOrderSavedFilterParams(params)).toEqual({
      company_id: ["42"],
      query: ["invoice"],
      status_names: ["new", "in_progress"],
    });
  });

  it("creates, renames, marks default and deletes saved filters immutably", () => {
    const saved = upsertSavedOrderFilter([], {
      id: "filter-1",
      name: "Рабочие заказы",
      params: { query: ["invoice"], status_names: ["new"] },
      now: "2026-07-28T10:00:00.000Z",
    });

    expect(saved).toEqual([
      {
        id: "filter-1",
        name: "Рабочие заказы",
        params: { query: ["invoice"], status_names: ["new"] },
        isDefault: false,
        createdAt: "2026-07-28T10:00:00.000Z",
        updatedAt: "2026-07-28T10:00:00.000Z",
      },
    ]);

    const renamed = renameSavedOrderFilter(saved, "filter-1", "Мои заказы", "2026-07-28T10:05:00.000Z");
    expect(renamed[0]).toMatchObject({
      name: "Мои заказы",
      updatedAt: "2026-07-28T10:05:00.000Z",
    });
    expect(saved[0].name).toBe("Рабочие заказы");

    const withDefault = markDefaultSavedOrderFilter(renamed, "filter-1", "2026-07-28T10:10:00.000Z");
    expect(withDefault[0]).toMatchObject({ isDefault: true, updatedAt: "2026-07-28T10:10:00.000Z" });

    expect(deleteSavedOrderFilter(withDefault, "filter-1")).toEqual([]);
  });
});
