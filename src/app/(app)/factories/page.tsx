"use client";

import { EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

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

const certificateTagColors: Record<string, string> = {
  active: "green",
  pending: "gold",
  expired: "red",
};

function formatCertificateStatus(value: string | null) {
  if (!value) return "-";
  return certificateStatusLabels[value] ?? value;
}

function renderCertificateStatus(value: string | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={certificateTagColors[value] ?? "default"} className="crm-status-tag">
      {formatCertificateStatus(value)}
    </Tag>
  );
}

function FactoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Factory | null>(null);
  const [createForm] = Form.useForm<FactoryForm>();
  const [editForm] = Form.useForm<FactoryForm>();
  const [filterForm] = Form.useForm<{
    query?: string;
    country?: string;
    city?: string;
    certificate_statuses?: string[];
  }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      country: params.country,
      city: params.city,
      certificate_statuses: params.certificate_statuses?.length
        ? params.certificate_statuses
        : undefined,
    });
  }, [filterForm, params.certificate_statuses, params.city, params.country, params.query]);

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

  function openEdit(record: Factory) {
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
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  const columns: ColumnsType<Factory> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, sortOrder: sortOrderFor("id"), width: 90 },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      sorter: true,
      sortOrder: sortOrderFor("name"),
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      sorter: true,
      sortOrder: sortOrderFor("country"),
      render: (v) => v ?? "-",
    },
    {
      title: "Город",
      dataIndex: "city",
      key: "city",
      sorter: true,
      sortOrder: sortOrderFor("city"),
      render: (v) => v ?? "-",
    },
    { title: "Эл. почта", dataIndex: "email", key: "email", render: (v) => v ?? "-" },
    {
      title: "Сертификат",
      dataIndex: "certificate_status",
      key: "certificate_status",
      sorter: true,
      sortOrder: sortOrderFor("certificate_status"),
      render: (v) => renderCertificateStatus(v),
    },
    {
      title: "Действия",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
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
              Фабрики
            </Typography.Title>
            <Typography.Paragraph className="crm-page-subtitle">
              Каталог фабрик, сертификаты и контактные данные для логистических операций.
            </Typography.Paragraph>
          </div>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Создать фабрику
          </Button>
        </Space>
      </Card>

      <Card className="crm-panel filters">
        <Form
          form={filterForm}
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
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по названию или email" allowClear />
            </Form.Item>
            <Form.Item name="country" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Страна" allowClear />
            </Form.Item>
            <Form.Item name="city" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Город" allowClear />
            </Form.Item>
            <Form.Item name="certificate_statuses" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Сертификат"
                options={["active", "pending", "expired"].map((value) => ({
                  label: formatCertificateStatus(value),
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
                router.replace("/factories");
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
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки фабрик"}
          </Typography.Text>
        ) : null}

        {isMobile ? (
          <>
            <div className="crm-mobile-list">
              {rows.map((record) => (
                <article key={record.id} className="crm-row-card">
                  <div className="crm-row-card-head">
                    <div>
                      <div className="crm-row-title">{record.name}</div>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderCertificateStatus(record.certificate_status)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Страна
                      <strong>{record.country ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Город
                      <strong>{record.city ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item" style={{ gridColumn: "1 / -1" }}>
                      Email
                      <strong>{record.email ?? "-"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                      Редактировать
                    </Button>
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
          <Table<Factory>
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            scroll={{ x: 1020 }}
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
        title="Создать фабрику"
        open={createOpen}
        destroyOnHidden
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
        destroyOnHidden
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
