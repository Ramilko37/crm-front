import type { OrderStatusHistoryItem } from "@/shared/types/entities";

export function normalizeSpecialTariffText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getOrderActivityText(item: Pick<OrderStatusHistoryItem, "comment" | "status_name">) {
  const comment = item.comment?.trim();
  return comment || `Status: ${item.status_name}`;
}

export function getOrderActivityEventCode(
  item: Pick<OrderStatusHistoryItem, "event_type" | "field_name">,
) {
  return item.event_type || item.field_name || null;
}
