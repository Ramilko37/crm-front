import { describe, expect, it, vi } from "vitest";

import {
  getFilterPanelInitialState,
  readFilterPanelOpenState,
  writeFilterPanelOpenState,
} from "@/shared/lib/filter-panel-state";

function createStorage(initial?: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial ?? {}));

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("filter-panel-state", () => {
  it("uses saved panel state before active-filter fallback", () => {
    const storage = createStorage({ "crm:orders:filters-open": "closed" });

    expect(
      getFilterPanelInitialState({
        hasActiveFilters: true,
        storage,
        storageKey: "crm:orders:filters-open",
      }),
    ).toBe(false);
  });

  it("opens on active filters when no saved state exists", () => {
    expect(
      getFilterPanelInitialState({
        hasActiveFilters: true,
        storage: createStorage(),
        storageKey: "crm:orders:filters-open",
      }),
    ).toBe(true);
  });

  it("defaults to collapsed without saved state or active filters", () => {
    expect(
      getFilterPanelInitialState({
        hasActiveFilters: false,
        storage: createStorage(),
        storageKey: "crm:orders:filters-open",
      }),
    ).toBe(false);
  });

  it("ignores invalid saved values", () => {
    expect(readFilterPanelOpenState(createStorage({ key: "wat" }), "key")).toBeUndefined();
  });

  it("falls back to a cookie when storage has no saved state", () => {
    expect(readFilterPanelOpenState(createStorage(), "crm:orders:filters-open", "crm%3Aorders%3Afilters-open=open")).toBe(
      true,
    );
  });

  it("prefers storage before cookie fallback", () => {
    expect(
      readFilterPanelOpenState(
        createStorage({ "crm:orders:filters-open": "closed" }),
        "crm:orders:filters-open",
        "crm%3Aorders%3Afilters-open=open",
      ),
    ).toBe(false);
  });

  it("persists open and closed states", () => {
    const storage = createStorage();
    const writeCookie = vi.fn();

    writeFilterPanelOpenState(storage, "key", true, writeCookie);
    expect(readFilterPanelOpenState(storage, "key")).toBe(true);
    expect(writeCookie).toHaveBeenLastCalledWith("key=open; Path=/; Max-Age=31536000; SameSite=Lax");

    writeFilterPanelOpenState(storage, "key", false, writeCookie);
    expect(readFilterPanelOpenState(storage, "key")).toBe(false);
    expect(writeCookie).toHaveBeenLastCalledWith("key=closed; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});
