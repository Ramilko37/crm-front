import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyToBackend = vi.fn();

vi.mock("@/server/bff/proxy", () => ({
  proxyToBackend,
}));

describe("Trips nested API routes", () => {
  beforeEach(() => {
    proxyToBackend.mockReset();
  });

  it("proxies GET trip points", async () => {
    const { GET } = await import("../[tripId]/points/route");
    const request = new Request("http://localhost/api/trips/15/points") as never;

    await GET(request, { params: Promise.resolve({ tripId: "15" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/15/points");
  });

  it("proxies POST trip points", async () => {
    const { POST } = await import("../[tripId]/points/route");
    const request = new Request("http://localhost/api/trips/15/points", { method: "POST" }) as never;

    await POST(request, { params: Promise.resolve({ tripId: "15" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/15/points");
  });

  it("proxies PATCH trip point", async () => {
    const { PATCH } = await import("../[tripId]/points/[tripPointId]/route");
    const request = new Request("http://localhost/api/trips/15/points/101", { method: "PATCH" }) as never;

    await PATCH(request, { params: Promise.resolve({ tripId: "15", tripPointId: "101" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/15/points/101");
  });

  it("proxies scoped trip orders with the original request", async () => {
    const { GET } = await import("../[tripId]/orders/route");
    const request = new Request("http://localhost/api/trips/15/orders?page=1&page_size=50") as never;

    await GET(request, { params: Promise.resolve({ tripId: "15" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/15/orders");
  });

  it("proxies trip factory city lookup", async () => {
    const { GET } = await import("../lookups/cities/route");
    const request = new Request("http://localhost/api/trips/lookups/cities?country_id=15") as never;

    await GET(request);

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/lookups/cities");
  });

  it("proxies trip forwarder city lookup", async () => {
    const { GET } = await import("../lookups/forwarder-cities/route");
    const request = new Request("http://localhost/api/trips/lookups/forwarder-cities?country_id=15") as never;

    await GET(request);

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/lookups/forwarder-cities");
  });

  it("proxies trip forwarder lookup", async () => {
    const { GET } = await import("../lookups/forwarders/route");
    const request = new Request("http://localhost/api/trips/lookups/forwarders?country_id=15&city=Milan") as never;

    await GET(request);

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/lookups/forwarders");
  });
});
