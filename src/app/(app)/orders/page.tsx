"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  DatePicker,
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
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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

function formatOrderStatus(value: string | null) {
  if (!value) return "-";
  return statusLabels[value] ?? value;
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

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const [createForm] = Form.useForm<OrderForm>();
  const [editForm] = Form.useForm<Partial<OrderForm>>();
  const [statusForm] = Form.useForm<{ status_name: string; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

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

  const columns: ColumnsType<Order> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      sorter: true,
      width: 90,
    },
    {
      title: "Заказ #",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      width: 180,
      render: (value: string, record) => <Link href={`/orders/${record.id}`}>{value}</Link>,
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      render: (value: string | null) => <Tag>{formatOrderStatus(value)}</Tag>,
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
      width: 140,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      fixed: "right",
      width: 280,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" onClick={() => openEdit(record)}>
            Редактировать
          </Button>
          <Button size="small" onClick={() => openStatus(record)}>
            Статус
          </Button>
          <Button size="small" onClick={() => openAssign(record)}>
            Назначить рейс
          </Button>
          <Button size="small" type="link">
            <Link href={`/orders/${record.id}`}>Открыть</Link>
          </Button>
        </Space>
      ),
    },
  ];

  function applySearchPatch(
    patch: Record<string, string | number | boolean | string[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/orders${nextSearch ? `?${nextSearch}` : ""}`);
  }

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

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Заказы
        </Typography.Title>

        <Form
          layout="inline"
          initialValues={{
            query: params.query,
            country: params.country,
            status_names: params.status_names,
          }}
          onFinish={(values: { query?: string; country?: string; status_names?: string[] }) => {
            applySearchPatch({
              query: values.query,
              country: values.country,
              status_names: values.status_names,
              page: 1,
            });
          }}
        >
          <Form.Item name="query">
            <Input placeholder="Поиск" allowClear style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="country">
            <Input placeholder="Страна" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="status_names">
            <Select
              mode="multiple"
              allowClear
              placeholder="Статус"
              style={{ width: 260 }}
              options={statusOptions.map((status) => ({
                label: formatOrderStatus(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              onClick={() => {
                router.replace("/orders");
              }}
            >
              Сбросить
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="dashed" onClick={() => setCreateOpen(true)}>
              Создать заказ
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError
              ? listQuery.error.detail
              : "Ошибка загрузки заказов"}
          </Typography.Text>
        ) : null}

        <Table<Order>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={listQuery.data?.items ?? []}
          columns={columns}
          scroll={{ x: 1280 }}
          pagination={{
            current: listQuery.data?.meta.page ?? params.page ?? 1,
            pageSize: listQuery.data?.meta.page_size ?? params.page_size ?? 50,
            total: listQuery.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
          }}
          onChange={handleTableChange}
          locale={{ emptyText: "Нет данных" }}
        />
      </Card>

      <Modal
        title="Создать заказ"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<OrderForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
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
                label: `${trip.id} — ${trip.name}`,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
