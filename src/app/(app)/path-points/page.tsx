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
  Space,
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
import type { PaginatedResponse, PathPoint, PathPointFilterParams, PathPointWritePayload } from "@/shared/types/entities";

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

function getParams(searchParams: URLSearchParams): PathPointFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
  };
}

type PathPointForm = {
  name_ru: string;
  name_it?: string;
  name_en?: string;
};

function PathPointsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const canWrite = canWriteSettingsDictionaries(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<PathPoint | null>(null);
  const [createForm] = Form.useForm<PathPointForm>();
  const [editForm] = Form.useForm<PathPointForm>();
  const [filterForm] = Form.useForm<{ query?: string }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.pathPoints.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: params,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PathPointWritePayload) =>
      apiRequest<PathPoint>("/api/path-points", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Путевая точка создана");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["path-points"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PathPointWritePayload }) =>
      apiRequest<PathPoint>(`/api/path-points/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Путевая точка обновлена");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["path-points"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<null>(`/api/path-points/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Путевая точка удалена");
      await queryClient.invalidateQueries({ queryKey: ["path-points"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/path-points${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<PathPoint> | SorterResult<PathPoint>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<PathPoint> | undefined)
      : (sorter as SorterResult<PathPoint>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<PathPoint> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "Название (RU)",
      dataIndex: "name_ru",
      key: "name_ru",
      sorter: true,
      sortOrder: sortOrderFor("name_ru"),
    },
    { title: "Название (IT)", dataIndex: "name_it", key: "name_it", render: (value) => value ?? "-" },
    {
      title: "Название (EN)",
      dataIndex: "name_en",
      key: "name_en",
      sorter: true,
      sortOrder: sortOrderFor("name_en"),
      render: (value) => value ?? "-",
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
                  name_ru: record.name_ru,
                  name_it: record.name_it ?? undefined,
                  name_en: record.name_en ?? undefined,
                });
                setEditOpen(true);
              }}
            >
              Изменить
            </Button>
            <Popconfirm
              title="Удалить путевую точку?"
              okText="Да"
              cancelText="Нет"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
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
        title="Путевые точки"
        subtitle="Управление справочником path points"
        actions={
          canWrite ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новая точка
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
            key={params.query ?? "path-point-query"}
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
          initialValues={{ query: params.query }}
          onFinish={(values: { query?: string }) => {
            applySearchPatch({ query: values.query, page: 1 });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-6" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
          </div>
          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/path-points");
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

        <Table<PathPoint>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 920 }}
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
        title="Новая путевая точка"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<PathPointForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name_ru" label="Название (RU)" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="name_it" label="Название (IT)">
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название (EN)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить путевую точку #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<PathPointForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <Form.Item name="name_ru" label="Название (RU)" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="name_it" label="Название (IT)">
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название (EN)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function PathPointsPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <PathPointsPageContent />
    </Suspense>
  );
}
