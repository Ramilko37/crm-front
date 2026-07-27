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
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Suspense, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { useCountryDirectory } from "@/shared/hooks/use-country-directory";
import { apiRequest } from "@/shared/lib/api";
import {
  countryMatchesEnglishPrefix,
  formatCountryEnglishName,
  getCountryEnglishName,
  getSelectableCountries,
} from "@/shared/lib/countries";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  Company,
  CompanyContact,
  CompanyContactWritePayload,
  CompanyWritePayload,
  PaginatedResponse,
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

type CompanyFilterFormValues = {
  countries?: string[];
  cities?: string[];
  roles?: string[];
};

const STRICT_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const COMPANY_ROLE_OPTIONS = [
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
].map((role) => ({ label: role, value: role }));

function trimOrUndefined(value: string | undefined | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizePhone(value: string | undefined | null) {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) return undefined;

  let next = trimmed.replace(/[\s()-]/g, "");
  if (next.startsWith("00")) {
    next = `+${next.slice(2)}`;
  }

  if (next.startsWith("+")) {
    next = `+${next.slice(1).replace(/\+/g, "")}`;
  }

  return next;
}

function toContactList(payload: PaginatedResponse<CompanyContact> | CompanyContact[] | undefined) {
  if (!payload) {
    return { items: [] as CompanyContact[], page: 1, pageSize: 20, total: 0 };
  }

  if (Array.isArray(payload)) {
    return { items: payload, page: 1, pageSize: payload.length || 20, total: payload.length };
  }

  return {
    items: payload.items ?? [],
    page: payload.meta.page ?? 1,
    pageSize: payload.meta.page_size ?? 20,
    total: payload.meta.total ?? 0,
  };
}

function buildContactPayload(values: ContactFormValues, isOwnerManagedPrimary: boolean): CompanyContactWritePayload {
  const normalizedPhone = normalizePhone(values.phone);

  return {
    full_name: isOwnerManagedPrimary ? undefined : trimOrUndefined(values.full_name),
    job_title: trimOrUndefined(values.job_title),
    email: isOwnerManagedPrimary ? undefined : trimOrUndefined(values.email),
    phone: isOwnerManagedPrimary ? undefined : normalizedPhone,
    messenger_type: trimOrUndefined(values.messenger_type),
    messenger_value: trimOrUndefined(values.messenger_value),
    is_primary: isOwnerManagedPrimary ? undefined : values.is_primary,
  };
}

function getCompanyRoles(company: Company) {
  const roles = company.role_names ?? company.roles ?? [company.role_name, company.role];
  return roles
    .flatMap((role) => (typeof role === "string" ? role.split(",") : []))
    .map((role) => role.trim())
    .filter(Boolean);
}

function renderCompanyRoles(company: Company) {
  const roles = getCompanyRoles(company);
  if (roles.length === 0) {
    return "-";
  }
  return (
    <Space size={4} wrap>
      {roles.map((role) => (
        <Tag key={role}>{role}</Tag>
      ))}
    </Space>
  );
}

function CompaniesPageContent() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canWrite = meQuery.data?.is_superuser || normalizedRole === "administrator" || normalizedRole === "manager";
  const countryDirectory = useCountryDirectory();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPageSize, setCompanyPageSize] = useState(20);
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(20);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CompanyContact | null>(null);

  const [renameForm] = Form.useForm<{ name: string }>();
  const [filterForm] = Form.useForm<CompanyFilterFormValues>();
  const [createContactForm] = Form.useForm<ContactFormValues>();
  const [editContactForm] = Form.useForm<ContactFormValues>();

  const companyListParams = useMemo(
    () => ({
      page: companyPage,
      page_size: companyPageSize,
      query: searchQuery || undefined,
      country: countryFilters,
      city: cityFilters,
      role: roleFilters,
    }),
    [cityFilters, companyPage, companyPageSize, countryFilters, roleFilters, searchQuery],
  );

  const hasActiveFilters = Boolean(
    searchQuery || countryFilters.length > 0 || cityFilters.length > 0 || roleFilters.length > 0,
  );

  const countryFilterOptions = useMemo(
    () =>
      getSelectableCountries(countryDirectory.countries).map((country) => ({
        label: getCountryEnglishName(country)!,
        value: getCountryEnglishName(country)!,
        country,
      })),
    [countryDirectory.countries],
  );

  const companiesQuery = useQuery({
    queryKey: queryKeys.companies.list(companyListParams),
    queryFn: () =>
      apiRequest<PaginatedResponse<Company>>("/api/companies", {
        query: companyListParams,
      }),
    enabled: canWrite,
  });

  const companyDetailQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.companies.detail(selectedCompanyId) : ["companies", "detail", "idle"],
    queryFn: () => apiRequest<Company>(`/api/companies/${selectedCompanyId}`),
    enabled: detailsOpen && Boolean(selectedCompanyId) && canWrite,
  });

  const companyContactsQuery = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.companies.contacts(selectedCompanyId)
      : ["companies", "contacts", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<CompanyContact> | CompanyContact[]>(`/api/companies/${selectedCompanyId}/contacts`, {
        query: { page: contactPage, page_size: contactPageSize },
      }),
    enabled: detailsOpen && Boolean(selectedCompanyId) && canWrite,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompanyWritePayload }) =>
      apiRequest<Company>(`/api/companies/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Компания переименована");
      setRenameOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
        selectedCompanyId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(selectedCompanyId) })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось переименовать компанию");
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
      if (selectedCompanyId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies.contacts(selectedCompanyId) });
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось добавить контакт");
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
      if (selectedCompanyId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies.contacts(selectedCompanyId) });
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось обновить контакт");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: ({ companyId, contactId }: { companyId: number; contactId: number }) =>
      apiRequest<null>(`/api/companies/${companyId}/contacts/${contactId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Контакт удален");
      if (selectedCompanyId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies.contacts(selectedCompanyId) });
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось удалить контакт");
    },
  });

  const rows = companiesQuery.data?.items ?? [];
  const selectedCompany = companyDetailQuery.data;

  const companyCurrentPage = companiesQuery.data?.meta.page ?? companyPage;
  const companyCurrentPageSize = companiesQuery.data?.meta.page_size ?? companyPageSize;
  const companyTotal = companiesQuery.data?.meta.total ?? rows.length;

  const contactView = useMemo(() => toContactList(companyContactsQuery.data), [companyContactsQuery.data]);

  const companyColumns: ColumnsType<Company> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90 },
    { title: "Название", dataIndex: "name", key: "name" },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      width: 180,
      render: (value, row) => formatCountryEnglishName(countryDirectory.countries, value, row.country_id),
    },
    {
      title: "Город",
      dataIndex: "city",
      key: "city",
      width: 160,
      render: (value) => value ?? "-",
    },
    {
      title: "Роль",
      key: "role",
      width: 220,
      render: (_, row) => renderCompanyRoles(row),
    },
    {
      title: "Действия",
      key: "actions",
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedCompanyId(row.id);
            setContactPage(1);
            setDetailsOpen(true);
          }}
        >
          Открыть
        </Button>
      ),
    },
  ];

  const contactColumns: ColumnsType<CompanyContact> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90 },
    {
      title: "Контакт",
      key: "name",
      render: (_, row) => row.full_name ?? "-",
    },
    { title: "Должность", dataIndex: "job_title", key: "job_title", render: (v) => v ?? "-" },
    { title: "Email", dataIndex: "email", key: "email", render: (v) => v ?? "-" },
    { title: "Телефон", dataIndex: "phone", key: "phone", render: (v) => v ?? "-" },
    {
      title: "Primary",
      dataIndex: "is_primary",
      key: "is_primary",
      width: 100,
      render: (value: boolean) => (value ? "Да" : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 180,
      render: (_, row) => {
        const isOwnerManagedPrimary = Boolean(selectedCompany?.owner_user_id) && row.is_primary;
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
            <Popconfirm
              title="Удалить контакт?"
              okText="Удалить"
              cancelText="Отмена"
              disabled={isOwnerManagedPrimary}
              onConfirm={() => {
                if (!selectedCompanyId) return;
                deleteContactMutation.mutate({ companyId: selectedCompanyId, contactId: row.id });
              }}
            >
              <Button danger size="small" disabled={isOwnerManagedPrimary}>
                Удалить
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (!canWrite) {
    return (
      <Space orientation="vertical" size={16} className="crm-page-stack">
        <PageHeader title="Компании" subtitle="Раздел доступен только administrator/manager" />
        <Card className="crm-panel">
          <Typography.Text>Недостаточно прав для просмотра этого раздела.</Typography.Text>
        </Card>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader title="Компании" subtitle="Управление компаниями и контактной книгой" />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтры"
        search={
          <Input.Search
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию компании"
            value={searchInput}
            onChange={(event) => {
              const next = event.target.value;
              setSearchInput(next);
              if (!next.trim()) {
                setSearchQuery("");
                setCompanyPage(1);
              }
            }}
            onSearch={(value) => {
              setSearchQuery(value.trim());
              setCompanyPage(1);
            }}
          />
        }
        actions={
          <Button
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
              setCountryFilters([]);
              setCityFilters([]);
              setRoleFilters([]);
              filterForm.resetFields();
              setCompanyPage(1);
              setFiltersOpen(false);
            }}
          >
            Сброс
          </Button>
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form<CompanyFilterFormValues>
          form={filterForm}
          initialValues={{
            countries: countryFilters,
            cities: cityFilters,
            roles: roleFilters,
          }}
          onFinish={(values) => {
            setCountryFilters(values.countries ?? []);
            setCityFilters(values.cities ?? []);
            setRoleFilters(values.roles ?? []);
            setCompanyPage(1);
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="countries" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch
                filterOption={(input, option) => Boolean(option?.country && countryMatchesEnglishPrefix(option.country, input))}
                loading={countryDirectory.isLoading}
                options={countryFilterOptions}
                placeholder="Страны"
                notFoundContent={countryDirectory.isLoading ? "Загрузка..." : "Страны не найдены"}
              />
            </Form.Item>
            <Form.Item name="cities" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Select
                mode="tags"
                allowClear
                tokenSeparators={[","]}
                placeholder="Города"
                options={cityFilters.map((city) => ({ label: city, value: city }))}
              />
            </Form.Item>
            <Form.Item name="roles" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Роли компании"
                options={COMPANY_ROLE_OPTIONS}
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
                setCountryFilters([]);
                setCityFilters([]);
                setRoleFilters([]);
                setCompanyPage(1);
                setFiltersOpen(false);
              }}
            >
              Сбросить фильтры
            </Button>
            {hasActiveFilters ? (
              <Typography.Text type="secondary">
                Фильтры комбинируются; значения отправляются названиями, без внутренних ID.
              </Typography.Text>
            ) : null}
          </div>
        </Form>
      </FilterPanel>

      <Card className="crm-panel crm-table-card">
        {companiesQuery.error ? (
          <Typography.Text type="danger">
            {companiesQuery.error instanceof ApiError ? companiesQuery.error.detail : "Ошибка загрузки компаний"}
          </Typography.Text>
        ) : null}

        <Table<Company>
          rowKey="id"
          loading={companiesQuery.isLoading}
          dataSource={rows}
          columns={companyColumns}
          pagination={false}
          locale={{ emptyText: "Нет данных" }}
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
        title={selectedCompany ? `Компания #${selectedCompany.id}` : "Компания"}
        size={840}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedCompanyId(null);
          setSelectedContact(null);
          setContactPage(1);
        }}
      >
        {companyDetailQuery.error ? (
          <Typography.Text type="danger">
            {companyDetailQuery.error instanceof ApiError ? companyDetailQuery.error.detail : "Ошибка загрузки компании"}
          </Typography.Text>
        ) : null}

        {selectedCompany ? (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="ID">{selectedCompany.id}</Descriptions.Item>
              <Descriptions.Item label="Название">{selectedCompany.name}</Descriptions.Item>
              <Descriptions.Item label="Страна">
                {formatCountryEnglishName(countryDirectory.countries, selectedCompany.country, selectedCompany.country_id)}
              </Descriptions.Item>
              <Descriptions.Item label="Город">{selectedCompany.city ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Роль">{renderCompanyRoles(selectedCompany)}</Descriptions.Item>
              <Descriptions.Item label="owner_user_id">{selectedCompany.owner_user_id ?? "-"}</Descriptions.Item>
            </Descriptions>

            <Space style={{ marginBottom: 16 }}>
              <Button
                onClick={() => {
                  renameForm.setFieldValue("name", selectedCompany.name);
                  setRenameOpen(true);
                }}
              >
                Переименовать компанию
              </Button>
              <Button type="primary" onClick={() => setCreateContactOpen(true)}>
                Добавить контакт
              </Button>
            </Space>

            <Table<CompanyContact>
              rowKey="id"
              loading={companyContactsQuery.isLoading}
              dataSource={contactView.items}
              columns={contactColumns}
              pagination={false}
              locale={{ emptyText: "Контакты не найдены" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
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
          </>
        ) : null}
      </Drawer>

      <Modal
        title="Переименовать компанию"
        open={renameOpen}
        destroyOnHidden
        onCancel={() => setRenameOpen(false)}
        onOk={() => renameForm.submit()}
        confirmLoading={renameMutation.isPending}
      >
        <Form
          form={renameForm}
          layout="vertical"
          onFinish={(values: { name: string }) => {
            if (!selectedCompanyId) return;
            renameMutation.mutate({
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
                  const normalized = normalizePhone(value);
                  if (!normalized) return;
                  if (!STRICT_PHONE_REGEX.test(normalized)) {
                    throw new Error("Введите телефон в формате +79991234567");
                  }
                },
              },
            ]}
            extra="Формат: +[код][номер], от 8 до 15 цифр после +."
          >
            <Input
              placeholder="+79991234567"
              onBlur={(event) => {
                createContactForm.setFieldValue("phone", normalizePhone(event.target.value));
              }}
            />
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
              Для owner-managed компании primary-контакт синхронизируется системой: ФИО, email, телефон и primary-флаг read-only.
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
                  const normalized = normalizePhone(value);
                  if (!normalized) return;
                  if (!STRICT_PHONE_REGEX.test(normalized)) {
                    throw new Error("Введите телефон в формате +79991234567");
                  }
                },
              },
            ]}
            extra="Формат: +[код][номер], от 8 до 15 цифр после +."
          >
            <Input
              placeholder="+79991234567"
              disabled={Boolean(selectedCompany?.owner_user_id && selectedContact?.is_primary)}
              onBlur={(event) => {
                editContactForm.setFieldValue("phone", normalizePhone(event.target.value));
              }}
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
