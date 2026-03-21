"use client";

import {
  ApartmentOutlined,
  EditOutlined,
  MoreOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dropdown,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode, ORDER_STATUS_VALUES, type OrderStatus } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { toOrderWritePayload } from "@/shared/lib/order-dto";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import { FilterPanel, PageToolbar } from "@/shared/ui/page-frame";
import type {
  BulkMutationResponse,
  Order,
  OrderFilterParams,
  OrderWritePayload,
  PaginatedResponse,
  Trip,
} from "@/shared/types/entities";

type OrderForm = {
  order_number: string;
  user_id: number;
  factory_id: number;
  trip_id?: number;
  comment?: string;
  status_name?: OrderStatus;
};

type OrderBulkEndpoint =
  | "status"
  | "assign-trip"
  | "archive"
  | "delete"
  | "warehouse-comment"
  | "forwarder-comment";

const quickStatusTabs: Array<{
  key: string;
  label: string;
  status?: OrderStatus;
  tone?: "danger";
}> = [
  { key: "all", label: "Все" },
  { key: "new_request", label: "Новые", status: "new_request" },
  { key: "factory_confirmed", label: "Подтверждены фабрикой", status: "factory_confirmed" },
  { key: "in_transportation", label: "Транспортировка", status: "in_transportation" },
  { key: "released_to_client", label: "Выдано клиенту", status: "released_to_client" },
  { key: "archived", label: "Архив", status: "archived" },
  { key: "deleted", label: "Удаленные", status: "deleted", tone: "danger" },
];

const statusTagColors: Partial<Record<OrderStatus, string>> = {
  new_request: "blue",
  in_transportation: "cyan",
  released_to_client: "green",
  archived: "default",
  deleted: "red",
};

function renderOrderStatus(value: OrderStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={statusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatEnumCode(value)}
    </Tag>
  );
}

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

function getParams(searchParams: URLSearchParams): OrderFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    status_names: parseSearchArray(searchParams, "status_names") as OrderStatus[],
    country: searchParams.get("country") ?? undefined,
    user_id: parseNumber(searchParams.get("user_id")),
    company_id: parseNumber(searchParams.get("company_id")),
    factory_id: parseNumber(searchParams.get("factory_id")),
    trip_id: parseNumber(searchParams.get("trip_id")),
    has_mrn: parseBool(searchParams.get("has_mrn")),
    has_certificate: parseBool(searchParams.get("has_certificate")),
    has_documents: parseBool(searchParams.get("has_documents")),
    order_date_from: searchParams.get("order_date_from") ?? undefined,
    order_date_to: searchParams.get("order_date_to") ?? undefined,
  };
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const meQuery = useCurrentUser(true);
  const canMutate = isBackOfficeRole(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkCommentOpen, setBulkCommentOpen] = useState(false);
  const [bulkCommentTarget, setBulkCommentTarget] = useState<"warehouse" | "forwarder">("warehouse");
  const [selected, setSelected] = useState<Order | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const [createForm] = Form.useForm<OrderForm>();
  const [editForm] = Form.useForm<Partial<OrderForm>>();
  const [statusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();
  const [filterForm] = Form.useForm<{
    query?: string;
    country?: string;
    status_names?: OrderStatus[];
    user_id?: number;
    factory_id?: number;
    trip_id?: number;
    order_date_from?: dayjs.Dayjs;
    order_date_to?: dayjs.Dayjs;
    has_certificate?: boolean;
    has_documents?: boolean;
  }>();
  const [bulkStatusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [bulkAssignForm] = Form.useForm<{ trip_id?: number }>();
  const [bulkCommentForm] = Form.useForm<{ comment: string }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const hasActiveFilters = Boolean(
    params.query || params.country || (params.status_names?.length ?? 0) > 0,
  );
  const [filtersOpen, setFiltersOpen] = useState(() => hasActiveFilters);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      country: params.country,
      status_names: params.status_names?.length ? params.status_names : undefined,
      user_id: params.user_id,
      factory_id: params.factory_id,
      trip_id: params.trip_id,
      order_date_from: params.order_date_from ? dayjs(params.order_date_from) : undefined,
      order_date_to: params.order_date_to ? dayjs(params.order_date_to) : undefined,
      has_certificate: params.has_certificate,
      has_documents: params.has_documents,
    });
  }, [
    filterForm,
    params.country,
    params.factory_id,
    params.has_certificate,
    params.has_documents,
    params.order_date_from,
    params.order_date_to,
    params.query,
    params.status_names,
    params.trip_id,
    params.user_id,
  ]);

  const listQuery = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Order>>("/api/orders", {
        query: params,
      }),
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: OrderForm) =>
      apiRequest<Order>("/api/orders", {
        method: "POST",
        body: toOrderWritePayload(payload),
      }),
    onSuccess: async () => {
      message.success("Заказ создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания заказа");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<OrderForm> }) =>
      apiRequest<Order>(`/api/orders/${id}`, {
        method: "PATCH",
        body: toOrderWritePayload(payload as OrderWritePayload),
      }),
    onSuccess: async () => {
      message.success("Заказ обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (selected) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(selected.id) });
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления заказа");
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status_name, status_date }: { id: number; status_name: OrderStatus; status_date?: string }) =>
      apiRequest<Order>(`/api/orders/${id}/status`, {
        method: "POST",
        body: {
          status_name,
          status_date,
        },
      }),
    onSuccess: async () => {
      message.success("Статус обновлен");
      setStatusOpen(false);
      statusForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления статуса");
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, trip_id }: { id: number; trip_id?: number }) =>
      apiRequest<Order>(`/api/orders/${id}/assign-trip`, {
        method: "POST",
        body: { trip_id: trip_id ?? null },
      }),
    onSuccess: async () => {
      message.success("Рейс назначен");
      setAssignOpen(false);
      assignForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения рейса");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: OrderBulkEndpoint; body: Record<string, unknown> }) =>
      apiRequest<BulkMutationResponse<Order>>(`/api/orders/bulk/${endpoint}`, {
        method: "POST",
        body,
      }),
    onSuccess: async (payload) => {
      message.success(`Операция выполнена. Обновлено: ${payload.updated_count}`);
      setBulkStatusOpen(false);
      setBulkAssignOpen(false);
      setBulkCommentOpen(false);
      bulkStatusForm.resetFields();
      bulkAssignForm.resetFields();
      bulkCommentForm.resetFields();
      setSelectedRowKeys([]);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка массовой операции");
    },
  });

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/orders${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function openEdit(record: Order) {
    setSelected(record);
    editForm.setFieldsValue({
      order_number: record.order_number,
      comment: record.comment ?? undefined,
      status_name: record.status_name ?? undefined,
      trip_id: record.trip_id ?? undefined,
      user_id: record.user_id,
      factory_id: record.factory_id,
    });
    setEditOpen(true);
  }

  function openStatus(record: Order) {
    setSelected(record);
    statusForm.setFieldsValue({
      status_name: record.status_name ?? undefined,
      status_date: record.status_date ? dayjs(record.status_date) : undefined,
    });
    setStatusOpen(true);
  }

  function openAssign(record: Order) {
    setSelected(record);
    assignForm.setFieldsValue({ trip_id: record.trip_id ?? undefined });
    setAssignOpen(true);
  }

  function toggleRowSelection(id: number, checked: boolean) {
    setSelectedRowKeys((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((currentId) => currentId !== id);
    });
  }

  function runBulkMutation(endpoint: OrderBulkEndpoint, body: Record<string, unknown>) {
    bulkMutation.mutate({
      endpoint,
      body: {
        order_ids: selectedRowKeys,
        ...body,
      },
    });
  }

  function askBulkConfirm(title: string, content: string, onOk: () => void) {
    Modal.confirm({
      title,
      content,
      okText: "Подтвердить",
      cancelText: "Отмена",
      onOk,
    });
  }

  function orderActions(record: Order) {
    if (!canMutate) {
      return [];
    }

    return [
      {
        key: "edit",
        label: "Редактировать",
        icon: <EditOutlined />,
        onClick: () => openEdit(record),
      },
      {
        key: "status",
        label: "Изменить статус",
        icon: <SwapOutlined />,
        onClick: () => openStatus(record),
      },
      {
        key: "assign",
        label: "Назначить рейс",
        icon: <ApartmentOutlined />,
        onClick: () => openAssign(record),
      },
    ];
  }

  const columns: ColumnsType<Order> = [
    {
      title: "Id",
      dataIndex: "id",
      key: "id",
      sorter: true,
      sortOrder: sortOrderFor("id"),
      width: 84,
    },
    {
      title: "#",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      sortOrder: sortOrderFor("order_number"),
      width: 170,
      render: (value: string, record) => <Link href={`/orders/${record.id}`}>{value}</Link>,
    },
    {
      title: "Клиент",
      dataIndex: "user_id",
      key: "user_id",
      width: 120,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "Название фабрики",
      dataIndex: "factory_id",
      key: "factory_id",
      width: 170,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "Инвойс / проформа",
      dataIndex: "invoice_number",
      key: "invoice_number",
      width: 170,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Объем",
      key: "volume",
      width: 90,
      render: () => "-",
    },
    {
      title: "Объем из инв.",
      key: "invoice_volume",
      width: 120,
      render: () => "-",
    },
    {
      title: "Акт. объем",
      key: "actual_volume",
      width: 110,
      render: () => "-",
    },
    {
      title: "Объем на складе",
      key: "warehouse_volume",
      width: 130,
      render: () => "-",
    },
    {
      title: "Кол-во",
      key: "count",
      width: 90,
      render: () => "-",
    },
    {
      title: "Акт. кол-во",
      key: "actual_count",
      width: 110,
      render: () => "-",
    },
    {
      title: "Акт. вес",
      key: "actual_weight",
      width: 100,
      render: () => "-",
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (value: OrderStatus | null) => renderOrderStatus(value),
      width: 200,
    },
    {
      title: "Эксп.",
      dataIndex: "trip_id",
      key: "trip_id",
      width: 90,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "Дата заказа",
      dataIndex: "order_date",
      key: "order_date",
      sorter: true,
      sortOrder: sortOrderFor("order_date"),
      width: 130,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Дата готовности",
      dataIndex: "ready_date",
      key: "ready_date",
      sorter: true,
      sortOrder: sortOrderFor("ready_date"),
      width: 140,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      width: 140,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      fixed: "right",
      width: canMutate ? 178 : 92,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => router.push(`/orders/${record.id}`)}>
            Открыть
          </Button>
          {canMutate ? (
            <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          ) : null}
        </Space>
      ),
    },
  ];

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Order> | SorterResult<Order>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Order> | undefined)
      : (sorter as SorterResult<Order>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;
  const activeQuickStatus = params.status_names?.length === 1 ? params.status_names[0] : undefined;
  const statusCounts = useMemo(() => {
    return rows.reduce(
      (acc, order) => {
        if (order.status_name) {
          acc[order.status_name] = (acc[order.status_name] ?? 0) + 1;
        }
        return acc;
      },
      {} as Partial<Record<OrderStatus, number>>,
    );
  }, [rows]);

  function runBulkAction(action: () => void) {
    if (!selectedRowKeys.length) {
      message.warning("Сначала выберите заказы в таблице");
      return;
    }
    action();
  }

  function showUnavailableFeature(name: string) {
    message.info(`${name}: пока недоступно в текущем API-контракте`);
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтр"
        search={
          <Input.Search
            key={params.query ?? "orders-query"}
            allowClear
            enterButton="Найти"
            placeholder="search"
            defaultValue={params.query}
            onSearch={(value) => {
              applySearchPatch({
                query: value || null,
                page: 1,
              });
            }}
          />
        }
        actions={
          canMutate ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              + Новый заказ
            </Button>
          ) : null
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          onFinish={(values) => {
            applySearchPatch({
              query: values.query,
              country: values.country,
              status_names: values.status_names,
              user_id: values.user_id,
              factory_id: values.factory_id,
              trip_id: values.trip_id,
              order_date_from: values.order_date_from?.format("YYYY-MM-DD"),
              order_date_to: values.order_date_to?.format("YYYY-MM-DD"),
              has_certificate: values.has_certificate,
              has_documents: values.has_documents,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по номеру заказа" allowClear />
            </Form.Item>
            <Form.Item name="country" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Страна" allowClear />
            </Form.Item>
            <Form.Item name="status_names" className="crm-col-5" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статусы"
                options={ORDER_STATUS_VALUES.map((status) => ({
                  label: formatEnumCode(status),
                  value: status,
                }))}
              />
            </Form.Item>
            <Form.Item name="user_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Клиент ID" />
            </Form.Item>
            <Form.Item name="factory_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Фабрика ID" />
            </Form.Item>
            <Form.Item name="trip_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Рейс ID" />
            </Form.Item>
            <Form.Item name="order_date_from" className="crm-col-3" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан от" />
            </Form.Item>
            <Form.Item name="order_date_to" className="crm-col-3" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан до" />
            </Form.Item>
            <Form.Item name="has_certificate" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Сертификат"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="has_documents" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Документы"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
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
                router.replace("/orders");
                setFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </FilterPanel>

      <Card className="crm-panel crm-status-tabs-bar">
        <div className="crm-status-tabs-wrap">
          {quickStatusTabs.map((tab) => {
            const isActive = tab.status ? activeQuickStatus === tab.status : !activeQuickStatus;
            const count = tab.status ? statusCounts[tab.status] ?? 0 : totalRows;
            return (
              <Button
                key={tab.key}
                size="small"
                type={isActive ? "primary" : "default"}
                className={tab.tone === "danger" && !isActive ? "crm-status-btn-danger" : ""}
                onClick={() => {
                  applySearchPatch({
                    status_names: tab.status ? [tab.status] : null,
                    page: 1,
                  });
                }}
              >
                {tab.label}
                {tab.status ? ` (${count})` : ""}
              </Button>
            );
          })}
          <Button size="small" className="crm-status-btn-danger" onClick={() => showUnavailableFeature("Не подтверждены фабрикой")}>
            Не подтверждены фабрикой
          </Button>
          <Button size="small" className="crm-status-btn-danger" onClick={() => showUnavailableFeature("Оплата не получена")}>
            Оплата не получена
          </Button>
          <Button size="small" className="crm-status-btn-danger" onClick={() => showUnavailableFeature("Нет ответа от фабрики")}>
            Нет ответа от фабрики
          </Button>
        </div>
      </Card>

      {canMutate ? (
        <Card className="crm-panel crm-actions-strip-bar">
          <div className="crm-actions-strip">
            <Typography.Text type="secondary">Выбрано: {selectedRowKeys.length}</Typography.Text>
            <Button type="text" onClick={() => runBulkAction(() => setBulkStatusOpen(true))}>
              Изменить статус
            </Button>
            <Button type="text" onClick={() => runBulkAction(() => setBulkAssignOpen(true))}>
              Назначить рейс
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  setBulkCommentTarget("warehouse");
                  setBulkCommentOpen(true);
                })
              }
            >
              Комментарий склада
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  setBulkCommentTarget("forwarder");
                  setBulkCommentOpen(true);
                })
              }
            >
              Комментарий экспедитора
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  askBulkConfirm(
                    "Архивировать выбранные заказы",
                    "Заказы получат статус archived. Продолжить?",
                    () => runBulkMutation("archive", {}),
                  );
                })
              }
            >
              Архивировать
            </Button>
            <Button
              type="text"
              danger
              onClick={() =>
                runBulkAction(() => {
                  askBulkConfirm(
                    "Удалить выбранные заказы",
                    "Это soft-delete через статус deleted. Продолжить?",
                    () => runBulkMutation("delete", {}),
                  );
                })
              }
            >
              Удалить
            </Button>
            <Button type="text" onClick={() => setSelectedRowKeys([])}>
              Снять выделение
            </Button>
            <Button type="text" onClick={() => showUnavailableFeature("Спецтариф")}>
              Спецтариф
            </Button>
            <Button type="text" danger onClick={() => showUnavailableFeature("Удалить заказ из рейса")}>
              Удалить заказ из рейса
            </Button>
            <Button type="text" onClick={() => showUnavailableFeature("Назначить дату вывоза")}>
              Назначить дату вывоза
            </Button>
            <Button type="text" onClick={() => showUnavailableFeature("Отменить вывоз")}>
              Отменить вывоз
            </Button>
            <Button type="text" onClick={() => showUnavailableFeature("Отправить e-mail")}>
              Отправить e-mail
            </Button>
            <Button type="text" onClick={() => showUnavailableFeature("Экспорт в Excel")}>
              В Excel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки заказов"}
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
                      <Link href={`/orders/${record.id}`} className="crm-row-title">
                        {record.order_number}
                      </Link>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderOrderStatus(record.status_name)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Фабрика
                      <strong>{record.factory_id}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Рейс
                      <strong>{record.trip_id ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Страна
                      <strong>{record.country ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Готовность
                      <strong>{record.ready_date ?? "-"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    <Button size="small" type="primary" ghost onClick={() => router.push(`/orders/${record.id}`)}>
                      Открыть
                    </Button>
                    {canMutate ? (
                      <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
                        <Button size="small" icon={<MoreOutlined />}>
                          Действия
                        </Button>
                      </Dropdown>
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
          <Table<Order>
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
            scroll={{ x: 2280 }}
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

      <Modal
        title="Создать заказ"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<OrderForm> form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="order_number" label="Номер заказа" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="user_id" label="ID пользователя" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="factory_id" label="ID фабрики" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="trip_id" label="ID рейса">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status_name" label="Статус">
            <Select
              allowClear
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Редактировать заказ #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<Partial<OrderForm>>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <Form.Item name="order_number" label="Номер заказа">
            <Input />
          </Form.Item>
          <Form.Item name="status_name" label="Статус">
            <Select
              allowClear
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item name="trip_id" label="ID рейса">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить статус #${selected?.id ?? ""}`}
        open={statusOpen}
        destroyOnHidden
        onCancel={() => setStatusOpen(false)}
        onOk={() => statusForm.submit()}
        confirmLoading={changeStatusMutation.isPending}
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={(values: { status_name: OrderStatus; status_date?: dayjs.Dayjs }) => {
            if (!selected) return;
            changeStatusMutation.mutate({
              id: selected.id,
              status_name: values.status_name,
              status_date: values.status_date?.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}>
            <Select
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item name="status_date" label="Дата статуса">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Назначить рейс #${selected?.id ?? ""}`}
        open={assignOpen}
        destroyOnHidden
        onCancel={() => setAssignOpen(false)}
        onOk={() => assignForm.submit()}
        confirmLoading={assignMutation.isPending}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values: { trip_id?: number }) => {
            if (!selected) return;
            assignMutation.mutate({ id: selected.id, trip_id: values.trip_id });
          }}
        >
          <Form.Item name="trip_id" label="Рейс" tooltip="Оставьте пустым, чтобы снять рейс">
            <Select
              allowClear
              loading={tripsQuery.isLoading}
              options={(tripsQuery.data?.items ?? []).map((trip) => ({
                label: `${trip.id} - ${trip.name}`,
                value: trip.id,
              }))}
            />
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
          onFinish={(values: { status_name: OrderStatus; status_date?: dayjs.Dayjs }) => {
            runBulkMutation("status", {
              status_name: values.status_name,
              status_date: values.status_date?.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}>
            <Select
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item name="status_date" label="Дата статуса">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массовое назначение рейса"
        open={bulkAssignOpen}
        destroyOnHidden
        onCancel={() => setBulkAssignOpen(false)}
        onOk={() => bulkAssignForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkAssignForm}
          layout="vertical"
          onFinish={(values: { trip_id?: number }) => {
            runBulkMutation("assign-trip", { trip_id: values.trip_id ?? null });
          }}
        >
          <Form.Item name="trip_id" label="Рейс" tooltip="Оставьте пустым, чтобы снять рейсы у заказов">
            <Select
              allowClear
              loading={tripsQuery.isLoading}
              options={(tripsQuery.data?.items ?? []).map((trip) => ({
                label: `${trip.id} - ${trip.name}`,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={bulkCommentTarget === "warehouse" ? "Массовый комментарий склада" : "Массовый комментарий экспедитора"}
        open={bulkCommentOpen}
        destroyOnHidden
        onCancel={() => setBulkCommentOpen(false)}
        onOk={() => bulkCommentForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkCommentForm}
          layout="vertical"
          onFinish={(values: { comment: string }) => {
            runBulkMutation(
              bulkCommentTarget === "warehouse" ? "warehouse-comment" : "forwarder-comment",
              { comment: values.comment },
            );
          }}
        >
          <Form.Item name="comment" label="Комментарий" rules={[{ required: true }]}> 
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <OrdersPageContent />
    </Suspense>
  );
}
