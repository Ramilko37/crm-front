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
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseCsv, setSearchPatch } from "@/shared/lib/query-string";
import type { Factory, FactoryFilterParams, PaginatedResponse } from "@/shared/types/entities";

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

function getParams(searchParams: URLSearchParams): FactoryFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    certificate_statuses: parseCsv(searchParams.get("certificate_statuses")),
  };
}

type FactoryForm = {
  name: string;
  country_id?: number;
  country?: string;
  city?: string;
  address?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  certificate_status?: string;
};

const certificateStatusLabels: Record<string, string> = {
  active: "Активен",
  pending: "В ожидании",
  expired: "Истек",
};

function formatCertificateStatus(value: string | null) {
  if (!value) return "-";
  return certificateStatusLabels[value] ?? value;
}

function FactoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Factory | null>(null);
  const [createForm] = Form.useForm<FactoryForm>();
  const [editForm] = Form.useForm<FactoryForm>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.factories.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: params,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: FactoryForm) =>
      apiRequest<Factory>("/api/factories", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Фабрика создана");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания фабрики");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FactoryForm }) =>
      apiRequest<Factory>(`/api/factories/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Фабрика обновлена");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления фабрики");
    },
  });

  const columns: ColumnsType<Factory> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, width: 90 },
    { title: "Название", dataIndex: "name", key: "name", sorter: true },
    { title: "Страна", dataIndex: "country", key: "country", sorter: true, render: (v) => v ?? "-" },
    { title: "Город", dataIndex: "city", key: "city", sorter: true, render: (v) => v ?? "-" },
    { title: "Эл. почта", dataIndex: "email", key: "email", render: (v) => v ?? "-" },
    {
      title: "Сертификат",
      dataIndex: "certificate_status",
      key: "certificate_status",
      sorter: true,
      render: (v) => formatCertificateStatus(v),
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
              country_id: record.country_id ?? undefined,
              country: record.country ?? undefined,
              city: record.city ?? undefined,
              address: record.address ?? undefined,
              postcode: record.postcode ?? undefined,
              phone: record.phone ?? undefined,
              email: record.email ?? undefined,
              certificate_status: record.certificate_status ?? undefined,
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
    router.replace(`/factories${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Factory> | SorterResult<Factory>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Factory> | undefined)
      : (sorter as SorterResult<Factory>);

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
          Фабрики
        </Typography.Title>

        <Form
          layout="inline"
          initialValues={{
            query: params.query,
            country: params.country,
            city: params.city,
            certificate_statuses: params.certificate_statuses,
          }}
          onFinish={(values: {
            query?: string;
            country?: string;
            city?: string;
            certificate_statuses?: string[];
          }) => {
            applySearchPatch({
              query: values.query,
              country: values.country,
              city: values.city,
              certificate_statuses: values.certificate_statuses,
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
          <Form.Item name="city">
            <Input placeholder="Город" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="certificate_statuses">
            <Select
              mode="multiple"
              allowClear
              placeholder="Статус сертификата"
              style={{ width: 260 }}
              options={["active", "pending", "expired"].map((value) => ({
                label: formatCertificateStatus(value),
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
            <Button onClick={() => router.replace("/factories")}>Сбросить</Button>
          </Form.Item>
          <Form.Item>
            <Button type="dashed" onClick={() => setCreateOpen(true)}>
              Создать фабрику
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError
              ? listQuery.error.detail
              : "Ошибка загрузки фабрик"}
          </Typography.Text>
        ) : null}

        <Table<Factory>
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
        title="Создать фабрику"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<FactoryForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="ID страны">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Эл. почта">
            <Input />
          </Form.Item>
          <Form.Item name="certificate_status" label="Статус сертификата">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Редактировать фабрику #${selected?.id ?? ""}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<FactoryForm>
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
          <Form.Item name="country_id" label="ID страны">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Эл. почта">
            <Input />
          </Form.Item>
          <Form.Item name="certificate_status" label="Статус сертификата">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function FactoriesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <FactoriesPageContent />
    </Suspense>
  );
}
