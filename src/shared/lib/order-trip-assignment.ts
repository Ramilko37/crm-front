export type AssignTripPreview = {
  order_id: number;
  trip_id: number;
  trip_name: string | null;
  loading_point_id: number;
  loading_point_name: string | null;
  loading_point_sequence: number;
  declared_volume_m3: string | null;
  actual_volume_m3: string | null;
  declared_total_weight_kg: string | null;
  actual_weight_kg: string | null;
  confirmation_token: string;
  expires_in_sec: number;
};

export type BulkAssignTripPreviewItem = {
  order_id: number;
  loading_point_id: number;
  loading_point_name: string | null;
  loading_point_sequence: number;
  declared_volume_m3: string | null;
  actual_volume_m3: string | null;
  declared_total_weight_kg: string | null;
  actual_weight_kg: string | null;
};

export type BulkAssignTripPreview = {
  trip_id: number;
  trip_name: string | null;
  order_ids: number[];
  items: BulkAssignTripPreviewItem[];
  confirmation_token: string;
  expires_in_sec: number;
};

export function buildAssignTripConfirmPayload({
  tripId,
  confirmationToken,
}: {
  tripId: number | null | undefined;
  confirmationToken?: string | null;
}) {
  if (tripId == null) {
    return { trip_id: null };
  }

  if (!confirmationToken) {
    throw new Error("confirmation_token is required");
  }

  return {
    trip_id: tripId,
    confirmation_token: confirmationToken,
  };
}

export function getAssignTripEligibilityErrorMessage(detail: string) {
  if (detail === "order-trip-source-mismatch") {
    return "Заказ нельзя добавить: фабрика/экспедитор не найдены среди непройденных точек погрузки рейса";
  }
  if (detail.startsWith("Trip has already left")) {
    return "Рейс уже покинул точку погрузки заказа";
  }
  if (detail.startsWith("Trip ") && detail.includes("is already finished")) {
    return "Рейс уже завершён";
  }
  if (detail === "Order status does not allow loading") {
    return "Статус заказа не допускает погрузку";
  }
  if (detail.startsWith("Order is already assigned to active trip")) {
    return "Заказ уже находится в другом активном рейсе";
  }
  if (detail.startsWith("confirmation_token is required")) {
    return "Нужно подтвердить добавление: сначала выполните проверку";
  }
  if (detail === "confirmation_token has expired") {
    return "Время подтверждения истекло — повторите проверку";
  }
  if (detail === "confirmation_token is invalid" || detail.includes("does not match")) {
    return "Подтверждение устарело — повторите проверку";
  }
  return detail;
}
