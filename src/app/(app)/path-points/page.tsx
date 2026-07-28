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
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { useCountryDirectory } from "@/shared/hooks/use-country-directory";
import { apiRequest } from "@/shared/lib/api";
import {
  findCountry,
  getCountryEnglishName,
} from "@/shared/lib/countries";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { canWriteSettingsDictionaries } from "@/shared/lib/rbac";
import { CountrySelect } from "@/shared/ui/country-select";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type { Company, PaginatedResponse, PathPoint, PathPointFilterParams, PathPointWritePayload } from "@/shared/types/entities";

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
    type: searchParams.get("type") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    company_id: parseNumber(searchParams.get("company_id")),
    status: searchParams.get("status") ?? undefined,
    has_active_trips: parseBool(searchParams.get("has_active_trips")),
    created_at_from: searchParams.get("created_at_from") ?? undefined,
    created_at_to: searchParams.get("created_at_to") ?? undefined,
  };
}

type PathPointForm = {
  name_ru: string;
  name_it?: string;
  name_en?: string;
};

type PathPointFilterForm = {
  query?: string;
  type?: string;
  country?: number;
  city?: string;
  company_id?: number;
  status?: string;
  has_active_trips?: boolean;
  created_at_from?: dayjs.Dayjs;
  created_at_to?: dayjs.Dayjs;
};

const PATH_POINT_TYPE_OPTIONS = [
  "Factory",
  "Forwarder warehouse",
  "Consolidation warehouse",
  "Customs warehouse",
  "Terminal",
  "Loading point",
  "Unloading point",
  "Border crossing",
  "Customs office",
  "Transit point",
  "Other",
].map((value) => ({ label: value, value }));

const PATH_POINT_STATUS_OPTIONS = [
  { label: "Активна", value: "active" },
  { label: "Неактивна", value: "inactive" },
];

function parseFilterPanelQueryState(value: string | null) {
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

function PathPointsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const canWrite = canWriteSettingsDictionaries(meQuery.data?.role_name, meQuery.data?.is_superuser);
  const countryDirectory = useCountryDirectory();
  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const filtersOpenFromQuery = parseFilterPanelQueryState(searchParams.get("filters_open"));
  const hasActiveFilters = Boolean(
    params.query ||
      params.type ||
      params.country ||
      params.city ||
      params.company_id ||
      params.status ||
      typeof params.has_active_trips === "boolean" ||
      params.created_at_from ||
      params.created_at_to,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpenFallback, setFiltersOpenFallback] = useState(false);
  const [companyQueryText, setCompanyQueryText] = useState("");
  const [selected, setSelected] = useState<PathPoint | null>(null);
  const [createForm] = Form.useForm<PathPointForm>();
  const [editForm] = Form.useForm<PathPointForm>();
  const [filterForm] = Form.useForm<PathPointFilterForm>();
  const filtersOpen = filtersOpenFromQuery ?? (filtersOpenFallback || hasActiveFilters);

  const listQuery = useQuery({
    queryKey: queryKeys.pathPoints.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: params,
      }),
  });

  const companiesQuery = useQuery({
    queryKey: ["path-points", "filter-companies", companyQueryText],
    queryFn: () =>
      apiRequest<PaginatedResponse<Company>>("/api/companies", {
        query: {
          page: 1,
          page_size: 20,
          query: companyQueryText || undefined,
        },
      }),
    enabled: filtersOpen,
  });

  const companyOptions = useMemo(
    () =>
      (companiesQuery.data?.items ?? []).map((company) => ({
        label: [company.name, company.country, company.city].filter(Boolean).join(" · "),
        value: company.id,
      })),
    [companiesQuery.data?.items],
  );

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      type: params.type,
      country: findCountry(countryDirectory.countries, params.country)?.id,
      city: params.city,
      company_id: params.company_id,
      status: params.status,
      has_active_trips: params.has_active_trips,
      created_at_from: params.created_at_from ? dayjs(params.created_at_from) : undefined,
      created_at_to: params.created_at_to ? dayjs(params.created_at_to) : undefined,
    });
  }, [countryDirectory.countries, filterForm, params]);

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
    { title: "Тип", dataIndex: "type", key: "type", width: 150, render: (value) => value ?? "-" },
    { title: "Страна", dataIndex: "country", key: "country", width: 150, render: (value) => value ?? "-" },
    { title: "Город", dataIndex: "city", key: "city", width: 150, render: (value) => value ?? "-" },
    { title: "Компания", dataIndex: "company_name", key: "company_name", width: 190, render: (value) => value ?? "-" },
    { title: "Статус", dataIndex: "status", key: "status", width: 120, render: (value) => value ?? "-" },
    {
      title: "Активные рейсы",
      dataIndex: "has_active_trips",
      key: "has_active_trips",
      width: 140,
      render: (value) => (typeof value === "boolean" ? (value ? "Да" : "Нет") : "-"),
    },
    {
      title: "Создана",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      render: (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "-"),
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
    <Space orientation="vertical" size={16} className="crm-page-stack">
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
        onToggleFilters={() => {
          const nextFiltersOpen = !filtersOpen;
          setFiltersOpenFallback(nextFiltersOpen);
          applySearchPatch({ filters_open: nextFiltersOpen ? "1" : "0" });
        }}
        toggleLabel="Фильтр"
        search={
          <Input.Search
            key={params.query ?? "path-point-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию, типу, городу, компании"
            defaultValue={params.query}
            onSearch={(value) => applySearchPatch({ query: value?.trim() || null, page: 1 })}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          onFinish={(values) => {
            applySearchPatch({
              query: values.query?.trim() || null,
              type: values.type,
              country: getCountryEnglishName(findCountry(countryDirectory.countries, values.country)) ?? null,
              city: values.city?.trim() || null,
              company_id: values.company_id,
              status: values.status,
              has_active_trips: values.has_active_trips,
              created_at_from: values.created_at_from?.format("YYYY-MM-DD"),
              created_at_to: values.created_at_to?.format("YYYY-MM-DD"),
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid crm-path-point-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Наименование" allowClear />
            </Form.Item>
            <Form.Item name="type" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select allowClear showSearch placeholder="Тип" options={PATH_POINT_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="country" className="crm-col-3" style={{ marginBottom: 0 }}>
              <CountrySelect scope="staff" allowClear placeholder="Страна" />
            </Form.Item>
            <Form.Item name="city" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Input placeholder="Город" allowClear />
            </Form.Item>
            <Form.Item name="company_id" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                showSearch
                filterOption={false}
                loading={companiesQuery.isLoading}
                options={companyOptions}
                placeholder="Компания"
                onSearch={setCompanyQueryText}
                notFoundContent={companiesQuery.isLoading ? "Загрузка..." : "Компании не найдены"}
              />
            </Form.Item>
            <Form.Item name="status" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select allowClear placeholder="Статус" options={PATH_POINT_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="has_active_trips" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Активные рейсы"
                options={[
                  { label: "Есть", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="created_at_from" className="crm-col-2" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создана от" />
            </Form.Item>
            <Form.Item name="created_at_to" className="crm-col-3" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создана до" />
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
                setFiltersOpenFallback(false);
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
          scroll={{ x: 1500 }}
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
