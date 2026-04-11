"use client";

import { useQuery } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Pagination,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode, type OrderStatus } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { downloadFileWithCredentials, getFileOperationErrorMessage } from "@/shared/lib/file-operations";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type { OrderDetail, OrderDocument, OrderListItem, PaginatedResponse } from "@/shared/types/entities";

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

type RequestTabParams = {
  page: number;
  page_size: number;
  sort_by?: string;
  sort_desc: boolean;
  query?: string;
};

function getParams(searchParams: URLSearchParams): RequestTabParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
  };
}

function renderOrderNumber(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

function RequestsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { message } = App.useApp();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [filterForm] = Form.useForm<{ query?: string }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.orders.list({ ...params, order_types: ["request"] }),
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderListItem>>("/api/orders", {
        query: {
          ...params,
          order_types: ["request"],
        },
      }),
  });

  const detailQuery = useQuery({
    queryKey: selectedOrderId ? queryKeys.orders.detail(selectedOrderId) : ["orders", "detail", "idle-request-tab"],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${selectedOrderId}`),
    enabled: detailsOpen && Boolean(selectedOrderId),
  });

  const documentsFallbackQuery = useQuery({
    queryKey: selectedOrderId
      ? queryKeys.orders.documents(selectedOrderId)
      : ["orders", "documents", "idle-request-tab"],
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderDocument>>(`/api/orders/${selectedOrderId}/documents`, {
        query: { page: 1, page_size: 100 },
      }),
    enabled: detailsOpen && Boolean(selectedOrderId) && !(detailQuery.data?.documents?.length ?? 0),
  });

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
    sorter: SorterResult<OrderListItem> | SorterResult<OrderListItem>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<OrderListItem> | undefined)
      : (sorter as SorterResult<OrderListItem>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  async function handleOrderDocumentDownload(orderId: number, row: OrderDocument) {
    const fallbackName = row.file_name || `order-${orderId}-document-${row.id}`;
    setDownloadingDocumentId(row.id);
    try {
      await downloadFileWithCredentials(`/api/orders/${orderId}/documents/${row.id}/download`, fallbackName);
    } catch (error) {
      message.error(getFileOperationErrorMessage(error, "Ошибка скачивания документа"));
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  const columns: ColumnsType<OrderListItem> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "Номер",
      dataIndex: "order_number",
      key: "order_number",
      width: 170,
      sorter: true,
      sortOrder: sortOrderFor("order_number"),
      render: (value: string | null | undefined) => renderOrderNumber(value),
    },
    {
      title: "Компания",
      key: "company",
      width: 220,
      render: (_, row) => row.company_name || (row.company_id ? `ID ${row.company_id}` : "—"),
    },
    {
      title: "Контакт",
      key: "contact",
      width: 220,
      render: (_, row) => row.contact_name_snapshot || row.contact_phone_snapshot || row.contact_email_snapshot || "—",
    },
    {
      title: "Фабрика",
      dataIndex: "factory_name",
      key: "factory_name",
      width: 220,
      render: (value: string | null | undefined) => value || "—",
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      width: 190,
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (status: OrderStatus | null) => formatEnumCode(status),
    },
    {
      title: "Дата заказа",
      dataIndex: "order_date",
      key: "order_date",
      width: 140,
      sorter: true,
      sortOrder: sortOrderFor("order_date"),
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Готовность",
      dataIndex: "ready_date",
      key: "ready_date",
      width: 140,
      sorter: true,
      sortOrder: sortOrderFor("ready_date"),
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Документы",
      key: "documents",
      width: 130,
      render: (_, row) => `${row.documents_count ?? 0}${row.has_documents ? " (есть)" : ""}`,
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedOrderId(row.id);
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
  const detailDocuments = detailQuery.data?.documents?.length
    ? detailQuery.data.documents
    : (documentsFallbackQuery.data?.items ?? []);

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader title="Заявки" subtitle="Вкладка построена только на orders API (order_type=request)." />

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
          initialValues={{ query: params.query }}
          onFinish={(values: { query?: string }) => {
            applySearchPatch({ query: values.query, page: 1 });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-6" style={{ marginBottom: 0 }}>
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

        <Table<OrderListItem>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 1520 }}
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

      <Drawer
        title={`Заявка #${renderOrderNumber(detailQuery.data?.order_number)}`}
        width={760}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedOrderId(null);
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
            <Descriptions.Item label="Номер">{renderOrderNumber(detailQuery.data.order_number)}</Descriptions.Item>
            <Descriptions.Item label="Компания">
              {detailQuery.data.client?.company_name || detailQuery.data.company_name || detailQuery.data.company_id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Контакт">
              {detailQuery.data.client?.contact_name || detailQuery.data.contact_name_snapshot || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">{formatEnumCode(detailQuery.data.status_name)}</Descriptions.Item>
            <Descriptions.Item label="Комментарий">{detailQuery.data.comment ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="raw_payload">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(detailQuery.data.raw_payload ?? {}, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        <Typography.Title level={5}>Документы</Typography.Title>

        <Table<OrderDocument>
          rowKey="id"
          loading={documentsFallbackQuery.isLoading}
          dataSource={detailDocuments}
          pagination={false}
          columns={[
            { title: "ID", dataIndex: "id", key: "id", width: 90 },
            {
              title: "Тип",
              dataIndex: "document_type",
              key: "document_type",
              width: 220,
              render: (value: string | null) => value ?? "—",
            },
            {
              title: "Файл",
              key: "file_name",
              render: (_, row) => row.file_name ?? row.display_name ?? row.file_path ?? "—",
            },
            {
              title: "Действия",
              key: "actions",
              width: 130,
              render: (_, row) =>
                selectedOrderId ? (
                  <Button
                    size="small"
                    type="link"
                    loading={downloadingDocumentId === row.id}
                    onClick={() => {
                      void handleOrderDocumentDownload(selectedOrderId, row);
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
