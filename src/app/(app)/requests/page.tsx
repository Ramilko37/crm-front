"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode, REQUEST_STATUS_VALUES, type RequestStatus } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { downloadFileWithCredentials, getFileOperationErrorMessage } from "@/shared/lib/file-operations";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  PaginatedResponse,
  Request,
  RequestCreatePayload,
  RequestDocument,
  RequestFilterParams,
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

function getParams(searchParams: URLSearchParams): RequestFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    status: (searchParams.get("status") as RequestStatus | null) ?? undefined,
    query: searchParams.get("query") ?? undefined,
  };
}

type RequestCreateForm = {
  company_id: number;
  company_contact_id?: number;
  comment?: string;
  payload_json?: string;
  document_type?: string;
  files?: FileList;
};

function RequestsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canWrite = meQuery.data?.is_superuser || normalizedRole === "administrator" || normalizedRole === "manager";

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [createForm] = Form.useForm<RequestCreateForm>();
  const [filterForm] = Form.useForm<{ status?: RequestStatus; query?: string }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.requests.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Request>>("/api/requests", {
        query: params,
      }),
  });

  const detailQuery = useQuery({
    queryKey: selectedRequestId ? queryKeys.requests.detail(selectedRequestId) : ["requests", "detail", "idle"],
    queryFn: () => apiRequest<Request>(`/api/requests/${selectedRequestId}`),
    enabled: detailsOpen && Boolean(selectedRequestId),
  });

  const documentsQuery = useQuery({
    queryKey: selectedRequestId ? queryKeys.requests.documents(selectedRequestId) : ["requests", "documents", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<RequestDocument>>(`/api/requests/${selectedRequestId}/documents`, {
        query: { page: 1, page_size: 100 },
      }),
    enabled: detailsOpen && Boolean(selectedRequestId) && !(detailQuery.data?.documents?.length ?? 0),
  });

  const createMutation = useMutation({
    mutationFn: (payload: RequestCreateForm) => {
      let parsedPayloadJson: Record<string, unknown> | undefined;
      if (payload.payload_json?.trim()) {
        parsedPayloadJson = JSON.parse(payload.payload_json) as Record<string, unknown>;
      }

      const files = payload.files ? Array.from(payload.files) : [];
      const requestPayload: RequestCreatePayload = {
        request: {
          company_id: payload.company_id,
          company_contact_id: payload.company_contact_id,
          comment: payload.comment,
          payload_json: parsedPayloadJson,
        },
      };

      if (files.length > 0) {
        requestPayload.documents = files.map((file, index) => ({
          document_type: payload.document_type?.trim() || "attachment",
          file_slot: `request_file_${index + 1}`,
          display_name: file.name,
        }));
      }

      const formData = new FormData();
      formData.set("payload", JSON.stringify(requestPayload));

      files.forEach((file, index) => {
        formData.append(`request_file_${index + 1}`, file);
      });

      return apiRequest<Request>("/api/requests", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      message.success("Заявка создана");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (error) => {
      if (error instanceof SyntaxError) {
        message.error("payload_json должен быть валидным JSON");
        return;
      }
      if (error instanceof ApiError && error.status === 503) {
        message.error(getFileOperationErrorMessage(error, "Ошибка создания заявки"));
        return;
      }
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания заявки");
    },
  });

  async function handleRequestDocumentDownload(requestId: number, row: RequestDocument) {
    const fallbackName = row.file_name || `request-${requestId}-document-${row.id}`;
    setDownloadingDocumentId(row.id);
    try {
      await downloadFileWithCredentials(`/api/requests/${requestId}/documents/${row.id}/download`, fallbackName);
    } catch (error) {
      message.error(getFileOperationErrorMessage(error, "Ошибка скачивания документа"));
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/requests${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Request> | SorterResult<Request>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Request> | undefined)
      : (sorter as SorterResult<Request>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<Request> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "Номер заявки",
      dataIndex: "request_number",
      key: "request_number",
      sorter: true,
      sortOrder: sortOrderFor("request_number"),
      width: 180,
    },
    {
      title: "Компания",
      key: "company",
      width: 210,
      render: (_, record) => record.company_name ?? `ID ${record.company_id}`,
    },
    {
      title: "Контакт",
      key: "contact",
      width: 200,
      render: (_, record) => record.user_full_name ?? record.company_contact_id ?? record.contact_user_id ?? "-",
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 160,
      render: (status: RequestStatus) => formatEnumCode(status),
    },
    {
      title: "Документы",
      key: "documents",
      width: 130,
      render: (_, record) => `${record.documents_count ?? 0}${record.has_documents ? " (есть)" : ""}`,
    },
    {
      title: "Комментарий",
      dataIndex: "comment",
      key: "comment",
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Создан",
      dataIndex: "created_at",
      key: "created_at",
      width: 200,
      render: (value: string) => value,
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedRequestId(record.id);
            setDetailsOpen(true);
          }}
        >
          Открыть
        </Button>
      ),
    },
  ];

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;
  const newCount = listQuery.data?.meta.new_count;
  const detailDocuments = detailQuery.data?.documents?.length ? detailQuery.data.documents : (documentsQuery.data?.items ?? []);

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Заявки"
        subtitle={`Runtime-модуль requests${typeof newCount === "number" ? ` · Новых: ${newCount}` : ""}`}
        actions={
          canWrite ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новая заявка
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
            key={params.query ?? "requests-query"}
            allowClear
            enterButton="Найти"
            defaultValue={params.query}
            placeholder="Поиск по номеру/компании/контакту"
            onSearch={(value) => applySearchPatch({ query: value || null, page: 1 })}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{ status: params.status, query: params.query }}
          onFinish={(values: { status?: RequestStatus; query?: string }) => {
            applySearchPatch({ status: values.status, query: values.query, page: 1 });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="status" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Статус"
                options={REQUEST_STATUS_VALUES.map((status) => ({ label: formatEnumCode(status), value: status }))}
              />
            </Form.Item>
            <Form.Item name="query" className="crm-col-5" style={{ marginBottom: 0 }}>
              <Input allowClear placeholder="Поиск" />
            </Form.Item>
          </div>
          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/requests");
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
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки заявок"}
          </Typography.Text>
        ) : null}

        <Table<Request>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 1360 }}
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
            onChange={(page, pageSize) => applySearchPatch({ page, page_size: pageSize })}
          />
        </div>
      </Card>

      <Modal
        title="Новая заявка"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<RequestCreateForm> form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="company_id" label="ID компании" rules={[{ required: true }]}> 
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="company_contact_id" label="ID контакта компании">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="payload_json" label="payload_json (JSON)">
            <Input.TextArea rows={5} placeholder='{"source":"frontend"}' />
          </Form.Item>
          <Form.Item name="document_type" label="Тип документов (опционально)">
            <Input placeholder="например: invoice" />
          </Form.Item>
          <Form.Item
            name="files"
            label="Файлы документов"
            valuePropName="fileList"
            getValueFromEvent={(event) => (event?.target?.files as FileList | undefined) || undefined}
          >
            <Input type="file" multiple />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`Заявка #${detailQuery.data?.request_number ?? selectedRequestId ?? ""}`}
        width={760}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedRequestId(null);
        }}
      >
        {detailQuery.error ? (
          <Typography.Text type="danger">
            {detailQuery.error instanceof ApiError ? detailQuery.error.detail : "Ошибка загрузки заявки"}
          </Typography.Text>
        ) : null}

        {detailQuery.data ? (
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="ID">{detailQuery.data.id}</Descriptions.Item>
            <Descriptions.Item label="Номер">{detailQuery.data.request_number}</Descriptions.Item>
            <Descriptions.Item label="Компания">{detailQuery.data.company_name ?? detailQuery.data.company_id}</Descriptions.Item>
            <Descriptions.Item label="Пользователь">{detailQuery.data.user_full_name ?? detailQuery.data.user_id ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailQuery.data.user_email ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Статус">{formatEnumCode(detailQuery.data.status)}</Descriptions.Item>
            <Descriptions.Item label="Комментарий">{detailQuery.data.comment ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="payload_json">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(detailQuery.data.payload_json ?? {}, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        <Typography.Title level={5}>Документы</Typography.Title>

        <Table<RequestDocument>
          rowKey="id"
          loading={documentsQuery.isLoading}
          dataSource={detailDocuments}
          pagination={false}
          columns={[
            { title: "ID", dataIndex: "id", key: "id", width: 90 },
            {
              title: "Тип",
              dataIndex: "document_type",
              key: "document_type",
              width: 220,
              render: (value: string | null) => value ?? "-",
            },
            {
              title: "Файл",
              key: "file_name",
              render: (_, row) => row.file_name ?? row.file_path ?? "-",
            },
            {
              title: "Действия",
              key: "actions",
              width: 130,
              render: (_, row) =>
                selectedRequestId ? (
                  <Button
                    size="small"
                    type="link"
                    loading={downloadingDocumentId === row.id}
                    onClick={() => {
                      void handleRequestDocumentDownload(selectedRequestId, row);
                    }}
                  >
                    Скачать
                  </Button>
                ) : null,
            },
          ]}
          locale={{ emptyText: "Нет документов" }}
        />
      </Drawer>
    </Space>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <RequestsPageContent />
    </Suspense>
  );
}
