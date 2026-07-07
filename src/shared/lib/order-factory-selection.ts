export type OrderFactorySelectionFormValues = {
  factory_mode?: "existing" | "create";
  factory_country_id?: number;
  factory_id?: number;
  loading_address_id?: number;
  factory_contact_id?: number;
  create_factory?: {
    factory_name?: string;
    primary_email?: string;
    loading_address?: {
      country_id?: number;
      postcode_id?: number;
      city_id?: number;
      address?: string;
      contact_name?: string;
      phone?: string;
      fax?: string;
      messenger_type?: string;
      messenger_value?: string;
    };
  };
};

function trimOrUndefined(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : undefined;
}

function compact<T extends Record<string, unknown>>(source: T) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export function buildOrderFactorySelectionPayload(values: OrderFactorySelectionFormValues) {
  const mode = values.factory_mode ?? "existing";

  if (mode === "create") {
    const loadingAddress = values.create_factory?.loading_address;

    return compact({
      factory_mode: "create",
      country_id: values.factory_country_id,
      create_factory: compact({
        factory_name: trimOrUndefined(values.create_factory?.factory_name),
        country_id: values.factory_country_id,
        primary_email: trimOrUndefined(values.create_factory?.primary_email),
        loading_address: compact({
          country_id: values.factory_country_id,
          postcode_id: loadingAddress?.postcode_id,
          city_id: loadingAddress?.city_id,
          address: trimOrUndefined(loadingAddress?.address),
          contact_name: trimOrUndefined(loadingAddress?.contact_name),
          phone: trimOrUndefined(loadingAddress?.phone),
          fax: trimOrUndefined(loadingAddress?.fax),
          messenger_type: trimOrUndefined(loadingAddress?.messenger_type),
          messenger_value: trimOrUndefined(loadingAddress?.messenger_value),
        }),
      }),
      factory_contact_id: values.factory_contact_id,
    });
  }

  return compact({
    factory_mode: "existing",
    country_id: values.factory_country_id,
    factory_id: values.factory_id,
    loading_address_id: values.loading_address_id,
    factory_contact_id: values.factory_contact_id,
  });
}
