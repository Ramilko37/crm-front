import { buildOrderFactorySelectionPayload } from "@/shared/lib/order-factory-selection";

describe("order factory selection payload", () => {
  it("builds existing factory selection with address and contact", () => {
    expect(
      buildOrderFactorySelectionPayload({
        factory_mode: "existing",
        factory_country_id: 380,
        factory_id: 7,
        loading_address_id: 3,
        factory_contact_id: 501,
      }),
    ).toEqual({
      factory_mode: "existing",
      country_id: 380,
      factory_id: 7,
      loading_address_id: 3,
      factory_contact_id: 501,
    });
  });

  it("builds create factory selection like order create flow", () => {
    expect(
      buildOrderFactorySelectionPayload({
        factory_mode: "create",
        factory_country_id: 380,
        factory_contact_id: 501,
        create_factory: {
          factory_name: "Inline Factory",
          primary_email: "factory@example.com",
          loading_address: {
            country_id: 380,
            postcode_id: 11,
            city_id: 22,
            address: "Via Roma 1",
            fax: "123",
            messenger_type: "whatsapp",
            messenger_value: "+3900011122",
          },
        },
      }),
    ).toEqual({
      factory_mode: "create",
      country_id: 380,
      create_factory: {
        factory_name: "Inline Factory",
        country_id: 380,
        primary_email: "factory@example.com",
        loading_address: {
          country_id: 380,
          postcode_id: 11,
          city_id: 22,
          address: "Via Roma 1",
          fax: "123",
          messenger_type: "whatsapp",
          messenger_value: "+3900011122",
        },
      },
      factory_contact_id: 501,
    });
  });
});
