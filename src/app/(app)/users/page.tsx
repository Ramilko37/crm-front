"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Table,
  Tag,
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
import { findCountry, getCountryEnglishName } from "@/shared/lib/countries";
import { ROLE_NAMES, type RoleName } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { canManageUsers, canResetUserPassword, normalizeRoleName } from "@/shared/lib/rbac";
import { buildUserWritePayload, requiredWhenForwarder } from "@/shared/lib/user-flow";
import {
  getUserQuickFilterPatch,
  getUserQuickFilters,
  type UserQuickFilterCode,
} from "@/shared/lib/user-quick-filters";
import { CountrySelect } from "@/shared/ui/country-select";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  Company,
  PaginatedResponse,
  UserAdmin,
  UserCityLookupItem,
  UserFilterParams,
  UserManagerLookupItem,
  UserWritePayload,
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

function trimOrUndefined(value: string | undefined | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function parseFilterPanelQueryState(value: string | null) {
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

function extractItems<T>(response: T[] | { items?: T[] } | undefined): T[] {
  if (!response) return [];
  return Array.isArray(response) ? response : (response.items ?? []);
}

function getParams(searchParams: URLSearchParams): UserFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    company_id: parseNumber(searchParams.get("company_id")),
    role_name: searchParams.get("role_name") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    is_active: parseBool(searchParams.get("is_active")),
    has_company: parseBool(searchParams.get("has_company")),
    has_email: parseBool(searchParams.get("has_email")),
    has_orders: parseBool(searchParams.get("has_orders")),
    last_order_date_from: searchParams.get("last_order_date_from") ?? undefined,
    last_order_date_to: searchParams.get("last_order_date_to") ?? undefined,
  };
}

type UserCreateForm = {
  company_name?: string;
  personal_manager_id?: number;
  full_name: string;
  login: string;
  password: string;
  role_name: RoleName | string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  is_active: boolean;
  selectedCountryId?: number;
};

type UserEditForm = Omit<UserCreateForm, "password" | "company_name"> & {
  total_orders?: number;
  last_order_date?: dayjs.Dayjs;
};

function UsersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canWrite = canManageUsers(meQuery.data?.role_name, meQuery.data?.is_superuser);
  const canResetPassword = canResetUserPassword(meQuery.data?.role_name, meQuery.data?.is_superuser);
  const isManagerActor = !meQuery.data?.is_superuser && normalizedRole === "manager";
  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const filtersOpenFromQuery = parseFilterPanelQueryState(searchParams.get("filters_open"));
  const hasActiveFilters = Boolean(
    params.query ||
      params.company_id ||
      params.role_name ||
      params.country ||
      params.city ||
      typeof params.is_active === "boolean" ||
      typeof params.has_company === "boolean" ||
      typeof params.has_email === "boolean" ||
      typeof params.has_orders === "boolean" ||
      params.last_order_date_from ||
      params.last_order_date_to,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [filtersOpenFallback, setFiltersOpenFallback] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [createCitySearch, setCreateCitySearch] = useState("");
  const [editCitySearch, setEditCitySearch] = useState("");
  const [selected, setSelected] = useState<UserAdmin | null>(null);
  const [createForm] = Form.useForm<UserCreateForm>();
  const [editForm] = Form.useForm<UserEditForm>();
  const [passwordForm] = Form.useForm<{ new_password: string }>();
  const [filterForm] = Form.useForm<{
    query?: string;
    company_id?: number;
    role_name?: RoleName | string;
    has_email?: boolean;
    has_orders?: boolean;
  }>();
  const createRoleName = Form.useWatch("role_name", createForm) as RoleName | string | undefined;
  const editRoleName = Form.useWatch("role_name", editForm) as RoleName | string | undefined;
  const createCountryId = Form.useWatch("selectedCountryId", createForm) as number | undefined;
  const editCountryId = Form.useWatch("selectedCountryId", editForm) as number | undefined;
  const countryDirectory = useCountryDirectory();
  const filtersOpen = filtersOpenFromQuery ?? (filtersOpenFallback || hasActiveFilters);

  const roleOptions = useMemo(() => {
    const all = ROLE_NAMES.filter((role) => role !== "anonymous");
    if (isManagerActor) {
      return all.filter((role) => role !== "administrator" && role !== "manager");
    }
    return all;
  }, [isManagerActor]);

  const listQuery = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin>>("/api/users", {
        query: params,
      }),
    enabled: canWrite,
  });

  const filterCompaniesQuery = useQuery({
    queryKey: queryKeys.companies.list({
      page: 1,
      page_size: 50,
      query: companySearch || undefined,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Company>>("/api/companies", {
        query: {
          page: 1,
          page_size: 50,
          query: companySearch || undefined,
        },
      }),
    enabled: canWrite && filtersOpen,
  });

  const selectedCompanyQuery = useQuery({
    queryKey: params.company_id ? queryKeys.companies.detail(params.company_id) : ["companies", "detail", "idle"],
    queryFn: () => apiRequest<Company>(`/api/companies/${params.company_id}`),
    enabled: canWrite && Boolean(params.company_id),
  });

  const managersQuery = useQuery({
    queryKey: queryKeys.users.lookupManagers({ query: managerSearch || undefined }),
    queryFn: () =>
      apiRequest<UserManagerLookupItem[] | { items: UserManagerLookupItem[] }>("/api/users/lookups/managers", {
        query: { query: managerSearch || undefined },
      }),
    enabled: createOpen || editOpen,
  });

  const createCitiesQuery = useQuery({
    queryKey: queryKeys.users.lookupCities({ country_id: createCountryId, query: createCitySearch || undefined }),
    queryFn: () =>
      apiRequest<UserCityLookupItem[] | { items: UserCityLookupItem[] }>("/api/users/lookups/cities", {
        query: { country_id: createCountryId, query: createCitySearch || undefined },
      }),
    enabled: createOpen && Boolean(createCountryId),
  });

  const editCitiesQuery = useQuery({
    queryKey: queryKeys.users.lookupCities({ country_id: editCountryId, query: editCitySearch || undefined }),
    queryFn: () =>
      apiRequest<UserCityLookupItem[] | { items: UserCityLookupItem[] }>("/api/users/lookups/cities", {
        query: { country_id: editCountryId, query: editCitySearch || undefined },
      }),
    enabled: editOpen && Boolean(editCountryId),
  });

  const managerOptions = useMemo(
    () =>
      extractItems(managersQuery.data).map((manager) => ({
        label: [manager.label || manager.full_name, manager.email].filter(Boolean).join(" · "),
        value: manager.id,
      })),
    [managersQuery.data],
  );

  const companyOptions = useMemo(() => {
    const companies = [...(filterCompaniesQuery.data?.items ?? [])];
    if (selectedCompanyQuery.data && !companies.some((company) => company.id === selectedCompanyQuery.data.id)) {
      companies.unshift(selectedCompanyQuery.data);
    }

    return companies.map((company) => ({
      label: company.name,
      value: company.id,
    }));
  }, [filterCompaniesQuery.data?.items, selectedCompanyQuery.data]);

  const createCityOptions = useMemo(
    () => extractItems(createCitiesQuery.data).map((item) => ({ label: item.city, value: item.city })),
    [createCitiesQuery.data],
  );

  const editCityOptions = useMemo(
    () => extractItems(editCitiesQuery.data).map((item) => ({ label: item.city, value: item.city })),
    [editCitiesQuery.data],
  );

  useEffect(() => {
    if (!editOpen || editCountryId) return;
    const currentCountry = editForm.getFieldValue("country");
    if (!currentCountry) return;

    const matchedCountry = findCountry(countryDirectory.countries, currentCountry);
    if (matchedCountry) {
      editForm.setFieldsValue({
        selectedCountryId: matchedCountry.id,
        country: getCountryEnglishName(matchedCountry) ?? undefined,
      });
    }
  }, [countryDirectory.countries, editCountryId, editForm, editOpen]);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      company_id: params.company_id,
      role_name: params.role_name,
      has_email: params.has_email,
      has_orders: params.has_orders,
    });
  }, [filterForm, params]);

  const createMutation = useMutation({
    mutationFn: (payload: UserWritePayload) =>
      apiRequest<UserAdmin>("/api/users", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Пользователь создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания пользователя");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserWritePayload }) =>
      apiRequest<UserAdmin>(`/api/users/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Пользователь обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления пользователя");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, new_password }: { id: number; new_password: string }) =>
      apiRequest<null>(`/api/users/${id}/password`, {
        method: "PATCH",
        body: { new_password },
      }),
    onSuccess: () => {
      message.success("Пароль пользователя обновлен");
      setPasswordOpen(false);
      passwordForm.resetFields();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка сброса пароля");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/users${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function applyGlobalUserSearch(value: string) {
    const query = trimOrUndefined(value);
    applySearchPatch({ query: query ?? null, page: 1 });
  }

  function toggleQuickFilter(code: UserQuickFilterCode) {
    applySearchPatch(getUserQuickFilterPatch(code, params));
  }

  const quickFilters = getUserQuickFilters(params);

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<UserAdmin> | SorterResult<UserAdmin>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<UserAdmin> | undefined)
      : (sorter as SorterResult<UserAdmin>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<UserAdmin> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "ФИО",
      dataIndex: "full_name",
      key: "full_name",
      sorter: true,
      sortOrder: sortOrderFor("full_name"),
    },
    { title: "Логин", dataIndex: "login", key: "login" },
    {
      title: "Компания",
      key: "company",
      width: 180,
      render: (_, record) => record.company_name ?? "-",
    },
    {
      title: "Роль",
      dataIndex: "role_name",
      key: "role_name",
      width: 130,
      render: (value) => <Tag>{value}</Tag>,
    },
    { title: "Email", dataIndex: "email", key: "email", render: (value) => value ?? "-" },
    {
      title: "Активен",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (value: boolean) => (value ? "Да" : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelected(record);
              editForm.setFieldsValue({
                personal_manager_id: record.personal_manager_id ?? undefined,
                full_name: record.full_name,
                login: record.login,
                role_name: record.role_name,
                email: record.email ?? undefined,
                phone: record.phone ?? undefined,
                country: record.country ?? undefined,
                city: record.city ?? undefined,
                address: record.address ?? undefined,
                selectedCountryId: undefined,
                is_active: record.is_active,
                total_orders: record.total_orders ?? undefined,
                last_order_date: record.last_order_date ? dayjs(record.last_order_date) : undefined,
              });
              setEditCitySearch(record.city ?? "");
              setEditOpen(true);
            }}
          >
            Изменить
          </Button>
          {canResetPassword ? (
            <Button
              size="small"
              onClick={() => {
                setSelected(record);
                passwordForm.resetFields();
                setPasswordOpen(true);
              }}
            >
              Сброс пароля
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  if (!canWrite) {
    return (
      <Space orientation="vertical" size={16} className="crm-page-stack">
        <PageHeader title="Пользователи" subtitle="Раздел доступен только administrator/manager" />
        <Card className="crm-panel">
          <Typography.Text>Недостаточно прав для просмотра этого раздела.</Typography.Text>
        </Card>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Пользователи"
        subtitle="Административный CRUD пользователей"
        actions={
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Новый пользователь
          </Button>
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
            key={params.query ?? "users-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по ФИО, логину, email, компании"
            defaultValue={params.query}
            onSearch={applyGlobalUserSearch}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{
            query: params.query,
            company_id: params.company_id,
            role_name: params.role_name,
            has_email: params.has_email,
            has_orders: params.has_orders,
          }}
          onFinish={(values) => {
            applySearchPatch({
              query: trimOrUndefined(values.query) ?? null,
              company_id: values.company_id,
              role_name: values.role_name,
              has_email: values.has_email,
              has_orders: values.has_orders,
              page: 1,
            });
          }}
        >
          <div className="crm-user-filter-stack">
            <div className="crm-filter-grid crm-user-filter-row">
              <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
                <Input placeholder="Поиск" allowClear />
              </Form.Item>
              <Form.Item name="company_id" className="crm-col-4" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  showSearch
                  filterOption={false}
                  loading={filterCompaniesQuery.isLoading || selectedCompanyQuery.isLoading}
                  options={companyOptions}
                  placeholder="Компания"
                  notFoundContent={filterCompaniesQuery.isLoading ? "Загрузка..." : "Компании не найдены"}
                  labelRender={({ label }) => (label ? String(label) : "Компания выбрана")}
                  onSearch={setCompanySearch}
                />
              </Form.Item>
              <Form.Item name="role_name" className="crm-col-4" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="Роль"
                  options={roleOptions.map((role) => ({ label: role, value: role }))}
                />
              </Form.Item>
            </div>
            <div className="crm-filter-grid crm-user-filter-row">
              <div className="crm-col-8 crm-user-quick-filters">
                {quickFilters.map((filter) => (
                  <Tag.CheckableTag
                    key={filter.code}
                    checked={filter.checked}
                    onChange={() => toggleQuickFilter(filter.code)}
                  >
                    {filter.label}
                  </Tag.CheckableTag>
                ))}
              </div>
              <Form.Item name="has_email" className="crm-col-2" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="С email"
                  options={[
                    { label: "Да", value: true },
                    { label: "Нет", value: false },
                  ]}
                />
              </Form.Item>
              <Form.Item name="has_orders" className="crm-col-2" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="С заказами"
                  options={[
                    { label: "Да", value: true },
                    { label: "Нет", value: false },
                  ]}
                />
              </Form.Item>
            </div>
          </div>
          <div className="crm-filter-actions crm-user-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/users");
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

        <Table<UserAdmin>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1460 }}
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
        title="Новый пользователь"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<UserCreateForm>
          form={createForm}
          layout="vertical"
          initialValues={{ is_active: true }}
          onFinish={(values) => {
            createMutation.mutate(buildUserWritePayload(values, { includeCompanyName: true, isManagerActor }));
          }}
        >
          <Form.Item name="country" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="company_name"
            label="Название компании"
            rules={[
              {
                validator: async (_, value) => {
                  const nextValue = typeof value === "string" ? value.trim() : "";
                  if (createRoleName === "client" && !nextValue) {
                    throw new Error("Для роли client укажите название компании");
                  }
                },
              },
            ]}
            extra="Для роли client поле обязательно. Для остальных ролей можно оставить пустым."
          >
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="login" label="Логин" rules={[{ required: true }]}> 
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true }]}> 
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role_name" label="Роль" rules={[{ required: true }]}> 
            <Select options={roleOptions.map((role) => ({ label: role, value: role }))} />
          </Form.Item>
          <Form.Item name="personal_manager_id" label="Персональный менеджер">
            <Select
              allowClear
              showSearch
              filterOption={false}
              loading={managersQuery.isLoading}
              options={managerOptions}
              placeholder="Выберите менеджера"
              onSearch={setManagerSearch}
              notFoundContent={managersQuery.isLoading ? "Загрузка..." : "Менеджеры не найдены"}
            />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item
            name="selectedCountryId"
            label="Страна"
            rules={[requiredWhenForwarder(createRoleName, "Выберите страну")]}
          >
            <CountrySelect
              allowClear
              placeholder="Начните вводить страну"
              onChange={(countryId, country) => {
                createForm.setFieldsValue({
                  country: getCountryEnglishName(country) ?? undefined,
                  selectedCountryId: countryId,
                  city: undefined,
                });
                setCreateCitySearch("");
              }}
            />
          </Form.Item>
          <Form.Item name="city" label="Город" rules={[requiredWhenForwarder(createRoleName, "Выберите город")]}>
            <AutoComplete
              allowClear
              disabled={!createCountryId}
              options={createCityOptions}
              placeholder={createCountryId ? "Начните вводить город" : "Сначала выберите страну"}
              onSearch={setCreateCitySearch}
            />
          </Form.Item>
          <Form.Item name="address" label="Адрес" rules={[requiredWhenForwarder(createRoleName, "Укажите адрес")]}>
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch disabled={isManagerActor} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить пользователя #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<UserEditForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({
              id: selected.id,
              payload: buildUserWritePayload(values, { isManagerActor }),
            });
          }}
        >
          <Form.Item name="country" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="login" label="Логин" rules={[{ required: true }]}> 
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="role_name" label="Роль" rules={[{ required: true }]}> 
            <Select options={roleOptions.map((role) => ({ label: role, value: role }))} />
          </Form.Item>
          <Form.Item name="personal_manager_id" label="Персональный менеджер">
            <Select
              allowClear
              showSearch
              filterOption={false}
              loading={managersQuery.isLoading}
              options={managerOptions}
              placeholder="Выберите менеджера"
              onSearch={setManagerSearch}
              notFoundContent={managersQuery.isLoading ? "Загрузка..." : "Менеджеры не найдены"}
            />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item
            name="selectedCountryId"
            label="Страна"
            rules={[requiredWhenForwarder(editRoleName, "Выберите страну")]}
          >
            <CountrySelect
              allowClear
              placeholder="Начните вводить страну"
              onChange={(countryId, country) => {
                editForm.setFieldsValue({
                  country: getCountryEnglishName(country) ?? undefined,
                  selectedCountryId: countryId,
                  city: undefined,
                });
                setEditCitySearch("");
              }}
            />
          </Form.Item>
          <Form.Item name="city" label="Город" rules={[requiredWhenForwarder(editRoleName, "Выберите город")]}>
            <AutoComplete
              allowClear
              disabled={!editCountryId}
              options={editCityOptions}
              placeholder={editCountryId ? "Начните вводить город" : "Сначала выберите страну"}
              onSearch={setEditCitySearch}
            />
          </Form.Item>
          <Form.Item name="address" label="Адрес" rules={[requiredWhenForwarder(editRoleName, "Укажите адрес")]}>
            <Input />
          </Form.Item>
          <Form.Item name="total_orders" label="Всего заказов">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="last_order_date" label="Дата последнего заказа">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch disabled={isManagerActor} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Сброс пароля для #${selected?.id ?? ""}`}
        open={passwordOpen}
        destroyOnHidden
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={(values: { new_password: string }) => {
            if (!selected) return;
            resetPasswordMutation.mutate({ id: selected.id, new_password: values.new_password });
          }}
        >
          <Form.Item name="new_password" label="Новый пароль" rules={[{ required: true }]}> 
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <UsersPageContent />
    </Suspense>
  );
}
