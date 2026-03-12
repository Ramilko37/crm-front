import { extractApiDetail } from "@/shared/lib/errors";

describe("extractApiDetail", () => {
  it("extracts detail from backend payload", () => {
    expect(extractApiDetail({ detail: "Validation failed" }, "fallback")).toBe("Validation failed");
  });

  it("falls back for unknown payload", () => {
    expect(extractApiDetail({ message: "oops" }, "fallback")).toBe("fallback");
    expect(extractApiDetail(null, "fallback")).toBe("fallback");
  });
});
