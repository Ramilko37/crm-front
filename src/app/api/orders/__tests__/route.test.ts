import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyToBackend = vi.fn();
const proxyJsonPayloadAsMultipart = vi.fn();

vi.mock("@/server/bff/proxy", () => ({
  proxyToBackend,
  proxyJsonPayloadAsMultipart,
}));

vi.mock("@/server/bff/orchestration", () => ({
  buildInternalOrderMultipartPayload: vi.fn(),
}));

describe("POST /api/orders route", () => {
  beforeEach(() => {
    proxyToBackend.mockReset();
    proxyJsonPayloadAsMultipart.mockReset();
  });

  it("proxies canonical multipart body as-is", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
      },
    });

    await POST(request as never);

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/orders");
    expect(proxyJsonPayloadAsMultipart).not.toHaveBeenCalled();
  });

  it("uses JSON->multipart fallback for legacy callers", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ order_number: "ORD-1" }),
    });

    await POST(request as never);

    expect(proxyJsonPayloadAsMultipart).toHaveBeenCalledWith(
      request,
      "/orders",
      expect.objectContaining({
        payloadBuilder: expect.any(Function),
      }),
    );
    expect(proxyToBackend).not.toHaveBeenCalled();
  });
});
