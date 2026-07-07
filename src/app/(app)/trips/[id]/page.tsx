"use client";

import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TablePaginationConfig } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { TripPointFormFields } from "@/features/trips/trip-point-form-fields";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  ORDER_STATUS_VALUES,
  type OrderStatus,
  TRIP_STATUS_VALUES,
  TRIP_TYPE_VALUES,
  type TripStatus,
  type TripType,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import {
  buildTripPointInitialValues,
  buildTripPointPayload,
  formatTripCurrentStage,
  formatTripPointDate,
  formatTripPointKind,
  formatTripPointSourceLabel,
  getNextTripPointSequence,
  hasDuplicateTripPointSequence,
  type TripPointFormValues,
} from "@/shared/lib/trip-point-forms";
import { PageHeader } from "@/shared/ui/page-frame";
import type {
  Factory,
  Country,
  OrderListItem,
  PaginatedResponse,
  PathPoint,
  TripCityLookupItem,
  TripDetail,
  TripForwarderLookupItem,
  TripPoint,
  TripPointUpdatePayload,
  TripWritePayload,
} from "@/shared/types/entities";

type TripForm = {
  name?: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
  type_name?: TripType;
};

type TripOrdersParams = {
  query?: string;
  status_names?: OrderStatus[];
  page: number;
  page_size: number;
  sort_by?: string;
  sort_desc?: boolean;
};

const tripStatusTagColors: Record<string, string> = {
  new: "blue",
  in_transit: "cyan",
  in_russia_customs: "orange",
  in_moscow_warehouse: "geekblue",
  unloaded: "green",
};

function uniqueSortedCities(items: TripCityLookupItem[]) {
  return Array.from(new Set(items.map((item) => item.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
}

function renderTripStatus(value: TripStatus | null) {
  return value ? (
    <Tag color={tripStatusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatEnumCode(value)}
    </Tag>
  ) : (
    "—"
  );
}

function TripDetailPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const tripId = Number(params.id);

  const meQuery = useCurrentUser(true);
  const canMutate = isBackOfficeRole(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [editTripOpen, setEditTripOpen] = useState(false);
  const [pointModalOpen, setPointModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<TripPoint | null>(null);
  const [ordersParams, setOrdersParams] = useState<TripOrdersParams>({
    page: 1,
    page_size: 20,
  });

  const [tripForm] = Form.useForm<TripForm>();
  const [pointForm] = Form.useForm<TripPointFormValues>();
  const pointKind = Form.useWatch("point_kind", pointForm);
  const pointLoadingSource = Form.useWatch("loading_source", pointForm);
  const pointCountryId = Form.useWatch("country_id", pointForm);
  const pointCountryName = Form.useWatch("country", pointForm);
  const pointCity = Form.useWatch("city", pointForm);

  const detailQuery = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => apiRequest<TripDetail>(`/api/trips/${tripId}`),
    enabled: Number.isFinite(tripId) && tripId > 0,
  });

  function fetchTripOrders() {
    return apiRequest<PaginatedResponse<OrderListItem>>("/api/orders", {
      query: {
        ...ordersParams,
        trip_id: tripId,
      },
    });
  }

  const ordersQuery = useQuery({
    queryKey: queryKeys.trips.orders(tripId, ordersParams),
    queryFn: fetchTripOrders,
    enabled: Number.isFinite(tripId) && tripId > 0,
  });

  const pathPointsCatalogQuery = useQuery({
    queryKey: queryKeys.pathPoints.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const countriesQuery = useQuery({
    queryKey: queryKeys.countries.list({ page: 1, page_size: 250 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Country>>("/api/countries", {
        query: { page: 1, page_size: 250 },
      }),
    enabled: pointModalOpen && pointKind === "loading",
  });

  const factoriesQuery = useQuery({
    queryKey: queryKeys.factories.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const factoryCitiesQuery = useQuery({
    queryKey: queryKeys.trips.lookupCities({
      country_id: pointCountryId,
      page: 1,
      page_size: 50,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<TripCityLookupItem>>("/api/trips/lookups/cities", {
        query: {
          page: 1,
          page_size: 50,
          country_id: pointCountryId,
        },
      }),
    enabled:
      pointModalOpen &&
      pointKind === "loading" &&
      pointLoadingSource !== "forwarder" &&
      Boolean(pointCountryId),
  });

  const countries = useMemo(() => countriesQuery.data?.items ?? [], [countriesQuery.data?.items]);
  const selectedPointCountry = useMemo(
    () => countries.find((country) => country.id === pointCountryId),
    [countries, pointCountryId],
  );
  const selectedPointFactoryCountry = selectedPointCountry?.name_en || selectedPointCountry?.name_ru || pointCountryName;

  const pointFactoriesQuery = useQuery({
    queryKey: queryKeys.factories.list({
      scope: "trip-point-factories",
      country: selectedPointFactoryCountry,
      city: pointCity,
      page: 1,
      page_size: 200,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: {
          page: 1,
          page_size: 200,
          country: selectedPointFactoryCountry,
          city: pointCity,
        },
      }),
    enabled:
      pointModalOpen &&
      pointKind === "loading" &&
      pointLoadingSource !== "forwarder" &&
      Boolean(selectedPointFactoryCountry) &&
      Boolean(pointCity),
  });

  const forwarderCitiesQuery = useQuery({
    queryKey: queryKeys.trips.lookupForwarderCities({
      country_id: pointCountryId,
      page: 1,
      page_size: 50,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<TripCityLookupItem>>("/api/trips/lookups/forwarder-cities", {
        query: {
          page: 1,
          page_size: 50,
          country_id: pointCountryId,
        },
      }),
    enabled:
      pointModalOpen &&
      pointKind === "loading" &&
      pointLoadingSource === "forwarder" &&
      Boolean(pointCountryId),
  });

  const pointForwardersQuery = useQuery({
    queryKey: queryKeys.trips.lookupForwarders({
      country_id: pointCountryId,
      city: pointCity,
      page: 1,
      page_size: 250,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<TripForwarderLookupItem>>("/api/trips/lookups/forwarders", {
        query: {
          page: 1,
          page_size: 250,
          country_id: pointCountryId,
          city: pointCity,
        },
      }),
    enabled:
      pointModalOpen &&
      pointKind === "loading" &&
      pointLoadingSource === "forwarder" &&
      Boolean(pointCountryId) &&
      Boolean(pointCity),
  });

  const trip = detailQuery.data;
  const factories = useMemo(() => factoriesQuery.data?.items ?? [], [factoriesQuery.data?.items]);
  const pointFactories = useMemo(() => pointFactoriesQuery.data?.items ?? [], [pointFactoriesQuery.data?.items]);
  const factoryCityOptions = useMemo(() => uniqueSortedCities(factoryCitiesQuery.data?.items ?? []), [factoryCitiesQuery.data?.items]);
  const forwarderCityOptions = useMemo(() => uniqueSortedCities(forwarderCitiesQuery.data?.items ?? []), [forwarderCitiesQuery.data?.items]);
  const pointCityOptions = pointLoadingSource === "forwarder" ? forwarderCityOptions : factoryCityOptions;
  const pointPayloadFactories = useMemo(() => {
    const byId = new Map<number, Factory>();
    for (const factory of [...factories, ...pointFactories]) {
      byId.set(factory.id, factory);
    }
    return Array.from(byId.values());
  }, [factories, pointFactories]);
  const pathPoints = useMemo(() => pathPointsCatalogQuery.data?.items ?? [], [pathPointsCatalogQuery.data?.items]);
  const pointForwarders = useMemo(() => pointForwardersQuery.data?.items ?? [], [pointForwardersQuery.data?.items]);
  const selectedPointForwarder = useMemo<TripForwarderLookupItem | null>(() => {
    if (!selectedPoint?.forwarder_user_id) return null;
    return {
      id: selectedPoint.forwarder_user_id,
      full_name: selectedPoint.contact_name,
      company_name: selectedPoint.name,
      country: selectedPoint.country,
      city: selectedPoint.city,
      phone: selectedPoint.phone,
      label: [selectedPoint.name, selectedPoint.contact_name].filter(Boolean).join(" / ") || selectedPoint.name,
    };
  }, [selectedPoint]);
  const pointPayloadForwarders = useMemo(() => {
    const byId = new Map<number, TripForwarderLookupItem>();
    for (const forwarder of [...pointForwarders, ...(selectedPointForwarder ? [selectedPointForwarder] : [])]) {
      byId.set(forwarder.id, forwarder);
    }
    return Array.from(byId.values());
  }, [pointForwarders, selectedPointForwarder]);

  const pointContext = useMemo(
    () => ({ factories, pathPoints, forwarders: pointPayloadForwarders }),
    [factories, pathPoints, pointPayloadForwarders],
  );

  useEffect(() => {
    if (!pointModalOpen || pointKind !== "loading" || pointCountryId || !pointCountryName) return;
    const matchedCountry = countries.find(
      (country) =>
        country.name_ru === pointCountryName ||
        country.name_en === pointCountryName ||
        country.iso2 === pointCountryName ||
        country.iso3 === pointCountryName,
    );
    if (matchedCountry) {
      pointForm.setFieldValue("country_id", matchedCountry.id);
    }
  }, [countries, pointCountryId, pointCountryName, pointForm, pointKind, pointModalOpen]);

  const updateTripMutation = useMutation({
    mutationFn: (payload: TripWritePayload) =>
      apiRequest<TripDetail>(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс обновлён");
      setEditTripOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления рейса");
    },
  });

  const savePointMutation = useMutation({
    mutationFn: async (values: TripPointFormValues) => {
      const existingPoints = trip?.points ?? [];
      const sequence = selectedPoint?.sequence ?? getNextTripPointSequence(existingPoints);
      if (hasDuplicateTripPointSequence(sequence, existingPoints, selectedPoint?.id)) {
        throw new Error("Sequence должен быть уникален внутри рейса");
      }

      const payload = buildTripPointPayload(
        { ...values, sequence },
        { factories: pointPayloadFactories, forwarders: pointPayloadForwarders },
      );

      if (selectedPoint) {
        const updatePayload: TripPointUpdatePayload = payload;
        return apiRequest<TripPoint>(`/api/trips/${tripId}/points/${selectedPoint.id}`, {
          method: "PATCH",
          body: updatePayload,
        });
      }

      return apiRequest<TripPoint>(`/api/trips/${tripId}/points`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: async () => {
      message.success(selectedPoint ? "Точка рейса обновлена" : "Точка рейса добавлена");
      setPointModalOpen(false);
      setSelectedPoint(null);
      pointForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Ошибка сохранения точки рейса");
    },
  });

  function openEditTrip() {
    if (!trip) return;
    tripForm.setFieldsValue({
      name: trip.name,
      current_point_id: trip.current_point_id ?? undefined,
      current_point_name: trip.current_point_name ?? undefined,
      truck_plate: trip.truck_plate ?? undefined,
      truck_company_name: trip.truck_company_name ?? undefined,
      status_name: trip.status_name ?? undefined,
      type_name: trip.type_name ?? undefined,
    });
    setEditTripOpen(true);
  }

  function openCreatePoint() {
    setSelectedPoint(null);
    pointForm.resetFields();
    pointForm.setFieldsValue({
      point_kind: "path",
      loading_source: "factory",
      sequence: getNextTripPointSequence(trip?.points ?? []),
      is_completed: false,
    });
    setPointModalOpen(true);
  }

  function openEditPoint(record: TripPoint) {
    setSelectedPoint(record);
    pointForm.setFieldsValue(buildTripPointInitialValues(record));
    setPointModalOpen(true);
  }

  const pointColumns: ColumnsType<TripPoint> = [
    {
      title: "Sequence",
      dataIndex: "sequence",
      width: 100,
    },
    {
      title: "Тип",
      key: "kind",
      width: 130,
      render: (_, record) => formatTripPointKind(record.is_loading_point ? "loading" : "path"),
    },
    {
      title: "Точка",
      key: "source",
      render: (_, record) => formatTripPointSourceLabel(record, pointContext),
    },
    {
      title: "Адрес",
      key: "address",
      render: (_, record) => [record.address, record.city, record.country].filter(Boolean).join(", ") || "—",
    },
    {
      title: "План",
      dataIndex: "planned_at",
      render: (value: string | null) => formatTripPointDate(value),
      width: 130,
    },
    {
      title: "Факт",
      dataIndex: "actual_at",
      render: (value: string | null) => formatTripPointDate(value),
      width: 130,
    },
    {
      title: "Завершено",
      dataIndex: "is_completed",
      render: (value: boolean) => (value ? "Да" : "Нет"),
      width: 120,
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, record) =>
        canMutate ? (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditPoint(record)}>
            Изменить
          </Button>
        ) : null,
    },
  ];

  const orderSortOrderFor = (field: string) => {
    if (ordersParams.sort_by !== field) return null;
    return ordersParams.sort_desc ? "descend" : "ascend";
  };

  const orderColumns: ColumnsType<OrderListItem> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, sortOrder: orderSortOrderFor("id"), width: 90 },
    {
      title: "Заказ",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      sortOrder: orderSortOrderFor("order_number"),
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Клиент",
      dataIndex: "company_name",
      key: "company_name",
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Фабрика",
      dataIndex: "factory_name",
      key: "factory_name",
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: orderSortOrderFor("status_name"),
      render: (value: OrderStatus | null) => (value ? formatEnumCode(value) : "—"),
    },
    {
      title: "Ready date",
      dataIndex: "ready_date",
      key: "ready_date",
      sorter: true,
      sortOrder: orderSortOrderFor("ready_date"),
      render: (value: string | null) => value ?? "—",
    },
    { title: "Страна", dataIndex: "country", key: "country", render: (value: string | null) => value ?? "—" },
    {
      title: "Экспедитор",
      dataIndex: "forwarder_name",
      key: "forwarder_name",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Документы",
      dataIndex: "documents_count",
      key: "documents_count",
      render: (value: number | undefined) => value ?? 0,
      width: 120,
    },
    {
      title: "Сертификат",
      dataIndex: "has_certificate",
      key: "has_certificate",
      render: (value: boolean | undefined) => (value ? "Да" : "Нет"),
      width: 120,
    },
  ];

  function handleOrdersTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<OrderListItem> | SorterResult<OrderListItem>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<OrderListItem> | undefined)
      : (sorter as SorterResult<OrderListItem>);

    setOrdersParams((current) => ({
      ...current,
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? current.page_size,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    }));
  }

  if (!Number.isFinite(tripId) || tripId <= 0) {
    return <Typography.Text type="danger">Некорректный ID рейса</Typography.Text>;
  }

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title={trip ? `Рейс #${trip.id}` : "Рейс"}
        subtitle={trip?.name}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/trips")}>
              К списку
            </Button>
            {canMutate && trip ? (
              <Button type="primary" icon={<EditOutlined />} onClick={openEditTrip}>
                Редактировать рейс
              </Button>
            ) : null}
          </Space>
        }
      />

      {detailQuery.isLoading ? (
        <Card loading />
      ) : detailQuery.error ? (
        <Typography.Text type="danger">
          {detailQuery.error instanceof ApiError ? detailQuery.error.detail : "Ошибка загрузки рейса"}
        </Typography.Text>
      ) : trip ? (
        <>
          <Card className="crm-panel">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="Название">{trip.name}</Descriptions.Item>
              <Descriptions.Item label="Статус">{renderTripStatus(trip.status_name)}</Descriptions.Item>
              <Descriptions.Item label="Тип">{trip.type_name ? formatEnumCode(trip.type_name) : "—"}</Descriptions.Item>
              <Descriptions.Item label="Текущий этап">{formatTripCurrentStage(trip.current_stage)}</Descriptions.Item>
              <Descriptions.Item label="Текущая точка">{trip.current_point_name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Номер тягача">{trip.truck_plate ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Транспортная компания">{trip.truck_company_name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Создан">{trip.created_at ?? "—"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            className="crm-panel crm-table-card"
            title="Точки рейса"
            extra={
              canMutate ? (
                <Button size="small" icon={<PlusOutlined />} onClick={openCreatePoint}>
                  Добавить
                </Button>
              ) : null
            }
          >
            <Table<TripPoint>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={trip.points ?? []}
              columns={pointColumns}
              scroll={{ x: 980 }}
              locale={{ emptyText: "Точки рейса не добавлены" }}
            />
          </Card>

          <Card className="crm-panel crm-table-card" title="Заказы рейса">
            {ordersQuery.error ? (
              <Typography.Text type="danger">
                {ordersQuery.error instanceof ApiError ? ordersQuery.error.detail : "Ошибка загрузки заказов рейса"}
              </Typography.Text>
            ) : null}
            <Space wrap style={{ marginBottom: 12 }}>
              <Input.Search
                allowClear
                placeholder="Поиск по заказам"
                style={{ width: 260 }}
                onSearch={(value) => {
                  setOrdersParams((current) => ({
                    ...current,
                    query: value || undefined,
                    page: 1,
                  }));
                }}
              />
              <Select
                allowClear
                mode="multiple"
                placeholder="Статусы"
                style={{ minWidth: 260 }}
                options={ORDER_STATUS_VALUES.map((value) => ({
                  label: formatEnumCode(value),
                  value,
                }))}
                onChange={(values: OrderStatus[]) => {
                  setOrdersParams((current) => ({
                    ...current,
                    status_names: values.length ? values : undefined,
                    page: 1,
                  }));
                }}
              />
            </Space>
            <Table<OrderListItem>
              rowKey="id"
              size="small"
              loading={ordersQuery.isLoading}
              dataSource={ordersQuery.data?.items ?? []}
              columns={orderColumns}
              scroll={{ x: 1180 }}
              pagination={{
                current: ordersParams.page,
                pageSize: ordersParams.page_size,
                total: ordersQuery.data?.meta.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: [20, 50, 100, 200],
              }}
              onChange={handleOrdersTableChange}
              locale={{ emptyText: "Заказы рейса не найдены" }}
            />
          </Card>
        </>
      ) : null}

      <Modal
        title={`Редактировать рейс #${trip?.id ?? ""}`}
        open={editTripOpen}
        destroyOnHidden
        onCancel={() => setEditTripOpen(false)}
        onOk={() => tripForm.submit()}
        confirmLoading={updateTripMutation.isPending}
      >
        <Form<TripForm>
          form={tripForm}
          layout="vertical"
          onFinish={(values) => updateTripMutation.mutate(values)}
        >
          <Form.Item name="name" label="Название">
            <Input />
          </Form.Item>
          <Form.Item name="current_point_id" label="ID текущей точки">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="current_point_name" label="Текущая точка">
            <Input />
          </Form.Item>
          <Form.Item name="truck_plate" label="Номер тягача">
            <Input />
          </Form.Item>
          <Form.Item name="truck_company_name" label="Транспортная компания">
            <Input />
          </Form.Item>
          <Form.Item name="status_name" label="Статус">
            <Select
              allowClear
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatEnumCode(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Select
              allowClear
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatEnumCode(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedPoint ? "Редактировать точку рейса" : "Добавить точку рейса"}
        open={pointModalOpen}
        destroyOnHidden
        onCancel={() => {
          setPointModalOpen(false);
          setSelectedPoint(null);
        }}
        onOk={() => pointForm.submit()}
        confirmLoading={savePointMutation.isPending}
      >
        <Form
          form={pointForm}
          layout="vertical"
          onFinish={(values) => savePointMutation.mutate(values)}
        >
          <TripPointFormFields
            form={pointForm}
            countries={countries}
            cities={pointCityOptions}
            factories={pointFactories}
            forwarders={pointPayloadForwarders}
            pathPoints={pathPoints}
            countriesLoading={countriesQuery.isLoading}
            citiesLoading={
              pointLoadingSource === "forwarder"
                ? forwarderCitiesQuery.isLoading
                : factoryCitiesQuery.isLoading
            }
            factoriesLoading={pointFactoriesQuery.isLoading}
            forwardersLoading={pointForwardersQuery.isLoading}
            pathPointsLoading={pathPointsCatalogQuery.isLoading}
          />
        </Form>
      </Modal>
    </Space>
  );
}

export default function TripDetailPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <TripDetailPageContent />
    </Suspense>
  );
}
