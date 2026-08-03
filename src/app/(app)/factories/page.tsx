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
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import type { FormInstance } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { useCountryDirectory } from "@/shared/hooks/use-country-directory";
import { apiRequest } from "@/shared/lib/api";
import {
  findCountry,
  formatCountryEnglishName,
  getCountryEnglishName,
} from "@/shared/lib/countries";
import {
  FACTORY_CERTIFICATE_STATUS_VALUES,
  formatEnumCode,
  type FactoryCertificateStatus,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import { CountrySelect } from "@/shared/ui/country-select";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type {
  Country,
  Factory,
  FactoryCertificate,
  FactoryEmail,
  FactoryFilterParams,
  FactoryLoadingAddress,
  FactoryLoadingAddressWritePayload,
  PaginatedResponse,
  Postcode,
  PostcodeCity,
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
  create_loading_address?: boolean;
  use_factory_root_as_loading?: boolean;
  loading_address?: FactoryLoadingAddressForm;
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
  name?: string;
  country_id?: number;
  postcode_id?: number;
  city_id?: number;
  address?: string;
  phone?: string;
  fax?: string;
  messenger_type?: string;
  messenger_value?: string;
  comment?: string;
  is_active?: boolean;
};

const FACTORY_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function compactText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeInternationalPhone(value: string | undefined | null) {
  const trimmed = compactText(value ?? undefined);
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

function validateInternationalPhone(_: unknown, value: string | undefined) {
  const normalized = normalizeInternationalPhone(value);
  if (!normalized || FACTORY_PHONE_REGEX.test(normalized)) {
    return Promise.resolve();
  }
  return Promise.reject(new Error("Введите телефон в международном формате +79991234567"));
}

function serializeLoadingAddressForm(
  values: FactoryLoadingAddressForm,
  options: { includeActive?: boolean } = {},
): FactoryLoadingAddressWritePayload {
  return {
    name: compactText(values.name),
    country_id: values.country_id,
    postcode_id: values.postcode_id,
    city_id: values.city_id,
    address: compactText(values.address),
    phone: compactText(values.phone),
    fax: compactText(values.fax),
    messenger_type: compactText(values.messenger_type),
    messenger_value: compactText(values.messenger_value),
    comment: compactText(values.comment),
    ...(options.includeActive && typeof values.is_active === "boolean" ? { is_active: values.is_active } : {}),
  };
}

function hasLoadingAddressDraft(values: FactoryLoadingAddressForm | undefined) {
  if (!values) return false;
  return Boolean(
    values.country_id ||
      values.postcode_id ||
      values.city_id ||
      compactText(values.name) ||
      compactText(values.address) ||
      compactText(values.phone) ||
      compactText(values.fax) ||
      compactText(values.messenger_type) ||
      compactText(values.messenger_value) ||
      compactText(values.comment),
  );
}

function serializeFactoryForm(values: FactoryForm) {
  const { create_loading_address, loading_address, ...factoryValues } = values;
  delete factoryValues.use_factory_root_as_loading;
  const payload: Record<string, unknown> = {
    ...factoryValues,
    name: compactText(values.name),
    country: compactText(values.country),
    city: compactText(values.city),
    address: compactText(values.address),
    postcode: compactText(values.postcode),
    phone: normalizeInternationalPhone(values.phone),
    primary_email: compactText(values.primary_email),
  };

  if (create_loading_address && hasLoadingAddressDraft(loading_address)) {
    payload.loading_address = serializeLoadingAddressForm(loading_address ?? {});
  }

  return payload;
}

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

function getApiErrorText(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  const text = error.detail.toLowerCase();
  if (text.includes("duplicate") || text.includes("duplicate-name-in-country")) {
    return "Фабрика с таким названием уже есть в выбранной стране";
  }
  if (text.includes("messenger") && text.includes("value")) {
    return "Заполните контакт мессенджера или очистите тип мессенджера";
  }
  if (text.includes("primary") && (text.includes("delete") || text.includes("deactivate"))) {
    return "Сначала назначьте другой основной адрес погрузки";
  }
  if (text.includes("last") && text.includes("active")) {
    return "Нельзя оставить фабрику без активного адреса погрузки";
  }
  if (text.includes("country") && (text.includes("postcode") || text.includes("city"))) {
    return "Страна, индекс и город должны быть из одного справочника";
  }
  return error.detail || fallback;
}

type LoadingAddressFieldsProps = {
  form: FormInstance<FactoryLoadingAddressForm>;
  countryIdFallback?: number;
  includeActive?: boolean;
  disabled?: boolean;
};

function LoadingAddressFields({
  form,
  countryIdFallback,
  includeActive,
  disabled,
}: LoadingAddressFieldsProps) {
  const [postcodeSearch, setPostcodeSearch] = useState("");
  const countryId = (Form.useWatch("country_id", form) as number | undefined) ?? countryIdFallback;
  const postcodeId = Form.useWatch("postcode_id", form) as number | undefined;

  const postcodesQuery = useQuery({
    queryKey: ["factories", "loading-address-postcodes", countryId, postcodeSearch],
    queryFn: () =>
      apiRequest<PaginatedResponse<Postcode>>("/api/postcodes", {
        query: {
          country_id: countryId,
          query: postcodeSearch || undefined,
          page: 1,
          page_size: 50,
        },
      }),
    enabled: Boolean(countryId) && !disabled,
  });

  const citiesQuery = useQuery({
    queryKey: ["factories", "loading-address-cities", postcodeId],
    queryFn: () =>
      apiRequest<PaginatedResponse<PostcodeCity>>(`/api/postcodes/${postcodeId}/cities`, {
        query: { page: 1, page_size: 100 },
      }),
    enabled: Boolean(postcodeId) && !disabled,
  });

  return (
    <div className="crm-filter-grid">
      <Form.Item
        name="name"
        label="Название точки"
        className="crm-col-3"
        rules={[{ required: true, message: "Введите название точки" }]}
      >
        <Input disabled={disabled} placeholder="Основной склад" />
      </Form.Item>
      <Form.Item
        name="country_id"
        label="Страна"
        className="crm-col-3"
        rules={[{ required: true, message: "Выберите страну" }]}
      >
        <CountrySelect
          allowClear
          disabled={disabled}
          onChange={(countryId) => {
            form.setFieldsValue({
              country_id: countryId,
              postcode_id: undefined,
              city_id: undefined,
            });
            setPostcodeSearch("");
          }}
        />
      </Form.Item>
      <Form.Item
        name="postcode_id"
        label="Индекс"
        className="crm-col-3"
        rules={[{ required: true, message: "Выберите индекс" }]}
      >
        <Select
          allowClear
          showSearch
          filterOption={false}
          disabled={disabled || !countryId}
          loading={postcodesQuery.isLoading}
          options={(postcodesQuery.data?.items ?? []).map((postcode) => ({
            label: postcode.postcode,
            value: postcode.id,
          }))}
          onSearch={setPostcodeSearch}
          onChange={() => {
            form.setFieldValue("city_id", undefined);
          }}
          placeholder={countryId ? "Начните вводить индекс" : "Сначала выберите страну"}
          notFoundContent={countryId ? "Индексы не найдены" : "Сначала выберите страну"}
        />
      </Form.Item>
      <Form.Item
        name="city_id"
        label="Город"
        className="crm-col-3"
        rules={[{ required: true, message: "Выберите город" }]}
      >
        <Select
          allowClear
          disabled={disabled || !postcodeId}
          loading={citiesQuery.isLoading}
          options={(citiesQuery.data?.items ?? []).map((city) => ({
            label: city.city,
            value: city.id,
          }))}
          placeholder={postcodeId ? "Выберите город" : "Сначала выберите индекс"}
          notFoundContent={postcodeId ? "Нет городов для индекса" : "Сначала выберите индекс"}
        />
      </Form.Item>
      <Form.Item
        name="address"
        label="Адрес"
        className="crm-col-6"
        rules={[{ required: true, message: "Введите адрес" }]}
      >
        <Input disabled={disabled} placeholder="Улица, дом, ворота" />
      </Form.Item>
      <Form.Item name="phone" label="Телефон" className="crm-col-3">
        <Input disabled={disabled} />
      </Form.Item>
      <Form.Item name="fax" label="Fax" className="crm-col-3">
        <Input disabled={disabled} />
      </Form.Item>
      <Form.Item name="messenger_type" label="Мессенджер" className="crm-col-3">
        <Input disabled={disabled} placeholder="WhatsApp, Telegram" />
      </Form.Item>
      <Form.Item
        name="messenger_value"
        label="Контакт мессенджера"
        className="crm-col-3"
        dependencies={["messenger_type"]}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!getFieldValue("messenger_type") || compactText(value)) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("Заполните контакт мессенджера"));
            },
          }),
        ]}
      >
        <Input disabled={disabled} />
      </Form.Item>
      <Form.Item name="comment" label="Комментарий" className="crm-col-6">
        <Input.TextArea disabled={disabled} autoSize={{ minRows: 2, maxRows: 4 }} maxLength={1000} showCount />
      </Form.Item>
      {includeActive ? (
        <Form.Item name="is_active" label="Активен" valuePropName="checked" className="crm-col-2" initialValue>
          <Switch disabled={disabled} />
        </Form.Item>
      ) : null}
    </div>
  );
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
  const countryDirectory = useCountryDirectory();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [certificateEditOpen, setCertificateEditOpen] = useState(false);
  const [loadingAddressEditOpen, setLoadingAddressEditOpen] = useState(false);
  const [createLoadingAddressEnabled, setCreateLoadingAddressEnabled] = useState(false);
  const [copyRootToNewLoadingAddress, setCopyRootToNewLoadingAddress] = useState(false);

  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<FactoryEmail | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<FactoryCertificate | null>(null);
  const [selectedLoadingAddress, setSelectedLoadingAddress] = useState<FactoryLoadingAddress | null>(null);

  const [createForm] = Form.useForm<FactoryForm>();
  const [editForm] = Form.useForm<FactoryForm>();
  const [firstLoadingAddressForm] = Form.useForm<FactoryLoadingAddressForm>();
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
      ? [...queryKeys.factories.loadingAddresses(selectedFactory.id), "include-inactive"]
      : ["factories", "loading-addresses", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryLoadingAddress>>(`/api/factories/${selectedFactory?.id}/loading-addresses`, {
        query: { include_inactive: true, page: 1, page_size: 50 },
      }),
    enabled: (resourcesOpen || editOpen) && Boolean(selectedFactory),
  });

  const createMutation = useMutation({
    mutationFn: (payload: FactoryForm) =>
      apiRequest<Factory>("/api/factories", {
        method: "POST",
        body: serializeFactoryForm(payload),
      }),
    onSuccess: async () => {
      message.success("Фабрика создана");
      setCreateOpen(false);
      createForm.resetFields();
      firstLoadingAddressForm.resetFields();
      setCreateLoadingAddressEnabled(false);
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(getApiErrorText(error, "Ошибка создания фабрики"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FactoryForm }) =>
      apiRequest<Factory>(`/api/factories/${id}`, {
        method: "PATCH",
        body: serializeFactoryForm(payload),
      }),
    onSuccess: async () => {
      message.success("Фабрика обновлена");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
    },
    onError: (error) => {
      message.error(getApiErrorText(error, "Ошибка обновления фабрики"));
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
    mutationFn: (payload: FactoryLoadingAddressForm) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${selectedFactory?.id}/loading-addresses`, {
        method: "POST",
        body: serializeLoadingAddressForm(payload),
      }),
    onSuccess: async () => {
      message.success("Адрес загрузки добавлен");
      loadingAddressCreateForm.resetFields();
      setCopyRootToNewLoadingAddress(false);
      if (!selectedFactory) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factories.loadingAddresses(selectedFactory.id) }),
        queryClient.invalidateQueries({ queryKey: ["factories"] }),
      ]);
    },
    onError: (error) => {
      message.error(getApiErrorText(error, "Ошибка добавления адреса загрузки"));
    },
  });

  const updateLoadingAddressMutation = useMutation({
    mutationFn: ({ addressId, payload }: { addressId: number; payload: FactoryLoadingAddressForm }) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${selectedFactory?.id}/loading-addresses/${addressId}`, {
        method: "PATCH",
        body: serializeLoadingAddressForm(payload, { includeActive: true }),
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
      message.error(getApiErrorText(error, "Ошибка обновления адреса загрузки"));
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
      message.error(getApiErrorText(error, "Ошибка смены primary-адреса"));
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
      message.error(getApiErrorText(error, "Ошибка удаления адреса загрузки"));
    },
  });

  function openEdit(record: Factory) {
    setSelectedFactory(record);
    loadingAddressCreateForm.resetFields();
    setCopyRootToNewLoadingAddress(false);
    editForm.setFieldsValue({
      ...record,
      country_id: record.country_id ?? undefined,
      country:
        getCountryEnglishName(
          findCountry(countryDirectory.countries, record.country_id ?? record.country),
        ) ?? undefined,
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
      name: record.name ?? undefined,
      country_id: record.country_id ?? undefined,
      postcode_id: record.postcode_id ?? undefined,
      city_id: record.city_id ?? undefined,
      address: record.address ?? undefined,
      phone: record.phone ?? undefined,
      fax: record.fax ?? undefined,
      messenger_type: record.messenger_type ?? undefined,
      messenger_value: record.messenger_value ?? undefined,
      comment: record.comment ?? undefined,
      is_active: record.is_active ?? true,
    });
    setLoadingAddressEditOpen(true);
  }

  function copyFactoryRootToLoadingAddress(
    targetForm: FormInstance<FactoryLoadingAddressForm>,
    values: Pick<FactoryForm, "country_id" | "address" | "phone">,
  ) {
    targetForm.setFieldsValue({
      name: "Основной адрес погрузки",
      country_id: values.country_id,
      address: values.address,
      phone: values.phone,
    });
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
      render: (value, record) =>
        formatCountryEnglishName(countryDirectory.countries, value, record.country_id),
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
    { title: "Основной email", dataIndex: "primary_email", key: "primary_email", render: (v) => v ?? "-" },
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
            Email и сертификаты
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
      title: "Основной",
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
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (value, record) => (
        <Space size={4} wrap>
          <Typography.Text strong>{value?.trim() || "Адрес погрузки"}</Typography.Text>
          {record.is_primary ? <Tag color="green">Основной</Tag> : null}
          {record.is_active === false ? <Tag>Неактивен</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Страна",
      dataIndex: "country_id",
      key: "country_id",
      width: 140,
      render: (countryId) => formatCountryEnglishName(countryDirectory.countries, undefined, countryId),
    },
    { title: "Город", dataIndex: "city", key: "city", width: 140, render: (v) => v ?? "-" },
    { title: "Адрес", dataIndex: "address", key: "address", render: (v) => v ?? "-" },
    { title: "Индекс", dataIndex: "postcode", key: "postcode", width: 120, render: (v) => v ?? "-" },
    { title: "Телефон", dataIndex: "phone", key: "phone", width: 140, render: (v) => v ?? "-" },
    { title: "Комментарий", dataIndex: "comment", key: "comment", width: 220, render: (v) => v ?? "-" },
    {
      title: "Действия",
      key: "actions",
      width: 320,
      render: (_, record) => {
        if (!canMutate) return "-";
        const inactive = record.is_active === false;
        const deleteDisabled = record.is_primary;
        return (
          <Space wrap>
            <Button size="small" onClick={() => openLoadingAddressEdit(record)}>
              Изменить
            </Button>
            <Tooltip title={inactive ? "Неактивный адрес нельзя назначить основным" : undefined}>
              <Button
                size="small"
                disabled={record.is_primary || inactive}
                loading={makePrimaryLoadingAddressMutation.isPending}
                onClick={() => makePrimaryLoadingAddressMutation.mutate(record.id)}
              >
                Сделать основным
              </Button>
            </Tooltip>
            <Tooltip title={deleteDisabled ? "Сначала назначьте другой основной адрес" : undefined}>
              <Popconfirm
                title="Удалить адрес погрузки?"
                okText="Да"
                cancelText="Нет"
                disabled={deleteDisabled}
                onConfirm={() => deleteLoadingAddressMutation.mutate(record.id)}
              >
                <Button size="small" danger disabled={deleteDisabled}>
                  Удалить
                </Button>
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Фабрики"
        subtitle="Каталог фабрик, адреса погрузки, email-адреса и сертификаты."
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
            <Form.Item
              name="country"
              className="crm-col-3"
              style={{ marginBottom: 0 }}
              getValueProps={(countryName?: string) => ({
                value: findCountry(countryDirectory.countries, countryName)?.id,
              })}
              getValueFromEvent={(_countryId: number | undefined, country: Country | undefined) =>
                getCountryEnglishName(country) ?? undefined
              }
            >
              <CountrySelect
                allowClear
                placeholder="Страна"
              />
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
                      <strong>
                        {formatCountryEnglishName(
                          countryDirectory.countries,
                          record.country,
                          record.country_id,
                        )}
                      </strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Город
                      <strong>{record.city ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item" style={{ gridColumn: "1 / -1" }}>
                      Основной email
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
                      Email и сертификаты
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

      {!createOpen ? (
        <>
          <Form<FactoryForm> form={createForm} style={{ display: "none" }} />
          <Form<FactoryLoadingAddressForm> form={firstLoadingAddressForm} style={{ display: "none" }} />
        </>
      ) : null}
      {!editOpen ? <Form<FactoryForm> form={editForm} style={{ display: "none" }} /> : null}
      {!resourcesOpen ? (
        <>
          <Form<FactoryEmailForm> form={emailCreateForm} style={{ display: "none" }} />
          <Form<FactoryCertificateForm> form={certificateCreateForm} style={{ display: "none" }} />
        </>
      ) : null}
      {!editOpen && !resourcesOpen ? (
        <Form<FactoryLoadingAddressForm> form={loadingAddressCreateForm} style={{ display: "none" }} />
      ) : null}
      {!emailEditOpen ? <Form<FactoryEmailForm> form={emailEditForm} style={{ display: "none" }} /> : null}
      {!certificateEditOpen ? (
        <Form<FactoryCertificateForm> form={certificateEditForm} style={{ display: "none" }} />
      ) : null}
      {!loadingAddressEditOpen ? (
        <Form<FactoryLoadingAddressForm> form={loadingAddressEditForm} style={{ display: "none" }} />
      ) : null}

      <Modal
        title="Создать фабрику"
        open={createOpen}
        destroyOnHidden
        width={920}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
          firstLoadingAddressForm.resetFields();
          setCreateLoadingAddressEnabled(false);
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<FactoryForm>
          form={createForm}
          layout="vertical"
          initialValues={{ create_loading_address: false, use_factory_root_as_loading: false }}
          onFinish={async (values) => {
            if (!values.create_loading_address) {
              createMutation.mutate(values);
              return;
            }
            const loadingAddress = await firstLoadingAddressForm.validateFields();
            createMutation.mutate({ ...values, loading_address: loadingAddress });
          }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название фабрики" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="Страна" rules={[{ required: true, message: "Выберите страну" }]}>
            <CountrySelect
              allowClear
              onChange={(countryId, country) => {
                createForm.setFieldsValue({
                  country_id: countryId,
                  country: getCountryEnglishName(country) ?? undefined,
                  city: undefined,
                });
              }}
            />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс" rules={[{ required: true, message: "Введите почтовый индекс" }]}>
            <Input autoComplete="postal-code" />
          </Form.Item>
          <Form.Item name="city" label="Город" rules={[{ required: true, message: "Введите город" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес" rules={[{ required: true, message: "Введите адрес" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="primary_email"
            label="E-mail"
            rules={[
              { required: true, message: "Введите e-mail" },
              { type: "email", message: "Введите корректный e-mail" },
            ]}
          >
            <Input type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              { required: true, message: "Введите телефон" },
              { validator: validateInternationalPhone },
            ]}
            extra="Формат: +[код][номер], от 8 до 15 цифр после +."
          >
            <Input
              autoComplete="tel"
              placeholder="+79991234567"
              onBlur={(event) => {
                createForm.setFieldValue("phone", normalizeInternationalPhone(event.target.value));
              }}
            />
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
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Адреса погрузки
            </Typography.Title>
            <Form.Item name="create_loading_address" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Switch
                checkedChildren="Добавить"
                unCheckedChildren="Позже"
                onChange={(checked) => {
                  setCreateLoadingAddressEnabled(checked);
                  createForm.setFieldValue("create_loading_address", checked);
                  if (!checked) {
                    firstLoadingAddressForm.resetFields();
                  }
                }}
              />
            </Form.Item>
            {createLoadingAddressEnabled ? (
              <Form.Item
                name="use_factory_root_as_loading"
                valuePropName="checked"
                label="Использовать основной адрес фабрики как основной адрес погрузки"
              >
                <Switch
                  onChange={(checked) => {
                    if (!checked) return;
                    copyFactoryRootToLoadingAddress(firstLoadingAddressForm, createForm.getFieldsValue());
                  }}
                />
              </Form.Item>
            ) : null}
          </div>
        </Form>
        <Form<FactoryLoadingAddressForm>
          form={firstLoadingAddressForm}
          layout="vertical"
          style={{ display: createLoadingAddressEnabled ? "block" : "none" }}
        >
            <LoadingAddressFields
              form={firstLoadingAddressForm}
              countryIdFallback={createForm.getFieldValue("country_id") as number | undefined}
              disabled={!createLoadingAddressEnabled}
            />
        </Form>
        {!createLoadingAddressEnabled ? (
          <Typography.Text type="secondary">
            Первый адрес можно добавить сразу или позже в редактировании фабрики.
          </Typography.Text>
        ) : null}
      </Modal>

      <Modal
        title={`Редактировать фабрику #${selectedFactory?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        width={1120}
        onCancel={() => {
          setEditOpen(false);
          setSelectedLoadingAddress(null);
          loadingAddressCreateForm.resetFields();
          setCopyRootToNewLoadingAddress(false);
        }}
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
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название фабрики" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="Страна" rules={[{ required: true, message: "Выберите страну" }]}>
            <CountrySelect
              allowClear
              onChange={(countryId, country) => {
                editForm.setFieldsValue({
                  country_id: countryId,
                  country: getCountryEnglishName(country) ?? undefined,
                  city: undefined,
                });
              }}
            />
          </Form.Item>
          <Form.Item name="postcode" label="Индекс" rules={[{ required: true, message: "Введите почтовый индекс" }]}>
            <Input autoComplete="postal-code" />
          </Form.Item>
          <Form.Item name="city" label="Город" rules={[{ required: true, message: "Введите город" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Адрес" rules={[{ required: true, message: "Введите адрес" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="primary_email"
            label="E-mail"
            rules={[
              { required: true, message: "Введите e-mail" },
              { type: "email", message: "Введите корректный e-mail" },
            ]}
          >
            <Input type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              { required: true, message: "Введите телефон" },
              { validator: validateInternationalPhone },
            ]}
            extra="Формат: +[код][номер], от 8 до 15 цифр после +."
          >
            <Input
              autoComplete="tel"
              placeholder="+79991234567"
              onBlur={(event) => {
                editForm.setFieldValue("phone", normalizeInternationalPhone(event.target.value));
              }}
            />
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
        <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 16, paddingTop: 16 }}>
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <div>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                Адреса погрузки
              </Typography.Title>
              <Typography.Text type="secondary">
                В справочнике показаны активные и неактивные адреса; в новых заказах доступны только активные.
              </Typography.Text>
            </div>

            <Table<FactoryLoadingAddress>
              rowKey="id"
              loading={loadingAddressesQuery.isLoading}
              columns={loadingAddressColumns}
              dataSource={loadingAddressesQuery.data?.items ?? []}
              pagination={false}
              scroll={{ x: 1380 }}
              locale={{ emptyText: "Нет адресов погрузки" }}
            />

            {canMutate ? (
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
                <Space align="center" style={{ marginBottom: 12 }}>
                  <Typography.Text strong>Добавить ещё один адрес погрузки</Typography.Text>
                  <Switch
                    checked={copyRootToNewLoadingAddress}
                    onChange={(checked) => {
                      setCopyRootToNewLoadingAddress(checked);
                      if (checked) {
                        copyFactoryRootToLoadingAddress(loadingAddressCreateForm, editForm.getFieldsValue());
                      }
                    }}
                  />
                  <Typography.Text type="secondary">Использовать основной адрес фабрики</Typography.Text>
                </Space>
                <Form<FactoryLoadingAddressForm>
                  form={loadingAddressCreateForm}
                  layout="vertical"
                  onFinish={(values) => createLoadingAddressMutation.mutate(values)}
                >
                  <LoadingAddressFields
                    form={loadingAddressCreateForm}
                    countryIdFallback={selectedFactory?.country_id ?? undefined}
                  />
                  <Button type="primary" htmlType="submit" loading={createLoadingAddressMutation.isPending}>
                    Добавить ещё один адрес погрузки
                  </Button>
                </Form>
              </div>
            ) : null}
          </Space>
        </div>
      </Modal>

      <Modal
        title={`Email и сертификаты фабрики #${selectedFactory?.id ?? ""} — ${selectedFactory?.name ?? ""}`}
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
              label: "Email-адреса",
              children: (
                <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                  {canMutate ? (
                    <Form<FactoryEmailForm>
                      form={emailCreateForm}
                      layout="inline"
                      onFinish={(values) => createEmailMutation.mutate({ ...values, is_primary: Boolean(values.is_primary) })}
                    >
                      <Form.Item name="email" rules={[{ required: true, message: "Введите email" }]}>
                        <Input placeholder="Email" style={{ width: 280 }} />
                      </Form.Item>
                      <Form.Item name="is_primary" label="Основной" valuePropName="checked" initialValue={false}>
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
                <Space orientation="vertical" style={{ width: "100%" }} size={12}>
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
          <Form.Item name="is_primary" label="Основной" valuePropName="checked">
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
        width={920}
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
          <LoadingAddressFields form={loadingAddressEditForm} includeActive />
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
