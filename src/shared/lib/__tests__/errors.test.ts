import { ApiError, extractApiDetail, extractApiValidationIssues } from "@/shared/lib/errors";

describe("extractApiDetail", () => {
  it("extracts detail from backend payload", () => {
    expect(extractApiDetail({ detail: "Validation failed" }, "fallback")).toBe("Validation failed");
  });

  it("falls back for unknown payload", () => {
    expect(extractApiDetail({ message: "oops" }, "fallback")).toBe("fallback");
    expect(extractApiDetail(null, "fallback")).toBe("fallback");
  });

  it("keeps string detail while extracting structured validation issues", () => {
    const payload = {
      detail: [
        { loc: ["body", "order", "invoice_number"], msg: "Field required", type: "missing" },
        { loc: ["body", "order", "declared_volume_m3"], msg: "Input should be greater than 0" },
      ],
    };

    expect(extractApiDetail(payload, "fallback")).toBe("Field required; Input should be greater than 0");
    expect(extractApiValidationIssues(payload)).toEqual(payload.detail);

    const error = new ApiError(422, extractApiDetail(payload, "fallback"), extractApiValidationIssues(payload));
    expect(error.detail).toBe("Field required; Input should be greater than 0");
    expect(error.issues).toEqual(payload.detail);
  });
});
