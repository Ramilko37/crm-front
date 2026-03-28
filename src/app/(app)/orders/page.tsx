"use client";

import {
  ApartmentOutlined,
  EditOutlined,
  MessageOutlined,
  MoreOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dropdown,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  ORDER_STATUS_VALUES,
  ORDER_TYPE_VALUES,
  QUOTE_STATUS_VALUES,
  type OrderStatus,
  type OrderType,
  type QuoteStatus,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { toOrderWritePayload } from "@/shared/lib/order-dto";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { FilterPanel, PageToolbar } from "@/shared/ui/page-frame";
import type {
  BulkMutationResponse,
  ClientFactoryDetail,
  ClientFactoryListItem,
  Factory,
  FactoryLoadingAddress,
  OrderDetail,
  OrderFilterParams,
  OrderListItem,
  OrderWritePayload,
  PaginatedResponse,
  Trip,
  UserAdmin,
} from "@/shared/types/entities";

type OrderCreateForm = {
  order_number: string;
  company_id?: number;
  contact_user_id?: number;
  ready_date: dayjs.Dayjs;
  order_type?: OrderType;
  factory_id: number;
  loading_address_id: number;
  additional_description?: string;
  invoice_number?: string;
  comment?: string;
};

type OrderEditForm = {
  order_number?: string;
  trip_id?: number;
  comment?: string;
  status_name?: OrderStatus;
};

type OrderBulkEndpoint =
  | "status"
  | "assign-trip"
  | "archive"
  | "delete"
  | "warehouse-comment"
  | "forwarder-comment"
  | "pickup-date"
  | "cancel-pickup"
  | "special-tariff";

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

function renderOrderStatus(value: OrderStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }
  return <Tag className="crm-status-tag">{formatEnumCode(value)}</Tag>;
}

function getParams(searchParams: URLSearchParams): OrderFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    id: parseNumber(searchParams.get("id")),
    query: searchParams.get("query") ?? undefined,
    quick_tab: searchParams.get("quick_tab") ?? undefined,
    status_names: parseSearchArray(searchParams, "status_names") as OrderStatus[],
    order_types: parseSearchArray(searchParams, "order_types") as OrderType[],
    quote_statuses: parseSearchArray(searchParams, "quote_statuses") as QuoteStatus[],
    priority_codes: parseSearchArray(searchParams, "priority_codes"),
    office_mark_codes: parseSearchArray(searchParams, "office_mark_codes"),
    document_type: searchParams.get("document_type") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    user_id: parseNumber(searchParams.get("user_id")),
    company_id: parseNumber(searchParams.get("company_id")),
    personal_manager_id: parseNumber(searchParams.get("personal_manager_id")),
    assigned_forwarder_user_id: parseNumber(searchParams.get("assigned_forwarder_user_id")),
    factory_id: parseNumber(searchParams.get("factory_id")),
    trip_id: parseNumber(searchParams.get("trip_id")),
    has_mrn: parseBool(searchParams.get("has_mrn")),
    has_certificate: parseBool(searchParams.get("has_certificate")),
    has_documents: parseBool(searchParams.get("has_documents")),
    is_checked: parseBool(searchParams.get("is_checked")),
    order_date_from: searchParams.get("order_date_from") ?? undefined,
    order_date_to: searchParams.get("order_date_to") ?? undefined,
  };
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const isClientRole = normalizedRole === "client" && !meQuery.data?.is_superuser;
  const canWriteOrder =
    meQuery.data?.is_superuser ||
    ["administrator", "manager", "logist", "accountant", "warehouse"].includes(normalizedRole);
  const canCreate =
    isClientRole ||
    meQuery.data?.is_superuser ||
    ["administrator", "manager", "logist", "forwarder"].includes(normalizedRole);
  const canRunOperationalActions =
    meQuery.data?.is_superuser || ["administrator", "manager", "logist"].includes(normalizedRole);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForwarderOpen, setAssignForwarderOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [specialTariffOpen, setSpecialTariffOpen] = useState(false);
  const [requestToFactoryOpen, setRequestToFactoryOpen] = useState(false);
  const [quotePriceOpen, setQuotePriceOpen] = useState(false);
  const [quoteDecisionOpen, setQuoteDecisionOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkPickupOpen, setBulkPickupOpen] = useState(false);
  const [bulkSpecialTariffOpen, setBulkSpecialTariffOpen] = useState(false);
  const [bulkCommentOpen, setBulkCommentOpen] = useState(false);
  const [bulkCommentTarget, setBulkCommentTarget] = useState<"warehouse" | "forwarder">("warehouse");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const [createForm] = Form.useForm<OrderCreateForm>();
  const [editForm] = Form.useForm<OrderEditForm>();
  const [statusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();
  const [assignForwarderForm] = Form.useForm<{ assigned_forwarder_user_id?: number }>();
  const [pickupForm] = Form.useForm<{ pickup_date: dayjs.Dayjs }>();
  const [specialTariffForm] = Form.useForm<{ amount?: number | null; currency?: string }>();
  const [requestToFactoryForm] = Form.useForm<{ comment?: string; template_id?: number }>();
  const [quotePriceForm] = Form.useForm<{ amount: number; currency?: string }>();
  const [quoteDecisionForm] = Form.useForm<{ decision: "agree" | "decline" | "request_again" }>();
  const [filterForm] = Form.useForm<{
    id?: number;
    query?: string;
    country?: string;
    status_names?: OrderStatus[];
    order_types?: OrderType[];
    quote_statuses?: QuoteStatus[];
    user_id?: number;
    company_id?: number;
    personal_manager_id?: number;
    assigned_forwarder_user_id?: number;
    factory_id?: number;
    trip_id?: number;
    order_date_from?: dayjs.Dayjs;
    order_date_to?: dayjs.Dayjs;
    has_certificate?: boolean;
    has_documents?: boolean;
    is_checked?: boolean;
    document_type?: string;
    priority_codes?: string[];
    office_mark_codes?: string[];
  }>();
  const [bulkStatusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [bulkAssignForm] = Form.useForm<{ trip_id?: number }>();
  const [bulkPickupForm] = Form.useForm<{ pickup_date: dayjs.Dayjs }>();
  const [bulkSpecialTariffForm] = Form.useForm<{ amount?: number | null; currency?: string }>();
  const [bulkCommentForm] = Form.useForm<{ comment: string }>();
  const createFactoryId = Form.useWatch("factory_id", createForm);
  const createLoadingAddressId = Form.useWatch("loading_address_id", createForm);

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const hasActiveFilters = Boolean(
    params.id ||
      params.query ||
      params.country ||
      params.document_type ||
      (params.status_names?.length ?? 0) > 0 ||
      (params.order_types?.length ?? 0) > 0 ||
      (params.quote_statuses?.length ?? 0) > 0 ||
      (params.priority_codes?.length ?? 0) > 0 ||
      (params.office_mark_codes?.length ?? 0) > 0,
  );
  const [filtersOpen, setFiltersOpen] = useState(() => hasActiveFilters);

  useEffect(() => {
    filterForm.setFieldsValue({
      id: params.id,
      query: params.query,
      country: params.country,
      status_names: params.status_names?.length ? params.status_names : undefined,
      order_types: params.order_types?.length ? params.order_types : undefined,
      quote_statuses: params.quote_statuses?.length ? params.quote_statuses : undefined,
      user_id: params.user_id,
      company_id: params.company_id,
      personal_manager_id: params.personal_manager_id,
      assigned_forwarder_user_id: params.assigned_forwarder_user_id,
      factory_id: params.factory_id,
      trip_id: params.trip_id,
      order_date_from: params.order_date_from ? dayjs(params.order_date_from) : undefined,
      order_date_to: params.order_date_to ? dayjs(params.order_date_to) : undefined,
      has_certificate: params.has_certificate,
      has_documents: params.has_documents,
      is_checked: params.is_checked,
      document_type: params.document_type,
      priority_codes: params.priority_codes?.length ? params.priority_codes : undefined,
      office_mark_codes: params.office_mark_codes?.length ? params.office_mark_codes : undefined,
    });
  }, [filterForm, params]);

  const listQuery = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderListItem>>("/api/orders", {
        query: params,
      }),
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const forwardersQuery = useQuery({
    queryKey: queryKeys.users.list({ page: 1, page_size: 200, role_name: "forwarder" }),
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin>>("/api/users", {
        query: { page: 1, page_size: 200, role_name: "forwarder" },
      }),
    enabled: canRunOperationalActions,
  });

  const factoryOptionsQuery = useQuery({
    queryKey: [isClientRole ? "client-factories" : "factories", "order-create-options"],
    queryFn: async () => {
      if (isClientRole) {
        const response = await apiRequest<PaginatedResponse<ClientFactoryListItem>>("/api/client/factories", {
          query: { page: 1, page_size: 200, sort_desc: false },
        });
        return response.items.map((factory) => ({
          id: factory.id,
          name: factory.name,
          subtitle: [factory.country, factory.city].filter(Boolean).join(", "),
        }));
      }

      const response = await apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200, sort_desc: false },
      });
      return response.items.map((factory) => ({
        id: factory.id,
        name: factory.name,
        subtitle: [factory.country, factory.city].filter(Boolean).join(", "),
      }));
    },
    enabled: createOpen && canCreate,
  });

  const loadingAddressesQuery = useQuery({
    queryKey: ["orders", "create-loading-addresses", isClientRole, createFactoryId],
    queryFn: async () => {
      if (!createFactoryId) {
        return [] as FactoryLoadingAddress[];
      }

      if (isClientRole) {
        const detail = await apiRequest<ClientFactoryDetail>(`/api/client/factories/${createFactoryId}`);
        return detail.loading_addresses;
      }

      const response = await apiRequest<PaginatedResponse<FactoryLoadingAddress>>(
        `/api/factories/${createFactoryId}/loading-addresses`,
        {
          query: { page: 1, page_size: 200 },
        },
      );
      return response.items;
    },
    enabled: createOpen && Boolean(createFactoryId) && canCreate,
  });

  useEffect(() => {
    if (!createOpen || !createFactoryId) {
      return;
    }

    const addresses = loadingAddressesQuery.data ?? [];
    if (!addresses.length) {
      createForm.setFieldValue("loading_address_id", undefined);
      return;
    }

    const stillValid = addresses.some((address) => address.id === createLoadingAddressId);
    if (stillValid) {
      return;
    }

    const primaryAddress = addresses.find((address) => address.is_primary) ?? addresses[0];
    createForm.setFieldValue("loading_address_id", primaryAddress.id);
  }, [createFactoryId, createForm, createLoadingAddressId, createOpen, loadingAddressesQuery.data]);

  function invalidateOrdersQueries(orderId?: number) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      orderId ? queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) }) : Promise.resolve(),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: async (payload: OrderCreateForm) => {
      const ready_date = payload.ready_date.format("YYYY-MM-DD");

      if (isClientRole) {
        return apiRequest<OrderDetail>("/api/client/orders", {
          method: "POST",
          body: {
            order_number: payload.order_number,
            ready_date,
            factory_id: payload.factory_id,
            loading_address_id: payload.loading_address_id,
            additional_description: payload.additional_description,
            comment: payload.comment,
            invoice_number: payload.invoice_number,
          },
        });
      }

      return apiRequest<OrderDetail>("/api/orders", {
        method: "POST",
        body: {
          order_number: payload.order_number,
          company_id: payload.company_id,
          contact_user_id: payload.contact_user_id,
          ready_date,
          order_type: payload.order_type ?? "delivery",
          factory_id: payload.factory_id,
          loading_address_id: payload.loading_address_id,
          additional_description: payload.additional_description,
          comment: payload.comment,
          invoice_number: payload.invoice_number,
        },
      });
    },
    onSuccess: async () => {
      message.success("Заказ создан");
      setCreateOpen(false);
      createForm.resetFields();
      await invalidateOrdersQueries();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания заказа");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OrderEditForm }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}`, {
        method: "PATCH",
        body: toOrderWritePayload(payload as OrderWritePayload),
      }),
    onSuccess: async (_, values) => {
      message.success("Заказ обновлен");
      setEditOpen(false);
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления заказа");
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status_name, status_date }: { id: number; status_name: OrderStatus; status_date?: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/status`, {
        method: "POST",
        body: {
          status_name,
          status_date,
        },
      }),
    onSuccess: async (_, values) => {
      message.success("Статус обновлен");
      setStatusOpen(false);
      statusForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления статуса");
    },
  });

  const assignTripMutation = useMutation({
    mutationFn: ({ id, trip_id }: { id: number; trip_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/assign-trip`, {
        method: "POST",
        body: { trip_id: trip_id ?? null },
      }),
    onSuccess: async (_, values) => {
      message.success("Рейс назначен");
      setAssignOpen(false);
      assignForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения рейса");
    },
  });

  const assignForwarderMutation = useMutation({
    mutationFn: ({ id, assigned_forwarder_user_id }: { id: number; assigned_forwarder_user_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/assign-forwarder`, {
        method: "POST",
        body: { assigned_forwarder_user_id: assigned_forwarder_user_id ?? null },
      }),
    onSuccess: async (_, values) => {
      message.success("Экспедитор назначен");
      setAssignForwarderOpen(false);
      assignForwarderForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения экспедитора");
    },
  });

  const pickupDateMutation = useMutation({
    mutationFn: ({ id, pickup_date }: { id: number; pickup_date: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/pickup-date`, {
        method: "POST",
        body: { pickup_date },
      }),
    onSuccess: async (_, values) => {
      message.success("Дата вывоза назначена");
      setPickupOpen(false);
      pickupForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения даты вывоза");
    },
  });

  const cancelPickupMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/cancel-pickup`, {
        method: "POST",
      }),
    onSuccess: async (_, values) => {
      message.success("Дата вывоза отменена");
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка отмены вывоза");
    },
  });

  const specialTariffMutation = useMutation({
    mutationFn: ({ id, amount, currency }: { id: number; amount?: number | null; currency: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/special-tariff`, {
        method: "POST",
        body: {
          amount: amount ?? null,
          currency,
        },
      }),
    onSuccess: async (_, values) => {
      message.success("Спецтариф обновлен");
      setSpecialTariffOpen(false);
      specialTariffForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка спецтарифа");
    },
  });

  const requestToFactoryMutation = useMutation({
    mutationFn: ({ id, comment, template_id }: { id: number; comment?: string; template_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/request-to-factory`, {
        method: "POST",
        body: {
          comment: comment ?? null,
          template_id: template_id ?? null,
        },
      }),
    onSuccess: async (_, values) => {
      message.success("Запрос на фабрику отправлен");
      setRequestToFactoryOpen(false);
      requestToFactoryForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка отправки запроса");
    },
  });

  const quotePriceMutation = useMutation({
    mutationFn: ({ id, amount, currency }: { id: number; amount: number; currency?: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/quote-price`, {
        method: "POST",
        body: {
          amount,
          currency: currency || "EUR",
        },
      }),
    onSuccess: async (_, values) => {
      message.success("Цена квоты обновлена");
      setQuotePriceOpen(false);
      quotePriceForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления цены квоты");
    },
  });

  const quoteDecisionMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "agree" | "decline" | "request_again" }) =>
      apiRequest<OrderDetail>(`/api/orders/${id}/quote-decision`, {
        method: "POST",
        body: { decision },
      }),
    onSuccess: async (_, values) => {
      message.success("Решение по квоте отправлено");
      setQuoteDecisionOpen(false);
      quoteDecisionForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка отправки решения по квоте");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: OrderBulkEndpoint; body: Record<string, unknown> }) =>
      apiRequest<BulkMutationResponse<OrderListItem>>(`/api/orders/bulk/${endpoint}`, {
        method: "POST",
        body,
      }),
    onSuccess: async (payload) => {
      message.success(`Операция выполнена. Обновлено: ${payload.updated_count}`);
      setBulkStatusOpen(false);
      setBulkAssignOpen(false);
      setBulkPickupOpen(false);
      setBulkSpecialTariffOpen(false);
      setBulkCommentOpen(false);
      bulkStatusForm.resetFields();
      bulkAssignForm.resetFields();
      bulkPickupForm.resetFields();
      bulkSpecialTariffForm.resetFields();
      bulkCommentForm.resetFields();
      setSelectedRowKeys([]);
      await invalidateOrdersQueries();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка массовой операции");
    },
  });

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/orders${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function openEdit(record: OrderListItem) {
    setSelected(record);
    editForm.setFieldsValue({
      order_number: record.order_number,
      comment: record.comment ?? undefined,
      status_name: record.status_name ?? undefined,
      trip_id: record.trip_id ?? undefined,
    });
    setEditOpen(true);
  }

  function openStatus(record: OrderListItem) {
    setSelected(record);
    statusForm.setFieldsValue({
      status_name: record.status_name ?? undefined,
      status_date: record.status_date ? dayjs(record.status_date) : undefined,
    });
    setStatusOpen(true);
  }

  function openAssign(record: OrderListItem) {
    setSelected(record);
    assignForm.setFieldsValue({ trip_id: record.trip_id ?? undefined });
    setAssignOpen(true);
  }

  function openAssignForwarder(record: OrderListItem) {
    setSelected(record);
    assignForwarderForm.setFieldsValue({ assigned_forwarder_user_id: record.assigned_forwarder_user_id ?? undefined });
    setAssignForwarderOpen(true);
  }

  function openPickup(record: OrderListItem) {
    setSelected(record);
    pickupForm.setFieldsValue({ pickup_date: record.pickup_date ? dayjs(record.pickup_date) : undefined });
    setPickupOpen(true);
  }

  function openSpecialTariff(record: OrderListItem) {
    setSelected(record);
    specialTariffForm.setFieldsValue({
      amount: record.special_tariff_amount ? Number(record.special_tariff_amount) : undefined,
      currency: record.special_tariff_currency ?? "EUR",
    });
    setSpecialTariffOpen(true);
  }

  function openRequestToFactory(record: OrderListItem) {
    setSelected(record);
    requestToFactoryForm.resetFields();
    setRequestToFactoryOpen(true);
  }

  function openQuotePrice(record: OrderListItem) {
    setSelected(record);
    quotePriceForm.setFieldsValue({
      amount: record.quote_price_amount ? Number(record.quote_price_amount) : undefined,
      currency: record.quote_price_currency ?? "EUR",
    });
    setQuotePriceOpen(true);
  }

  function openQuoteDecision(record: OrderListItem) {
    setSelected(record);
    quoteDecisionForm.setFieldValue("decision", "agree");
    setQuoteDecisionOpen(true);
  }

  function runBulkMutation(endpoint: OrderBulkEndpoint, body: Record<string, unknown>) {
    bulkMutation.mutate({
      endpoint,
      body: {
        order_ids: selectedRowKeys,
        ...body,
      },
    });
  }

  function askBulkConfirm(title: string, content: string, onOk: () => void) {
    Modal.confirm({
      title,
      content,
      okText: "Подтвердить",
      cancelText: "Отмена",
      onOk,
    });
  }

  function runBulkAction(action: () => void) {
    if (!selectedRowKeys.length) {
      message.warning("Сначала выберите заказы в таблице");
      return;
    }
    action();
  }

  function orderActions(record: OrderListItem) {
    const actions = [] as Array<{ key: string; label: string; icon?: React.ReactNode; onClick: () => void }>;

    if (canWriteOrder) {
      actions.push(
        {
          key: "edit",
          label: "Редактировать",
          icon: <EditOutlined />,
          onClick: () => openEdit(record),
        },
        {
          key: "status",
          label: "Изменить статус",
          icon: <SwapOutlined />,
          onClick: () => openStatus(record),
        },
        {
          key: "assign",
          label: "Назначить рейс",
          icon: <ApartmentOutlined />,
          onClick: () => openAssign(record),
        },
      );
    }

    if (canRunOperationalActions) {
      actions.push(
        {
          key: "assign-forwarder",
          label: "Назначить экспедитора",
          icon: <ApartmentOutlined />,
          onClick: () => openAssignForwarder(record),
        },
        {
          key: "pickup-date",
          label: "Назначить дату вывоза",
          icon: <SwapOutlined />,
          onClick: () => openPickup(record),
        },
        {
          key: "special-tariff",
          label: "Спецтариф",
          icon: <SwapOutlined />,
          onClick: () => openSpecialTariff(record),
        },
        {
          key: "request-to-factory",
          label: "Запрос на фабрику",
          icon: <MessageOutlined />,
          onClick: () => openRequestToFactory(record),
        },
      );

      if (record.pickup_date) {
        actions.push({
          key: "cancel-pickup",
          label: "Отменить вывоз",
          icon: <SwapOutlined />,
          onClick: () => {
            cancelPickupMutation.mutate({ id: record.id });
          },
        });
      }
    }

    if (
      (meQuery.data?.is_superuser || normalizedRole === "administrator" || normalizedRole === "manager") &&
      record.order_type === "quote_request"
    ) {
      actions.push({
        key: "quote-price",
        label: "Выставить цену",
        icon: <SwapOutlined />,
        onClick: () => openQuotePrice(record),
      });
    }

    if (isClientRole && record.order_type === "quote_request" && record.quote_status === "priced_waiting_client") {
      actions.push({
        key: "quote-decision",
        label: "Решение по квоте",
        icon: <SwapOutlined />,
        onClick: () => openQuoteDecision(record),
      });
    }

    return actions;
  }

  const columns: ColumnsType<OrderListItem> = [
    {
      title: "Id",
      dataIndex: "id",
      key: "id",
      sorter: true,
      sortOrder: sortOrderFor("id"),
      width: 84,
    },
    {
      title: "#",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      sortOrder: sortOrderFor("order_number"),
      width: 180,
      render: (value: string, record) => <Link href={`/orders/${record.id}`}>{value}</Link>,
    },
    {
      title: "Компания",
      dataIndex: "company_name",
      key: "company_name",
      width: 180,
      render: (value: string | null | undefined, record) => value || (record.company_id ? `ID ${record.company_id}` : "-"),
    },
    {
      title: "Фабрика",
      dataIndex: "factory_name",
      key: "factory_name",
      width: 180,
      render: (value: string | null | undefined, record) => value || `ID ${record.factory_id}`,
    },
    {
      title: "Рейс",
      dataIndex: "trip_name",
      key: "trip_name",
      width: 170,
      render: (value: string | null | undefined, record) => value || (record.trip_id ? `ID ${record.trip_id}` : "-"),
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (value: OrderStatus | null) => renderOrderStatus(value),
      width: 190,
    },
    {
      title: "Тип",
      dataIndex: "order_type",
      key: "order_type",
      width: 150,
      render: (value: OrderType | null) => (value ? formatEnumCode(value) : "-"),
    },
    {
      title: "Квота",
      dataIndex: "quote_status",
      key: "quote_status",
      width: 160,
      render: (value: QuoteStatus | null) => (value ? formatEnumCode(value) : "-"),
    },
    {
      title: "Готовность",
      dataIndex: "ready_date",
      key: "ready_date",
      sorter: true,
      sortOrder: sortOrderFor("ready_date"),
      width: 130,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "Вывоз",
      dataIndex: "pickup_date",
      key: "pickup_date",
      sorter: true,
      sortOrder: sortOrderFor("pickup_date"),
      width: 120,
      render: (value: string | null | undefined) => value ?? "-",
    },
    {
      title: "Флаги",
      key: "flags",
      width: 230,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.has_documents ? <Tag color="blue">Док.</Tag> : null}
          {record.has_certificate ? <Tag color="green">Серт.</Tag> : null}
          {record.has_description ? <Tag color="gold">Описание</Tag> : null}
          {record.is_checked ? <Tag color="purple">Проверен</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Теги",
      key: "tags",
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          {(record.priority_tags ?? []).slice(0, 2).map((tag) => (
            <Tag key={`p-${tag.code}`} color="red">
              {tag.label}
            </Tag>
          ))}
          {(record.office_mark_tags ?? []).slice(0, 2).map((tag) => (
            <Tag key={`o-${tag.code}`} color="orange">
              {tag.label}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Коэф. цены",
      dataIndex: "price_coefficient",
      key: "price_coefficient",
      width: 130,
      render: (value: string | number | null | undefined) => (value ?? "-") as React.ReactNode,
    },
    {
      title: "Действия",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => router.push(`/orders/${record.id}`)}>
            Открыть
          </Button>
          {orderActions(record).length ? (
            <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          ) : null}
        </Space>
      ),
    },
  ];

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

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;
  const quickTabs = listQuery.data?.meta.quick_tabs ?? [
    { code: "all", label: "Все", count: totalRows, is_active: !params.quick_tab || params.quick_tab === "all" },
  ];

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтр"
        search={
          <Input.Search
            key={params.query ?? "orders-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск (номер, инвойс, фабрика, компания, комментарий)"
            defaultValue={params.query}
            onSearch={(value) => {
              applySearchPatch({
                query: value || null,
                page: 1,
              });
            }}
          />
        }
        actions={
          canCreate ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              + Новый заказ
            </Button>
          ) : null
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          onFinish={(values) => {
            applySearchPatch({
              id: values.id,
              query: values.query,
              country: values.country,
              status_names: values.status_names,
              order_types: values.order_types,
              quote_statuses: values.quote_statuses,
              user_id: values.user_id,
              company_id: values.company_id,
              personal_manager_id: values.personal_manager_id,
              assigned_forwarder_user_id: values.assigned_forwarder_user_id,
              factory_id: values.factory_id,
              trip_id: values.trip_id,
              order_date_from: values.order_date_from?.format("YYYY-MM-DD"),
              order_date_to: values.order_date_to?.format("YYYY-MM-DD"),
              has_certificate: values.has_certificate,
              has_documents: values.has_documents,
              is_checked: values.is_checked,
              document_type: values.document_type,
              priority_codes: values.priority_codes,
              office_mark_codes: values.office_mark_codes,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="ID" />
            </Form.Item>
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
            <Form.Item name="country" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Input placeholder="Страна" allowClear />
            </Form.Item>
            <Form.Item name="status_names" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статусы"
                options={ORDER_STATUS_VALUES.map((status) => ({
                  label: formatEnumCode(status),
                  value: status,
                }))}
              />
            </Form.Item>
            <Form.Item name="order_types" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Тип заказа"
                options={ORDER_TYPE_VALUES.map((orderType) => ({
                  label: formatEnumCode(orderType),
                  value: orderType,
                }))}
              />
            </Form.Item>
            <Form.Item name="quote_statuses" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статус квоты"
                options={QUOTE_STATUS_VALUES.map((quoteStatus) => ({
                  label: formatEnumCode(quoteStatus),
                  value: quoteStatus,
                }))}
              />
            </Form.Item>
            <Form.Item name="user_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Клиент ID" />
            </Form.Item>
            <Form.Item name="company_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Компания ID" />
            </Form.Item>
            <Form.Item name="personal_manager_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Менеджер ID" />
            </Form.Item>
            <Form.Item name="assigned_forwarder_user_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Экспедитор ID" />
            </Form.Item>
            <Form.Item name="factory_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Фабрика ID" />
            </Form.Item>
            <Form.Item name="trip_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Рейс ID" />
            </Form.Item>
            <Form.Item name="document_type" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Input placeholder="Тип документа" allowClear />
            </Form.Item>
            <Form.Item name="priority_codes" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select mode="tags" allowClear placeholder="Приоритеты" />
            </Form.Item>
            <Form.Item name="office_mark_codes" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select mode="tags" allowClear placeholder="Отметки офиса" />
            </Form.Item>
            <Form.Item name="order_date_from" className="crm-col-3" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан от" />
            </Form.Item>
            <Form.Item name="order_date_to" className="crm-col-3" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан до" />
            </Form.Item>
            <Form.Item name="has_certificate" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Сертификат"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="has_documents" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Документы"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="is_checked" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Проверен"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
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
                router.replace("/orders");
                setFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </FilterPanel>

      <Card className="crm-panel crm-status-tabs-bar">
        <div className="crm-status-tabs-wrap">
          {quickTabs.map((tab) => {
            const isActive = params.quick_tab ? params.quick_tab === tab.code : tab.code === "all";
            return (
              <Button
                key={tab.code}
                size="small"
                type={isActive ? "primary" : "default"}
                onClick={() => {
                  applySearchPatch({
                    quick_tab: tab.code === "all" ? null : tab.code,
                    page: 1,
                  });
                }}
              >
                {tab.label} ({tab.count})
              </Button>
            );
          })}
        </div>
      </Card>

      {canWriteOrder ? (
        <Card className="crm-panel crm-actions-strip-bar">
          <div className="crm-actions-strip">
            <Typography.Text type="secondary">Выбрано: {selectedRowKeys.length}</Typography.Text>
            <Button type="text" onClick={() => runBulkAction(() => setBulkStatusOpen(true))}>
              Изменить статус
            </Button>
            <Button type="text" onClick={() => runBulkAction(() => setBulkAssignOpen(true))}>
              Назначить рейс
            </Button>
            <Button type="text" onClick={() => runBulkAction(() => setBulkPickupOpen(true))}>
              Назначить дату вывоза
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  askBulkConfirm(
                    "Отменить вывоз у выбранных заказов",
                    "Дата вывоза будет очищена. Продолжить?",
                    () => runBulkMutation("cancel-pickup", {}),
                  );
                })
              }
            >
              Отменить вывоз
            </Button>
            <Button type="text" onClick={() => runBulkAction(() => setBulkSpecialTariffOpen(true))}>
              Спецтариф
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  setBulkCommentTarget("warehouse");
                  setBulkCommentOpen(true);
                })
              }
            >
              Комментарий склада
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  setBulkCommentTarget("forwarder");
                  setBulkCommentOpen(true);
                })
              }
            >
              Комментарий экспедитора
            </Button>
            <Button
              type="text"
              onClick={() =>
                runBulkAction(() => {
                  askBulkConfirm(
                    "Архивировать выбранные заказы",
                    "Заказы получат статус archived. Продолжить?",
                    () => runBulkMutation("archive", {}),
                  );
                })
              }
            >
              Архивировать
            </Button>
            <Button
              type="text"
              danger
              onClick={() =>
                runBulkAction(() => {
                  askBulkConfirm(
                    "Удалить выбранные заказы",
                    "Это soft-delete через статус deleted. Продолжить?",
                    () => runBulkMutation("delete", {}),
                  );
                })
              }
            >
              Удалить
            </Button>
            <Button type="text" onClick={() => setSelectedRowKeys([])}>
              Снять выделение
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки заказов"}
          </Typography.Text>
        ) : null}

        {isMobile ? (
          <>
            <div className="crm-mobile-list">
              {rows.map((record) => (
                <article key={record.id} className="crm-row-card">
                  <div className="crm-row-card-head">
                    <div>
                      {canWriteOrder ? (
                        <Checkbox
                          checked={selectedRowKeys.includes(record.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedRowKeys((current) => (current.includes(record.id) ? current : [...current, record.id]));
                            } else {
                              setSelectedRowKeys((current) => current.filter((item) => item !== record.id));
                            }
                          }}
                          style={{ marginBottom: 8 }}
                        >
                          Выбрать
                        </Checkbox>
                      ) : null}
                      <Link href={`/orders/${record.id}`} className="crm-row-title">
                        {record.order_number}
                      </Link>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderOrderStatus(record.status_name)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Компания
                      <strong>{record.company_name ?? record.company_id ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Фабрика
                      <strong>{record.factory_name ?? record.factory_id}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Рейс
                      <strong>{record.trip_name ?? record.trip_id ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Готовность
                      <strong>{record.ready_date ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Вывоз
                      <strong>{record.pickup_date ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Тип
                      <strong>{record.order_type ? formatEnumCode(record.order_type) : "-"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    <Button size="small" type="primary" ghost onClick={() => router.push(`/orders/${record.id}`)}>
                      Открыть
                    </Button>
                    {orderActions(record).length ? (
                      <Dropdown trigger={["click"]} menu={{ items: orderActions(record) }}>
                        <Button size="small" icon={<MoreOutlined />}>
                          Действия
                        </Button>
                      </Dropdown>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {!listQuery.isLoading && rows.length === 0 ? <Typography.Text type="secondary">Нет данных</Typography.Text> : null}

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
          <Table<OrderListItem>
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            rowSelection={
              canWriteOrder
                ? {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }
                : undefined
            }
            scroll={{ x: 2800 }}
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
        title={isClientRole ? "Создать заказ (клиентский контур)" : "Создать заказ"}
        open={createOpen}
        destroyOnHidden
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<OrderCreateForm>
          form={createForm}
          layout="vertical"
          initialValues={{
            order_type: "delivery",
          }}
          onFinish={(values) => {
            const addresses = loadingAddressesQuery.data ?? [];
            if (!addresses.length) {
              message.error("Для выбранной фабрики нет доступных адресов загрузки");
              return;
            }
            createMutation.mutate(values);
          }}
        >
          <Form.Item name="order_number" label="Номер заказа" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!isClientRole ? (
            <Form.Item name="company_id" label="ID компании" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          {!isClientRole ? (
            <Form.Item name="contact_user_id" label="ID контактного пользователя">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          <Form.Item name="ready_date" label="Дата готовности" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          {!isClientRole ? (
            <Form.Item name="order_type" label="Тип заказа" rules={[{ required: true }]}>
              <Select
                options={ORDER_TYPE_VALUES.filter((value) => value !== "request").map((orderType) => ({
                  label: formatEnumCode(orderType),
                  value: orderType,
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="factory_id" label="Фабрика" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={factoryOptionsQuery.isLoading}
              options={(factoryOptionsQuery.data ?? []).map((factory) => ({
                label: factory.subtitle ? `${factory.name} (${factory.subtitle})` : factory.name,
                value: factory.id,
              }))}
              onChange={() => createForm.setFieldValue("loading_address_id", undefined)}
            />
          </Form.Item>
          <Form.Item name="loading_address_id" label="Адрес загрузки" rules={[{ required: true }]}>
            <Select
              loading={loadingAddressesQuery.isLoading}
              disabled={!createFactoryId}
              options={(loadingAddressesQuery.data ?? []).map((address) => ({
                label: `${address.city ?? "-"}, ${address.address ?? "-"}${address.is_primary ? " (Primary)" : ""}`,
                value: address.id,
              }))}
              notFoundContent={createFactoryId ? "Нет адресов загрузки" : "Сначала выберите фабрику"}
            />
          </Form.Item>
          <Form.Item name="invoice_number" label="Инвойс / проформа">
            <Input />
          </Form.Item>
          <Form.Item name="additional_description" label="Описание груза" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
          {loadingAddressesQuery.data?.length ? (
            <Typography.Text type="secondary">
              Доступно адресов загрузки: {loadingAddressesQuery.data.length}
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={selected ? `Редактировать заказ #${selected.id}` : "Редактировать заказ"}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<OrderEditForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <Form.Item name="order_number" label="Номер заказа">
            <Input />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Изменить статус #${selected.id}` : "Изменить статус"}
        open={statusOpen}
        destroyOnHidden
        onCancel={() => setStatusOpen(false)}
        onOk={() => statusForm.submit()}
        confirmLoading={changeStatusMutation.isPending}
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={(values: { status_name: OrderStatus; status_date?: dayjs.Dayjs }) => {
            if (!selected) return;
            changeStatusMutation.mutate({
              id: selected.id,
              status_name: values.status_name,
              status_date: values.status_date?.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}>
            <Select
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item name="status_date" label="Дата статуса">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Назначить рейс #${selected.id}` : "Назначить рейс"}
        open={assignOpen}
        destroyOnHidden
        onCancel={() => setAssignOpen(false)}
        onOk={() => assignForm.submit()}
        confirmLoading={assignTripMutation.isPending}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values: { trip_id?: number }) => {
            if (!selected) return;
            assignTripMutation.mutate({
              id: selected.id,
              trip_id: values.trip_id,
            });
          }}
        >
          <Form.Item name="trip_id" label="Рейс">
            <Select
              allowClear
              loading={tripsQuery.isLoading}
              options={(tripsQuery.data?.items ?? []).map((trip) => ({
                label: `${trip.id} - ${trip.name}`,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Назначить экспедитора #${selected.id}` : "Назначить экспедитора"}
        open={assignForwarderOpen}
        destroyOnHidden
        onCancel={() => setAssignForwarderOpen(false)}
        onOk={() => assignForwarderForm.submit()}
        confirmLoading={assignForwarderMutation.isPending}
      >
        <Form
          form={assignForwarderForm}
          layout="vertical"
          onFinish={(values: { assigned_forwarder_user_id?: number }) => {
            if (!selected) return;
            assignForwarderMutation.mutate({
              id: selected.id,
              assigned_forwarder_user_id: values.assigned_forwarder_user_id,
            });
          }}
        >
          <Form.Item name="assigned_forwarder_user_id" label="Экспедитор">
            <Select
              allowClear
              loading={forwardersQuery.isLoading}
              options={(forwardersQuery.data?.items ?? []).map((user) => ({
                label: `${user.id} - ${user.full_name || user.login}`,
                value: user.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Назначить дату вывоза #${selected.id}` : "Назначить дату вывоза"}
        open={pickupOpen}
        destroyOnHidden
        onCancel={() => setPickupOpen(false)}
        onOk={() => pickupForm.submit()}
        confirmLoading={pickupDateMutation.isPending}
      >
        <Form
          form={pickupForm}
          layout="vertical"
          onFinish={(values: { pickup_date: dayjs.Dayjs }) => {
            if (!selected) return;
            pickupDateMutation.mutate({
              id: selected.id,
              pickup_date: values.pickup_date.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="pickup_date" label="Дата вывоза" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Спецтариф #${selected.id}` : "Спецтариф"}
        open={specialTariffOpen}
        destroyOnHidden
        onCancel={() => setSpecialTariffOpen(false)}
        onOk={() => specialTariffForm.submit()}
        confirmLoading={specialTariffMutation.isPending}
      >
        <Form
          form={specialTariffForm}
          layout="vertical"
          initialValues={{ currency: "EUR" }}
          onFinish={(values: { amount?: number | null; currency?: string }) => {
            if (!selected) return;
            specialTariffMutation.mutate({
              id: selected.id,
              amount: values.amount,
              currency: values.currency || "EUR",
            });
          }}
        >
          <Form.Item name="amount" label="Сумма (пусто = очистить)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Запрос на фабрику #${selected.id}` : "Запрос на фабрику"}
        open={requestToFactoryOpen}
        destroyOnHidden
        onCancel={() => setRequestToFactoryOpen(false)}
        onOk={() => requestToFactoryForm.submit()}
        confirmLoading={requestToFactoryMutation.isPending}
      >
        <Form
          form={requestToFactoryForm}
          layout="vertical"
          onFinish={(values: { comment?: string; template_id?: number }) => {
            if (!selected) return;
            requestToFactoryMutation.mutate({
              id: selected.id,
              comment: values.comment,
              template_id: values.template_id,
            });
          }}
        >
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="template_id" label="ID шаблона (опционально)">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Выставить цену #${selected.id}` : "Выставить цену"}
        open={quotePriceOpen}
        destroyOnHidden
        onCancel={() => setQuotePriceOpen(false)}
        onOk={() => quotePriceForm.submit()}
        confirmLoading={quotePriceMutation.isPending}
      >
        <Form
          form={quotePriceForm}
          layout="vertical"
          initialValues={{ currency: "EUR" }}
          onFinish={(values: { amount: number; currency?: string }) => {
            if (!selected) return;
            quotePriceMutation.mutate({
              id: selected.id,
              amount: values.amount,
              currency: values.currency,
            });
          }}
        >
          <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Решение по квоте #${selected.id}` : "Решение по квоте"}
        open={quoteDecisionOpen}
        destroyOnHidden
        onCancel={() => setQuoteDecisionOpen(false)}
        onOk={() => quoteDecisionForm.submit()}
        confirmLoading={quoteDecisionMutation.isPending}
      >
        <Form
          form={quoteDecisionForm}
          layout="vertical"
          onFinish={(values: { decision: "agree" | "decline" | "request_again" }) => {
            if (!selected) return;
            quoteDecisionMutation.mutate({
              id: selected.id,
              decision: values.decision,
            });
          }}
        >
          <Form.Item name="decision" label="Решение" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Согласиться", value: "agree" },
                { label: "Отказаться", value: "decline" },
                { label: "Запросить повторно", value: "request_again" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массово: изменить статус"
        open={bulkStatusOpen}
        destroyOnHidden
        onCancel={() => setBulkStatusOpen(false)}
        onOk={() => bulkStatusForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkStatusForm}
          layout="vertical"
          onFinish={(values: { status_name: OrderStatus; status_date?: dayjs.Dayjs }) => {
            runBulkMutation("status", {
              status_name: values.status_name,
              status_date: values.status_date?.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}>
            <Select
              options={ORDER_STATUS_VALUES.map((status) => ({
                label: formatEnumCode(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Form.Item name="status_date" label="Дата статуса">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массово: назначить рейс"
        open={bulkAssignOpen}
        destroyOnHidden
        onCancel={() => setBulkAssignOpen(false)}
        onOk={() => bulkAssignForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkAssignForm}
          layout="vertical"
          onFinish={(values: { trip_id?: number }) => {
            runBulkMutation("assign-trip", {
              trip_id: values.trip_id ?? null,
            });
          }}
        >
          <Form.Item name="trip_id" label="Рейс">
            <Select
              allowClear
              loading={tripsQuery.isLoading}
              options={(tripsQuery.data?.items ?? []).map((trip) => ({
                label: `${trip.id} - ${trip.name}`,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массово: назначить дату вывоза"
        open={bulkPickupOpen}
        destroyOnHidden
        onCancel={() => setBulkPickupOpen(false)}
        onOk={() => bulkPickupForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkPickupForm}
          layout="vertical"
          onFinish={(values: { pickup_date: dayjs.Dayjs }) => {
            runBulkMutation("pickup-date", {
              pickup_date: values.pickup_date.format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="pickup_date" label="Дата вывоза" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массово: спецтариф"
        open={bulkSpecialTariffOpen}
        destroyOnHidden
        onCancel={() => setBulkSpecialTariffOpen(false)}
        onOk={() => bulkSpecialTariffForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkSpecialTariffForm}
          layout="vertical"
          initialValues={{ currency: "EUR" }}
          onFinish={(values: { amount?: number | null; currency?: string }) => {
            runBulkMutation("special-tariff", {
              amount: values.amount ?? null,
              currency: values.currency || "EUR",
            });
          }}
        >
          <Form.Item name="amount" label="Сумма (пусто = очистить)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Массово: ${bulkCommentTarget === "warehouse" ? "комментарий склада" : "комментарий экспедитора"}`}
        open={bulkCommentOpen}
        destroyOnHidden
        onCancel={() => setBulkCommentOpen(false)}
        onOk={() => bulkCommentForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkCommentForm}
          layout="vertical"
          onFinish={(values: { comment: string }) => {
            runBulkMutation(bulkCommentTarget === "warehouse" ? "warehouse-comment" : "forwarder-comment", {
              comment: values.comment,
            });
          }}
        >
          <Form.Item name="comment" label="Комментарий" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <OrdersPageContent />
    </Suspense>
  );
}
