import type { Dayjs } from "dayjs";

import type { RoleName } from "@/shared/lib/domain-enums";
import type { UserWritePayload } from "@/shared/types/entities";

export type UserFormValues = {
  company_id?: number | null;
  company_name?: string;
  full_name?: string;
  login?: string;
  password?: string;
  role_name?: RoleName | string;
  personal_manager_id?: number | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  is_active?: boolean;
  total_orders?: number | null;
  last_order_date?: Dayjs | string | null;
  selectedCountryId?: number | null;
};

type BuildUserWritePayloadOptions = {
  includeCompanyLink?: boolean;
  includeCompanyName?: boolean;
  isManagerActor?: boolean;
};

function trimOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function formatDate(value: Dayjs | string | null | undefined) {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.format("YYYY-MM-DD");
}

export function isForwarderRole(roleName: RoleName | string | null | undefined) {
  return roleName === "forwarder";
}

export function requiredWhenForwarder(roleName: RoleName | string | null | undefined, message: string) {
  return {
    validator: async (_: unknown, value: unknown) => {
      const stringValue = typeof value === "string" ? value.trim() : "";
      const hasNumericValue = typeof value === "number" && Number.isFinite(value) && value > 0;
      if (isForwarderRole(roleName) && !stringValue && !hasNumericValue) {
        throw new Error(message);
      }
    },
  };
}

export function buildUserWritePayload(
  values: UserFormValues,
  options: BuildUserWritePayloadOptions = {},
): UserWritePayload {
  return {
    ...(options.includeCompanyLink && values.company_id ? { company_id: values.company_id } : {}),
    ...(options.includeCompanyName ? { company_name: trimOptional(values.company_name) } : {}),
    full_name: values.full_name,
    login: values.login,
    password: values.password,
    role_name: values.role_name,
    personal_manager_id: values.personal_manager_id,
    email: values.email,
    phone: values.phone,
    country: values.country,
    city: values.city,
    address: values.address,
    is_active: options.isManagerActor ? true : values.is_active,
    total_orders: values.total_orders,
    last_order_date: formatDate(values.last_order_date),
  };
}
