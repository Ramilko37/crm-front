"use client";

import {
  ApartmentOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Pagination,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  TRIP_STATUS_VALUES,
  TRIP_TYPE_VALUES,
  type TripStatus,
  type TripType,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  BulkMutationResponse,
  Country,
  Factory,
  OrderListItem,
  PaginatedResponse,
  PathPoint,
  Trip,
  TripCityLookupItem,
  TripFilterParams,
  TripPoint,
  TripPointWritePayload,
} from "@/shared/types/entities";

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBool(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function getParams(searchParams: URLSearchParams): TripFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    quick_tab: searchParams.get("quick_tab") ?? undefined,
    status_names: parseSearchArray(searchParams, "status_names") as TripStatus[],
    type_names: parseSearchArray(searchParams, "type_names") as TripType[],
    truck_plate: searchParams.get("truck_plate") ?? undefined,
    current_point_id: parseNumber(searchParams.get("current_point_id")),
    created_at_from: searchParams.get("created_at_from") ?? undefined,
    created_at_to: searchParams.get("created_at_to") ?? undefined,
  };
}

type TripForm = {
  name: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
  type_name?: TripType;
};

type TripPointForm = {
  point_kind?: "loading" | "path";
  loading_source?: "factory" | "forwarder";
  sequence?: number;
  path_point_id?: number;
  factory_id?: number;
  country_id?: number;
  name?: string;
  country?: string;
  city?: string;
  address?: string;
  postcode?: string;
  contact_name?: string;
  phone?: string;
  forwarder_user_id?: number;
  planned_at?: dayjs.Dayjs;
  actual_at?: dayjs.Dayjs;
  is_completed?: boolean;
};

type TripLookupForwarder = {
  id: number;
  full_name: string;
  company_id: number | null;
  company_name: string | null;
  country: string | null;
  city: string | null;
  label: string;
};

const tripStatusTagColors: Record<string, string> = {
  new: "blue",
  in_transit: "cyan",
  in_russia_customs: "orange",
  in_moscow_warehouse: "geekblue",
  unloaded: "green",
};

function formatTripStatus(value: TripStatus | null) {
  return formatEnumCode(value);
}

function formatTripType(value: TripType | null) {
  return formatEnumCode(value);
}

function renderTripStatus(value: TripStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={tripStatusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatTripStatus(value)}
    </Tag>
  );
}

function formatTripStage(record: Trip) {
  return record.current_stage?.point_name ?? record.current_point_name ?? "-";
}

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "-";
}

function compactText(value: string | number | null | undefined, fallback = "-") {
  return value === null || value === undefined || String(value).trim() === "" ? fallback : String(value);
}

const tripQuickTabs: Array<{ code: string; label: string; status?: TripStatus }> = [
  { code: "all", label: "Все" },
  { code: "new", label: "Новые", status: "new" },
  { code: "in_transit", label: "В пути", status: "in_transit" },
  { code: "in_moscow_warehouse", label: "На складе в МСК", status: "in_moscow_warehouse" },
  { code: "unloaded", label: "Разгружены", status: "unloaded" },
];

const createTripStatusOptions: Array<{ label: string; value: TripStatus }> = [
  { label: "В России", value: "in_russia_customs" },
  { label: "В Москве на складе", value: "in_transit" },
  { label: "Разгружен", value: "unloaded" },
];

function TripsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const meQuery = useCurrentUser(true);
  const canMutate = isBackOfficeRole(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);
  const [ordersDrawerOpen, setOrdersDrawerOpen] = useState(false);
  const [routeDrawerOpen, setRouteDrawerOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [pointKind, setPointKind] = useState<"loading" | "path">("loading");
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [factorySearch, setFactorySearch] = useState("");
  const [forwarderSearch, setForwarderSearch] = useState("");
  const [pathPointSearch, setPathPointSearch] = useState("");
  const [selected, setSelected] = useState<Trip | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const [createForm] = Form.useForm<TripForm>();
  const [pointForm] = Form.useForm<TripPointForm>();
  const [bulkStatusForm] = Form.useForm<{ status_name: TripStatus }>();
  const [bulkTypeForm] = Form.useForm<{ type_name: TripType }>();
  const [filterForm] = Form.useForm<{
    query?: string;
    status_names?: TripStatus[];
    type_names?: TripType[];
    truck_plate?: string;
  }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const pointLoadingSource = Form.useWatch("loading_source", pointForm) ?? "factory";
  const pointCountryId = Form.useWatch("country_id", pointForm);
  const pointCountry = Form.useWatch("country", pointForm);
  const pointCity = Form.useWatch("city", pointForm);
  const hasActiveFilters = Boolean(
    params.query ||
      params.quick_tab ||
      params.truck_plate ||
      (params.status_names?.length ?? 0) > 0 ||
      (params.type_names?.length ?? 0) > 0,
  );
  const [filtersOpen, setFiltersOpen] = useState(() => hasActiveFilters);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      status_names: params.status_names?.length ? params.status_names : undefined,
      type_names: params.type_names?.length ? params.type_names : undefined,
      truck_plate: params.truck_plate,
    });
  }, [filterForm, params.query, params.status_names, params.truck_plate, params.type_names]);

  const listQuery = useQuery({
    queryKey: queryKeys.trips.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: params,
      }),
  });

  const tripPointsQuery = useQuery({
    queryKey: ["trips", selected?.id, "points"],
    queryFn: () =>
      apiRequest<PaginatedResponse<TripPoint>>(`/api/trips/${selected?.id}/points`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: Boolean(selected?.id) && routeDrawerOpen,
  });

  const tripOrdersQuery = useQuery({
    queryKey: ["trips", selected?.id, "orders"],
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderListItem>>(`/api/trips/${selected?.id}/orders`, {
        query: { page: 1, page_size: 50 },
      }),
    enabled: Boolean(selected?.id) && ordersDrawerOpen,
  });

  const countriesQuery = useQuery({
    queryKey: queryKeys.countries.list({ query: countrySearch || undefined, page: 1, page_size: 300 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Country>>("/api/countries", {
        query: { query: countrySearch || undefined, page: 1, page_size: 300 },
      }),
    enabled: pointOpen && pointKind === "loading",
  });

  const tripCitiesQuery = useQuery({
    queryKey: [
      "trips",
      "lookups",
      pointLoadingSource === "forwarder" ? "forwarder-cities" : "cities",
      { query: citySearch || undefined, country_id: pointCountryId ?? undefined },
    ],
    queryFn: () =>
      apiRequest<PaginatedResponse<TripCityLookupItem>>(
        pointLoadingSource === "forwarder" ? "/api/trips/lookups/forwarder-cities" : "/api/trips/lookups/cities",
        {
          query: {
            query: citySearch || undefined,
            country_id: pointCountryId ?? undefined,
            page: 1,
            page_size: 200,
          },
        },
      ),
    enabled: pointOpen && pointKind === "loading",
  });

  const factoriesLookupQuery = useQuery({
    queryKey: queryKeys.factories.list({
      query: factorySearch || undefined,
      country_id: pointCountryId ?? undefined,
      country: pointCountry || undefined,
      city: pointCity || undefined,
      page: 1,
      page_size: 50,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: {
          query: factorySearch || undefined,
          country_id: pointCountryId ?? undefined,
          country: pointCountry || undefined,
          city: pointCity || undefined,
          page: 1,
          page_size: 50,
        },
      }),
    enabled: pointOpen && pointKind === "loading" && pointLoadingSource === "factory",
  });

  const forwardersLookupQuery = useQuery({
    queryKey: [
      "trips",
      "lookups",
      "forwarders",
      {
        query: forwarderSearch || undefined,
        country_id: pointCountryId ?? undefined,
        city: pointCity || undefined,
      },
    ],
    queryFn: () =>
      apiRequest<PaginatedResponse<TripLookupForwarder>>("/api/trips/lookups/forwarders", {
        query: {
          query: forwarderSearch || undefined,
          country_id: pointCountryId ?? undefined,
          city: pointCity || undefined,
          page: 1,
          page_size: 50,
        },
      }),
    enabled: pointOpen && pointKind === "loading" && pointLoadingSource === "forwarder",
  });

  const pathPointsLookupQuery = useQuery({
    queryKey: queryKeys.pathPoints.list({ query: pathPointSearch || undefined, page: 1, page_size: 100 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: { query: pathPointSearch || undefined, page: 1, page_size: 100 },
      }),
    enabled: pointOpen && pointKind === "path",
  });

  const createMutation = useMutation({
    mutationFn: (payload: TripForm) =>
      apiRequest<Trip>("/api/trips", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания рейса");
    },
  });

  const createPointMutation = useMutation({
    mutationFn: ({ tripId, payload }: { tripId: number; payload: TripPointWritePayload }) =>
      apiRequest<TripPoint>(`/api/trips/${tripId}/points`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async (_, values) => {
      message.success("Точка рейса добавлена");
      setPointOpen(false);
      pointForm.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips", values.tripId, "points"] }),
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления точки");
    },
  });

  const updatePointMutation = useMutation({
    mutationFn: ({ tripId, pointId, payload }: { tripId: number; pointId: number; payload: TripPointWritePayload }) =>
      apiRequest<TripPoint>(`/api/trips/${tripId}/points/${pointId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async (_, values) => {
      message.success("Точка рейса обновлена");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips", values.tripId, "points"] }),
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления точки");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: "status" | "type" | "delete"; body: Record<string, unknown> }) =>
      apiRequest<BulkMutationResponse<Trip>>(`/api/trips/bulk/${endpoint}`, {
        method: "POST",
        body,
      }),
    onSuccess: async (payload) => {
      message.success(`Операция выполнена. Обновлено: ${payload.updated_count}`);
      setBulkStatusOpen(false);
      setBulkTypeOpen(false);
      bulkStatusForm.resetFields();
      bulkTypeForm.resetFields();
      setSelectedRowKeys([]);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка массовой операции");
    },
  });

  function openOrders(record: Trip) {
    setSelected(record);
    setOrdersDrawerOpen(true);
  }

  function openRoute(record: Trip) {
    setSelected(record);
    setRouteDrawerOpen(true);
  }

  function openPointModal(kind: "loading" | "path") {
    const nextSequence = (tripPointsQuery.data?.items?.length ?? selected?.points?.length ?? 0) + 1;
    setPointKind(kind);
    setCountrySearch("");
    setCitySearch("");
    setFactorySearch("");
    setForwarderSearch("");
    setPathPointSearch("");
    pointForm.resetFields();
    pointForm.setFieldsValue({
      point_kind: kind,
      loading_source: "factory",
      sequence: nextSequence,
      is_completed: false,
    });
    setPointOpen(true);
  }

  function selectCountry(countryId: number | undefined) {
    const country = countriesQuery.data?.items.find((item) => item.id === countryId);
    pointForm.setFieldsValue({
      country_id: countryId,
      country: country?.name_ru,
      city: undefined,
      factory_id: undefined,
      forwarder_user_id: undefined,
      name: undefined,
      address: undefined,
      postcode: undefined,
      phone: undefined,
    });
    setCitySearch("");
    setFactorySearch("");
    setForwarderSearch("");
  }

  function selectFactory(factoryId: number | undefined) {
    const factory = factoriesLookupQuery.data?.items.find((item) => item.id === factoryId);
    pointForm.setFieldsValue({
      factory_id: factoryId,
      name: factory?.name,
      country: factory?.country ?? pointCountry,
      city: factory?.city ?? pointCity,
      address: factory?.address ?? undefined,
      postcode: factory?.postcode ?? undefined,
      phone: factory?.phone ?? undefined,
      forwarder_user_id: undefined,
    });
  }

  function selectForwarder(forwarderId: number | undefined) {
    const forwarder = forwardersLookupQuery.data?.items.find((item) => item.id === forwarderId);
    pointForm.setFieldsValue({
      forwarder_user_id: forwarderId,
      name: forwarder?.company_name ?? forwarder?.full_name,
      country: forwarder?.country ?? pointCountry,
      city: forwarder?.city ?? pointCity,
      factory_id: undefined,
    });
  }

  function selectPathPoint(pathPointId: number | undefined) {
    const pathPoint = pathPointsLookupQuery.data?.items.find((item) => item.id === pathPointId);
    pointForm.setFieldsValue({
      path_point_id: pathPointId,
      name: pathPoint?.name_ru,
    });
  }

  function buildPointPayload(values: TripPointForm): TripPointWritePayload {
    return {
      sequence: values.sequence,
      is_loading_point: pointKind === "loading",
      path_point_id: pointKind === "path" ? (values.path_point_id ?? null) : null,
      factory_id: pointKind === "loading" && values.loading_source === "factory" ? (values.factory_id ?? null) : null,
      forwarder_user_id:
        pointKind === "loading" && values.loading_source === "forwarder" ? (values.forwarder_user_id ?? null) : null,
      name: values.name || null,
      country: values.country || null,
      city: values.city || null,
      address: values.address || null,
      postcode: values.postcode || null,
      contact_name: values.contact_name || null,
      phone: values.phone || null,
      planned_at: values.planned_at?.format("YYYY-MM-DD") ?? null,
      actual_at: values.is_completed ? (values.actual_at?.format("YYYY-MM-DD") ?? null) : null,
      is_completed: Boolean(values.is_completed),
    };
  }

  function togglePointCompleted(point: TripPoint, checked: boolean) {
    if (!selected) return;
    updatePointMutation.mutate({
      tripId: selected.id,
      pointId: point.id,
      payload: {
        is_completed: checked,
        actual_at: checked ? (point.actual_at ?? dayjs().format("YYYY-MM-DD")) : point.actual_at,
      },
    });
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  const columns: ColumnsType<Trip> = [
    { title: "ID рейса", dataIndex: "id", key: "id", sorter: true, sortOrder: sortOrderFor("id"), width: 96 },
    {
      title: "Название рейса",
      dataIndex: "name",
      key: "name",
      sorter: true,
      sortOrder: sortOrderFor("name"),
      width: 190,
      render: (value: string, record) => (
        <Button type="link" size="small" className="crm-cell-link" onClick={() => openRoute(record)}>
          {value}
        </Button>
      ),
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (v: TripStatus | null) => renderTripStatus(v),
      width: 170,
    },
    {
      title: "Тип рейса",
      dataIndex: "type_name",
      key: "type_name",
      sorter: true,
      sortOrder: sortOrderFor("type_name"),
      render: (v: TripType | null) => formatTripType(v),
      width: 130,
    },
    {
      title: "Текущая точка",
      key: "current_stage",
      sorter: true,
      sortOrder: sortOrderFor("current_point_name"),
      render: (_, record) => (
        <Button type="link" size="small" className="crm-cell-link" onClick={() => openRoute(record)}>
          {formatTripStage(record)}
        </Button>
      ),
      width: 190,
    },
    {
      title: "Номер",
      dataIndex: "truck_plate",
      key: "truck_plate",
      sorter: true,
      sortOrder: sortOrderFor("truck_plate"),
      render: (v) => v ?? "-",
      width: 140,
    },
    {
      title: "Компания",
      dataIndex: "truck_company_name",
      key: "truck_company_name",
      sorter: true,
      sortOrder: sortOrderFor("truck_company_name"),
      render: (v: string | null) => compactText(v),
      width: 170,
    },
    {
      title: "Дата",
      dataIndex: "created_at",
      key: "created_at",
      sorter: true,
      sortOrder: sortOrderFor("created_at"),
      render: (v: string | null | undefined) => formatDate(v),
      width: 120,
    },
    {
      title: "Действия",
      key: "actions",
      width: 230,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<UnorderedListOutlined />} onClick={() => openOrders(record)}>
            Заказы
          </Button>
          {canMutate ? (
            <Button size="small" icon={<ApartmentOutlined />} onClick={() => openRoute(record)}>
              Открыть
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/trips${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Trip> | SorterResult<Trip>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Trip> | undefined)
      : (sorter as SorterResult<Trip>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  function toggleRowSelection(id: number, checked: boolean) {
    setSelectedRowKeys((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((currentId) => currentId !== id);
    });
  }

  function askBulkDeleteConfirm() {
    Modal.confirm({
      title: "Удалить выбранные рейсы",
      content: "Удаление возможно только для рейсов без связанных заказов.",
      okText: "Подтвердить",
      cancelText: "Отмена",
      onOk: () => {
        bulkMutation.mutate({
          endpoint: "delete",
          body: { trip_ids: selectedRowKeys },
        });
      },
    });
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Рейсы"
        subtitle="Планирование перемещений, связанные заказы и маршрутные точки."
        actions={
          canMutate ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новый рейс
            </Button>
          ) : null
        }
      />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтры"
        search={
          <Input.Search
            key={params.query ?? "trips-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию рейса"
            defaultValue={params.query}
            onSearch={(value) => {
              applySearchPatch({
                query: value || null,
                page: 1,
              });
            }}
          />
        }
      />

      <Card className="crm-panel crm-status-tabs-bar">
        <div className="crm-status-tabs-wrap">
          {tripQuickTabs.map((tab) => {
            const isActive = params.quick_tab ? params.quick_tab === tab.code : tab.code === "all";
            return (
              <Button
                key={tab.code}
                size="small"
                type={isActive ? "primary" : "default"}
                onClick={() => {
                  applySearchPatch({
                    quick_tab: tab.code === "all" ? null : tab.code,
                    status_names: tab.status ? [tab.status] : null,
                    page: 1,
                  });
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </Card>

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          onFinish={(values: {
            query?: string;
            status_names?: TripStatus[];
            type_names?: TripType[];
            truck_plate?: string;
          }) => {
            applySearchPatch({
              query: values.query,
              status_names: values.status_names,
              type_names: values.type_names,
              truck_plate: values.truck_plate,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по названию" allowClear />
            </Form.Item>
            <Form.Item name="truck_plate" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Номер тягача" allowClear />
            </Form.Item>
            <Form.Item name="status_names" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статус"
                options={TRIP_STATUS_VALUES.map((value) => ({
                  label: formatTripStatus(value),
                  value,
                }))}
              />
            </Form.Item>
            <Form.Item name="type_names" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Тип"
                options={TRIP_TYPE_VALUES.map((value) => ({
                  label: formatTripType(value),
                  value,
                }))}
              />
            </Form.Item>
          </div>

          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/trips");
                setFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </FilterPanel>

      {canMutate ? (
        <Card className="crm-panel crm-actions-strip-bar">
          <div className="crm-actions-strip">
            <Typography.Text strong>Выбрано рейсов: {selectedRowKeys.length}</Typography.Text>
            <Button disabled={!selectedRowKeys.length} onClick={() => setBulkStatusOpen(true)}>
              Массово: статус
            </Button>
            <Button disabled={!selectedRowKeys.length} onClick={() => setBulkTypeOpen(true)}>
              Массово: тип
            </Button>
            <Button danger disabled={!selectedRowKeys.length} onClick={askBulkDeleteConfirm}>
              Удалить
            </Button>
            <Button disabled={!selectedRowKeys.length} onClick={() => setSelectedRowKeys([])}>
              Снять выделение
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки рейсов"}
          </Typography.Text>
        ) : null}

        {isMobile ? (
          <>
            <div className="crm-mobile-list">
              {rows.map((record) => (
                <article key={record.id} className="crm-row-card">
                  <div className="crm-row-card-head">
                    <div>
                      {canMutate ? (
                        <Checkbox
                          checked={selectedRowKeys.includes(record.id)}
                          onChange={(event) => toggleRowSelection(record.id, event.target.checked)}
                          style={{ marginBottom: 8 }}
                        >
                          Выбрать
                        </Checkbox>
                      ) : null}
                      <div className="crm-row-title">{record.name}</div>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderTripStatus(record.status_name)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Тип
                      <strong>{formatTripType(record.type_name)}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Точка
                      <strong>{formatTripStage(record)}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Тягач
                      <strong>{record.truck_plate ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Компания
                      <strong>{record.truck_company_name ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Создан
                      <strong>{record.created_at ?? "-"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    {canMutate ? (
                      <Button size="small" icon={<ApartmentOutlined />} onClick={() => openRoute(record)}>
                        Открыть
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {!listQuery.isLoading && rows.length === 0 ? (
              <Typography.Text type="secondary">Нет данных</Typography.Text>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Pagination
                current={currentPage}
                pageSize={currentPageSize}
                total={totalRows}
                showSizeChanger
                pageSizeOptions={[20, 50, 100, 200]}
                onChange={(page, pageSize) => {
                  applySearchPatch({
                    page,
                    page_size: pageSize,
                  });
                }}
              />
            </div>
          </>
        ) : (
          <Table<Trip>
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            rowSelection={
              canMutate
                ? {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }
                : undefined
            }
            scroll={{ x: 1500 }}
            pagination={{
              current: currentPage,
              pageSize: currentPageSize,
              total: totalRows,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100, 200],
            }}
            onChange={handleTableChange}
            locale={{ emptyText: "Нет данных" }}
          />
        )}
      </Card>

      <Drawer
        title={selected ? `Заказы в рейсе: ${selected.name}` : "Заказы в рейсе"}
        open={ordersDrawerOpen}
        width={760}
        onClose={() => setOrdersDrawerOpen(false)}
      >
        <Table<OrderListItem>
          rowKey="id"
          size="small"
          loading={tripOrdersQuery.isLoading}
          dataSource={tripOrdersQuery.data?.items ?? []}
          pagination={false}
          scroll={{ x: 720 }}
          locale={{ emptyText: "В рейсе нет заказов" }}
          columns={[
            { title: "ID", dataIndex: "id", key: "id", width: 76 },
            {
              title: "Номер",
              dataIndex: "order_number",
              key: "order_number",
              width: 140,
              render: (value: string | null, record) => (
                <Button type="link" size="small" className="crm-cell-link" onClick={() => router.push(`/orders/${record.id}`)}>
                  {compactText(value, `ID ${record.id}`)}
                </Button>
              ),
            },
            {
              title: "Клиент",
              dataIndex: "company_name",
              key: "company_name",
              width: 160,
              render: (value: string | null | undefined) => compactText(value),
            },
            {
              title: "Инвойс",
              dataIndex: "invoice_number",
              key: "invoice_number",
              width: 150,
              render: (value: string | null | undefined) => compactText(value),
            },
            {
              title: "Статус",
              dataIndex: "status_name",
              key: "status_name",
              width: 180,
              render: (value: OrderListItem["status_name"]) => (value ? <Tag>{formatEnumCode(value)}</Tag> : "-"),
            },
            { title: "Готовность", dataIndex: "ready_date", key: "ready_date", width: 120, render: formatDate },
          ]}
        />
      </Drawer>

      <Modal
        title={selected ? `Рейс #${selected.id}` : "Рейс"}
        open={routeDrawerOpen}
        width={720}
        footer={null}
        destroyOnHidden
        onCancel={() => setRouteDrawerOpen(false)}
      >
        {selected ? (
          <div className="crm-trip-route">
            <div className="crm-trip-route-summary">
              <strong>{selected.name}</strong>
              <span>{renderTripStatus(selected.status_name)}</span>
              <span>{formatTripType(selected.type_name)}</span>
              <span>{compactText(selected.truck_plate)}</span>
              <span>{compactText(selected.truck_company_name)}</span>
            </div>

            <div className="crm-trip-point-list">
              {(tripPointsQuery.data?.items ?? selected.points ?? []).map((point) => (
                <article key={point.id} className="crm-trip-point-card">
                  <div className="crm-trip-point-head">
                    <div>
                      <Typography.Text strong>
                        {point.sequence}. {point.name || point.city || point.country || `Точка #${point.id}`}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {point.is_loading_point ? "Точка погрузки" : "Путевая точка"}
                      </Typography.Text>
                    </div>
                    <Checkbox
                      checked={point.is_completed}
                      disabled={!canMutate || updatePointMutation.isPending}
                      onChange={(event) => togglePointCompleted(point, event.target.checked)}
                    >
                      Завершена
                    </Checkbox>
                  </div>
                  <div className="crm-trip-point-meta">
                    <span>Страна: {compactText(point.country)}</span>
                    <span>Город: {compactText(point.city)}</span>
                    <span>Адрес: {compactText(point.address)}</span>
                    <span>План: {formatDate(point.planned_at)}</span>
                    <span>Факт: {formatDate(point.actual_at)}</span>
                  </div>
                </article>
              ))}
            </div>

            {tripPointsQuery.isLoading ? <Card loading className="crm-trip-point-card" /> : null}
            {!tripPointsQuery.isLoading && !(tripPointsQuery.data?.items ?? selected.points ?? []).length ? (
              <Typography.Text type="secondary">Точки маршрута еще не добавлены</Typography.Text>
            ) : null}

            {canMutate ? (
              <div className="crm-trip-route-actions">
                <Button icon={<PlusOutlined />} onClick={() => openPointModal("loading")}>
                  Добавить точку погрузки
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => openPointModal("path")}>
                  Добавить путевую точку
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pointKind === "loading" ? "Добавить точку погрузки" : "Добавить путевую точку"}
        open={pointOpen}
        width={pointKind === "loading" ? 760 : 620}
        destroyOnHidden
        onCancel={() => setPointOpen(false)}
        onOk={() => pointForm.submit()}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createPointMutation.isPending}
      >
        <Form<TripPointForm>
          form={pointForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            createPointMutation.mutate({ tripId: selected.id, payload: buildPointPayload(values) });
          }}
        >
          <Form.Item name="sequence" hidden rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="point_kind" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="country" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" hidden>
            <Input />
          </Form.Item>

          {pointKind === "loading" ? (
            <>
              <Form.Item name="loading_source" label="Тип" rules={[{ required: true }]}>
                <Radio.Group
                  className="crm-trip-loading-type"
                  onChange={() => {
                    pointForm.setFieldsValue({
                      factory_id: undefined,
                      forwarder_user_id: undefined,
                      name: undefined,
                      address: undefined,
                      postcode: undefined,
                      phone: undefined,
                    });
                    setFactorySearch("");
                    setForwarderSearch("");
                  }}
                >
                  <Radio value="forwarder">Склад экспедитора</Radio>
                  <Radio value="factory">Фабрика</Radio>
                </Radio.Group>
              </Form.Item>

              <div className="crm-trip-point-form-grid">
                <Form.Item name="country_id" label="Страна" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    allowClear
                    filterOption={false}
                    placeholder="Страна"
                    loading={countriesQuery.isLoading}
                    onSearch={setCountrySearch}
                    onChange={selectCountry}
                    options={(countriesQuery.data?.items ?? []).map((country) => ({
                      value: country.id,
                      label: country.name_ru,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="city" label="Город" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    allowClear
                    filterOption={false}
                    placeholder="Город"
                    loading={tripCitiesQuery.isLoading}
                    onSearch={setCitySearch}
                    onChange={(city) => {
                      pointForm.setFieldsValue({
                        city,
                        factory_id: undefined,
                        forwarder_user_id: undefined,
                        name: undefined,
                        address: undefined,
                        postcode: undefined,
                        phone: undefined,
                      });
                      setFactorySearch("");
                      setForwarderSearch("");
                    }}
                    options={(tripCitiesQuery.data?.items ?? []).map((item) => ({
                      value: item.city,
                      label: item.city,
                    }))}
                  />
                </Form.Item>
              </div>

              {pointLoadingSource === "factory" ? (
                <Form.Item name="factory_id" label="Название фабрики" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    allowClear
                    filterOption={false}
                    placeholder="Фабрика"
                    loading={factoriesLookupQuery.isLoading}
                    onSearch={setFactorySearch}
                    onChange={selectFactory}
                    options={(factoriesLookupQuery.data?.items ?? []).map((factory) => ({
                      value: factory.id,
                      label: [factory.name, factory.city, factory.country].filter(Boolean).join(" · "),
                    }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item name="forwarder_user_id" label="Название компании экспедитора" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    allowClear
                    filterOption={false}
                    placeholder="Компания экспедитора"
                    loading={forwardersLookupQuery.isLoading}
                    onSearch={setForwarderSearch}
                    onChange={selectForwarder}
                    options={(forwardersLookupQuery.data?.items ?? []).map((forwarder) => ({
                      value: forwarder.id,
                      label: forwarder.label,
                    }))}
                  />
                </Form.Item>
              )}

              <div className="crm-trip-point-form-grid">
                <Form.Item name="planned_at" label="Дата прохождения" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item label="Актуальная дата">
                  <DatePicker disabled style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="После завершения" />
                </Form.Item>
              </div>
            </>
          ) : (
            <>
              <Form.Item name="path_point_id" label="Путевая точка" rules={[{ required: true }]}>
                <Select
                  showSearch
                  allowClear
                  filterOption={false}
                  placeholder="Выберите путевую точку"
                  loading={pathPointsLookupQuery.isLoading}
                  onSearch={setPathPointSearch}
                  onChange={selectPathPoint}
                  options={(pathPointsLookupQuery.data?.items ?? []).map((pathPoint) => ({
                    value: pathPoint.id,
                    label: pathPoint.name_ru,
                  }))}
                />
              </Form.Item>
              <div className="crm-trip-point-form-grid">
                <Form.Item name="planned_at" label="Дата прохождения" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item label="Актуальная дата">
                  <DatePicker disabled style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="После завершения" />
                </Form.Item>
              </div>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="Создать рейс"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<TripForm> form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="name" label="Имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="truck_company_name" label="Компания">
            <Input />
          </Form.Item>
          <Form.Item name="truck_plate" label="Номер">
            <Input />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Select
              allowClear
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item label="Статус">
            <div className="crm-trip-status-checkboxes">
              {createTripStatusOptions.map((option) => (
                <Form.Item key={option.value} noStyle shouldUpdate={(previous, current) => previous.status_name !== current.status_name}>
                  {() => {
                    const checked = createForm.getFieldValue("status_name") === option.value;
                    return (
                      <Checkbox
                        checked={checked}
                        onChange={(event) => {
                          createForm.setFieldValue("status_name", event.target.checked ? option.value : undefined);
                        }}
                      >
                        {option.label}
                      </Checkbox>
                    );
                  }}
                </Form.Item>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массовое изменение статуса"
        open={bulkStatusOpen}
        destroyOnHidden
        onCancel={() => setBulkStatusOpen(false)}
        onOk={() => bulkStatusForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkStatusForm}
          layout="vertical"
          onFinish={(values: { status_name: TripStatus }) => {
            bulkMutation.mutate({
              endpoint: "status",
              body: {
                trip_ids: selectedRowKeys,
                status_name: values.status_name,
              },
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}> 
            <Select
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatTripStatus(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массовое изменение типа"
        open={bulkTypeOpen}
        destroyOnHidden
        onCancel={() => setBulkTypeOpen(false)}
        onOk={() => bulkTypeForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkTypeForm}
          layout="vertical"
          onFinish={(values: { type_name: TripType }) => {
            bulkMutation.mutate({
              endpoint: "type",
              body: {
                trip_ids: selectedRowKeys,
                type_name: values.type_name,
              },
            });
          }}
        >
          <Form.Item name="type_name" label="Тип" rules={[{ required: true }]}> 
            <Select
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <TripsPageContent />
    </Suspense>
  );
}
