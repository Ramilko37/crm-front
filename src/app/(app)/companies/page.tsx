"use client";

import { MinusCircleOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { ROLE_NAMES, type RoleName } from "@/shared/lib/domain-enums";
import { apiRequest } from "@/shared/lib/api";
import { buildCompanyCreatePayload, isCompanyPhoneValid } from "@/shared/lib/company-flow";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { buildUserWritePayload } from "@/shared/lib/user-flow";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { CountrySelect } from "@/shared/ui/country-select";
import { PageHeader } from "@/shared/ui/page-frame";
import type {
  Company,
  CompanyContact,
  CompanyContactWritePayload,
  CompanyRole,
  CompanyWritePayload,
  PaginatedResponse,
  UserAdmin,
  UserCityLookupItem,
  UserWritePayload,
} from "@/shared/types/entities";

type ContactFormValues = {
  full_name?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  messenger_type?: string;
  messenger_value?: string;
  is_primary?: boolean;
};

type CompanyUserFormValues = {
  full_name?: string;
  login?: string;
  password?: string;
  role_name?: RoleName | string;
  email?: string;
  phone?: string;
  is_active?: boolean;
};

type CompanyCreateFormValues = Omit<CompanyWritePayload, "contacts"> & {
  country_id?: number;
  contacts?: ContactFormValues[];
};

type CompanyCountryLookupItem = { country: string };
type CompanyCityLookupItem = { city: string };

const COMPANY_ROLES: CompanyRole[] = [
  "Client",
  "Factory",
  "Supplier",
  "Forwarder",
  "Carrier",
  "Warehouse",
  "Customs Broker",
  "Dealer",
  "Partner",
  "Other",
];

function trimOrUndefined(value: string | undefined | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function toListView<T>(payload: PaginatedResponse<T> | T[] | undefined, fallbackPage: number, fallbackPageSize: number) {
  if (!payload) {
    return { items: [] as T[], page: fallbackPage, pageSize: fallbackPageSize, total: 0 };
  }

  if (Array.isArray(payload)) {
    return { items: payload, page: 1, pageSize: payload.length || fallbackPageSize, total: payload.length };
  }

  return {
    items: payload.items ?? [],
    page: payload.meta.page ?? fallbackPage,
    pageSize: payload.meta.page_size ?? fallbackPageSize,
    total: payload.meta.total ?? 0,
  };
}

function buildContactPayload(values: ContactFormValues, isOwnerManagedPrimary: boolean): CompanyContactWritePayload {
  return {
    full_name: isOwnerManagedPrimary ? undefined : trimOrUndefined(values.full_name),
    job_title: trimOrUndefined(values.job_title),
    email: isOwnerManagedPrimary ? undefined : trimOrUndefined(values.email),
    phone: isOwnerManagedPrimary ? undefined : trimOrUndefined(values.phone),
    messenger_type: trimOrUndefined(values.messenger_type),
    messenger_value: trimOrUndefined(values.messenger_value),
    is_primary: isOwnerManagedPrimary ? undefined : values.is_primary,
  };
}

function apiErrorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.detail : fallback;
}

function companyDeleteErrorText(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    const detail = error.detail.toLowerCase();
    if (detail.includes("order") || detail.includes("заказ")) {
      return "Компанию нельзя удалить: есть связанные заказы.";
    }
    if (detail.includes("user") || detail.includes("польз")) {
      return "Компанию нельзя удалить: сначала отвяжите пользователей в карточке.";
    }
  }

  return apiErrorText(error, "Не удалось удалить компанию");
}

function userLabel(user: UserAdmin | undefined) {
  if (!user) return "Owner не назначен";
  return [user.full_name, user.login, user.email, user.phone].filter(Boolean).join(" · ") || `User #${user.id}`;
}

function CompaniesPageContent() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canWrite = meQuery.data?.is_superuser || normalizedRole === "administrator" || normalizedRole === "manager";
  const isManagerActor = !meQuery.data?.is_superuser && normalizedRole === "manager";

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<CompanyRole[]>([]);
  const [countryLookupSearch, setCountryLookupSearch] = useState("");
  const [cityLookupSearch, setCityLookupSearch] = useState("");
  const [createCitySearch, setCreateCitySearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPageSize, setCompanyPageSize] = useState(50);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(20);
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState("users");

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [attachUserOpen, setAttachUserOpen] = useState(false);
  const [attachUserSearch, setAttachUserSearch] = useState("");
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CompanyContact | null>(null);

  const [createCompanyForm] = Form.useForm<CompanyCreateFormValues>();
  const [renameForm] = Form.useForm<{ name: string }>();
  const [createUserForm] = Form.useForm<CompanyUserFormValues>();
  const [attachUserForm] = Form.useForm<{ user_id: number }>();
  const [ownerForm] = Form.useForm<{ owner_user_id: number | null }>();
  const [createContactForm] = Form.useForm<ContactFormValues>();
  const [editContactForm] = Form.useForm<ContactFormValues>();
  const createCountryId = Form.useWatch("country_id", createCompanyForm) as number | undefined;

  const roleOptions = useMemo(() => {
    const all = ROLE_NAMES.filter((role) => role !== "anonymous");
    if (isManagerActor) {
      return all.filter((role) => role !== "administrator" && role !== "manager");
    }
    return all;
  }, [isManagerActor]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = searchInput.trim();
      setSearchQuery(nextQuery);
      setCompanyPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const companyListParams = useMemo(
    () => ({
      page: companyPage,
      page_size: companyPageSize,
      query: searchQuery || undefined,
      country: selectedCountries.length ? selectedCountries : undefined,
      city: selectedCities.length ? selectedCities : undefined,
      role: selectedRoles.length ? selectedRoles : undefined,
    }),
    [companyPage, companyPageSize, searchQuery, selectedCities, selectedCountries, selectedRoles],
  );

  const companiesQuery = useQuery({
    queryKey: queryKeys.companies.list(companyListParams),
    queryFn: () =>
      apiRequest<PaginatedResponse<Company>>("/api/companies", {
        query: companyListParams,
      }),
    enabled: canWrite,
  });

  const countryLookupQuery = useQuery({
    queryKey: ["companies", "lookups", "countries", countryLookupSearch],
    queryFn: () =>
      apiRequest<PaginatedResponse<CompanyCountryLookupItem>>("/api/companies/lookups/countries", {
        query: { query: countryLookupSearch || undefined, page: 1, page_size: 50 },
      }),
    enabled: canWrite,
  });

  const cityLookupQuery = useQuery({
    queryKey: ["companies", "lookups", "cities", selectedCountries, cityLookupSearch],
    queryFn: () =>
      apiRequest<PaginatedResponse<CompanyCityLookupItem>>("/api/companies/lookups/cities", {
        query: {
          country: selectedCountries.length ? selectedCountries : undefined,
          query: cityLookupSearch || undefined,
          page: 1,
          page_size: 50,
        },
      }),
    enabled: canWrite,
  });

  const createCitiesQuery = useQuery({
    queryKey: ["companies", "create", "cities", createCountryId, createCitySearch],
    queryFn: () =>
      apiRequest<PaginatedResponse<UserCityLookupItem> | UserCityLookupItem[]>("/api/users/lookups/cities", {
        query: { country_id: createCountryId, query: createCitySearch || undefined, page: 1, page_size: 50 },
      }),
    enabled: createCompanyOpen && Boolean(createCountryId),
  });

  const companyDetailQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.companies.detail(selectedCompanyId) : ["companies", "detail", "idle"],
    queryFn: () => apiRequest<Company>(`/api/companies/${selectedCompanyId}`),
    enabled: detailsOpen && Boolean(selectedCompanyId) && canWrite,
  });

  const companyUsersQuery = useQuery({
    queryKey: selectedCompanyId
      ? ["companies", "users", selectedCompanyId, { page: usersPage, page_size: usersPageSize }]
      : ["companies", "users", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin> | UserAdmin[]>(`/api/companies/${selectedCompanyId}/users`, {
        query: { page: usersPage, page_size: usersPageSize },
      }),
    enabled: detailsOpen && Boolean(selectedCompanyId) && canWrite,
  });

  const companyContactsQuery = useQuery({
    queryKey: selectedCompanyId
      ? ["companies", "contacts", selectedCompanyId, { page: contactPage, page_size: contactPageSize }]
      : ["companies", "contacts", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<CompanyContact> | CompanyContact[]>(`/api/companies/${selectedCompanyId}/contacts`, {
        query: { page: contactPage, page_size: contactPageSize },
      }),
    enabled: detailsOpen && Boolean(selectedCompanyId) && canWrite,
  });

  const attachCandidatesQuery = useQuery({
    queryKey: queryKeys.users.list({
      page: 1,
      page_size: 30,
      query: attachUserSearch || undefined,
      has_company: false,
    }),
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin>>("/api/users", {
        query: {
          page: 1,
          page_size: 30,
          query: attachUserSearch || undefined,
          has_company: false,
        },
      }),
    enabled: attachUserOpen && canWrite,
  });

  const selectedCompany = companyDetailQuery.data;
  const companyRows = companiesQuery.data?.items ?? [];
  const companyCurrentPage = companiesQuery.data?.meta.page ?? companyPage;
  const companyCurrentPageSize = companiesQuery.data?.meta.page_size ?? companyPageSize;
  const companyTotal = companiesQuery.data?.meta.total ?? companyRows.length;
  const usersView = useMemo(() => toListView(companyUsersQuery.data, usersPage, usersPageSize), [companyUsersQuery.data, usersPage, usersPageSize]);
  const contactView = useMemo(
    () => toListView(companyContactsQuery.data, contactPage, contactPageSize),
    [companyContactsQuery.data, contactPage, contactPageSize],
  );
  const ownerUser = usersView.items.find((user) => user.id === selectedCompany?.owner_user_id);
  const ownerCandidates = usersView.items.filter((user) => user.role_name === "client");
  const attachOptions = (attachCandidatesQuery.data?.items ?? [])
    .filter((user) => user.company_id === null)
    .map((user) => ({ label: userLabel(user), value: user.id }));
  const createCityItems = Array.isArray(createCitiesQuery.data)
    ? createCitiesQuery.data
    : (createCitiesQuery.data?.items ?? []);

  useEffect(() => {
    ownerForm.setFieldsValue({ owner_user_id: selectedCompany?.owner_user_id ?? null });
  }, [ownerForm, selectedCompany?.owner_user_id]);

  function openDetails(companyId: number) {
    setSelectedCompanyId(companyId);
    setUsersPage(1);
    setContactPage(1);
    setActiveTab("users");
    setDetailsOpen(true);
  }

  async function invalidateCompany(companyId: number | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["companies"] }),
      companyId ? queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(companyId) }) : Promise.resolve(),
      companyId ? queryClient.invalidateQueries({ queryKey: ["companies", "users", companyId] }) : Promise.resolve(),
      companyId ? queryClient.invalidateQueries({ queryKey: ["companies", "contacts", companyId] }) : Promise.resolve(),
    ]);
  }

  const createCompanyMutation = useMutation({
    mutationFn: (payload: CompanyWritePayload) =>
      apiRequest<Company>("/api/companies", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async (company) => {
      message.success("Компания создана");
      setCreateCompanyOpen(false);
      setCreateCitySearch("");
      setCompanyPage(1);
      createCompanyForm.resetFields();
      await invalidateCompany(company.id);
      openDetails(company.id);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось создать компанию"));
    },
  });

  const patchCompanyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompanyWritePayload }) =>
      apiRequest<Company>(`/api/companies/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async (_company, variables) => {
      setRenameOpen(false);
      message.success("Компания обновлена");
      await invalidateCompany(variables.id);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось обновить компанию"));
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: number) =>
      apiRequest<null>(`/api/companies/${companyId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Компания удалена");
      setDetailsOpen(false);
      setSelectedCompanyId(null);
      await invalidateCompany(null);
    },
    onError: (error) => {
      message.error(companyDeleteErrorText(error));
    },
  });

  const createCompanyUserMutation = useMutation({
    mutationFn: ({ companyId, payload }: { companyId: number; payload: UserWritePayload }) =>
      apiRequest<UserAdmin>(`/api/companies/${companyId}/users`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Пользователь добавлен");
      setCreateUserOpen(false);
      createUserForm.resetFields();
      await invalidateCompany(selectedCompanyId);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось добавить пользователя"));
    },
  });

  const attachUserMutation = useMutation({
    mutationFn: ({ companyId, userId }: { companyId: number; userId: number }) =>
      apiRequest<UserAdmin>(`/api/companies/${companyId}/users/attach`, {
        method: "POST",
        body: { user_id: userId },
      }),
    onSuccess: async () => {
      message.success("Пользователь привязан");
      setAttachUserOpen(false);
      setAttachUserSearch("");
      attachUserForm.resetFields();
      await invalidateCompany(selectedCompanyId);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось привязать пользователя"));
    },
  });

  const detachUserMutation = useMutation({
    mutationFn: ({ companyId, userId }: { companyId: number; userId: number }) =>
      apiRequest<null>(`/api/companies/${companyId}/users/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Пользователь отвязан");
      await invalidateCompany(selectedCompanyId);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось отвязать пользователя"));
    },
  });

  const createContactMutation = useMutation({
    mutationFn: ({ companyId, payload }: { companyId: number; payload: CompanyContactWritePayload }) =>
      apiRequest<CompanyContact>(`/api/companies/${companyId}/contacts`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Контакт добавлен");
      setCreateContactOpen(false);
      createContactForm.resetFields();
      await invalidateCompany(selectedCompanyId);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось добавить контакт"));
    },
  });

  const editContactMutation = useMutation({
    mutationFn: ({ companyId, contactId, payload }: { companyId: number; contactId: number; payload: CompanyContactWritePayload }) =>
      apiRequest<CompanyContact>(`/api/companies/${companyId}/contacts/${contactId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Контакт обновлен");
      setEditContactOpen(false);
      setSelectedContact(null);
      await invalidateCompany(selectedCompanyId);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось обновить контакт"));
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: ({ companyId, contactId }: { companyId: number; contactId: number }) =>
      apiRequest<null>(`/api/companies/${companyId}/contacts/${contactId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Контакт удален");
      await invalidateCompany(selectedCompanyId);
    },
    onError: (error) => {
      message.error(apiErrorText(error, "Не удалось удалить контакт"));
    },
  });

  const companyColumns: ColumnsType<Company> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: "Страна", dataIndex: "country", key: "country", width: 150, render: (value) => value ?? "-" },
    { title: "Город", dataIndex: "city", key: "city", width: 150, render: (value) => value ?? "-" },
    {
      title: "Роль",
      dataIndex: "role",
      key: "role",
      width: 150,
      render: (value: CompanyRole | null) => (value ? <Tag>{value}</Tag> : "-"),
    },
    {
      title: "Основной контакт",
      key: "primary_contact",
      width: 190,
      render: (_, row) => row.primary_contact?.full_name ?? "-",
    },
    {
      title: "Owner",
      key: "owner",
      width: 140,
      render: (_, row) => (row.owner_user_id ? <Tag color="green">Есть</Tag> : <Tag>Нет</Tag>),
    },
    {
      title: "",
      key: "actions",
      width: 64,
      render: (_, row) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [{ key: "open", label: "Открыть" }],
            onClick: ({ domEvent }) => {
              domEvent.stopPropagation();
              openDetails(row.id);
            },
          }}
        >
          <Button
            size="small"
            icon={<MoreOutlined />}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        </Dropdown>
      ),
    },
  ];

  const userColumns: ColumnsType<UserAdmin> = [
    { title: "ФИО", dataIndex: "full_name", key: "full_name", render: (value) => value ?? "-" },
    { title: "Логин", dataIndex: "login", key: "login" },
    {
      title: "Роль",
      dataIndex: "role_name",
      key: "role_name",
      width: 130,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: "Контакты",
      key: "contacts",
      render: (_, row) => [row.email, row.phone].filter(Boolean).join(" · ") || "-",
    },
    {
      title: "Статус",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (value: boolean) => (value ? <Tag color="green">Активен</Tag> : <Tag>Выключен</Tag>),
    },
    {
      title: "Owner",
      key: "owner",
      width: 100,
      render: (_, row) => (row.id === selectedCompany?.owner_user_id ? <Tag color="green">Owner</Tag> : "-"),
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, row) => {
        const isOwner = row.id === selectedCompany?.owner_user_id;
        return (
          <Tooltip title={isOwner ? "Сначала смените или снимите owner" : undefined}>
            <Popconfirm
              title="Отвязать пользователя?"
              okText="Отвязать"
              cancelText="Отмена"
              disabled={isOwner}
              onConfirm={() => {
                if (!selectedCompanyId) return;
                detachUserMutation.mutate({ companyId: selectedCompanyId, userId: row.id });
              }}
            >
              <Button size="small" danger disabled={isOwner}>
                Отвязать
              </Button>
            </Popconfirm>
          </Tooltip>
        );
      },
    },
  ];

  const contactColumns: ColumnsType<CompanyContact> = [
    { title: "ФИО", dataIndex: "full_name", key: "full_name", render: (value) => value ?? "-" },
    { title: "Должность", dataIndex: "job_title", key: "job_title", render: (value) => value ?? "-" },
    { title: "Email", dataIndex: "email", key: "email", render: (value) => value ?? "-" },
    { title: "Телефон", dataIndex: "phone", key: "phone", render: (value) => value ?? "-" },
    {
      title: "Мессенджер",
      key: "messenger",
      render: (_, row) => [row.messenger_type, row.messenger_value].filter(Boolean).join(": ") || "-",
    },
    {
      title: "Primary",
      dataIndex: "is_primary",
      key: "is_primary",
      width: 110,
      render: (value: boolean) => (value ? <Tag color="blue">Primary</Tag> : "-"),
    },
    {
      title: "",
      key: "actions",
      width: 170,
      render: (_, row) => {
        return (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setSelectedContact(row);
                editContactForm.setFieldsValue({
                  full_name: row.full_name ?? undefined,
                  job_title: row.job_title ?? undefined,
                  email: row.email ?? undefined,
                  phone: row.phone ?? undefined,
                  messenger_type: row.messenger_type ?? undefined,
                  messenger_value: row.messenger_value ?? undefined,
                  is_primary: row.is_primary,
                });
                setEditContactOpen(true);
              }}
            >
              Изм.
            </Button>
            <Tooltip title={row.is_primary ? "Primary-контакт нельзя удалить" : undefined}>
              <Popconfirm
                title="Удалить контакт?"
                okText="Удалить"
                cancelText="Отмена"
                disabled={row.is_primary}
                onConfirm={() => {
                  if (!selectedCompanyId) return;
                  deleteContactMutation.mutate({ companyId: selectedCompanyId, contactId: row.id });
                }}
              >
                <Button danger size="small" disabled={row.is_primary}>
                  Удалить
                </Button>
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  if (!canWrite) {
    return (
      <Space direction="vertical" size={16} className="crm-page-stack">
        <PageHeader title="Компании" subtitle="Раздел доступен только administrator/manager/superuser" />
        <Card className="crm-panel">
          <Typography.Text>Недостаточно прав для просмотра этого раздела.</Typography.Text>
        </Card>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Компании"
        subtitle="Справочник компаний, владельцы, пользователи и контакты."
        actions={
          <Button type="primary" onClick={() => setCreateCompanyOpen(true)}>
            Создать компанию
          </Button>
        }
      />

      <Card className="crm-toolbar-card">
        <div className="crm-filter-grid">
          <div className="crm-col-4">
            <Input.Search
              allowClear
              placeholder="Название, контакт, телефон, email, VAT"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onSearch={(value) => {
                setSearchQuery(value.trim());
                setCompanyPage(1);
              }}
            />
          </div>
          <div className="crm-col-3">
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              value={selectedCountries}
              loading={countryLookupQuery.isLoading}
              options={(countryLookupQuery.data?.items ?? []).map(({ country }) => ({ label: country, value: country }))}
              placeholder="Страны"
              notFoundContent={countryLookupQuery.isLoading ? "Загрузка..." : "Страны не найдены"}
              style={{ width: "100%" }}
              onSearch={(value) => setCountryLookupSearch(value.trim())}
              onChange={(countries) => {
                setSelectedCountries(countries);
                setSelectedCities([]);
                setCityLookupSearch("");
                setCompanyPage(1);
              }}
            />
          </div>
          <div className="crm-col-3">
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              value={selectedCities}
              loading={cityLookupQuery.isLoading}
              options={(cityLookupQuery.data?.items ?? []).map(({ city }) => ({ label: city, value: city }))}
              placeholder="Города"
              notFoundContent={cityLookupQuery.isLoading ? "Загрузка..." : "Города не найдены"}
              style={{ width: "100%" }}
              onSearch={(value) => setCityLookupSearch(value.trim())}
              onChange={(cities) => {
                setSelectedCities(cities);
                setCompanyPage(1);
              }}
            />
          </div>
          <div className="crm-col-2">
            <Select
              mode="multiple"
              allowClear
              value={selectedRoles}
              options={COMPANY_ROLES.map((role) => ({ label: role, value: role }))}
              placeholder="Роли"
              style={{ width: "100%" }}
              onChange={(roles) => {
                setSelectedRoles(roles);
                setCompanyPage(1);
              }}
            />
          </div>
          <div className="crm-col-12">
            <Button
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setSelectedCountries([]);
                setSelectedCities([]);
                setSelectedRoles([]);
                setCountryLookupSearch("");
                setCityLookupSearch("");
                setCompanyPage(1);
              }}
            >
              Сбросить поиск и фильтры
            </Button>
          </div>
        </div>
      </Card>

      <Card className="crm-panel crm-table-card">
        {companiesQuery.error ? (
          <Typography.Text type="danger">
            {apiErrorText(companiesQuery.error, "Ошибка загрузки компаний")}
          </Typography.Text>
        ) : null}

        <Table<Company>
          rowKey="id"
          loading={companiesQuery.isLoading}
          dataSource={companyRows}
          columns={companyColumns}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: "Компании не найдены" }}
          onRow={(row) => ({
            onClick: () => openDetails(row.id),
            style: { cursor: "pointer" },
          })}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Pagination
            current={companyCurrentPage}
            pageSize={companyCurrentPageSize}
            total={companyTotal}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            onChange={(page, pageSize) => {
              setCompanyPage(page);
              setCompanyPageSize(pageSize);
            }}
          />
        </div>
      </Card>

      <Drawer
        title={selectedCompany ? selectedCompany.name : "Компания"}
        width={980}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedCompanyId(null);
          setSelectedContact(null);
          setUsersPage(1);
          setContactPage(1);
        }}
        extra={
          selectedCompany ? (
            <Space>
              <Button
                onClick={() => {
                  renameForm.setFieldValue("name", selectedCompany.name);
                  setRenameOpen(true);
                }}
              >
                Переименовать
              </Button>
              <Button
                danger
                loading={deleteCompanyMutation.isPending}
                onClick={() => {
                  Modal.confirm({
                    title: "Удалить компанию?",
                    content: "Если у компании есть пользователи или заказы, бэк вернет запрет.",
                    okText: "Удалить",
                    cancelText: "Отмена",
                    onOk: () => deleteCompanyMutation.mutate(selectedCompany.id),
                  });
                }}
              >
                Удалить
              </Button>
            </Space>
          ) : null
        }
      >
        {companyDetailQuery.error ? (
          <Typography.Text type="danger">
            {apiErrorText(companyDetailQuery.error, "Ошибка загрузки компании")}
          </Typography.Text>
        ) : null}

        {selectedCompany ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{selectedCompany.id}</Descriptions.Item>
              <Descriptions.Item label="Название">{selectedCompany.name}</Descriptions.Item>
              <Descriptions.Item label="Owner">{ownerUser ? userLabel(ownerUser) : "Не назначен"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" className="crm-panel">
              <Form
                form={ownerForm}
                layout="inline"
                onFinish={(values) => {
                  if (!selectedCompanyId) return;
                  patchCompanyMutation.mutate({
                    id: selectedCompanyId,
                    payload: { owner_user_id: values.owner_user_id ?? null },
                  });
                }}
              >
                <Form.Item name="owner_user_id" label="Owner" style={{ minWidth: 320 }}>
                  <Select
                    allowClear
                    placeholder="Выберите client из пользователей компании"
                    options={ownerCandidates.map((user) => ({ label: userLabel(user), value: user.id }))}
                    notFoundContent="В компании нет client-пользователей"
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={patchCompanyMutation.isPending}>
                  Сохранить owner
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedCompanyId) return;
                    patchCompanyMutation.mutate({ id: selectedCompanyId, payload: { owner_user_id: null } });
                  }}
                  loading={patchCompanyMutation.isPending}
                >
                  Снять
                </Button>
              </Form>
            </Card>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "users",
                  label: "Пользователи",
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Space wrap>
                        <Button type="primary" onClick={() => setCreateUserOpen(true)}>
                          Создать пользователя
                        </Button>
                        <Button onClick={() => setAttachUserOpen(true)}>Привязать существующего</Button>
                      </Space>
                      <Typography.Text type="secondary">
                        Первый client в компании без owner станет owner автоматически.
                      </Typography.Text>
                      <Table<UserAdmin>
                        rowKey="id"
                        loading={companyUsersQuery.isLoading}
                        dataSource={usersView.items}
                        columns={userColumns}
                        pagination={false}
                        scroll={{ x: 900 }}
                        locale={{ emptyText: "Пользователей нет" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Pagination
                          current={usersView.page}
                          pageSize={usersView.pageSize}
                          total={usersView.total}
                          showSizeChanger
                          pageSizeOptions={[10, 20, 50, 100]}
                          onChange={(page, pageSize) => {
                            setUsersPage(page);
                            setUsersPageSize(pageSize);
                          }}
                        />
                      </div>
                    </Space>
                  ),
                },
                {
                  key: "contacts",
                  label: "Контакты",
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Space wrap>
                        <Button type="primary" onClick={() => setCreateContactOpen(true)}>
                          Добавить контакт
                        </Button>
                      </Space>
                      {selectedCompany.owner_user_id ? (
                        <Typography.Text type="secondary">
                          Primary-контакт управляется owner-пользователем: ФИО, email, телефон и primary-флаг read-only.
                        </Typography.Text>
                      ) : null}
                      <Table<CompanyContact>
                        rowKey="id"
                        loading={companyContactsQuery.isLoading}
                        dataSource={contactView.items}
                        columns={contactColumns}
                        pagination={false}
                        scroll={{ x: 940 }}
                        locale={{ emptyText: "Контакты не найдены" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Pagination
                          current={contactView.page}
                          pageSize={contactView.pageSize}
                          total={contactView.total}
                          showSizeChanger
                          pageSizeOptions={[10, 20, 50, 100]}
                          onChange={(page, pageSize) => {
                            setContactPage(page);
                            setContactPageSize(pageSize);
                          }}
                        />
                      </div>
                    </Space>
                  ),
                },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="Создать компанию"
        open={createCompanyOpen}
        width={900}
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        onCancel={() => {
          setCreateCompanyOpen(false);
          setCreateCitySearch("");
          createCompanyForm.resetFields();
        }}
        onOk={() => createCompanyForm.submit()}
        confirmLoading={createCompanyMutation.isPending}
      >
        <Form<CompanyCreateFormValues>
          form={createCompanyForm}
          layout="vertical"
          onFinish={(values) => {
            createCompanyMutation.mutate(buildCompanyCreatePayload(values));
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item
              name="name"
              label="Название"
              className="crm-col-6"
              rules={[{ required: true, whitespace: true, max: 255, message: "Укажите название" }]}
            >
              <Input autoFocus maxLength={255} />
            </Form.Item>
            <Form.Item name="role" label="Роль" className="crm-col-3">
              <Select allowClear options={COMPANY_ROLES.map((role) => ({ label: role, value: role }))} />
            </Form.Item>
            <Form.Item name="country_id" label="Страна" className="crm-col-3">
              <CountrySelect
                allowClear
                onChange={(countryId, country) => {
                  createCompanyForm.setFieldsValue({
                    country_id: countryId,
                    country: country?.name_en ?? undefined,
                    city: undefined,
                  });
                  setCreateCitySearch("");
                }}
              />
            </Form.Item>
            <Form.Item name="country" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="city" label="Город" className="crm-col-3">
              <Select
                allowClear
                showSearch
                filterOption={false}
                disabled={!createCountryId}
                loading={createCitiesQuery.isLoading}
                options={createCityItems.map(({ city }) => ({ label: city, value: city }))}
                placeholder={createCountryId ? "Начните вводить город" : "Сначала выберите страну"}
                notFoundContent={createCitiesQuery.isLoading ? "Загрузка..." : "Города не найдены"}
                onSearch={(value) => setCreateCitySearch(value.trim())}
              />
            </Form.Item>
            <Form.Item name="postcode" label="Индекс" className="crm-col-3" rules={[{ max: 20 }]}>
              <Input maxLength={20} />
            </Form.Item>
            <Form.Item name="vat_number" label="Налоговый номер / VAT" className="crm-col-3" rules={[{ max: 64 }]}>
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item name="address" label="Адрес" className="crm-col-6" rules={[{ max: 255 }]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Телефон офиса"
              className="crm-col-3"
              rules={[
                {
                  validator: async (_, value) => {
                    if (!isCompanyPhoneValid(value)) throw new Error("Допустимы +, -, пробел, скобки и 6–20 цифр");
                  },
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="email" label="E-mail офиса" className="crm-col-3" rules={[{ type: "email", message: "Некорректный email" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="website" label="Сайт" className="crm-col-6" rules={[{ max: 255 }]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item name="comment" label="Комментарий" className="crm-col-6" rules={[{ max: 2000 }]}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} showCount />
            </Form.Item>
          </div>

          <Divider>Контакты (необязательно)</Divider>
          <Form.List
            name="contacts"
            rules={[
              {
                validator: async (_, contacts: ContactFormValues[] | undefined) => {
                  if ((contacts ?? []).filter((contact) => contact?.is_primary).length > 1) {
                    throw new Error("Основным можно назначить только один контакт");
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Контакт ${index + 1}`}
                    extra={
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        aria-label={`Удалить контакт ${index + 1}`}
                        onClick={() => remove(field.name)}
                      />
                    }
                  >
                    <div className="crm-filter-grid">
                      <Form.Item name={[field.name, "full_name"]} label="ФИО" className="crm-col-6">
                        <Input maxLength={255} />
                      </Form.Item>
                      <Form.Item name={[field.name, "job_title"]} label="Должность" className="crm-col-3">
                        <Input maxLength={255} />
                      </Form.Item>
                      <Form.Item name={[field.name, "is_primary"]} label="Основной" valuePropName="checked" className="crm-col-3">
                        <Switch />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "phone"]}
                        label="Телефон"
                        className="crm-col-3"
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (!isCompanyPhoneValid(value)) throw new Error("Допустимы +, -, пробел, скобки и 6–20 цифр");
                            },
                          },
                        ]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "email"]}
                        label="E-mail"
                        className="crm-col-3"
                        rules={[{ type: "email", message: "Некорректный email" }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, "messenger_type"]} label="Мессенджер" className="crm-col-3">
                        <Input maxLength={64} placeholder="Telegram, WhatsApp" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "messenger_value"]}
                        label="Контакт мессенджера"
                        className="crm-col-3"
                        dependencies={[
                          ["contacts", field.name, "full_name"],
                          ["contacts", field.name, "messenger_type"],
                        ]}
                        rules={[
                          ({ getFieldValue }) => ({
                            validator: async (_, value) => {
                              const type = getFieldValue(["contacts", field.name, "messenger_type"]);
                              const fullName = getFieldValue(["contacts", field.name, "full_name"]);
                              if (fullName?.trim() && type?.trim() && !value?.trim()) {
                                throw new Error("Укажите контакт мессенджера");
                              }
                            },
                          }),
                        ]}
                      >
                        <Input maxLength={255} />
                      </Form.Item>
                    </div>
                  </Card>
                ))}
                <Form.ErrorList errors={errors} />
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ is_primary: false })} block>
                  Добавить контакт
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Переименовать компанию"
        open={renameOpen}
        destroyOnHidden
        onCancel={() => setRenameOpen(false)}
        onOk={() => renameForm.submit()}
        confirmLoading={patchCompanyMutation.isPending}
      >
        <Form
          form={renameForm}
          layout="vertical"
          onFinish={(values: { name: string }) => {
            if (!selectedCompanyId) return;
            patchCompanyMutation.mutate({
              id: selectedCompanyId,
              payload: { name: values.name.trim() },
            });
          }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Создать пользователя в компании"
        open={createUserOpen}
        destroyOnHidden
        onCancel={() => setCreateUserOpen(false)}
        onOk={() => createUserForm.submit()}
        confirmLoading={createCompanyUserMutation.isPending}
      >
        <Form<CompanyUserFormValues>
          form={createUserForm}
          layout="vertical"
          initialValues={{ role_name: "client", is_active: true }}
          onFinish={(values) => {
            if (!selectedCompanyId) return;
            createCompanyUserMutation.mutate({
              companyId: selectedCompanyId,
              payload: buildUserWritePayload(values, { isManagerActor }),
            });
          }}
        >
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="login" label="Логин" rules={[{ required: true, message: "Укажите логин" }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: "Укажите пароль" }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role_name" label="Роль" rules={[{ required: true, message: "Укажите роль" }]}>
            <Select options={roleOptions.map((role) => ({ label: role, value: role }))} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Некорректный email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch disabled={isManagerActor} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Привязать существующего пользователя"
        open={attachUserOpen}
        destroyOnHidden
        onCancel={() => {
          setAttachUserOpen(false);
          setAttachUserSearch("");
        }}
        onOk={() => attachUserForm.submit()}
        confirmLoading={attachUserMutation.isPending}
      >
        <Form
          form={attachUserForm}
          layout="vertical"
          onFinish={(values: { user_id: number }) => {
            if (!selectedCompanyId) return;
            attachUserMutation.mutate({ companyId: selectedCompanyId, userId: values.user_id });
          }}
        >
          <Form.Item name="user_id" label="Пользователь без компании" rules={[{ required: true, message: "Выберите пользователя" }]}>
            <Select
              showSearch
              filterOption={false}
              loading={attachCandidatesQuery.isLoading}
              options={attachOptions}
              placeholder="Начните вводить ФИО, логин или email"
              notFoundContent={attachCandidatesQuery.isLoading ? "Загрузка..." : "Пользователи не найдены"}
              onSearch={(value) => setAttachUserSearch(value.trim())}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый контакт"
        open={createContactOpen}
        destroyOnHidden
        onCancel={() => setCreateContactOpen(false)}
        onOk={() => createContactForm.submit()}
        confirmLoading={createContactMutation.isPending}
      >
        <Form<ContactFormValues>
          form={createContactForm}
          layout="vertical"
          initialValues={{ is_primary: false }}
          onFinish={(values) => {
            if (!selectedCompanyId) return;
            createContactMutation.mutate({
              companyId: selectedCompanyId,
              payload: buildContactPayload(values, false),
            });
          }}
        >
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="job_title" label="Должность">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Некорректный email" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              {
                validator: async (_, value) => {
                  if (!isCompanyPhoneValid(value)) throw new Error("Допустимы +, -, пробел, скобки и 6–20 цифр");
                },
              },
            ]}
            extra="Допустимы +, -, пробел, скобки и 6–20 цифр."
          >
            <Input placeholder="+39 (02) 123-456" />
          </Form.Item>
          <Form.Item name="messenger_type" label="Тип мессенджера">
            <Input />
          </Form.Item>
          <Form.Item name="messenger_value" label="Контакт мессенджера">
            <Input />
          </Form.Item>
          <Form.Item name="is_primary" label="Primary" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedContact ? `Контакт #${selectedContact.id}` : "Контакт"}
        open={editContactOpen}
        destroyOnHidden
        onCancel={() => {
          setEditContactOpen(false);
          setSelectedContact(null);
        }}
        onOk={() => editContactForm.submit()}
        confirmLoading={editContactMutation.isPending}
      >
        <Form<ContactFormValues>
          form={editContactForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedCompanyId || !selectedContact) return;
            const isOwnerManagedPrimary = Boolean(selectedCompany?.owner_user_id) && selectedContact.is_primary;
            editContactMutation.mutate({
              companyId: selectedCompanyId,
              contactId: selectedContact.id,
              payload: buildContactPayload(values, isOwnerManagedPrimary),
            });
          }}
        >
          {Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary) ? (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              Primary-контакт синхронизируется owner-пользователем. Можно изменить только должность и мессенджер.
            </Typography.Text>
          ) : null}
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input disabled={Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary)} />
          </Form.Item>
          <Form.Item name="job_title" label="Должность">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Некорректный email" }]}>
            <Input disabled={Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary)} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              {
                validator: async (_, value) => {
                  if (!isCompanyPhoneValid(value)) throw new Error("Допустимы +, -, пробел, скобки и 6–20 цифр");
                },
              },
            ]}
            extra="Допустимы +, -, пробел, скобки и 6–20 цифр."
          >
            <Input
              placeholder="+39 (02) 123-456"
              disabled={Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary)}
            />
          </Form.Item>
          <Form.Item name="messenger_type" label="Тип мессенджера">
            <Input />
          </Form.Item>
          <Form.Item name="messenger_value" label="Контакт мессенджера">
            <Input />
          </Form.Item>
          <Form.Item name="is_primary" label="Primary" valuePropName="checked">
            <Switch disabled={Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary)} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <CompaniesPageContent />
    </Suspense>
  );
}
