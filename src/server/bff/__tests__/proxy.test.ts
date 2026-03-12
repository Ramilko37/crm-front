import { buildBackendUrl } from "@/server/bff/backend-url";

describe("buildBackendUrl", () => {
  it("joins prefix and passes querystring", () => {
    const url = buildBackendUrl("/orders", "?page=1&page_size=50");
    expect(url).toContain("/api/v1/orders");
    expect(url).toContain("page=1");
  });
});
