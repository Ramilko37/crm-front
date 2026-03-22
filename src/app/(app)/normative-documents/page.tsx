"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
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
  NormativeDocument,
  NormativeDocumentFilterParams,
  NormativeDocumentWritePayload,
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

function getParams(searchParams: URLSearchParams): NormativeDocumentFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    document_date_from: searchParams.get("document_date_from") ?? undefined,
    document_date_to: searchParams.get("document_date_to") ?? undefined,
  };
}

type NormativeDocForm = {
  title: string;
  file_path: string;
  document_date: dayjs.Dayjs;
};

function NormativeDocumentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const canWrite = canWriteSettingsDictionaries(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<NormativeDocument | null>(null);
  const [createForm] = Form.useForm<NormativeDocForm>();
  const [editForm] = Form.useForm<NormativeDocForm>();
  const [filterForm] = Form.useForm<{ query?: string; document_date_from?: dayjs.Dayjs; document_date_to?: dayjs.Dayjs }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.normativeDocuments.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<NormativeDocument>>("/api/normative-documents", {
        query: params,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: NormativeDocumentWritePayload) =>
      apiRequest<NormativeDocument>("/api/normative-documents", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Документ создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["normative-documents"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NormativeDocumentWritePayload }) =>
      apiRequest<NormativeDocument>(`/api/normative-documents/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Документ обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["normative-documents"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<null>(`/api/normative-documents/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Документ удален");
      await queryClient.invalidateQueries({ queryKey: ["normative-documents"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/normative-documents${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<NormativeDocument> | SorterResult<NormativeDocument>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<NormativeDocument> | undefined)
      : (sorter as SorterResult<NormativeDocument>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<NormativeDocument> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "Заголовок",
      dataIndex: "title",
      key: "title",
      sorter: true,
      sortOrder: sortOrderFor("title"),
    },
    { title: "Файл", dataIndex: "file_path", key: "file_path", render: (value) => value || "-" },
    {
      title: "Дата документа",
      dataIndex: "document_date",
      key: "document_date",
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor("document_date"),
      render: (value) => value || "-",
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
                  file_path: record.file_path,
                  document_date: dayjs(record.document_date),
                });
                setEditOpen(true);
              }}
            >
              Изменить
            </Button>
            <Popconfirm title="Удалить документ?" okText="Да" cancelText="Нет" onConfirm={() => deleteMutation.mutate(record.id)}>
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
        title="Нормативные документы"
        subtitle="Справочник нормативной документации"
        actions={
          canWrite ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новый документ
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
            key={params.query ?? "normative-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по заголовку"
            defaultValue={params.query}
            onSearch={(value) => applySearchPatch({ query: value || null, page: 1 })}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{
            query: params.query,
            document_date_from: params.document_date_from ? dayjs(params.document_date_from) : undefined,
            document_date_to: params.document_date_to ? dayjs(params.document_date_to) : undefined,
          }}
          onFinish={(values: { query?: string; document_date_from?: dayjs.Dayjs; document_date_to?: dayjs.Dayjs }) => {
            applySearchPatch({
              query: values.query,
              document_date_from: values.document_date_from?.format("YYYY-MM-DD"),
              document_date_to: values.document_date_to?.format("YYYY-MM-DD"),
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
            <Form.Item name="document_date_from" className="crm-col-2" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Дата от" />
            </Form.Item>
            <Form.Item name="document_date_to" className="crm-col-2" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Дата до" />
            </Form.Item>
          </div>
          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/normative-documents");
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

        <Table<NormativeDocument>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 980 }}
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
        title="Новый нормативный документ"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<NormativeDocForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) =>
            createMutation.mutate({
              title: values.title,
              file_path: values.file_path,
              document_date: values.document_date.format("YYYY-MM-DD"),
            })
          }
        >
          <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="file_path" label="Путь к файлу" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="document_date" label="Дата документа" rules={[{ required: true }]}> 
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить документ #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<NormativeDocForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({
              id: selected.id,
              payload: {
                title: values.title,
                file_path: values.file_path,
                document_date: values.document_date.format("YYYY-MM-DD"),
              },
            });
          }}
        >
          <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="file_path" label="Путь к файлу" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="document_date" label="Дата документа" rules={[{ required: true }]}> 
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function NormativeDocumentsPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <NormativeDocumentsPageContent />
    </Suspense>
  );
}
