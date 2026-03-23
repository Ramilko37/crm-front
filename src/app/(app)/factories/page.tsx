"use client";

import { EditOutlined, SettingOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import {
  FACTORY_CERTIFICATE_STATUS_VALUES,
  formatEnumCode,
  type FactoryCertificateStatus,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  Factory,
  FactoryCertificate,
  FactoryEmail,
  FactoryFilterParams,
  FactoryLoadingAddress,
  FactoryLoadingAddressWritePayload,
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

function getParams(searchParams: URLSearchParams): FactoryFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    certificate_statuses: parseSearchArray(searchParams, "certificate_statuses") as FactoryCertificateStatus[],
  };
}

type FactoryForm = {
  name: string;
  country_id?: number;
  country?: string;
  city?: string;
  address?: string;
  postcode?: string;
  phone?: string;
  primary_email?: string;
  certificate_status?: FactoryCertificateStatus;
};

type FactoryEmailForm = {
  email: string;
  is_primary?: boolean;
};

type FactoryCertificateForm = {
  number?: string;
  status?: FactoryCertificateStatus;
  file_path?: string;
  issued_date?: dayjs.Dayjs;
  expires_date?: dayjs.Dayjs;
};

type FactoryLoadingAddressForm = {
  country_id?: number;
  postcode?: string;
  city?: string;
  address?: string;
  phone?: string;
  fax?: string;
  messenger_type?: string;
  messenger_value?: string;
};

function formatCertificateStatus(value: FactoryCertificateStatus | null) {
  return formatEnumCode(value);
}

function renderCertificateStatus(value: FactoryCertificateStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return <Tag className="crm-status-tag">{formatCertificateStatus(value)}</Tag>;
}

function serializeCertificateForm(values: FactoryCertificateForm) {
  return {
    number: values.number,
    status: values.status,
    file_path: values.file_path,
    issued_date: values.issued_date?.format("YYYY-MM-DD"),
    expires_date: values.expires_date?.format("YYYY-MM-DD"),
  };
}

function FactoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const meQuery = useCurrentUser(true);
  const canMutate = isBackOfficeRole(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [certificateEditOpen, setCertificateEditOpen] = useState(false);
  const [loadingAddressEditOpen, setLoadingAddressEditOpen] = useState(false);

  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<FactoryEmail | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<FactoryCertificate | null>(null);
  const [selectedLoadingAddress, setSelectedLoadingAddress] = useState<FactoryLoadingAddress | null>(null);

  const [createForm] = Form.useForm<FactoryForm>();
  const [editForm] = Form.useForm<FactoryForm>();
  const [filterForm] = Form.useForm<{
    query?: string;
    country?: string;
    city?: string;
    certificate_statuses?: FactoryCertificateStatus[];
  }>();

  const [emailCreateForm] = Form.useForm<FactoryEmailForm>();
  const [emailEditForm] = Form.useForm<FactoryEmailForm>();
  const [certificateCreateForm] = Form.useForm<FactoryCertificateForm>();
  const [certificateEditForm] = Form.useForm<FactoryCertificateForm>();
  const [loadingAddressCreateForm] = Form.useForm<FactoryLoadingAddressForm>();
  const [loadingAddressEditForm] = Form.useForm<FactoryLoadingAddressForm>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const hasActiveFilters = Boolean(
    params.query || params.country || params.city || (params.certificate_statuses?.length ?? 0) > 0,
  );
  const [filtersOpen, setFiltersOpen] = useState(() => hasActiveFilters);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      country: params.country,
      city: params.city,
      certificate_statuses: params.certificate_statuses?.length ? params.certificate_statuses : undefined,
    });
  }, [filterForm, params.certificate_statuses, params.city, params.country, params.query]);

  const listQuery = useQuery({
    queryKey: queryKeys.factories.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: params,
      }),
  });

  const emailsQuery = useQuery({
    queryKey: selectedFactory ? queryKeys.factories.emails(selectedFactory.id) : ["factories", "emails", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryEmail>>(`/api/factories/${selectedFactory?.id}/emails`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: resourcesOpen && Boolean(selectedFactory),
  });

  const certificatesQuery = useQuery({
    queryKey: selectedFactory
      ? queryKeys.factories.certificates(selectedFactory.id)
      : ["factories", "certificates", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryCertificate>>(`/api/factories/${selectedFactory?.id}/certificates`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: resourcesOpen && Boolean(selectedFactory),
  });

  const loadingAddressesQuery = useQuery({
    queryKey: selectedFactory
      ? queryKeys.factories.loadingAddresses(selectedFactory.id)
      : ["factories", "loading-addresses", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryLoadingAddress>>(`/api/factories/${selectedFactory?.id}/loading-addresses`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: resourcesOpen && Boolean(selectedFactory),
  });

  const createMutation = useMutation({
    mutationFn: (payload: FactoryForm) =>
      apiRequest<Factory>("/api/factories", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Фабрика создана");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания фабрики");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FactoryForm }) =>
      apiRequest<Factory>(`/api/factories/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Фабрика обновлена");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления фабрики");
    },
  });

  const createEmailMutation = useMutation({
    mutationFn: (payload: FactoryEmailForm) =>
      apiRequest<FactoryEmail>(`/api/factories/${selectedFactory?.id}/emails`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Email добавлен");
      emailCreateForm.resetFields();
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.emails(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления email");
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ emailId, payload }: { emailId: number; payload: FactoryEmailForm }) =>
      apiRequest<FactoryEmail>(`/api/factories/${selectedFactory?.id}/emails/${emailId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Email обновлен");
      setEmailEditOpen(false);
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.emails(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления email");
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: (emailId: number) =>
      apiRequest<null>(`/api/factories/${selectedFactory?.id}/emails/${emailId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Email удален");
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.emails(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления email");
    },
  });

  const createCertificateMutation = useMutation({
    mutationFn: (payload: FactoryCertificateForm) =>
      apiRequest<FactoryCertificate>(`/api/factories/${selectedFactory?.id}/certificates`, {
        method: "POST",
        body: serializeCertificateForm(payload),
      }),
    onSuccess: async () => {
      message.success("Сертификат создан");
      certificateCreateForm.resetFields();
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.certificates(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания сертификата");
    },
  });

  const updateCertificateMutation = useMutation({
    mutationFn: ({ certificateId, payload }: { certificateId: number; payload: FactoryCertificateForm }) =>
      apiRequest<FactoryCertificate>(`/api/factories/${selectedFactory?.id}/certificates/${certificateId}`, {
        method: "PATCH",
        body: serializeCertificateForm(payload),
      }),
    onSuccess: async () => {
      message.success("Сертификат обновлен");
      setCertificateEditOpen(false);
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.certificates(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления сертификата");
    },
  });

  const deleteCertificateMutation = useMutation({
    mutationFn: (certificateId: number) =>
      apiRequest<null>(`/api/factories/${selectedFactory?.id}/certificates/${certificateId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Сертификат удален");
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.certificates(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления сертификата");
    },
  });

  const createLoadingAddressMutation = useMutation({
    mutationFn: (payload: FactoryLoadingAddressWritePayload) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${selectedFactory?.id}/loading-addresses`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Адрес загрузки добавлен");
      loadingAddressCreateForm.resetFields();
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.loadingAddresses(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления адреса загрузки");
    },
  });

  const updateLoadingAddressMutation = useMutation({
    mutationFn: ({ addressId, payload }: { addressId: number; payload: FactoryLoadingAddressWritePayload }) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${selectedFactory?.id}/loading-addresses/${addressId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Адрес загрузки обновлен");
      setLoadingAddressEditOpen(false);
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.loadingAddresses(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления адреса загрузки");
    },
  });

  const makePrimaryLoadingAddressMutation = useMutation({
    mutationFn: (addressId: number) =>
      apiRequest<FactoryLoadingAddress>(
        `/api/factories/${selectedFactory?.id}/loading-addresses/${addressId}/make-primary`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      message.success("Primary адрес обновлен");
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.loadingAddresses(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка смены primary-адреса");
    },
  });

  const deleteLoadingAddressMutation = useMutation({
    mutationFn: (addressId: number) =>
      apiRequest<null>(`/api/factories/${selectedFactory?.id}/loading-addresses/${addressId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      message.success("Адрес загрузки удален");
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.loadingAddresses(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка удаления адреса загрузки");
    },
  });

  function openEdit(record: Factory) {
    setSelectedFactory(record);
    editForm.setFieldsValue({
      ...record,
      country_id: record.country_id ?? undefined,
      country: record.country ?? undefined,
      city: record.city ?? undefined,
      address: record.address ?? undefined,
      postcode: record.postcode ?? undefined,
      phone: record.phone ?? undefined,
      primary_email: record.primary_email ?? undefined,
      certificate_status: record.certificate_status ?? undefined,
    });
    setEditOpen(true);
  }

  function openResources(record: Factory) {
    setSelectedFactory(record);
    setResourcesOpen(true);
  }

  function openEmailEdit(record: FactoryEmail) {
    setSelectedEmail(record);
    emailEditForm.setFieldsValue({
      email: record.email,
      is_primary: record.is_primary,
    });
    setEmailEditOpen(true);
  }

  function openCertificateEdit(record: FactoryCertificate) {
    setSelectedCertificate(record);
    certificateEditForm.setFieldsValue({
      number: record.number ?? undefined,
      status: record.status ?? undefined,
      file_path: record.file_path ?? undefined,
      issued_date: record.issued_date ? dayjs(record.issued_date) : undefined,
      expires_date: record.expires_date ? dayjs(record.expires_date) : undefined,
    });
    setCertificateEditOpen(true);
  }

  function openLoadingAddressEdit(record: FactoryLoadingAddress) {
    setSelectedLoadingAddress(record);
    loadingAddressEditForm.setFieldsValue({
      country_id: record.country_id ?? undefined,
      postcode: record.postcode ?? undefined,
      city: record.city ?? undefined,
      address: record.address ?? undefined,
      phone: record.phone ?? undefined,
      fax: record.fax ?? undefined,
      messenger_type: record.messenger_type ?? undefined,
      messenger_value: record.messenger_value ?? undefined,
    });
    setLoadingAddressEditOpen(true);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  const columns: ColumnsType<Factory> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, sortOrder: sortOrderFor("id"), width: 90 },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      sorter: true,
      sortOrder: sortOrderFor("name"),
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      sorter: true,
      sortOrder: sortOrderFor("country"),
      render: (v) => v ?? "-",
      width: 150,
    },
    {
      title: "Город",
      dataIndex: "city",
      key: "city",
      sorter: true,
      sortOrder: sortOrderFor("city"),
      render: (v) => v ?? "-",
      width: 150,
    },
    { title: "Primary Email", dataIndex: "primary_email", key: "primary_email", render: (v) => v ?? "-" },
    {
      title: "Сертификат",
      dataIndex: "certificate_status",
      key: "certificate_status",
      sorter: true,
      sortOrder: sortOrderFor("certificate_status"),
      render: (v: FactoryCertificateStatus | null) => renderCertificateStatus(v),
      width: 220,
    },
    {
      title: "Действия",
      key: "actions",
      width: 280,
      render: (_, record) => (
        <Space>
          {canMutate ? (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              Редактировать
            </Button>
          ) : null}
          <Button size="small" icon={<SettingOutlined />} onClick={() => openResources(record)}>
            Ресурсы
          </Button>
        </Space>
      ),
    },
  ];

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/factories${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Factory> | SorterResult<Factory>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Factory> | undefined)
      : (sorter as SorterResult<Factory>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  const emailColumns: ColumnsType<FactoryEmail> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90 },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Primary",
      dataIndex: "is_primary",
      key: "is_primary",
      width: 120,
      render: (value: boolean) => (value ? <Tag color="green">Да</Tag> : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 220,
      render: (_, record) =>
        canMutate ? (
          <Space>
            <Button size="small" onClick={() => openEmailEdit(record)}>
              Изменить
            </Button>
            <Popconfirm
              title="Удалить email?"
              okText="Да"
              cancelText="Нет"
              onConfirm={() => deleteEmailMutation.mutate(record.id)}
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

  const certificateColumns: ColumnsType<FactoryCertificate> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90 },
    { title: "Номер", dataIndex: "number", key: "number", render: (value) => value ?? "-" },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 220,
      render: (value: FactoryCertificateStatus | null) => renderCertificateStatus(value),
    },
    { title: "Файл", dataIndex: "file_path", key: "file_path", render: (value) => value ?? "-" },
    {
      title: "Выдан",
      dataIndex: "issued_date",
      key: "issued_date",
      width: 130,
      render: (value) => value ?? "-",
    },
    {
      title: "Истекает",
      dataIndex: "expires_date",
      key: "expires_date",
      width: 130,
      render: (value) => value ?? "-",
    },
    {
      title: "Действия",
      key: "actions",
      width: 220,
      render: (_, record) =>
        canMutate ? (
          <Space>
            <Button size="small" onClick={() => openCertificateEdit(record)}>
              Изменить
            </Button>
            <Popconfirm
              title="Удалить сертификат?"
              okText="Да"
              cancelText="Нет"
              onConfirm={() => deleteCertificateMutation.mutate(record.id)}
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

  const loadingAddressColumns: ColumnsType<FactoryLoadingAddress> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90 },
    { title: "Страна ID", dataIndex: "country_id", key: "country_id", width: 110, render: (v) => v ?? "-" },
    { title: "Город", dataIndex: "city", key: "city", width: 140, render: (v) => v ?? "-" },
    { title: "Адрес", dataIndex: "address", key: "address", render: (v) => v ?? "-" },
    { title: "Индекс", dataIndex: "postcode", key: "postcode", width: 120, render: (v) => v ?? "-" },
    { title: "Телефон", dataIndex: "phone", key: "phone", width: 140, render: (v) => v ?? "-" },
    {
      title: "Primary",
      dataIndex: "is_primary",
      key: "is_primary",
      width: 100,
      render: (value: boolean) => (value ? <Tag color="green">Да</Tag> : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 320,
      render: (_, record) =>
        canMutate ? (
          <Space wrap>
            <Button size="small" onClick={() => openLoadingAddressEdit(record)}>
              Изменить
            </Button>
            <Button
              size="small"
              disabled={record.is_primary}
              loading={makePrimaryLoadingAddressMutation.isPending}
              onClick={() => makePrimaryLoadingAddressMutation.mutate(record.id)}
            >
              Сделать primary
            </Button>
            <Popconfirm
              title="Удалить адрес загрузки?"
              okText="Да"
              cancelText="Нет"
              onConfirm={() => deleteLoadingAddressMutation.mutate(record.id)}
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

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Фабрики"
        subtitle="Каталог фабрик и nested-ресурсы emails/certificates/loading-addresses."
        actions={
          canMutate ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Создать фабрику
            </Button>
          ) : null
        }
      />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтры"
        search={
          <Input.Search
            key={params.query ?? "factories-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию или email"
            defaultValue={params.query}
            onSearch={(value) => {
              applySearchPatch({
                query: value || null,
                page: 1,
              });
            }}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          onFinish={(values: {
            query?: string;
            country?: string;
            city?: string;
            certificate_statuses?: FactoryCertificateStatus[];
          }) => {
            applySearchPatch({
              query: values.query,
              country: values.country,
              city: values.city,
              certificate_statuses: values.certificate_statuses,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по названию или email" allowClear />
            </Form.Item>
            <Form.Item name="country" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Страна" allowClear />
            </Form.Item>
            <Form.Item name="city" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Город" allowClear />
            </Form.Item>
            <Form.Item name="certificate_statuses" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Сертификат"
                options={FACTORY_CERTIFICATE_STATUS_VALUES.map((value) => ({
                  label: formatCertificateStatus(value),
                  value,
                }))}
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
                router.replace("/factories");
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
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки фабрик"}
          </Typography.Text>
        ) : null}

        {isMobile ? (
          <>
            <div className="crm-mobile-list">
              {rows.map((record) => (
                <article key={record.id} className="crm-row-card">
                  <div className="crm-row-card-head">
                    <div>
                      <div className="crm-row-title">{record.name}</div>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderCertificateStatus(record.certificate_status)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Страна
                      <strong>{record.country ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Город
                      <strong>{record.city ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item" style={{ gridColumn: "1 / -1" }}>
                      Primary Email
                      <strong>{record.primary_email ?? "-"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    {canMutate ? (
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                        Редактировать
                      </Button>
                    ) : null}
                    <Button size="small" icon={<SettingOutlined />} onClick={() => openResources(record)}>
                      Ресурсы
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            {!listQuery.isLoading && rows.length === 0 ? (
              <Typography.Text type="secondary">Нет данных</Typography.Text>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Pagination
                current={currentPage}
                pageSize={currentPageSize}
                total={totalRows}
                showSizeChanger
                pageSizeOptions={[20, 50, 100, 200]}
                onChange={(page, pageSize) => {
                  applySearchPatch({
                    page,
                    page_size: pageSize,
                  });
                }}
              />
            </div>
          </>
        ) : (
          <Table<Factory>
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            scroll={{ x: 1280 }}
            pagination={{
              current: currentPage,
              pageSize: currentPageSize,
              total: totalRows,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100, 200],
            }}
            onChange={handleTableChange}
            locale={{ emptyText: "Нет данных" }}
          />
        )}
      </Card>

      <Modal
        title="Создать фабрику"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<FactoryForm>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="ID страны">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="primary_email" label="Primary email">
            <Input />
          </Form.Item>
          <Form.Item name="certificate_status" label="Статус сертификата">
            <Select
              allowClear
              options={FACTORY_CERTIFICATE_STATUS_VALUES.map((value) => ({
                label: formatCertificateStatus(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Редактировать фабрику #${selectedFactory?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<FactoryForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedFactory) return;
            updateMutation.mutate({ id: selectedFactory.id, payload: values });
          }}
        >
          <Form.Item name="name" label="Название">
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="ID страны">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="primary_email" label="Primary email">
            <Input />
          </Form.Item>
          <Form.Item name="certificate_status" label="Статус сертификата">
            <Select
              allowClear
              options={FACTORY_CERTIFICATE_STATUS_VALUES.map((value) => ({
                label: formatCertificateStatus(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Ресурсы фабрики #${selectedFactory?.id ?? ""} — ${selectedFactory?.name ?? ""}`}
        open={resourcesOpen}
        destroyOnHidden
        width={980}
        footer={null}
        onCancel={() => {
          setResourcesOpen(false);
          setSelectedEmail(null);
          setSelectedCertificate(null);
          setSelectedLoadingAddress(null);
          emailCreateForm.resetFields();
          certificateCreateForm.resetFields();
          loadingAddressCreateForm.resetFields();
          loadingAddressEditForm.resetFields();
        }}
      >
        <Tabs
          items={[
            {
              key: "emails",
              label: "Emails",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {canMutate ? (
                    <Form<FactoryEmailForm>
                      form={emailCreateForm}
                      layout="inline"
                      onFinish={(values) => createEmailMutation.mutate({ ...values, is_primary: Boolean(values.is_primary) })}
                    >
                      <Form.Item name="email" rules={[{ required: true, message: "Введите email" }]}>
                        <Input placeholder="Email" style={{ width: 280 }} />
                      </Form.Item>
                      <Form.Item name="is_primary" label="Primary" valuePropName="checked" initialValue={false}>
                        <Switch />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={createEmailMutation.isPending}>
                        Добавить email
                      </Button>
                    </Form>
                  ) : null}

                  <Table<FactoryEmail>
                    rowKey="id"
                    loading={emailsQuery.isLoading}
                    columns={emailColumns}
                    dataSource={emailsQuery.data?.items ?? []}
                    pagination={false}
                    locale={{ emptyText: "Нет email-адресов" }}
                  />
                </Space>
              ),
            },
            {
              key: "certificates",
              label: "Сертификаты",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {canMutate ? (
                    <Form<FactoryCertificateForm>
                      form={certificateCreateForm}
                      layout="vertical"
                      onFinish={(values) => createCertificateMutation.mutate(values)}
                    >
                      <div className="crm-filter-grid">
                        <Form.Item name="number" label="Номер" className="crm-col-3" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="status"
                          label="Статус"
                          className="crm-col-3"
                          style={{ marginBottom: 8 }}
                        >
                          <Select
                            allowClear
                            options={FACTORY_CERTIFICATE_STATUS_VALUES.map((value) => ({
                              label: formatCertificateStatus(value),
                              value,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item
                          name="file_path"
                          label="Путь к файлу"
                          className="crm-col-4"
                          style={{ marginBottom: 8 }}
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="issued_date"
                          label="Дата выдачи"
                          className="crm-col-2"
                          style={{ marginBottom: 8 }}
                        >
                          <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                        </Form.Item>
                        <Form.Item
                          name="expires_date"
                          label="Дата окончания"
                          className="crm-col-2"
                          style={{ marginBottom: 8 }}
                        >
                          <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                        </Form.Item>
                      </div>
                      <Button type="primary" htmlType="submit" loading={createCertificateMutation.isPending}>
                        Добавить сертификат
                      </Button>
                    </Form>
                  ) : null}

                  <Table<FactoryCertificate>
                    rowKey="id"
                    loading={certificatesQuery.isLoading}
                    columns={certificateColumns}
                    dataSource={certificatesQuery.data?.items ?? []}
                    pagination={false}
                    locale={{ emptyText: "Нет сертификатов" }}
                  />
                </Space>
              ),
            },
            {
              key: "loading-addresses",
              label: "Адреса загрузки",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {canMutate ? (
                    <Form<FactoryLoadingAddressForm>
                      form={loadingAddressCreateForm}
                      layout="vertical"
                      onFinish={(values) => createLoadingAddressMutation.mutate(values)}
                    >
                      <div className="crm-filter-grid">
                        <Form.Item name="country_id" label="Страна ID" className="crm-col-2" style={{ marginBottom: 8 }}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="city" label="Город" className="crm-col-3" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="address" label="Адрес" className="crm-col-4" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="postcode" label="Индекс" className="crm-col-2" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="phone" label="Телефон" className="crm-col-3" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="fax" label="Fax" className="crm-col-2" style={{ marginBottom: 8 }}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="messenger_type"
                          label="Мессенджер тип"
                          className="crm-col-2"
                          style={{ marginBottom: 8 }}
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="messenger_value"
                          label="Мессенджер контакт"
                          className="crm-col-2"
                          style={{ marginBottom: 8 }}
                        >
                          <Input />
                        </Form.Item>
                      </div>
                      <Button type="primary" htmlType="submit" loading={createLoadingAddressMutation.isPending}>
                        Добавить адрес загрузки
                      </Button>
                    </Form>
                  ) : null}

                  <Table<FactoryLoadingAddress>
                    rowKey="id"
                    loading={loadingAddressesQuery.isLoading}
                    columns={loadingAddressColumns}
                    dataSource={loadingAddressesQuery.data?.items ?? []}
                    pagination={false}
                    scroll={{ x: 1280 }}
                    locale={{ emptyText: "Нет адресов загрузки" }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={`Изменить email #${selectedEmail?.id ?? ""}`}
        open={emailEditOpen}
        destroyOnHidden
        onCancel={() => setEmailEditOpen(false)}
        onOk={() => emailEditForm.submit()}
        confirmLoading={updateEmailMutation.isPending}
      >
        <Form<FactoryEmailForm>
          form={emailEditForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedEmail) return;
            updateEmailMutation.mutate({
              emailId: selectedEmail.id,
              payload: {
                ...values,
                is_primary: Boolean(values.is_primary),
              },
            });
          }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="is_primary" label="Primary" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить сертификат #${selectedCertificate?.id ?? ""}`}
        open={certificateEditOpen}
        destroyOnHidden
        onCancel={() => setCertificateEditOpen(false)}
        onOk={() => certificateEditForm.submit()}
        confirmLoading={updateCertificateMutation.isPending}
      >
        <Form<FactoryCertificateForm>
          form={certificateEditForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedCertificate) return;
            updateCertificateMutation.mutate({
              certificateId: selectedCertificate.id,
              payload: values,
            });
          }}
        >
          <Form.Item name="number" label="Номер">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Статус">
            <Select
              allowClear
              options={FACTORY_CERTIFICATE_STATUS_VALUES.map((value) => ({
                label: formatCertificateStatus(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="file_path" label="Путь к файлу">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Дата выдачи">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="expires_date" label="Дата окончания">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить адрес загрузки #${selectedLoadingAddress?.id ?? ""}`}
        open={loadingAddressEditOpen}
        destroyOnHidden
        onCancel={() => setLoadingAddressEditOpen(false)}
        onOk={() => loadingAddressEditForm.submit()}
        confirmLoading={updateLoadingAddressMutation.isPending}
      >
        <Form<FactoryLoadingAddressForm>
          form={loadingAddressEditForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedLoadingAddress) return;
            updateLoadingAddressMutation.mutate({
              addressId: selectedLoadingAddress.id,
              payload: values,
            });
          }}
        >
          <Form.Item name="country_id" label="Страна ID">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="fax" label="Fax">
            <Input />
          </Form.Item>
          <Form.Item name="messenger_type" label="Мессенджер тип">
            <Input />
          </Form.Item>
          <Form.Item name="messenger_value" label="Мессенджер контакт">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function FactoriesPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <FactoriesPageContent />
    </Suspense>
  );
}
