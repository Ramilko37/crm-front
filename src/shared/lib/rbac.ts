import type { RoleName } from "@/shared/lib/domain-enums";

const BACK_OFFICE_ROLES = new Set<RoleName>(["administrator", "logist", "accountant", "warehouse"]);

export type RoleLike = RoleName | "manager" | string | null | undefined;

export function normalizeRoleName(roleName: RoleLike): RoleName {
  if (roleName === "manager") {
    return "administrator";
  }

  if (!roleName) {
    return "anonymous";
  }

  if (BACK_OFFICE_ROLES.has(roleName as RoleName)) {
    return roleName as RoleName;
  }

  if (roleName === "forwarder" || roleName === "client" || roleName === "anonymous") {
    return roleName;
  }

  return "anonymous";
}

export function isBackOfficeRole(roleName: RoleLike, isSuperuser = false) {
  if (isSuperuser) {
    return true;
  }

  const normalizedRole = normalizeRoleName(roleName);
  return BACK_OFFICE_ROLES.has(normalizedRole);
}
