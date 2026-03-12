"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseCsv, setSearchPatch } from "@/shared/lib/query-string";
import type { PaginatedResponse, Trip, TripFilterParams } from "@/shared/types/entities";

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
    status_names: parseCsv(searchParams.get("status_names")),
    type_names: parseCsv(searchParams.get("type_names")),
    truck_plate: searchParams.get("truck_plate") ?? undefined,
    current_point_id: parseNumber(searchParams.get("current_point_id")),
  };
}

type TripForm = {
  name: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: string;
  type_name?: string;
};

const tripStatusLabels: Record<string, string> = {
  planned: "Запланирован",
  in_transit: "В пути",
  ready: "Готов",
  archived: "В архиве",
};

const tripTypeLabels: Record<string, string> = {
  truck: "Грузовик",
  sea: "Море",
  direct: "Прямой",
};

function formatTripStatus(value: string | null) {
  if (!value) return "-";
  return tripStatusLabels[value] ?? value;
}

function formatTripType(value: string | null) {
  if (!value) return "-";
  return tripTypeLabels[value] ?? value;
}

export default function TripsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [createForm] = Form.useForm<TripForm>();
  const [editForm] = Form.useForm<TripForm>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.trips.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: params,
      }),
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

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TripForm }) =>
      apiRequest<Trip>(`/api/trips/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления рейса");
    },
  });

  const columns: ColumnsType<Trip> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, width: 90 },
    { title: "Название", dataIndex: "name", key: "name", sorter: true },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      render: (v) => formatTripStatus(v),
    },
    {
      title: "Тип",
      dataIndex: "type_name",
      key: "type_name",
      sorter: true,
      render: (v) => formatTripType(v),
    },
    {
      title: "Текущая точка",
      dataIndex: "current_point_name",
      key: "current_point_name",
      sorter: true,
      render: (v) => v ?? "-",
    },
    {
      title: "Номер тягача",
      dataIndex: "truck_plate",
      key: "truck_plate",
      sorter: true,
      render: (v) => v ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            setSelected(record);
            editForm.setFieldsValue({
              ...record,
              current_point_id: record.current_point_id ?? undefined,
              current_point_name: record.current_point_name ?? undefined,
              truck_plate: record.truck_plate ?? undefined,
              truck_company_name: record.truck_company_name ?? undefined,
              status_name: record.status_name ?? undefined,
              type_name: record.type_name ?? undefined,
            });
            setEditOpen(true);
          }}
        >
          Редактировать
        </Button>
      ),
    },
  ];

  function applySearchPatch(
    patch: Record<string, string | number | boolean | string[] | null | undefined>,
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

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Рейсы
        </Typography.Title>

        <Form
          layout="inline"
          initialValues={{
            query: params.query,
            status_names: params.status_names,
            type_names: params.type_names,
            truck_plate: params.truck_plate,
          }}
          onFinish={(values: {
            query?: string;
            status_names?: string[];
            type_names?: string[];
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
          <Form.Item name="query">
            <Input placeholder="Поиск" allowClear style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="truck_plate">
            <Input placeholder="Номер тягача" allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="status_names">
            <Select
              mode="multiple"
              allowClear
              placeholder="Статус"
              style={{ width: 220 }}
              options={["planned", "in_transit", "ready", "archived"].map((value) => ({
                label: formatTripStatus(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="type_names">
            <Select
              mode="multiple"
              allowClear
              placeholder="Тип"
              style={{ width: 220 }}
              options={["truck", "sea", "direct"].map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={() => router.replace("/trips")}>Сбросить</Button>
          </Form.Item>
          <Form.Item>
            <Button type="dashed" onClick={() => setCreateOpen(true)}>
              Создать рейс
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки рейсов"}
          </Typography.Text>
        ) : null}

        <Table<Trip>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={listQuery.data?.items ?? []}
          columns={columns}
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
        title="Создать рейс"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<TripForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
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
            <Input />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Редактировать рейс #${selected?.id ?? ""}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<TripForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
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
            <Input />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
