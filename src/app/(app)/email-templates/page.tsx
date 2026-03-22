"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { canWriteSettingsDictionaries } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  EmailTemplate,
  EmailTemplateFilterParams,
  EmailTemplateWritePayload,
  PaginatedResponse,
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

function getParams(searchParams: URLSearchParams): EmailTemplateFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    is_active: parseBool(searchParams.get("is_active")),
  };
}

type EmailTemplateForm = {
  title: string;
  subject: string;
  body?: string;
  is_active: boolean;
};

function EmailTemplatesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const canWrite = canWriteSettingsDictionaries(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [createForm] = Form.useForm<EmailTemplateForm>();
  const [editForm] = Form.useForm<EmailTemplateForm>();
  const [filterForm] = Form.useForm<{ query?: string; is_active?: boolean }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.emailTemplates.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<EmailTemplate>>("/api/email-templates", {
        query: params,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: EmailTemplateWritePayload) =>
      apiRequest<EmailTemplate>("/api/email-templates", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Шаблон создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EmailTemplateWritePayload }) =>
      apiRequest<EmailTemplate>(`/api/email-templates/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Шаблон обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<null>(`/api/email-templates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Шаблон удален");
      await queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/email-templates${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<EmailTemplate> | SorterResult<EmailTemplate>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<EmailTemplate> | undefined)
      : (sorter as SorterResult<EmailTemplate>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<EmailTemplate> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    { title: "Название", dataIndex: "title", key: "title", sorter: true, sortOrder: sortOrderFor("title") },
    { title: "Тема", dataIndex: "subject", key: "subject" },
    {
      title: "Тело",
      dataIndex: "body",
      key: "body",
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Активен",
      dataIndex: "is_active",
      key: "is_active",
      width: 110,
      render: (value: boolean) => (value ? "Да" : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 210,
      render: (_, record) =>
        canWrite ? (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setSelected(record);
                editForm.setFieldsValue({
                  title: record.title,
                  subject: record.subject,
                  body: record.body ?? undefined,
                  is_active: record.is_active,
                });
                setEditOpen(true);
              }}
            >
              Изменить
            </Button>
            <Popconfirm title="Удалить шаблон?" okText="Да" cancelText="Нет" onConfirm={() => deleteMutation.mutate(record.id)}>
              <Button size="small" danger>
                Удалить
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Email шаблоны"
        subtitle="Управление шаблонами уведомлений"
        actions={
          canWrite ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новый шаблон
            </Button>
          ) : null
        }
      />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтр"
        search={
          <Input.Search
            key={params.query ?? "email-templates-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию"
            defaultValue={params.query}
            onSearch={(value) => applySearchPatch({ query: value || null, page: 1 })}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{ query: params.query, is_active: params.is_active }}
          onFinish={(values: { query?: string; is_active?: boolean }) => {
            applySearchPatch({ query: values.query, is_active: values.is_active, page: 1 });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
            <Form.Item name="is_active" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Активность"
                options={[
                  { label: "Активные", value: true },
                  { label: "Неактивные", value: false },
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
                router.replace("/email-templates");
                setFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </FilterPanel>

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки"}
          </Typography.Text>
        ) : null}

        <Table<EmailTemplate>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1080 }}
          pagination={false}
          onChange={handleTableChange}
          locale={{ emptyText: "Нет данных" }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={currentPageSize}
            total={totalRows}
            showSizeChanger
            pageSizeOptions={[20, 50, 100, 200]}
            onChange={(page, pageSize) => {
              applySearchPatch({ page, page_size: pageSize });
            }}
          />
        </div>
      </Card>

      <Modal
        title="Новый email шаблон"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<EmailTemplateForm>
          form={createForm}
          layout="vertical"
          initialValues={{ is_active: true }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="subject" label="Тема" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Тело">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить шаблон #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<EmailTemplateForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="subject" label="Тема" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Тело">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function EmailTemplatesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <EmailTemplatesPageContent />
    </Suspense>
  );
}
