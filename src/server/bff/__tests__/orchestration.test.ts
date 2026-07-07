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

  it("does not map legacy contact fields in internal order payload", () => {
    const payload = buildInternalOrderMultipartPayload({
      company_id: 10,
      ready_date: "2026-04-01",
      contact_user_id: 501,
      user_id: 777,
      factory_id: 7,
      loading_address_id: 3,
    });

    expect(payload).toEqual({
      order: {
        company_id: 10,
        ready_date: "2026-04-01",
      },
      factory_selection: {
        factory_id: 7,
        loading_address_id: 3,
      },
      goods_lines: [],
      documents: [],
    });
  });

  it("does not map legacy contact fields in request payload", () => {
    const payload = buildRequestMultipartPayload({
      company_id: 77,
      contact_user_id: 17,
      comment: "note",
    });

    expect(payload).toEqual({
      request: {
        company_id: 77,
        comment: "note",
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

  it("maps new internal create fields for JSON fallback", () => {
    const payload = buildInternalOrderMultipartPayload({
      company_id: 10,
      company_contact_id: 55,
      ready_date: "2026-04-01",
      pickup_date_from: "2026-04-02",
      pickup_date_to: "2026-04-03",
      is_factory_payment_via_company: true,
      is_factory_payment_completed: false,
      is_1c: true,
      factory_mode: "existing",
      country_id: 380,
      factory_id: 7,
      loading_address_id: 3,
      email_id: 11,
      factory_contact_id: 501,
    });

    expect(payload).toEqual({
      order: {
        company_id: 10,
        company_contact_id: 55,
        ready_date: "2026-04-01",
        pickup_date_from: "2026-04-02",
        pickup_date_to: "2026-04-03",
        is_factory_payment_via_company: true,
        is_factory_payment_completed: false,
        is_1c: true,
      },
      factory_selection: {
        factory_mode: "existing",
        country_id: 380,
        factory_id: 7,
        loading_address_id: 3,
        email_id: 11,
        factory_contact_id: 501,
      },
      goods_lines: [],
      documents: [],
    });
  });

  it("maps factory contact xor payload for create contact mode", () => {
    const payload = buildInternalOrderMultipartPayload({
      company_id: 10,
      ready_date: "2026-04-01",
      factory_mode: "create",
      country_id: 380,
      create_factory_contact: {
        full_name: "Mario Bianchi",
        phone: "+3900011122",
        email: "logistics@factory.it",
      },
      create_factory: {
        factory_name: "Inline Factory",
      },
    });

    expect(payload).toEqual({
      order: {
        company_id: 10,
        ready_date: "2026-04-01",
      },
      factory_selection: {
        factory_mode: "create",
        country_id: 380,
        create_factory_contact: {
          full_name: "Mario Bianchi",
          phone: "+3900011122",
          email: "logistics@factory.it",
        },
        create_factory: {
          factory_name: "Inline Factory",
        },
      },
      goods_lines: [],
      documents: [],
    });
  });
});
