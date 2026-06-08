import dayjs from "dayjs";

import { formatEnumCode, type LoadingPointType } from "@/shared/lib/domain-enums";
import type { Factory, PathPoint, TripLoadingPoint, TripLoadingPointWritePayload } from "@/shared/types/entities";

export function formatLoadingPointType(value: LoadingPointType) {
  if (value === "factory") return "Фабрика";
  if (value === "forwarder_warehouse") return "Склад экспедитора";
  return formatEnumCode(value);
}

export type LoadingPointFormValues = {
  loading_point_type: LoadingPointType;
  location_id?: number;
  planned_loading_at?: dayjs.Dayjs;
  actual_loading_at?: dayjs.Dayjs;
  is_completed?: boolean;
};

export function formatFactoryLocationLabel(factory: Factory) {
  const parts = [factory.name, factory.city, factory.address].filter(Boolean);
  return parts.join(" · ");
}

export function formatPathPointLocationLabel(pathPoint: PathPoint) {
  return pathPoint.name_ru;
}

export function resolveLoadingPointLocationId(
  record: TripLoadingPoint,
  pathPoints: PathPoint[],
): number | undefined {
  if (record.type === "factory") {
    return record.factory_id ?? undefined;
  }

  const matched = pathPoints.find((point) => point.name_ru === record.name || point.name_ru === record.address);
  return matched?.id;
}

export function formatLoadingPointLocationLabel(
  record: {
    type: LoadingPointType;
    factory_id?: number | null;
    name: string;
    address: string;
  },
  factories: Factory[],
  pathPoints: PathPoint[],
) {
  if (record.type === "factory" && record.factory_id) {
    const factory = factories.find((item) => item.id === record.factory_id);
    if (factory) return formatFactoryLocationLabel(factory);
  }

  if (record.type === "forwarder_warehouse") {
    const pathPoint = pathPoints.find((item) => item.name_ru === record.name || item.name_ru === record.address);
    if (pathPoint) return formatPathPointLocationLabel(pathPoint);
  }

  return record.address === "—" ? "—" : record.address || record.name;
}

export function toLoadingPointDateIso(value?: dayjs.Dayjs) {
  return value?.startOf("day").toISOString() ?? null;
}

export function buildLoadingPointApiPayload(
  values: LoadingPointFormValues,
  context: {
    factories: Factory[];
    pathPoints: PathPoint[];
  },
): TripLoadingPointWritePayload {
  const type = values.loading_point_type;

  if (type === "factory") {
    const factory = context.factories.find((item) => item.id === values.location_id);
    if (!factory) {
      throw new Error("Выберите фабрику");
    }

    return {
      type,
      factory_id: factory.id,
      name: factory.name,
      address: factory.address?.trim() || factory.name,
      country: factory.country,
      city: factory.city,
      postcode: factory.postcode,
      phone: factory.phone,
      planned_loading_at: toLoadingPointDateIso(values.planned_loading_at),
      actual_loading_at: toLoadingPointDateIso(values.actual_loading_at),
      is_completed: values.is_completed ?? false,
    };
  }

  const pathPoint = context.pathPoints.find((item) => item.id === values.location_id);
  if (!pathPoint) {
    throw new Error("Выберите склад экспедитора");
  }

  return {
    type,
    factory_id: null,
    name: pathPoint.name_ru,
    address: pathPoint.name_ru,
    planned_loading_at: toLoadingPointDateIso(values.planned_loading_at),
    actual_loading_at: toLoadingPointDateIso(values.actual_loading_at),
    is_completed: values.is_completed ?? false,
  };
}

export function pathPointIsCompleted(actualAt: string | null | undefined) {
  return Boolean(actualAt);
}

export function pathPointActualAtFromCompleted(
  isCompleted: boolean,
  existingActualAt?: string | null,
) {
  if (!isCompleted) return null;
  return existingActualAt ?? dayjs().startOf("day").toISOString();
}

export function formatLoadingPointDate(value: string | null | undefined) {
  return value ? dayjs(value).format("DD.MM.YYYY") : "—";
}
