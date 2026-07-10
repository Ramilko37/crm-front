import dayjs from "dayjs";

import type { Factory, PathPoint, TripCurrentStage, TripForwarderLookupItem, TripPoint, TripPointWritePayload } from "@/shared/types/entities";

export type TripPointKind = "path" | "loading";
export type TripLoadingSource = "factory" | "forwarder";

export type TripPointFormValues = {
  point_kind: TripPointKind;
  loading_source?: TripLoadingSource;
  path_point_id?: number;
  country_id?: number;
  factory_id?: number;
  forwarder_user_id?: number;
  sequence?: number;
  name?: string;
  address?: string;
  postcode?: string;
  country?: string;
  city?: string;
  contact_name?: string;
  phone?: string;
  planned_at?: dayjs.Dayjs;
  actual_at?: dayjs.Dayjs;
  is_completed?: boolean;
};

export function formatTripPointKind(value: TripPointKind | TripCurrentStage["point_kind"] | undefined) {
  if (value === "loading") return "Погрузка";
  if (value === "path") return "Маршрут";
  return "—";
}

export function formatTripCurrentStage(stage: TripCurrentStage | null | undefined) {
  if (!stage) return "—";
  if (stage.is_completed) return "Маршрут завершен";
  return [stage.point_name, formatTripPointKind(stage.point_kind)].filter(Boolean).join(" · ");
}

export function formatFactoryLocationLabel(factory: Factory) {
  const parts = [factory.name, factory.city, factory.address].filter(Boolean);
  return parts.join(" · ");
}

export function formatForwarderLocationLabel(user: TripForwarderLookupItem) {
  return user.label || [user.company_name, user.full_name, user.email, user.phone].filter(Boolean).join(" · ") || `Экспедитор #${user.id}`;
}

export function formatPathPointLocationLabel(pathPoint: PathPoint) {
  return pathPoint.name_ru;
}

export function formatTripPointSourceLabel(
  record: Pick<TripPoint, "is_loading_point" | "path_point_id" | "factory_id" | "forwarder_user_id" | "name" | "address">,
  context: {
    factories: Factory[];
    pathPoints: PathPoint[];
    forwarders: TripForwarderLookupItem[];
  },
) {
  if (!record.is_loading_point && record.path_point_id) {
    const pathPoint = context.pathPoints.find((item) => item.id === record.path_point_id);
    return pathPoint ? formatPathPointLocationLabel(pathPoint) : record.name || `#${record.path_point_id}`;
  }

  if (record.factory_id) {
    const factory = context.factories.find((item) => item.id === record.factory_id);
    return factory ? formatFactoryLocationLabel(factory) : record.name || `Фабрика #${record.factory_id}`;
  }

  if (record.forwarder_user_id) {
    const forwarder = context.forwarders.find((item) => item.id === record.forwarder_user_id);
    return forwarder ? formatForwarderLocationLabel(forwarder) : record.name || `Экспедитор #${record.forwarder_user_id}`;
  }

  return record.address || record.name || "—";
}

export function toTripPointDateIso(value?: dayjs.Dayjs) {
  return value?.startOf("day").toISOString() ?? null;
}

export function buildTripPointInitialValues(record: TripPoint): TripPointFormValues {
  return {
    point_kind: record.is_loading_point ? "loading" : "path",
    loading_source: record.forwarder_user_id ? "forwarder" : "factory",
    path_point_id: record.path_point_id ?? undefined,
    factory_id: record.factory_id ?? undefined,
    forwarder_user_id: record.forwarder_user_id ?? undefined,
    sequence: record.sequence,
    country: record.country ?? undefined,
    city: record.city ?? undefined,
    planned_at: record.planned_at ? dayjs(record.planned_at) : undefined,
    actual_at: record.actual_at ? dayjs(record.actual_at) : undefined,
    is_completed: record.is_completed,
  };
}

export function getNextTripPointSequence(points: Array<Pick<TripPoint, "sequence">>) {
  return points.reduce((max, point) => Math.max(max, point.sequence), 0) + 1;
}

export function hasDuplicateTripPointSequence(
  sequence: number | undefined,
  points: Array<Pick<TripPoint, "id" | "sequence">>,
  editingPointId?: number,
) {
  if (!sequence) return false;
  return points.some((point) => point.sequence === sequence && point.id !== editingPointId);
}

export function buildTripPointPayload(
  values: TripPointFormValues,
  _legacyContext?: {
    factories: Factory[];
    forwarders: TripForwarderLookupItem[];
  },
): TripPointWritePayload {
  const sequence = values.sequence;
  if (!sequence || sequence < 1) {
    throw new Error("Укажите sequence точки");
  }

  if (values.point_kind === "path") {
    if (!values.path_point_id) {
      throw new Error("Выберите маршрутную точку");
    }

    return {
      path_point_id: values.path_point_id,
      sequence,
      is_loading_point: false,
      planned_at: toTripPointDateIso(values.planned_at),
      actual_at: toTripPointDateIso(values.actual_at),
      is_completed: values.is_completed ?? false,
    };
  }

  if (values.loading_source === "factory") {
    if (!values.factory_id) {
      throw new Error("Выберите фабрику");
    }

    return {
      sequence,
      is_loading_point: true,
      factory_id: values.factory_id,
      planned_at: toTripPointDateIso(values.planned_at),
      actual_at: toTripPointDateIso(values.actual_at),
      is_completed: values.is_completed ?? false,
    };
  }

  if (values.loading_source === "forwarder") {
    if (!values.forwarder_user_id) {
      throw new Error("Выберите экспедитора");
    }

    return {
      sequence,
      is_loading_point: true,
      forwarder_user_id: values.forwarder_user_id,
      planned_at: toTripPointDateIso(values.planned_at),
      actual_at: toTripPointDateIso(values.actual_at),
      is_completed: values.is_completed ?? false,
    };
  }

  throw new Error("Выберите источник погрузки");
}

export function formatTripPointDate(value: string | null | undefined) {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}
