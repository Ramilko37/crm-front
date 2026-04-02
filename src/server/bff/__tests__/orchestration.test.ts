import {
  buildClientOrderMultipartPayload,
  buildInternalOrderMultipartPayload,
  buildRequestMultipartPayload,
} from "@/server/bff/orchestration";

describe("orchestration payload builders", () => {
  it("builds internal order payload for multipart create", () => {
    const payload = buildInternalOrderMultipartPayload({
      order_number: "A-100",
      company_id: 10,
      company_contact_id: 55,
      ready_date: "2026-04-01",
      order_type: "delivery",
      factory_id: 7,
      loading_address_id: 3,
      comment: "test",
    });

    expect(payload).toEqual({
      order: {
        order_number: "A-100",
        company_id: 10,
        company_contact_id: 55,
        ready_date: "2026-04-01",
        order_type: "delivery",
        comment: "test",
        additional_description: "test",
      },
      factory_selection: {
        factory_id: 7,
        loading_address_id: 3,
      },
      goods_lines: [],
      documents: [],
    });
  });

  it("builds client order payload without internal fields", () => {
    const payload = buildClientOrderMultipartPayload({
      order_number: "C-200",
      ready_date: "2026-04-02",
      factory_id: 9,
      loading_address_id: 6,
      comment: "client",
    });

    expect(payload).toEqual({
      order: {
        order_number: "C-200",
        ready_date: "2026-04-02",
        comment: "client",
        additional_description: "client",
      },
      factory_selection: {
        factory_id: 9,
        loading_address_id: 6,
      },
      goods_lines: [],
      documents: [],
    });
  });

  it("builds request payload", () => {
    const payload = buildRequestMultipartPayload({
      company_id: 77,
      company_contact_id: 17,
      comment: "note",
      payload_json: { source: "web" },
    });

    expect(payload).toEqual({
      request: {
        company_id: 77,
        company_contact_id: 17,
        comment: "note",
        payload_json: { source: "web" },
      },
      documents: [],
    });
  });

  it("passes through structured internal payload", () => {
    const payload = buildInternalOrderMultipartPayload({
      order: {
        order_number: "A-100",
        company_id: 10,
        ready_date: "2026-04-01",
        order_type: "delivery",
      },
      factory_selection: {
        factory_id: 7,
        loading_address_id: 3,
      },
      goods_lines: [{ item_type: "chair" }],
      documents: [{ document_type: "invoice", file_slot: "request_file_1" }],
    });

    expect(payload).toEqual({
      order: {
        order_number: "A-100",
        company_id: 10,
        ready_date: "2026-04-01",
        order_type: "delivery",
      },
      factory_selection: {
        factory_id: 7,
        loading_address_id: 3,
      },
      goods_lines: [{ item_type: "chair" }],
      documents: [{ document_type: "invoice", file_slot: "request_file_1" }],
    });
  });
});
