import type { CompanyContactWritePayload, CompanyWritePayload } from "@/shared/types/entities";

const COMPANY_STRING_FIELDS = [
  "name",
  "country",
  "city",
  "address",
  "postcode",
  "phone",
  "email",
  "website",
  "vat_number",
  "comment",
] as const;

const CONTACT_STRING_FIELDS = [
  "full_name",
  "job_title",
  "phone",
  "email",
  "messenger_type",
  "messenger_value",
] as const;

function trimmedStrings<T extends Record<string, unknown>>(values: T, fields: readonly (keyof T)[]) {
  return fields.reduce<Partial<T>>((payload, field) => {
    const value = values[field];
    if (typeof value === "string" && value.trim()) payload[field] = value.trim() as T[keyof T];
    return payload;
  }, {});
}

export function buildCompanyCreatePayload(values: CompanyWritePayload): CompanyWritePayload {
  const contacts = values.contacts
    ?.filter((contact) => contact.full_name?.trim())
    .map((contact) => ({
      ...trimmedStrings(contact, CONTACT_STRING_FIELDS),
      ...(typeof contact.is_primary === "boolean" ? { is_primary: contact.is_primary } : {}),
    } satisfies CompanyContactWritePayload));

  return {
    ...trimmedStrings(values, COMPANY_STRING_FIELDS),
    ...(values.role ? { role: values.role } : {}),
    ...(contacts?.length ? { contacts } : {}),
  };
}

export function isCompanyPhoneValid(value: string | undefined | null) {
  if (!value?.trim()) return true;
  return /^[\d+\- ()]+$/.test(value) && value.replace(/\D/g, "").length >= 6 && value.replace(/\D/g, "").length <= 20;
}
