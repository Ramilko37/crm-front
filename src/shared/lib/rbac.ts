import type { RoleName } from "@/shared/lib/domain-enums";

const ORDER_WRITE_ROLES = new Set<RoleName>([
  "administrator",
  "manager",
  "logist",
  "accountant",
  "warehouse",
]);

const SETTINGS_WRITE_ROLES = new Set<RoleName>(["administrator", "manager"]);

const INTERNAL_READ_ROLES = new Set<RoleName>([
  "administrator",
  "manager",
  "logist",
  "accountant",
  "warehouse",
  "forwarder",
]);

const KNOWN_ROLES = new Set<RoleName>([
  "administrator",
  "manager",
  "logist",
  "accountant",
  "forwarder",
  "warehouse",
  "client",
  "anonymous",
]);

export type AppModule =
  | "orders"
  | "factories"
  | "trips"
  | "users"
  | "path-points"
  | "countries"
  | "normative-documents"
  | "email-templates"
  | "profile";
export type RoleLike = RoleName | string | null | undefined;

export function normalizeRoleName(roleName: RoleLike): RoleName {
  if (!roleName) {
    return "anonymous";
  }

  if (KNOWN_ROLES.has(roleName as RoleName)) {
    return roleName as RoleName;
  }

  return "anonymous";
}

export function isBackOfficeRole(roleName: RoleLike, isSuperuser = false) {
  return isOrderWriteRole(roleName, isSuperuser);
}

export function isOrderWriteRole(roleName: RoleLike, isSuperuser = false) {
  if (isSuperuser) {
    return true;
  }

  const normalizedRole = normalizeRoleName(roleName);
  return ORDER_WRITE_ROLES.has(normalizedRole);
}

export function canAccessModule(module: AppModule, roleName: RoleLike, isSuperuser = false) {
  if (isSuperuser) {
    return true;
  }

  const normalizedRole = normalizeRoleName(roleName);

  if (module === "orders" || module === "profile") {
    return true;
  }

  if (module === "users") {
    return normalizedRole === "administrator" || normalizedRole === "manager";
  }

  return INTERNAL_READ_ROLES.has(normalizedRole);
}

export function getVisibleModules(roleName: RoleLike, isSuperuser = false): AppModule[] {
  const modules: AppModule[] = ["orders"];

  if (canAccessModule("factories", roleName, isSuperuser)) {
    modules.push("factories", "trips", "path-points", "countries", "normative-documents", "email-templates");
  }

  if (canAccessModule("users", roleName, isSuperuser)) {
    modules.push("users");
  }

  modules.push("profile");
  return modules;
}

export function canManageUsers(roleName: RoleLike, isSuperuser = false) {
  return canAccessModule("users", roleName, isSuperuser);
}

export function canWriteSettingsDictionaries(roleName: RoleLike, isSuperuser = false) {
  if (isSuperuser) {
    return true;
  }
  return SETTINGS_WRITE_ROLES.has(normalizeRoleName(roleName));
}

export function canResetUserPassword(roleName: RoleLike, isSuperuser = false) {
  if (isSuperuser) {
    return true;
  }
  return normalizeRoleName(roleName) === "administrator";
}
