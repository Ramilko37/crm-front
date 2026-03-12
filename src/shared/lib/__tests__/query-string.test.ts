import { buildQueryString, parseCsv, setSearchPatch } from "@/shared/lib/query-string";

describe("query-string utilities", () => {
  it("buildQueryString serializes arrays and ignores empty values", () => {
    const output = buildQueryString({
      query: "table",
      page: 2,
      status_names: ["ready", "in_transit"],
      empty: "",
      nil: undefined,
    });

    expect(output).toContain("query=table");
    expect(output).toContain("page=2");
    expect(output).toContain("status_names=ready");
    expect(output).toContain("status_names=in_transit");
    expect(output).not.toContain("empty=");
  });

  it("parseCsv returns normalized array", () => {
    expect(parseCsv(" ready, in_transit , ,archived")).toEqual([
      "ready",
      "in_transit",
      "archived",
    ]);
    expect(parseCsv(null)).toEqual([]);
  });

  it("setSearchPatch updates and clears params", () => {
    const current = new URLSearchParams("page=2&query=test");
    const next = setSearchPatch(current, { page: 1, query: null, status_names: ["ready"] });

    expect(next).toContain("page=1");
    expect(next).toContain("status_names=ready");
    expect(next).not.toContain("query=");
  });
});
