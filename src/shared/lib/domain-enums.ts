export const ROLE_NAMES = [
  "administrator",
  "logist",
  "accountant",
  "forwarder",
  "warehouse",
  "client",
  "anonymous",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ORDER_STATUS_VALUES = [
  "new_request",
  "awaiting_factory_confirmation",
  "factory_other_carrier",
  "payment_not_received",
  "goods_not_ready",
  "after_holidays_only",
  "factory_cannot_identify_client",
  "factory_confirmed",
  "pickup_in_progress",
  "picked_up_from_factory",
  "self_delivery_to_consolidation_warehouse",
  "at_european_warehouse",
  "at_european_warehouse_ready_to_ship",
  "at_european_warehouse_sanctioned_cargo",
  "at_european_warehouse_direct_contract",
  "at_european_warehouse_labeling",
  "at_european_warehouse_waiting_goods_or_docs",
  "at_european_warehouse_ex1_clearance",
  "at_european_warehouse_delivery_in_europe",
  "at_european_warehouse_customs_control",
  "in_transportation",
  "at_russian_customs",
  "at_moscow_warehouse",
  "unloaded_at_moscow_warehouse",
  "released_to_client",
  "at_moscow_warehouse_responsible_storage",
  "archived",
  "deleted",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const TRIP_STATUS_VALUES = [
  "new",
  "in_transit",
  "in_russia_customs",
  "in_moscow_warehouse",
  "unloaded",
] as const;

export type TripStatus = (typeof TRIP_STATUS_VALUES)[number];

export const TRIP_TYPE_VALUES = ["normal"] as const;

export type TripType = (typeof TRIP_TYPE_VALUES)[number];

export const FACTORY_CERTIFICATE_STATUS_VALUES = [
  "ready_to_provide",
  "agree_to_pay_production",
  "furniture_only",
  "ready_to_provide_upload_later",
] as const;

export type FactoryCertificateStatus = (typeof FACTORY_CERTIFICATE_STATUS_VALUES)[number];

export function formatEnumCode(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
