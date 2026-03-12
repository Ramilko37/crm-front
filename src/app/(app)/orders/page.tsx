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

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseCsv, setSearchPatch } from "@/shared/lib/query-string";
import type { Order, OrderFilterParams, PaginatedResponse, Trip } from "@/shared/types/entities";

type OrderForm = {
  order_number: string;
  user_id: number;
  factory_id: number;
  company_id?: number;
  trip_id?: number;
  comment?: string;
  status_name?: string;
};

const statusOptions = [
  "new",
  "processing",
  "ready",
  "in_transit",
  "in_moscow",
  "archived",
  "in_review",
];

const statusLabels: Record<string, string> = {
  new: "Новый",
  processing: "В обработке",
  ready: "Готов",
  in_transit: "В пути",
  in_moscow: "В Москве",
  archived: "В архиве",
  in_review: "На проверке",
};

const statusTagColors: Record<string, string> = {
  new: "blue",
  processing: "gold",
  ready: "green",
  in_transit: "cyan",
  in_moscow: "geekblue",
  archived: "default",
  in_review: "purple",
};

function formatOrderStatus(value: string | null) {
  if (!value) return "-";
  return statusLabels[value] ?? value;
}

function renderOrderStatus(value: string | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={statusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatOrderStatus(value)}
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
    status_names: parseCsv(searchParams.get("status_names")),
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const [createForm] = Form.useForm<OrderForm>();
  const [editForm] = Form.useForm<Partial<OrderForm>>();
  const [statusForm] = Form.useForm<{ status_name: string; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();
  const [filterForm] = Form.useForm<{ query?: string; country?: string; status_names?: string[] }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      country: params.country,
      status_names: params.status_names?.length ? params.status_names : undefined,
    });
  }, [filterForm, params.country, params.query, params.status_names]);

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
        body: payload,
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
        body: payload,
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
    mutationFn: ({ id, status_name, status_date }: { id: number; status_name: string; status_date?: string }) =>
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

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function applySearchPatch(
    patch: Record<string, string | number | boolean | string[] | null | undefined>,
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
      company_id: record.company_id ?? undefined,
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

  function orderActions(record: Order) {
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
      title: "ID",
      dataIndex: "id",
      key: "id",
      sorter: true,
      sortOrder: sortOrderFor("id"),
      width: 90,
    },
    {
      title: "Заказ #",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      sortOrder: sortOrderFor("order_number"),
      width: 180,
      render: (value: string, record) => <Link href={`/orders/${record.id}`}>{value}</Link>,
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (value: string | null) => renderOrderStatus(value),
    },
    {
      title: "Фабрика",
      dataIndex: "factory_id",
      key: "factory_id",
      width: 120,
    },
    {
      title: "Рейс",
      dataIndex: "trip_id",
      key: "trip_id",
      width: 120,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      width: 120,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Готовность",
      dataIndex: "ready_date",
      key: "ready_date",
      sorter: true,
      sortOrder: sortOrderFor("ready_date"),
      width: 140,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      fixed: "right",
      width: 178,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => router.push(`/orders/${record.id}`)}>
            Открыть
          </Button>
          <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
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

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <Card className="crm-panel">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Typography.Title level={2} className="crm-page-title">
              Заказы
            </Typography.Title>
            <Typography.Paragraph className="crm-page-subtitle">
              Контроль статусов, рейсов и приоритетных операций по отправкам.
            </Typography.Paragraph>
          </div>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Создать заказ
          </Button>
        </Space>
      </Card>

      <Card className="crm-panel filters">
        <Form
          form={filterForm}
          onFinish={(values: { query?: string; country?: string; status_names?: string[] }) => {
            applySearchPatch({
              query: values.query,
              country: values.country,
              status_names: values.status_names,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по номеру или комментарию" allowClear />
            </Form.Item>
            <Form.Item name="country" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Страна" allowClear />
            </Form.Item>
            <Form.Item name="status_names" className="crm-col-5" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статусы"
                options={statusOptions.map((status) => ({
                  label: formatOrderStatus(status),
                  value: status,
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
                router.replace("/orders");
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </Card>

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
                    <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
                      <Button size="small" icon={<MoreOutlined />}>
                        Действия
                      </Button>
                    </Dropdown>
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
            scroll={{ x: 1160 }}
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
          <Form.Item name="company_id" label="ID компании">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="trip_id" label="ID рейса">
            <InputNumber min={1} style={{ width: "100%" }} />
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
              options={statusOptions.map((status) => ({
                label: formatOrderStatus(status),
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
          onFinish={(values: { status_name: string; status_date?: dayjs.Dayjs }) => {
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
              options={statusOptions.map((status) => ({
                label: formatOrderStatus(status),
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
