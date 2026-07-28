import type { UserFilterParams } from "@/shared/types/entities";

export type UserQuickFilterCode = "active" | "logist" | "manager" | "without_company";

export type UserQuickFilter = {
  code: UserQuickFilterCode;
  label: string;
  checked: boolean;
};

export function getUserQuickFilters(params: Pick<UserFilterParams, "is_active" | "role_name" | "has_company">) {
  return [
    { code: "active", label: "Только активные", checked: params.is_active === true },
    { code: "logist", label: "Только логисты", checked: params.role_name === "logist" },
    { code: "manager", label: "Только менеджеры", checked: params.role_name === "manager" },
    { code: "without_company", label: "Без компании", checked: params.has_company === false },
  ] satisfies UserQuickFilter[];
}

export function getUserQuickFilterPatch(
  code: UserQuickFilterCode,
  params: Pick<UserFilterParams, "is_active" | "role_name" | "has_company">,
) {
  if (code === "active") {
    return { is_active: params.is_active === true ? null : true, page: 1 };
  }
  if (code === "without_company") {
    return { has_company: params.has_company === false ? null : false, page: 1 };
  }

  return {
    role_name: params.role_name === code ? null : code,
    page: 1,
  };
}
