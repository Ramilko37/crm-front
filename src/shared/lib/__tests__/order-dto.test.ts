import { toOrderWritePayload } from "@/shared/lib/order-dto";

describe("order dto helpers", () => {
  it("removes company_id from order write payload", () => {
    const payload = toOrderWritePayload({
      order_number: "ORD-001",
      user_id: 2,
      factory_id: 7,
      company_id: 99,
      status_name: "new_request",
    });

    expect(payload).toEqual({
      order_number: "ORD-001",
      user_id: 2,
      factory_id: 7,
      status_name: "new_request",
    });
    expect("company_id" in payload).toBe(false);
  });
});
