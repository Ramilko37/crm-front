import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

vi.mock("@/server/bff/proxy", () => ({
  proxyToBackend: vi.fn(() => new Response(null, { status: 204 })),
}));

const request = new Request("http://frontend.test/api/test?query=mil") as NextRequest;

describe("contract route mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies single order pickup window endpoints to the backend contract", async () => {
    const pickupWindow = await import("@/app/api/orders/[orderId]/pickup-window/route");
    const clearPickupWindow = await import("@/app/api/orders/[orderId]/clear-pickup-window/route");

    await pickupWindow.POST(request, { params: Promise.resolve({ orderId: "42" }) });
    await clearPickupWindow.POST(request, { params: Promise.resolve({ orderId: "42" }) });

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/orders/42/pickup-window");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/orders/42/clear-pickup-window");
  });

  it("proxies client order pickup window endpoints to the backend contract", async () => {
    const pickupWindow = await import("@/app/api/client/orders/[orderId]/pickup-window/route");
    const clearPickupWindow = await import("@/app/api/client/orders/[orderId]/clear-pickup-window/route");

    await pickupWindow.POST(request, { params: Promise.resolve({ orderId: "42" }) });
    await clearPickupWindow.POST(request, { params: Promise.resolve({ orderId: "42" }) });

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/client/orders/42/pickup-window");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/client/orders/42/clear-pickup-window");
  });

  it("proxies bulk order pickup window endpoints to the backend contract", async () => {
    const pickupWindow = await import("@/app/api/orders/bulk/pickup-window/route");
    const clearPickupWindow = await import("@/app/api/orders/bulk/clear-pickup-window/route");

    await pickupWindow.POST(request);
    await clearPickupWindow.POST(request);

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/orders/bulk/pickup-window");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/orders/bulk/clear-pickup-window");
  });

  it("proxies trip lookup endpoints used by loading point forms", async () => {
    const cities = await import("@/app/api/trips/lookups/cities/route");
    const forwarderCities = await import("@/app/api/trips/lookups/forwarder-cities/route");
    const forwarders = await import("@/app/api/trips/lookups/forwarders/route");

    await cities.GET(request);
    await forwarderCities.GET(request);
    await forwarders.GET(request);

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/trips/lookups/cities");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/trips/lookups/forwarder-cities");
    expect(proxyToBackend).toHaveBeenNthCalledWith(3, request, "/trips/lookups/forwarders");
  });

  it("proxies user lookup endpoints used by user forms", async () => {
    const managers = await import("@/app/api/users/lookups/managers/route");
    const cities = await import("@/app/api/users/lookups/cities/route");

    await managers.GET(request);
    await cities.GET(request);

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/users/lookups/managers");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/users/lookups/cities");
  });

  it("proxies unified trip points endpoints", async () => {
    const points = await import("@/app/api/trips/[tripId]/points/route");
    const point = await import("@/app/api/trips/[tripId]/points/[tripPointId]/route");

    await points.GET(request, { params: Promise.resolve({ tripId: "7" }) });
    await points.POST(request, { params: Promise.resolve({ tripId: "7" }) });
    await point.PATCH(request, { params: Promise.resolve({ tripId: "7", tripPointId: "9" }) });

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/trips/7/points");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/trips/7/points");
    expect(proxyToBackend).toHaveBeenNthCalledWith(3, request, "/trips/7/points/9");
  });

  it("proxies trip orders endpoint", async () => {
    const orders = await import("@/app/api/trips/[tripId]/orders/route");

    await orders.GET(request, { params: Promise.resolve({ tripId: "7" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/trips/7/orders");
  });

  it("proxies order chat mark-as-read endpoint", async () => {
    const read = await import("@/app/api/orders/[orderId]/chat-messages/read/route");

    await read.POST(request, { params: Promise.resolve({ orderId: "42" }) });

    expect(proxyToBackend).toHaveBeenCalledWith(request, "/orders/42/chat-messages/read");
  });

  it("proxies order trip assignment preview endpoints", async () => {
    const singlePreview = await import("@/app/api/orders/[orderId]/assign-trip/preview/route");
    const bulkPreview = await import("@/app/api/orders/bulk/assign-trip/preview/route");

    await singlePreview.POST(request, { params: Promise.resolve({ orderId: "42" }) });
    await bulkPreview.POST(request);

    expect(proxyToBackend).toHaveBeenNthCalledWith(1, request, "/orders/42/assign-trip/preview");
    expect(proxyToBackend).toHaveBeenNthCalledWith(2, request, "/orders/bulk/assign-trip/preview");
  });
});
