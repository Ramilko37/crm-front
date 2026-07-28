import type { NextRequest } from "next/server";
import { NextRequest as NextServerRequest } from "next/server";

import { buildBackendUrl } from "@/server/bff/backend-url";
import { proxyToBackend } from "@/server/bff/proxy";

const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("buildBackendUrl", () => {
  it("joins prefix and passes querystring", () => {
    const url = buildBackendUrl("/orders", "?page=1&page_size=50");
    expect(url).toContain("/api/v1/orders");
    expect(url).toContain("page=1");
  });
});

describe("proxyToBackend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("proxies empty 204 responses without parsing a JSON body", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "token" })),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextServerRequest("http://frontend.test/api/users/2/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: "secret123" }),
    }) as NextRequest;

    const response = await proxyToBackend(request, "/users/2/password");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
