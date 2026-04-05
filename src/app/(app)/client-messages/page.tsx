"use client";

import { useQuery } from "@tanstack/react-query";
import { Button, Card, Form, Input, InputNumber, Pagination, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type { ClientMessageInboxItem, PaginatedResponse } from "@/shared/types/entities";

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getParams(searchParams: URLSearchParams) {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    query: searchParams.get("query") ?? undefined,
    company_id: parseNumber(searchParams.get("company_id")),
    order_id: parseNumber(searchParams.get("order_id")),
  };
}

function renderOrderNumber(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

function ClientMessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filterForm] = Form.useForm<{
    query?: string;
    company_id?: number;
    order_id?: number;
  }>();

  const listQuery = useQuery({
    queryKey: queryKeys.orders.clientMessages(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<ClientMessageInboxItem>>("/api/orders/client-messages", {
        query: params,
      }),
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/client-messages${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size;
  const totalRows = listQuery.data?.meta.total ?? 0;

  const columns: ColumnsType<ClientMessageInboxItem> = [
    {
      title: "Заказ",
      key: "order",
      width: 180,
      render: (_, row) => <Link href={`/orders/${row.order_id}`}>{renderOrderNumber(row.order_number)}</Link>,
    },
    {
      title: "Компания",
      key: "company",
      width: 220,
      render: (_, row) => row.company_name || (row.company_id ? `ID ${row.company_id}` : "-"),
    },
    {
      title: "Фабрика",
      dataIndex: "factory_name",
      key: "factory_name",
      width: 220,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      width: 190,
      render: (value) => (value ? formatEnumCode(value) : "-"),
    },
    {
      title: "Сообщений клиента",
      dataIndex: "client_messages_count",
      key: "client_messages_count",
      width: 150,
    },
    {
      title: "Последнее сообщение",
      dataIndex: "latest_message_text",
      key: "latest_message_text",
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Последнее от клиента",
      dataIndex: "latest_client_message_at",
      key: "latest_client_message_at",
      width: 210,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      width: 130,
      render: (_, row) => (
        <Button size="small" type="link" onClick={() => router.push(`/orders/${row.order_id}`)}>
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Сообщения от клиентов"
        subtitle="Inbox заказов, где есть client-authored сообщения"
      />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтр"
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{
            query: params.query,
            company_id: params.company_id,
            order_id: params.order_id,
          }}
          onFinish={(values) => {
            applySearchPatch({
              query: values.query,
              company_id: values.company_id,
              order_id: values.order_id,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-6" style={{ marginBottom: 0 }}>
              <Input allowClear placeholder="Поиск по номеру заказа/сообщению" />
            </Form.Item>
            <Form.Item name="company_id" className="crm-col-3" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="ID компании" />
            </Form.Item>
            <Form.Item name="order_id" className="crm-col-3" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="ID заказа" />
            </Form.Item>
          </div>

          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/client-messages");
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
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки inbox"}
          </Typography.Text>
        ) : null}

        <Table<ClientMessageInboxItem>
          rowKey={(row) => `${row.order_id}`}
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "Нет сообщений" }}
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
    </Space>
  );
}

export default function ClientMessagesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <ClientMessagesPageContent />
    </Suspense>
  );
}
