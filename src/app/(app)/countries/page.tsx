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
import type { Country, CountryFilterParams, CountryWritePayload, PaginatedResponse } from "@/shared/types/entities";

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

function getParams(searchParams: URLSearchParams): CountryFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    iso2: searchParams.get("iso2") ?? undefined,
    iso3: searchParams.get("iso3") ?? undefined,
  };
}

type CountryForm = {
  name_ru: string;
  name_en?: string;
  iso2: string;
  iso3?: string;
};

function CountriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const canWrite = canWriteSettingsDictionaries(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Country | null>(null);
  const [createForm] = Form.useForm<CountryForm>();
  const [editForm] = Form.useForm<CountryForm>();
  const [filterForm] = Form.useForm<{ query?: string; iso2?: string; iso3?: string }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const listQuery = useQuery({
    queryKey: queryKeys.countries.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Country>>("/api/countries", {
        query: params,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CountryWritePayload) =>
      apiRequest<Country>("/api/countries", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Страна создана");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CountryWritePayload }) =>
      apiRequest<Country>(`/api/countries/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Страна обновлена");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<null>(`/api/countries/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Страна удалена");
      await queryClient.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/countries${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Country> | SorterResult<Country>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Country> | undefined)
      : (sorter as SorterResult<Country>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<Country> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "Название (RU)",
      dataIndex: "name_ru",
      key: "name_ru",
      sorter: true,
      sortOrder: sortOrderFor("name_ru"),
    },
    { title: "Название (EN)", dataIndex: "name_en", key: "name_en", render: (value) => value ?? "-" },
    {
      title: "ISO2",
      dataIndex: "iso2",
      key: "iso2",
      width: 100,
      sorter: true,
      sortOrder: sortOrderFor("iso2"),
    },
    { title: "ISO3", dataIndex: "iso3", key: "iso3", width: 100, render: (value) => value ?? "-" },
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
                  name_en: record.name_en ?? undefined,
                  iso2: record.iso2,
                  iso3: record.iso3 ?? undefined,
                });
                setEditOpen(true);
              }}
            >
              Изменить
            </Button>
            <Popconfirm title="Удалить страну?" okText="Да" cancelText="Нет" onConfirm={() => deleteMutation.mutate(record.id)}>
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
        title="Страны"
        subtitle="Справочник стран"
        actions={
          canWrite ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Новая страна
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
            key={params.query ?? "countries-query"}
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
          initialValues={{ query: params.query, iso2: params.iso2, iso3: params.iso3 }}
          onFinish={(values: { query?: string; iso2?: string; iso3?: string }) => {
            applySearchPatch({ query: values.query, iso2: values.iso2, iso3: values.iso3, page: 1 });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
            <Form.Item name="iso2" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Input placeholder="ISO2" allowClear maxLength={2} />
            </Form.Item>
            <Form.Item name="iso3" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Input placeholder="ISO3" allowClear maxLength={3} />
            </Form.Item>
          </div>
          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/countries");
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

        <Table<Country>
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
        title="Новая страна"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<CountryForm> form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="name_ru" label="Название (RU)" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название (EN)">
            <Input />
          </Form.Item>
          <Form.Item name="iso2" label="ISO2" rules={[{ required: true }]}> 
            <Input maxLength={2} />
          </Form.Item>
          <Form.Item name="iso3" label="ISO3">
            <Input maxLength={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить страну #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<CountryForm>
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
          <Form.Item name="name_en" label="Название (EN)">
            <Input />
          </Form.Item>
          <Form.Item name="iso2" label="ISO2" rules={[{ required: true }]}> 
            <Input maxLength={2} />
          </Form.Item>
          <Form.Item name="iso3" label="ISO3">
            <Input maxLength={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function CountriesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <CountriesPageContent />
    </Suspense>
  );
}
