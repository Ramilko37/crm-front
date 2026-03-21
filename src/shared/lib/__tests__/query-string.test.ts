import { buildQueryString, parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";

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

  it("parseSearchArray supports repeat-key and legacy csv", () => {
    const repeated = new URLSearchParams(
      "status_names=ready&status_names=in_transit&status_names=archived",
    );
    expect(parseSearchArray(repeated, "status_names")).toEqual(["ready", "in_transit", "archived"]);

    const legacy = new URLSearchParams("status_names=ready,in_transit");
    expect(parseSearchArray(legacy, "status_names")).toEqual(["ready", "in_transit"]);

    const empty = new URLSearchParams();
    expect(parseSearchArray(empty, "status_names")).toEqual([]);
  });

  it("setSearchPatch updates and clears params", () => {
    const current = new URLSearchParams("page=2&query=test");
    const next = setSearchPatch(current, {
      page: 1,
      query: null,
      status_names: ["ready", "in_transit"],
    });

    expect(next).toContain("page=1");
    expect(next).toContain("status_names=ready");
    expect(next).toContain("status_names=in_transit");
    expect(next).not.toContain("status_names=ready%2Cin_transit");
    expect(next).not.toContain("query=");
  });
});
