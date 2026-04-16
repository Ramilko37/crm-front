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
  Upload,
} from "antd";
import type { ColumnType, ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

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
  ClientOrderCreateMetadata,
  DictionaryOption,
  FactoryEmail,
  ClientFactoryDetail,
  ClientFactoryListItem,
  Factory,
  FactoryLoadingAddress,
  MeasurementPayload,
  OrderClientCompanyLookupItem,
  OrderCreateMetadata,
  OrderDetail,
  OrderFilterParams,
  OrderListItem,
  OrderWritePayload,
  PaginatedResponse,
  Postcode,
  PostcodeCity,
  Trip,
  UserAdmin,
} from "@/shared/types/entities";

type CreateMode = "existing" | "create";
type FactoryContactMode = "existing" | "create";

type OrderCreateGoodsLineForm = {
  item_type?: string;
  custom_item_type?: string;
  description?: string;
  weight_kg?: string;
  quantity_value?: string;
  quantity_unit?: string;
};

type OrderCreateDocumentForm = {
  document_type?: string;
  display_name?: string;
  file_list?: UploadFile[];
};

type OrderCreateForm = {
  order_number?: string;
  company_id?: number;
  company_contact_id?: number;
  ready_date?: dayjs.Dayjs;
  pickup_date_from?: dayjs.Dayjs;
  pickup_date_to?: dayjs.Dayjs;
  order_type?: OrderType;
  factory_mode?: CreateMode;
  factory_country_id?: number;
  factory_id?: number;
  loading_address_id?: number;
  email_id?: number;
  factory_contact_mode?: FactoryContactMode;
  factory_contact_id?: number;
  create_factory_contact?: {
    full_name?: string;
    phone?: string;
    email?: string;
  };
  create_factory?: {
    factory_name?: string;
    primary_email?: string;
    loading_address?: {
      country_id?: number;
      postcode_id?: number;
      city_id?: number;
      create_postcode?: {
        postcode?: string;
      };
      create_city?: {
        city?: string;
      };
      address?: string;
      contact_name?: string;
      phone?: string;
      fax?: string;
      messenger_type?: string;
      messenger_value?: string;
    };
  };
  invoice_on_other_company?: boolean;
  invoice_company_name?: string;
  additional_description?: string;
  invoice_number?: string;
  declared_volume_m3?: string;
  declared_total_weight_kg?: string;
  cargo_places_qty?: number;
  client_goods_value_amount?: string;
  client_goods_value_currency?: string;
  client_goods_value_currency_other_label?: string;
  comment?: string;
  user_comment?: string;
  forwarder_comment?: string;
  warehouse_comment?: string;
  assigned_forwarder_user_id?: number;
  is_factory_payment_via_company?: boolean;
  is_factory_payment_completed?: boolean;
  is_checked?: boolean;
  is_1c?: boolean;
  is_priority?: boolean;
  office_mark_codes?: string[];
  product_characteristic_codes?: string[];
  self_delivery?: boolean;
  self_delivery_forwarder_user_id?: number;
  measurement_status?: MeasurementPayload["status"];
  measurement_comment?: string;
  weighing_status?: MeasurementPayload["status"];
  weighing_comment?: string;
  request_payload_json?: string;
  goods_lines?: OrderCreateGoodsLineForm[];
  documents?: OrderCreateDocumentForm[];
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

function toSelectOptions(options?: DictionaryOption[]) {
  return (options ?? []).map((option) => ({
    label: option.label || formatEnumCode(option.code),
    value: option.code,
  }));
}

function trimOrUndefined(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : undefined;
}

function renderOrderNumber(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

const ORDER_TABLE_COLUMN_WIDTH_STORAGE_KEY = "crm-orders-column-widths-v1";
const ORDER_TABLE_MIN_COLUMN_WIDTH = 72;

type ResizableHeaderCellProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  onResizeStart?: (event: React.MouseEvent<HTMLSpanElement>) => void;
  resizable?: boolean;
};

function ResizableHeaderCell({ onResizeStart, resizable, className, children, ...rest }: ResizableHeaderCellProps) {
  const nextClassName = `${className ?? ""}${resizable ? " crm-resizable-th" : ""}`.trim();

  return (
    <th {...rest} className={nextClassName}>
      {children}
      {resizable ? (
        <span
          className="crm-column-resize-handle"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => {
            event.stopPropagation();
            onResizeStart?.(event);
          }}
        />
      ) : null}
    </th>
  );
}

const QUANTITY_UNIT_FALLBACK_OPTIONS = [
  { label: "Шт", value: "pcs" },
  { label: "Кв. м", value: "m2" },
];

const PHONE_FORMAT_REGEX = /^[0-9()+\-\s]{5,32}$/;
const ORDER_TRIP_FACTORY_MISMATCH_CODE = "order-trip-factory-mismatch";

function isOrderTripFactoryMismatch(detail: string | undefined) {
  if (!detail) return false;
  return detail.toLowerCase().includes(ORDER_TRIP_FACTORY_MISMATCH_CODE);
}

function getOrderTripFactoryMismatchMessage() {
  return "Выбранный рейс не содержит точку для фабрики заказа";
}

function normalizeCurrencyPayload(
  currency: string | undefined,
  otherLabel: string | undefined,
  otherLabelFieldName: string,
) {
  const normalizedCurrency = (currency || "EUR").toUpperCase();
  if (!["USD", "EUR", "OTHER"].includes(normalizedCurrency)) {
    throw new Error("Валюта должна быть USD, EUR или OTHER");
  }

  const normalizedOtherLabel = trimOrUndefined(otherLabel);
  if (normalizedCurrency === "OTHER" && !normalizedOtherLabel) {
    throw new Error(`Для валюты OTHER укажите ${otherLabelFieldName}`);
  }
  if (normalizedCurrency !== "OTHER" && normalizedOtherLabel) {
    throw new Error(`${otherLabelFieldName} допускается только для валюты OTHER`);
  }

  return {
    currency: normalizedCurrency,
    otherLabel: normalizedCurrency === "OTHER" ? normalizedOtherLabel : undefined,
  };
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
  const canEditRestrictedCreateFields =
    meQuery.data?.is_superuser || ["administrator", "manager", "logist"].includes(normalizedRole);
  const canManageFactoryEmails = canEditRestrictedCreateFields;
  const canInlineCreatePostcodeCity = canEditRestrictedCreateFields && !isClientRole;
  const canUseMessengerFields = canEditRestrictedCreateFields && !isClientRole;

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
  const [clientCompaniesQueryText, setClientCompaniesQueryText] = useState("");
  const [postcodeQueryText, setPostcodeQueryText] = useState("");
  const [newFactoryEmail, setNewFactoryEmail] = useState("");
  const [inlinePostcodeValue, setInlinePostcodeValue] = useState("");
  const [inlineCityValue, setInlineCityValue] = useState("");

  const [createForm] = Form.useForm<OrderCreateForm>();
  const [editForm] = Form.useForm<OrderEditForm>();
  const [statusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();
  const [assignForwarderForm] = Form.useForm<{ assigned_forwarder_user_id?: number }>();
  const [pickupForm] = Form.useForm<{ pickup_date: dayjs.Dayjs }>();
  const [specialTariffForm] = Form.useForm<{
    amount?: number | null;
    currency?: string;
    special_tariff_currency_other_label?: string;
  }>();
  const [requestToFactoryForm] = Form.useForm<{ comment?: string; template_id?: number }>();
  const [quotePriceForm] = Form.useForm<{
    amount: number;
    currency?: string;
    quote_price_currency_other_label?: string;
  }>();
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
  const [bulkSpecialTariffForm] = Form.useForm<{
    amount?: number | null;
    currency?: string;
    special_tariff_currency_other_label?: string;
  }>();
  const [bulkCommentForm] = Form.useForm<{ comment: string }>();
  const [createFactoryEmailForm] = Form.useForm<{ email: string }>();
  const createFactoryId = Form.useWatch("factory_id", createForm);
  const createFactoryMode = (Form.useWatch("factory_mode", createForm) as CreateMode | undefined) ?? "existing";
  const createFactoryContactMode =
    (Form.useWatch("factory_contact_mode", createForm) as FactoryContactMode | undefined) ?? "existing";
  const createClientGoodsValueCurrency = Form.useWatch("client_goods_value_currency", createForm);
  const createOrderType = Form.useWatch("order_type", createForm);
  const createCompanyId = Form.useWatch("company_id", createForm);
  const createFactoryCountryId = Form.useWatch("factory_country_id", createForm) as number | undefined;
  const createFactoryPostcodeId = Form.useWatch(
    ["create_factory", "loading_address", "postcode_id"],
    createForm,
  ) as number | undefined;
  const createLoadingAddressId = Form.useWatch("loading_address_id", createForm);
  const isRequestCreate = createOrderType === "request";

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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(ORDER_TABLE_COLUMN_WIDTH_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).reduce<Record<string, number>>((acc, [key, value]) => {
        if (typeof value === "number" && Number.isFinite(value) && value >= ORDER_TABLE_MIN_COLUMN_WIDTH) {
          acc[key] = Math.round(value);
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ORDER_TABLE_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // no-op: ignore storage write issues
    }
  }, [columnWidths]);

  const startColumnResize = useCallback(
    (columnKey: string, initialWidth: number, event: React.MouseEvent<HTMLSpanElement>) => {
      if (typeof window === "undefined") return;

      const startX = event.clientX;
      document.body.classList.add("crm-column-resizing");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(ORDER_TABLE_MIN_COLUMN_WIDTH, Math.round(initialWidth + delta));
        setColumnWidths((prev) => {
          if (prev[columnKey] === nextWidth) return prev;
          return { ...prev, [columnKey]: nextWidth };
        });
      };

      const handleMouseUp = () => {
        document.body.classList.remove("crm-column-resizing");
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [],
  );

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

  const createMetadataQuery = useQuery({
    queryKey: ["orders", "create-metadata", isClientRole],
    queryFn: () =>
      isClientRole
        ? apiRequest<ClientOrderCreateMetadata>("/api/client/orders/create-metadata")
        : apiRequest<OrderCreateMetadata>("/api/orders/create-metadata"),
    enabled: createOpen && canCreate,
  });

  const clientCompaniesQuery = useQuery({
    queryKey: ["orders", "client-companies", clientCompaniesQueryText],
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderClientCompanyLookupItem>>("/api/orders/client-companies", {
        query: {
          page: 1,
          page_size: 50,
          query: clientCompaniesQueryText || undefined,
        },
      }),
    enabled: createOpen && !isClientRole && canCreate,
  });

  const selectedClientCompany = useMemo(
    () => (clientCompaniesQuery.data?.items ?? []).find((item) => item.company_id === createCompanyId),
    [clientCompaniesQuery.data?.items, createCompanyId],
  );

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: { page: 1, page_size: 200 },
      }),
    enabled: canWriteOrder,
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
    queryKey: [
      isClientRole ? "client-factories" : "factories",
      "order-create-options",
      createFactoryMode,
      createFactoryCountryId,
    ],
    queryFn: async () => {
      if (!createFactoryCountryId) {
        return [] as Array<{ id: number; name: string; subtitle: string }>;
      }

      if (isClientRole) {
        const response = await apiRequest<PaginatedResponse<ClientFactoryListItem>>("/api/client/factories", {
          query: { page: 1, page_size: 200, sort_desc: false, country_id: createFactoryCountryId },
        });
        return response.items.map((factory) => ({
          id: factory.id,
          name: factory.name,
          subtitle: [factory.country, factory.city].filter(Boolean).join(", "),
        }));
      }

      const response = await apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200, sort_desc: false, country_id: createFactoryCountryId },
      });
      return response.items.map((factory) => ({
        id: factory.id,
        name: factory.name,
        subtitle: [factory.country, factory.city].filter(Boolean).join(", "),
      }));
    },
    enabled: createOpen && canCreate && createFactoryMode === "existing" && Boolean(createFactoryCountryId),
  });

  const factoryEmailsQuery = useQuery({
    queryKey: ["orders", "create-factory-emails", createFactoryId],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryEmail>>(`/api/factories/${createFactoryId}/emails`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: createOpen && !isClientRole && canCreate && createFactoryMode === "existing" && Boolean(createFactoryId),
  });

  const countriesQuery = useQuery({
    queryKey: ["orders", "create-countries", isClientRole],
    queryFn: () =>
      isClientRole
        ? apiRequest<PaginatedResponse<{ id: number; name_ru: string }>>("/api/client/countries", {
            query: { page: 1, page_size: 200 },
          })
        : apiRequest<PaginatedResponse<{ id: number; name_ru: string }>>("/api/countries", {
            query: { page: 1, page_size: 200 },
          }),
    enabled: createOpen && canCreate,
  });

  const postcodesQuery = useQuery({
    queryKey: ["orders", "create-postcodes", isClientRole, createFactoryCountryId, postcodeQueryText],
    queryFn: () =>
      isClientRole
        ? apiRequest<PaginatedResponse<Postcode>>("/api/client/postcodes", {
            query: { page: 1, page_size: 100, country_id: createFactoryCountryId, query: postcodeQueryText || undefined },
          })
        : apiRequest<PaginatedResponse<Postcode>>("/api/postcodes", {
            query: { page: 1, page_size: 100, country_id: createFactoryCountryId, query: postcodeQueryText || undefined },
          }),
    enabled: createOpen && canCreate && createFactoryMode === "create" && Boolean(createFactoryCountryId),
  });

  const postcodeCitiesQuery = useQuery({
    queryKey: ["orders", "create-postcode-cities", isClientRole, createFactoryPostcodeId],
    queryFn: () =>
      isClientRole
        ? apiRequest<PaginatedResponse<PostcodeCity>>(`/api/client/postcodes/${createFactoryPostcodeId}/cities`, {
            query: { page: 1, page_size: 200 },
          })
        : apiRequest<PaginatedResponse<PostcodeCity>>(`/api/postcodes/${createFactoryPostcodeId}/cities`, {
            query: { page: 1, page_size: 200 },
          }),
    enabled: createOpen && canCreate && createFactoryMode === "create" && Boolean(createFactoryPostcodeId),
  });

  const messengerTypesQuery = useQuery({
    queryKey: ["orders", "create-messenger-types"],
    queryFn: async () => {
      const payload = await apiRequest<
        PaginatedResponse<{ code: string; label: string }> | { code: string; label: string }[]
      >("/api/messenger-types");
      if (Array.isArray(payload)) {
        return payload;
      }
      return payload.items ?? [];
    },
    enabled: createOpen && canCreate && createFactoryMode === "create" && canUseMessengerFields,
  });

  const loadingAddressesQuery = useQuery({
    queryKey: ["orders", "create-loading-addresses", isClientRole, createFactoryMode, createFactoryId],
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
    enabled: createOpen && createFactoryMode === "existing" && Boolean(createFactoryId) && canCreate,
  });

  useEffect(() => {
    if (!createOpen || !createFactoryId || createFactoryMode !== "existing") {
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
  }, [createFactoryId, createFactoryMode, createForm, createLoadingAddressId, createOpen, loadingAddressesQuery.data]);

  useEffect(() => {
    if (!createOpen) return;
    if (createFactoryMode === "create") {
      createForm.setFieldValue("factory_id", undefined);
      createForm.setFieldValue("loading_address_id", undefined);
      createForm.setFieldValue("email_id", undefined);
      return;
    }
    createForm.setFieldValue(["create_factory"], undefined);
  }, [createFactoryMode, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen || !createFactoryCountryId) {
      return;
    }
    if (createFactoryMode === "existing") {
      createForm.setFieldValue("factory_id", undefined);
      createForm.setFieldValue("loading_address_id", undefined);
      createForm.setFieldValue("email_id", undefined);
      return;
    }
    createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], undefined);
    createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
  }, [createFactoryCountryId, createFactoryMode, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen || createFactoryMode !== "create") {
      return;
    }
    const cities = postcodeCitiesQuery.data?.items ?? [];
    if (cities.length === 1) {
      createForm.setFieldValue(["create_factory", "loading_address", "city_id"], cities[0].id);
    }
  }, [createFactoryMode, createForm, createOpen, postcodeCitiesQuery.data?.items]);

  useEffect(() => {
    if (!createOpen) return;
    if (createFactoryContactMode === "existing") {
      createForm.setFieldValue(["create_factory_contact"], undefined);
      return;
    }
    createForm.setFieldValue("factory_contact_id", undefined);
  }, [createFactoryContactMode, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    if (createClientGoodsValueCurrency !== "OTHER") {
      createForm.setFieldValue("client_goods_value_currency_other_label", undefined);
    }
  }, [createClientGoodsValueCurrency, createForm, createOpen]);

  function invalidateOrdersQueries(orderId?: number) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      orderId ? queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) }) : Promise.resolve(),
    ]);
  }

  const createFactoryEmailMutation = useMutation({
    mutationFn: (payload: { factoryId: number; email: string }) =>
      apiRequest<FactoryEmail>(`/api/factories/${payload.factoryId}/emails`, {
        method: "POST",
        body: { email: payload.email },
      }),
    onSuccess: async (result) => {
      message.success("Email фабрики добавлен");
      setNewFactoryEmail("");
      createFactoryEmailForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-factory-emails", createFactoryId] });
      if (result?.id) {
        createForm.setFieldValue("email_id", result.id);
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления email");
    },
  });

  const createPostcodeMutation = useMutation({
    mutationFn: (payload: { country_id: number; postcode: string }) =>
      apiRequest<Postcode>("/api/postcodes", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async (result) => {
      message.success("Индекс создан");
      setInlinePostcodeValue("");
      createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], result.id);
      createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-postcodes"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания индекса");
    },
  });

  const createPostcodeCityMutation = useMutation({
    mutationFn: (payload: { postcodeId: number; city: string }) =>
      apiRequest<PostcodeCity>(`/api/postcodes/${payload.postcodeId}/cities`, {
        method: "POST",
        body: { city: payload.city },
      }),
    onSuccess: async (result) => {
      message.success("Город создан");
      setInlineCityValue("");
      createForm.setFieldValue(["create_factory", "loading_address", "city_id"], result.id);
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-postcode-cities"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания города");
    },
  });

  function applyCreate422FieldErrors(detail: string) {
    const text = detail.toLowerCase();
    const fieldErrors: Array<{ name: (string | number)[]; errors: string[] }> = [];

    const mark = (name: (string | number)[] | string, messageText: string) => {
      fieldErrors.push({ name: Array.isArray(name) ? name : [name], errors: [messageText] });
    };

    if (text.includes("invoice_company_name")) {
      mark("invoice_company_name", "Укажите название компании для инвойса");
    }

    if (text.includes("company_contact_id")) {
      mark("company_contact_id", "Выберите контакт компании");
    }

    if (text.includes("email_id")) {
      mark("email_id", "Выберите email фабрики");
    }

    if (text.includes("self_delivery_forwarder_user_id")) {
      mark("self_delivery_forwarder_user_id", "Выберите экспедитора для self-delivery");
    }

    if (text.includes("pickup_date_from") || text.includes("pickup_date_to")) {
      mark("pickup_date_from", "Проверьте диапазон дат вывоза");
      mark("pickup_date_to", "Проверьте диапазон дат вывоза");
    }

    if (
      text.includes("factory_contact_id") ||
      text.includes("create_factory_contact") ||
      text.includes("xor") ||
      text.includes("contact mode")
    ) {
      mark("factory_contact_mode", "Выберите режим контакта фабрики и заполните один вариант");
    }

    if (text.includes("primary_email")) {
      mark(["create_factory", "primary_email"], "Введите корректный email");
    }

    if (text.includes("loading_address.phone")) {
      mark(["create_factory", "loading_address", "phone"], "Введите телефон в допустимом формате");
    }

    if (text.includes("loading_address.contact_name")) {
      mark(["create_factory", "loading_address", "contact_name"], "Укажите контактное лицо");
    }
    if (text.includes("selected loading address must have contact_name")) {
      mark("loading_address_id", "Выбранный адрес погрузки должен содержать контактное лицо");
    }
    if (text.includes("selected loading address has invalid phone")) {
      mark("loading_address_id", "Телефон в выбранном адресе погрузки невалиден");
    }

    if (text.includes("loading_address.postcode_id") || text.includes("create_postcode")) {
      mark(["create_factory", "loading_address", "postcode_id"], "Выберите индекс");
    }

    if (text.includes("loading_address.city_id") || text.includes("create_city")) {
      mark(["create_factory", "loading_address", "city_id"], "Выберите город");
    }

    if (text.includes("additional_description")) {
      mark("additional_description", "Если строки товара пустые, заполните описание груза");
    }

    if (text.includes("ready_date")) {
      mark("ready_date", "Дата готовности не может быть в прошлом");
    }

    if (text.includes("client_goods_value_currency_other_label")) {
      mark(
        "client_goods_value_currency_other_label",
        "Для валюты OTHER укажите текстовое обозначение валюты",
      );
    }

    if (text.includes("maximum of 10 documents")) {
      mark("documents", "Можно загрузить максимум 10 документов");
    }

    if (
      text.includes("factory_id must belong to the selected country_id") ||
      text.includes("loading_address_id must belong to the selected country_id") ||
      text.includes("country_id")
    ) {
      mark("factory_country_id", "Проверьте страну фабрики и соответствие выбранных данных");
    }

    if (!fieldErrors.length) {
      return false;
    }

    createForm.setFields(fieldErrors as Parameters<typeof createForm.setFields>[0]);
    return true;
  }

  function closeAndResetCreateModal() {
    setCreateOpen(false);
    createForm.resetFields();
    setClientCompaniesQueryText("");
    setPostcodeQueryText("");
    setNewFactoryEmail("");
    setInlinePostcodeValue("");
    setInlineCityValue("");
  }

  const createMutation = useMutation({
    mutationFn: async (values: OrderCreateForm) => {
      const docs = values.documents ?? [];
      if (docs.length > 10) {
        throw new Error("Можно загрузить максимум 10 документов");
      }

      const filesToUpload: Array<{ slot: string; file: File }> = [];
      const documentsPayload = docs.map((document, index) => {
        const file = document.file_list?.[0]?.originFileObj;
        if (!(file instanceof File)) {
          throw new Error(`Документ #${index + 1}: выберите файл`);
        }
        const slot = `create_file_${index + 1}`;
        filesToUpload.push({ slot, file });
        const resolvedDocumentType =
          trimOrUndefined(document.document_type) ?? createMetadataQuery.data?.document_type_options?.[0]?.code;
        if (!resolvedDocumentType) {
          throw new Error(`Документ #${index + 1}: не найден доступный тип документа`);
        }
        return {
          document_type: resolvedDocumentType,
          file_slot: slot,
          display_name: trimOrUndefined(document.display_name) ?? file.name,
        };
      });

      if (!isClientRole && !values.company_id) {
        throw new Error("Выберите клиента");
      }

      if (!isClientRole && !values.company_contact_id) {
        throw new Error("Выберите контакт компании");
      }

      if (!values.factory_mode) {
        throw new Error("Выберите режим фабрики");
      }

      if (!values.ready_date) {
        throw new Error("Укажите дату готовности");
      }

      const today = dayjs().startOf("day");
      if (values.ready_date.startOf("day").isBefore(today)) {
        throw new Error("Дата готовности не может быть в прошлом");
      }

      if (values.invoice_on_other_company && !trimOrUndefined(values.invoice_company_name)) {
        throw new Error("Для инвойса на другую компанию заполните название компании");
      }

      if (values.self_delivery && !values.self_delivery_forwarder_user_id) {
        throw new Error("Для self-delivery выберите экспедитора");
      }

      if (values.pickup_date_from && values.pickup_date_to && values.pickup_date_from.isAfter(values.pickup_date_to, "day")) {
        throw new Error("Дата вывоза 'От' не может быть позже даты 'До'");
      }

      const goodsLines = (values.goods_lines ?? [])
        .map((line) => {
          const itemTypeRaw = trimOrUndefined(line.item_type);
          const customItemType = trimOrUndefined(line.custom_item_type);
          const description = trimOrUndefined(line.description);
          const weight_kg = trimOrUndefined(line.weight_kg);
          const quantity_value = trimOrUndefined(line.quantity_value);
          const quantity_unit = trimOrUndefined(line.quantity_unit);

          if (!itemTypeRaw && !customItemType && !description && !weight_kg && !quantity_value && !quantity_unit) {
            return null;
          }

          if (itemTypeRaw === "other" && !customItemType) {
            throw new Error("Для типа позиции 'other' заполните custom тип");
          }

          if (quantity_unit && !["pcs", "m2"].includes(quantity_unit)) {
            throw new Error("Ед. изм. должна быть одной из: pcs, m2");
          }

          return {
            item_type: itemTypeRaw,
            custom_item_type: itemTypeRaw === "other" ? customItemType : undefined,
            description,
            weight_kg,
            quantity_value,
            quantity_unit,
          };
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line));

      if (!goodsLines.length && !trimOrUndefined(values.additional_description)) {
        throw new Error("Если строки товара пустые, заполните описание груза");
      }

      let requestRawPayload: Record<string, unknown> | undefined;
      if ((values.order_type ?? "delivery") === "request" && trimOrUndefined(values.request_payload_json)) {
        requestRawPayload = JSON.parse(values.request_payload_json as string) as Record<string, unknown>;
      }

      let factorySelection: Record<string, unknown>;
      const createFactoryContact = values.create_factory_contact;
      const createFactoryContactPayload = {
        full_name: trimOrUndefined(createFactoryContact?.full_name),
        phone: trimOrUndefined(createFactoryContact?.phone),
        email: trimOrUndefined(createFactoryContact?.email),
      };

      if (values.factory_contact_mode === "existing") {
        if (!values.factory_contact_id) {
          throw new Error("Выберите контакт фабрики");
        }
      } else if (values.factory_contact_mode === "create") {
        if (!createFactoryContactPayload.full_name || !createFactoryContactPayload.phone) {
          throw new Error("Для нового контакта фабрики заполните имя и телефон");
        }
      } else {
        throw new Error("Выберите режим контакта фабрики");
      }

      if (values.factory_mode === "create") {
        const loadingAddress = values.create_factory?.loading_address;
        if (!values.factory_country_id) {
          throw new Error("Выберите страну фабрики");
        }
        const inlinePostcode = trimOrUndefined(loadingAddress?.create_postcode?.postcode);
        const inlineCity = trimOrUndefined(loadingAddress?.create_city?.city);
        const createFactoryPayload: Record<string, unknown> = {
          factory_name: trimOrUndefined(values.create_factory?.factory_name),
          country_id: values.factory_country_id,
          primary_email: trimOrUndefined(values.create_factory?.primary_email),
          loading_address: {
            country_id: values.factory_country_id,
            postcode_id: loadingAddress?.postcode_id,
            city_id: loadingAddress?.city_id,
            address: trimOrUndefined(loadingAddress?.address),
            contact_name: trimOrUndefined(loadingAddress?.contact_name),
            phone: trimOrUndefined(loadingAddress?.phone),
            fax: trimOrUndefined(loadingAddress?.fax),
            messenger_type: canUseMessengerFields ? trimOrUndefined(loadingAddress?.messenger_type) : undefined,
            messenger_value: canUseMessengerFields ? trimOrUndefined(loadingAddress?.messenger_value) : undefined,
            create_postcode: canInlineCreatePostcodeCity && inlinePostcode ? { postcode: inlinePostcode } : undefined,
            create_city: canInlineCreatePostcodeCity && inlineCity ? { city: inlineCity } : undefined,
          },
        };
        factorySelection = {
          factory_mode: "create",
          country_id: values.factory_country_id,
          create_factory: createFactoryPayload,
          factory_contact_id: values.factory_contact_mode === "existing" ? values.factory_contact_id : undefined,
          create_factory_contact:
            values.factory_contact_mode === "create"
              ? {
                  full_name: createFactoryContactPayload.full_name,
                  phone: createFactoryContactPayload.phone,
                  email: createFactoryContactPayload.email ?? undefined,
                }
              : undefined,
        };
      } else {
        if (!values.factory_country_id) {
          throw new Error("Выберите страну фабрики");
        }
        if (!values.factory_id || !values.loading_address_id || (!isClientRole && !values.email_id)) {
          throw new Error("Выберите фабрику, адрес загрузки и email фабрики");
        }
        factorySelection = {
          factory_mode: "existing",
          country_id: values.factory_country_id,
          factory_id: values.factory_id,
          loading_address_id: values.loading_address_id,
          email_id: values.email_id ?? undefined,
          factory_contact_id: values.factory_contact_mode === "existing" ? values.factory_contact_id : undefined,
          create_factory_contact:
            values.factory_contact_mode === "create"
              ? {
                  full_name: createFactoryContactPayload.full_name,
                  phone: createFactoryContactPayload.phone,
                  email: createFactoryContactPayload.email ?? undefined,
                }
              : undefined,
        };
      }

      const clientGoodsValueCurrency = trimOrUndefined(values.client_goods_value_currency);
      if (clientGoodsValueCurrency && !["USD", "EUR", "OTHER"].includes(clientGoodsValueCurrency)) {
        throw new Error("Валюта стоимости товара должна быть USD, EUR или OTHER");
      }
      const clientGoodsValueCurrencyOtherLabel = trimOrUndefined(values.client_goods_value_currency_other_label);
      if (clientGoodsValueCurrency === "OTHER" && !clientGoodsValueCurrencyOtherLabel) {
        throw new Error("Для валюты OTHER укажите текстовое обозначение валюты");
      }
      if (clientGoodsValueCurrency && clientGoodsValueCurrency !== "OTHER" && clientGoodsValueCurrencyOtherLabel) {
        throw new Error("Текстовое обозначение валюты допустимо только для OTHER");
      }

      const orderPayload: Record<string, unknown> = {
        order_number: trimOrUndefined(values.order_number),
        order_type: values.order_type ?? "delivery",
        ready_date: values.ready_date.format("YYYY-MM-DD"),
        pickup_date_from: values.pickup_date_from?.format("YYYY-MM-DD"),
        pickup_date_to: values.pickup_date_to?.format("YYYY-MM-DD"),
        invoice_on_other_company: Boolean(values.invoice_on_other_company),
        invoice_company_name: trimOrUndefined(values.invoice_company_name),
        invoice_number: trimOrUndefined(values.invoice_number),
        declared_volume_m3: trimOrUndefined(values.declared_volume_m3),
        declared_total_weight_kg: trimOrUndefined(values.declared_total_weight_kg),
        cargo_places_qty: values.cargo_places_qty,
        client_goods_value_amount: trimOrUndefined(values.client_goods_value_amount),
        client_goods_value_currency: clientGoodsValueCurrency,
        client_goods_value_currency_other_label:
          clientGoodsValueCurrency === "OTHER" ? clientGoodsValueCurrencyOtherLabel : undefined,
        product_characteristic_codes: values.product_characteristic_codes,
        additional_description: trimOrUndefined(values.additional_description),
        comment: trimOrUndefined(values.comment),
        is_1c: values.is_1c,
        raw_payload: requestRawPayload,
      };

      if (!isClientRole) {
        const assignedForwarderUserId = canEditRestrictedCreateFields ? values.assigned_forwarder_user_id : undefined;
        Object.assign(orderPayload, {
          company_id: values.company_id,
          company_contact_id: values.company_contact_id,
          user_comment: trimOrUndefined(values.user_comment),
          forwarder_comment: trimOrUndefined(values.forwarder_comment),
          warehouse_comment: trimOrUndefined(values.warehouse_comment),
          self_delivery: Boolean(values.self_delivery),
          self_delivery_forwarder_user_id: values.self_delivery_forwarder_user_id,
          measurement_payload: values.measurement_status
            ? {
                status: values.measurement_status,
                comment: trimOrUndefined(values.measurement_comment) ?? null,
              }
            : undefined,
          weighing_payload: values.weighing_status
            ? {
                status: values.weighing_status,
                comment: trimOrUndefined(values.weighing_comment) ?? null,
              }
            : undefined,
          is_priority: canEditRestrictedCreateFields ? Boolean(values.is_priority) : undefined,
          office_mark_codes: canEditRestrictedCreateFields ? values.office_mark_codes : undefined,
          assigned_forwarder_user_id: assignedForwarderUserId,
          is_factory_payment_via_company: canEditRestrictedCreateFields ? values.is_factory_payment_via_company : undefined,
          is_factory_payment_completed: canEditRestrictedCreateFields ? values.is_factory_payment_completed : undefined,
          is_checked: canEditRestrictedCreateFields ? values.is_checked : undefined,
        });
      }

      const createPayload = {
        order: orderPayload,
        factory_selection: factorySelection,
        goods_lines: goodsLines,
        documents: documentsPayload,
      };

      const formData = new FormData();
      formData.set("payload", JSON.stringify(createPayload));
      filesToUpload.forEach(({ slot, file }) => formData.append(slot, file));

      return apiRequest<OrderDetail>(isClientRole ? "/api/client/orders" : "/api/orders", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async (_, values) => {
      message.success(values.order_type === "request" ? "Заявка создана" : "Заказ создан");
      closeAndResetCreateModal();
      await invalidateOrdersQueries();
    },
    onError: (error) => {
      if (error instanceof SyntaxError) {
        message.error("request_payload_json должен быть валидным JSON");
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 422) {
          applyCreate422FieldErrors(error.detail);
        }
        message.error(error.detail);
        return;
      }
      if (error instanceof Error) {
        message.error(error.message);
        return;
      }
      message.error("Ошибка создания заказа");
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
      if (error instanceof ApiError && isOrderTripFactoryMismatch(error.detail)) {
        message.error(getOrderTripFactoryMismatchMessage());
        return;
      }
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
    mutationFn: ({
      id,
      amount,
      currency,
      special_tariff_currency_other_label,
    }: {
      id: number;
      amount?: number | null;
      currency?: string;
      special_tariff_currency_other_label?: string;
    }) => {
      const normalized = normalizeCurrencyPayload(
        currency,
        special_tariff_currency_other_label,
        "special_tariff_currency_other_label",
      );
      return apiRequest<OrderDetail>(`/api/orders/${id}/special-tariff`, {
        method: "POST",
        body: {
          amount: amount ?? null,
          currency: normalized.currency,
          special_tariff_currency_other_label: normalized.otherLabel,
        },
      });
    },
    onSuccess: async (_, values) => {
      message.success("Спецтариф обновлен");
      setSpecialTariffOpen(false);
      specialTariffForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Ошибка спецтарифа");
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
    mutationFn: ({
      id,
      amount,
      currency,
      quote_price_currency_other_label,
    }: {
      id: number;
      amount: number;
      currency?: string;
      quote_price_currency_other_label?: string;
    }) => {
      const normalized = normalizeCurrencyPayload(currency, quote_price_currency_other_label, "quote_price_currency_other_label");
      return apiRequest<OrderDetail>(`/api/orders/${id}/quote-price`, {
        method: "POST",
        body: {
          amount,
          currency: normalized.currency,
          quote_price_currency_other_label: normalized.otherLabel,
        },
      });
    },
    onSuccess: async (_, values) => {
      message.success("Цена квоты обновлена");
      setQuotePriceOpen(false);
      quotePriceForm.resetFields();
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      message.error(
        error instanceof ApiError ? error.detail : error instanceof Error ? error.message : "Ошибка обновления цены квоты",
      );
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
      if (error instanceof ApiError && isOrderTripFactoryMismatch(error.detail)) {
        message.error(getOrderTripFactoryMismatchMessage());
        return;
      }
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
      order_number: record.order_number ?? undefined,
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
      special_tariff_currency_other_label: record.special_tariff_currency_other_label ?? undefined,
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
      quote_price_currency_other_label: record.quote_price_currency_other_label ?? undefined,
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
      title: "Док.",
      key: "documents",
      width: 90,
      render: (_, record) => (record.has_documents || (record.documents_count ?? 0) > 0 ? record.documents_count ?? 0 : "—"),
    },
    {
      title: "Оплачено TARGET MOB",
      dataIndex: "is_checked",
      key: "is_checked",
      width: 165,
      render: (value: boolean | undefined) => (value ? <Tag color="green">Да</Tag> : "—"),
    },
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
      render: (value: string | null, record) => <Link href={`/orders/${record.id}`}>{renderOrderNumber(value)}</Link>,
    },
    {
      title: "Клиент",
      dataIndex: "company_name",
      key: "company_name",
      width: 180,
      render: (value: string | null | undefined, record) => value || (record.company_id ? `ID ${record.company_id}` : "—"),
    },
    {
      title: "Название фабрики",
      dataIndex: "factory_name",
      key: "factory_name",
      width: 180,
      render: (value: string | null | undefined, record) => value || `ID ${record.factory_id}`,
    },
    {
      title: "Инвойс/проформа",
      dataIndex: "invoice_number",
      key: "invoice_number",
      width: 160,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Объем из инв.",
      dataIndex: "declared_volume_m3",
      key: "declared_volume_m3",
      width: 130,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Объем",
      dataIndex: "volume_m3",
      key: "volume_m3",
      width: 100,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Акт. объем",
      dataIndex: "actual_volume_m3",
      key: "actual_volume_m3",
      width: 110,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Объем на складе",
      dataIndex: "shipped_m3",
      key: "shipped_m3",
      width: 140,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Кол-во",
      dataIndex: "box_qty",
      key: "box_qty",
      width: 95,
      render: (value: number | null | undefined) => value ?? "—",
    },
    {
      title: "Акт. кол-во",
      dataIndex: "actual_qty",
      key: "actual_qty",
      width: 120,
      render: (value: number | null | undefined) => value ?? "—",
    },
    {
      title: "Акт. вес",
      dataIndex: "actual_weight_kg",
      key: "actual_weight_kg",
      width: 100,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "На складе",
      dataIndex: "quantity_whs",
      key: "quantity_whs",
      width: 100,
      render: (value: number | null | undefined) => value ?? "—",
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
      title: "Эксп.",
      dataIndex: "forwarder_name",
      key: "forwarder_name",
      width: 130,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Дни стат.",
      dataIndex: "days_same_status",
      key: "days_same_status",
      sorter: true,
      sortOrder: sortOrderFor("days_same_status"),
      width: 100,
      render: (value: number | null | undefined) => value ?? "—",
    },
    {
      title: "Дата заказа",
      dataIndex: "order_date",
      key: "order_date",
      sorter: true,
      sortOrder: sortOrderFor("order_date"),
      width: 130,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Дата готовности",
      dataIndex: "ready_date",
      key: "ready_date",
      sorter: true,
      sortOrder: sortOrderFor("ready_date"),
      width: 130,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Вывоз",
      dataIndex: "trip_name",
      key: "trip_name",
      width: 120,
      render: (value: string | null | undefined, record) => value || (record.trip_id ? `ID ${record.trip_id}` : "—"),
    },
    {
      title: "Опис.",
      dataIndex: "additional_description",
      key: "additional_description",
      width: 180,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      width: 120,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Комм. клиента",
      dataIndex: "user_comment",
      key: "user_comment",
      width: 190,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Комм. экспед.",
      dataIndex: "forwarder_comment",
      key: "forwarder_comment",
      width: 190,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Спецтар.",
      key: "special_tariff",
      width: 130,
      render: (_, record) =>
        record.special_tariff_amount
          ? `${record.special_tariff_amount}${record.special_tariff_currency ? ` ${record.special_tariff_currency}` : ""}`
          : "—",
    },
    {
      title: "Комм. склада",
      dataIndex: "warehouse_comment",
      key: "warehouse_comment",
      width: 190,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Ценовой коэффициент",
      dataIndex: "price_coefficient",
      key: "price_coefficient",
      width: 130,
      render: (value: string | number | null | undefined) => (value ?? "—") as React.ReactNode,
    },
    {
      title: "Сертификаты",
      dataIndex: "has_certificate",
      key: "has_certificate",
      width: 110,
      render: (value: boolean | undefined) => (value ? <Tag color="green">Да</Tag> : "—"),
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

  const columnsWithResize: ColumnsType<OrderListItem> = columns.map((column) => {
    const dataIndexKey =
      "dataIndex" in column && typeof column.dataIndex === "string" ? column.dataIndex : undefined;
    const columnKey = String(column.key ?? dataIndexKey ?? "");
    const defaultWidth = typeof column.width === "number" ? column.width : ORDER_TABLE_MIN_COLUMN_WIDTH;
    const width = columnWidths[columnKey] ?? defaultWidth;
    const shouldResize = columnKey.length > 0 && columnKey !== "actions";

    const nextColumn: ColumnType<OrderListItem> = {
      ...column,
      width,
    };

    if (!shouldResize) {
      return nextColumn;
    }

    return {
      ...nextColumn,
      onHeaderCell: () =>
        ({
          resizable: true,
          onResizeStart: (event: React.MouseEvent<HTMLSpanElement>) => {
            if (columnWidths[columnKey] === undefined) {
              setColumnWidths((prev) => ({ ...prev, [columnKey]: defaultWidth }));
            }
            startColumnResize(columnKey, width, event);
          },
        }) as React.HTMLAttributes<HTMLTableCellElement> & ResizableHeaderCellProps,
    };
  });

  const tableScrollX = useMemo(
    () =>
      columnsWithResize.reduce((total, column) => {
        const width = typeof column.width === "number" ? column.width : ORDER_TABLE_MIN_COLUMN_WIDTH;
        return total + width;
      }, 0) + 120,
    [columnsWithResize],
  );

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
  const orderTypeCreateOptions = toSelectOptions(createMetadataQuery.data?.order_type_options);
  const officeMarkOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.office_mark_options,
  );
  const productCharacteristicOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.product_characteristic_options,
  );
  const itemTypeOptions = toSelectOptions(createMetadataQuery.data?.item_type_options);
  const quantityUnitOptions =
    toSelectOptions(createMetadataQuery.data?.quantity_unit_options).length > 0
      ? toSelectOptions(createMetadataQuery.data?.quantity_unit_options)
      : QUANTITY_UNIT_FALLBACK_OPTIONS;
  const documentTypeOptions = toSelectOptions(createMetadataQuery.data?.document_type_options);
  const measurementStatusOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.measurement_status_options,
  );
  const weighingStatusOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.weighing_status_options,
  );
  const clientCompanyOptions = (clientCompaniesQuery.data?.items ?? []).map((item) => ({
    label: `${item.company_name} (ID ${item.company_id})`,
    value: item.company_id,
  }));
  const selectedCompanyContacts = selectedClientCompany?.contacts ?? [];
  const selectedLoadingAddress = useMemo(
    () => (loadingAddressesQuery.data ?? []).find((address) => address.id === createLoadingAddressId),
    [createLoadingAddressId, loadingAddressesQuery.data],
  );
  const countryOptions = (countriesQuery.data?.items ?? []).map((country) => ({
    label: country.name_ru,
    value: country.id,
  }));
  const postcodeOptions = (postcodesQuery.data?.items ?? []).map((postcode) => ({
    label: `${postcode.postcode}${postcode.country_id ? ` (country ${postcode.country_id})` : ""}`,
    value: postcode.id,
  }));
  const postcodeCityOptions = (postcodeCitiesQuery.data?.items ?? []).map((city) => ({
    label: city.city,
    value: city.id,
  }));
  const messengerTypeOptions = (messengerTypesQuery.data ?? []).map((item) => ({
    label: item.label,
    value: item.code,
  }));
  const selfDeliveryForwarderOptions = (
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.self_delivery_forwarder_options ?? []
  ).map((forwarder) => ({
    label: [forwarder.full_name, forwarder.email].filter(Boolean).join(" · ") || `ID ${forwarder.id}`,
    value: forwarder.id,
  }));
  const factoryEmailOptions = (factoryEmailsQuery.data?.items ?? []).map((item) => ({
    label: `${item.email}${item.is_primary ? " (primary)" : ""}`,
    value: item.id,
  }));

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
                        {renderOrderNumber(record.order_number)}
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
            columns={columnsWithResize}
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
            rowSelection={
              canWriteOrder
                ? {
                    fixed: true,
                    columnWidth: 56,
                    columnTitle: (checkboxNode) => (
                      <span className="crm-selection-column-title">
                        <span aria-hidden="true">..</span>
                        {checkboxNode}
                      </span>
                    ),
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }
                : undefined
            }
            scroll={{ x: tableScrollX }}
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
        title={
          isClientRole
            ? "Создать заказ (клиентский контур)"
            : isRequestCreate
              ? "Создать заявку (request)"
              : "Создать заказ"
        }
        open={createOpen}
        destroyOnHidden
        className="crm-order-create-modal"
        onCancel={() => {
          Modal.confirm({
            title: "Вы уверены, что хотите отменить создание заказа?",
            okText: "Отменить создание",
            cancelText: "Продолжить заполнение",
            onOk: () => closeAndResetCreateModal(),
          });
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        width={1080}
      >
        <Form<OrderCreateForm>
          form={createForm}
          layout="vertical"
          className="crm-order-create-form"
          initialValues={{
            order_type: "delivery",
            factory_mode: "existing",
            factory_contact_mode: "existing",
            client_goods_value_currency: "EUR",
            documents: [],
            goods_lines: [],
          }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <div className="crm-order-create-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Основное
            </Typography.Title>
            <div className="crm-order-create-grid">
              <Form.Item name="order_number" label="Номер заказа (опционально)" className="crm-order-create-col">
                <Input />
              </Form.Item>

              {!isClientRole ? (
                <Form.Item
                  name="company_id"
                  label="Клиент (компания)"
                  rules={[{ required: true }]}
                  className="crm-order-create-col"
                >
                  <Select
                    showSearch
                    filterOption={false}
                    loading={clientCompaniesQuery.isLoading}
                    options={clientCompanyOptions}
                    onSearch={(value) => setClientCompaniesQueryText(value)}
                    onChange={() => createForm.setFieldValue("company_contact_id", undefined)}
                    placeholder="Начните вводить название компании"
                  />
                </Form.Item>
              ) : null}

              {!isClientRole ? (
                <Form.Item
                  name="company_contact_id"
                  label="Имя клиента"
                  rules={[{ required: true, message: "Выберите контакт компании" }]}
                  className="crm-order-create-col"
                >
                  <Select
                    allowClear
                    disabled={!selectedCompanyContacts.length}
                    options={selectedCompanyContacts.map((contact) => ({
                      label:
                        [contact.full_name, contact.job_title, contact.email, contact.phone]
                          .filter(Boolean)
                          .join(" · ") || `Contact #${contact.id}`,
                      value: contact.id,
                    }))}
                    placeholder={selectedCompanyContacts.length ? "Выберите контакт" : "Сначала выберите компанию"}
                  />
                </Form.Item>
              ) : null}

              <Form.Item
                name="order_type"
                label="Тип заказа"
                rules={[{ required: true }]}
                className="crm-order-create-col"
              >
                <Select
                  loading={createMetadataQuery.isLoading}
                  options={orderTypeCreateOptions}
                  placeholder={orderTypeCreateOptions.length ? undefined : "Нет доступных типов в metadata"}
                />
              </Form.Item>

              <Form.Item
                name="ready_date"
                label="Дата готовности"
                rules={[{ required: true }]}
                className="crm-order-create-col"
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="YYYY-MM-DD"
                  disabledDate={(current) => Boolean(current && current.startOf("day").isBefore(dayjs().startOf("day")))}
                />
              </Form.Item>

              <Form.Item name="pickup_date_from" label="Вывоз: От" className="crm-order-create-col">
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
              </Form.Item>

              <Form.Item
                name="pickup_date_to"
                label="Вывоз: До"
                dependencies={["pickup_date_from"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value: dayjs.Dayjs | undefined) {
                      const from = getFieldValue("pickup_date_from") as dayjs.Dayjs | undefined;
                      if (!from || !value || !from.isAfter(value, "day")) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Дата 'До' должна быть не раньше даты 'От'"));
                    },
                  }),
                ]}
                className="crm-order-create-col"
              >
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
              </Form.Item>

              <Form.Item name="invoice_on_other_company" valuePropName="checked" className="crm-order-create-col">
                <Checkbox>Инвойс на другую компанию</Checkbox>
              </Form.Item>

              <Form.Item name="invoice_number" label="Инвойс / проформа" className="crm-order-create-col">
                <Input />
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, next) => prev.invoice_on_other_company !== next.invoice_on_other_company}>
                {({ getFieldValue }) =>
                  getFieldValue("invoice_on_other_company") ? (
                    <Form.Item
                      name="invoice_company_name"
                      label="Название компании для инвойса"
                      rules={[{ required: true, message: "Укажите название компании" }]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Form.Item name="comment" label="Комментарий" className="crm-order-create-col">
                <Input.TextArea rows={2} />
              </Form.Item>

              {isRequestCreate ? (
                <Form.Item
                  name="request_payload_json"
                  label="raw_payload (JSON, опционально)"
                  className="crm-order-create-col crm-order-create-col-span-2"
                >
                  <Input.TextArea rows={3} placeholder='{"legacy_request_form":{"comment":"From UI"}}' />
                </Form.Item>
              ) : null}
            </div>

            <Form.Item
              name="additional_description"
              label="Описание заказа"
              className="crm-order-create-col crm-order-create-col-full"
            >
              <Input.TextArea rows={4} />
            </Form.Item>
          </div>

          {!isClientRole ? (
            <div className="crm-order-create-section">
              <Typography.Title level={5} className="crm-order-create-section-title">
                Self-delivery и экспедитор
              </Typography.Title>
              <div className="crm-order-create-grid">
                {canEditRestrictedCreateFields ? (
                  <Form.Item
                    name="assigned_forwarder_user_id"
                    label="Назначить экспедитора"
                    className="crm-order-create-col"
                  >
                    <Select
                      allowClear
                      loading={forwardersQuery.isLoading}
                      options={(forwardersQuery.data?.items ?? []).map((user) => ({
                        label: `${user.id} - ${user.full_name || user.login}`,
                        value: user.id,
                      }))}
                    />
                  </Form.Item>
                ) : null}

                <Form.Item name="self_delivery" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>Self-delivery</Checkbox>
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, next) => prev.self_delivery !== next.self_delivery}>
                  {({ getFieldValue }) =>
                    getFieldValue("self_delivery") ? (
                      <Form.Item
                        name="self_delivery_forwarder_user_id"
                        label="Экспедитор для self-delivery"
                        rules={[{ required: true, message: "Выберите экспедитора" }]}
                        className="crm-order-create-col"
                      >
                        <Select
                          loading={createMetadataQuery.isLoading}
                          options={selfDeliveryForwarderOptions}
                          placeholder={selfDeliveryForwarderOptions.length ? undefined : "Нет экспедиторов в metadata"}
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>

                {canEditRestrictedCreateFields ? (
                  <Form.Item name="is_priority" valuePropName="checked" className="crm-order-create-col">
                    <Checkbox>Высокий приоритет</Checkbox>
                  </Form.Item>
                ) : null}

                {canEditRestrictedCreateFields ? (
                  <Form.Item name="office_mark_codes" label="Office mark codes" className="crm-order-create-col">
                    <Select mode="multiple" allowClear options={officeMarkOptions} />
                  </Form.Item>
                ) : null}

                <Form.Item
                  name="product_characteristic_codes"
                  label="Product characteristic codes"
                  className="crm-order-create-col"
                >
                  <Select mode="multiple" allowClear options={productCharacteristicOptions} />
                </Form.Item>
              </div>
            </div>
          ) : null}

          <div className="crm-order-create-section crm-order-create-factory-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Фабрика
            </Typography.Title>
            <Card size="small" className="crm-order-create-factory-card">
              <div className="crm-order-create-grid">
                <Form.Item
                  name="factory_mode"
                  label="Режим выбора фабрики"
                  rules={[{ required: true, message: "Выберите режим фабрики" }]}
                  className="crm-order-create-col"
                >
                  <Select
                    options={[
                      { label: "Выбрать существующую", value: "existing" },
                      { label: "Создать новую", value: "create" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="factory_country_id"
                  label="Страна фабрики"
                  rules={[{ required: true, message: "Выберите страну" }]}
                  className="crm-order-create-col"
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    loading={countriesQuery.isLoading}
                    options={countryOptions}
                    onChange={() => {
                      createForm.setFieldValue("factory_id", undefined);
                      createForm.setFieldValue("loading_address_id", undefined);
                      createForm.setFieldValue("email_id", undefined);
                      createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], undefined);
                      createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="factory_contact_mode"
                  label="Контакт фабрики"
                  rules={[{ required: true, message: "Выберите режим контакта фабрики" }]}
                  className="crm-order-create-col"
                >
                  <Select
                    options={[
                      { label: "Выбрать существующий контакт", value: "existing" },
                      { label: "Создать контакт", value: "create" },
                    ]}
                  />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, next) => prev.factory_contact_mode !== next.factory_contact_mode}>
                  {({ getFieldValue }) =>
                    getFieldValue("factory_contact_mode") === "existing" ? (
                      <Form.Item
                        name="factory_contact_id"
                        label="Контакт фабрики (ID)"
                        rules={[{ required: true, message: "Укажите ID контакта фабрики" }]}
                        className="crm-order-create-col"
                      >
                        <InputNumber min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    ) : (
                      <>
                        <Form.Item
                          name={["create_factory_contact", "full_name"]}
                          label="Контакт фабрики: ФИО"
                          rules={[{ required: true, message: "Укажите ФИО контакта" }]}
                          className="crm-order-create-col"
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={["create_factory_contact", "phone"]}
                          label="Контакт фабрики: Телефон"
                          rules={[
                            { required: true, message: "Укажите телефон контакта" },
                            { pattern: PHONE_FORMAT_REGEX, message: "Допустимы цифры, пробелы и символы + ( ) -" },
                          ]}
                          className="crm-order-create-col"
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={["create_factory_contact", "email"]}
                          label="Контакт фабрики: Email"
                          rules={[{ type: "email", message: "Введите корректный email" }]}
                          className="crm-order-create-col"
                        >
                          <Input />
                        </Form.Item>
                      </>
                    )
                  }
                </Form.Item>

                {createFactoryMode === "existing" ? (
                  <>
                    <Form.Item name="factory_id" label="Фабрика" rules={[{ required: true }]} className="crm-order-create-col">
                      <Select
                        showSearch
                        optionFilterProp="label"
                        loading={factoryOptionsQuery.isLoading}
                        disabled={!createFactoryCountryId}
                        options={(factoryOptionsQuery.data ?? []).map((factory) => ({
                          label: factory.subtitle ? `${factory.name} (${factory.subtitle})` : factory.name,
                          value: factory.id,
                        }))}
                        onChange={() => {
                          createForm.setFieldValue("loading_address_id", undefined);
                          createForm.setFieldValue("email_id", undefined);
                        }}
                        notFoundContent={createFactoryCountryId ? "Нет фабрик в выбранной стране" : "Сначала выберите страну"}
                      />
                    </Form.Item>

                    <Form.Item
                      name="loading_address_id"
                      label="Адрес погрузки"
                      rules={[{ required: true }]}
                      className="crm-order-create-col crm-order-create-col-full"
                    >
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

                    <Form.Item label="Контакт (из адреса погрузки)" className="crm-order-create-col">
                      <Input readOnly value={selectedLoadingAddress?.contact_name ?? ""} placeholder="Будет заполнено автоматически" />
                    </Form.Item>

                    <Form.Item label="Телефон (из адреса погрузки)" className="crm-order-create-col">
                      <Input readOnly value={selectedLoadingAddress?.phone ?? ""} placeholder="Будет заполнено автоматически" />
                    </Form.Item>

                    {!isClientRole ? (
                      <Form.Item
                        name="email_id"
                        label="Email фабрики"
                        rules={[{ required: true, message: "Выберите email фабрики" }]}
                        className="crm-order-create-col"
                      >
                        <Select
                          allowClear
                          loading={factoryEmailsQuery.isLoading}
                          disabled={!createFactoryId}
                          options={factoryEmailOptions}
                          placeholder={createFactoryId ? "Выберите email" : "Сначала выберите фабрику"}
                        />
                      </Form.Item>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Form.Item
                      name={["create_factory", "factory_name"]}
                      label="Название фабрики"
                      rules={[{ required: true, message: "Укажите название фабрики" }]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "address"]}
                      label="Адрес погрузки"
                      rules={[{ required: true, message: "Укажите адрес" }]}
                      className="crm-order-create-col crm-order-create-col-span-2"
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "primary_email"]}
                      label="Primary email фабрики"
                      rules={[
                        { required: true, message: "Укажите email" },
                        { type: "email", message: "Введите корректный email" },
                      ]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "postcode_id"]}
                      label="Индекс"
                      rules={[{ required: true, message: "Выберите индекс" }]}
                      className="crm-order-create-col"
                    >
                      <Select
                        showSearch
                        filterOption={false}
                        onSearch={(value) => setPostcodeQueryText(value)}
                        loading={postcodesQuery.isLoading}
                        options={postcodeOptions}
                        onChange={() => createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined)}
                      />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "city_id"]}
                      label="Город"
                      rules={[{ required: true, message: "Выберите город" }]}
                      className="crm-order-create-col"
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        loading={postcodeCitiesQuery.isLoading}
                        options={postcodeCityOptions}
                        disabled={!createFactoryPostcodeId}
                      />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "phone"]}
                      label="Телефон адреса погрузки"
                      rules={[
                        { required: true, message: "Укажите телефон" },
                        { pattern: PHONE_FORMAT_REGEX, message: "Допустимы цифры, пробелы и символы + ( ) -" },
                      ]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "contact_name"]}
                      label="Контактное лицо"
                      rules={[{ required: true, message: "Укажите контактное лицо" }]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory", "loading_address", "fax"]}
                      label="Fax (опционально)"
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>

                    {canUseMessengerFields ? (
                      <Form.Item
                        name={["create_factory", "loading_address", "messenger_type"]}
                        label="Тип мессенджера"
                        className="crm-order-create-col"
                      >
                        <Select allowClear loading={messengerTypesQuery.isLoading} options={messengerTypeOptions} />
                      </Form.Item>
                    ) : null}

                    {canUseMessengerFields ? (
                      <Form.Item
                        name={["create_factory", "loading_address", "messenger_value"]}
                        label="Контакт мессенджера"
                        className="crm-order-create-col"
                      >
                        <Input />
                      </Form.Item>
                    ) : null}
                  </>
                )}
              </div>

              {createFactoryMode === "existing" && !isClientRole && canManageFactoryEmails ? (
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    placeholder="Добавить email фабрики"
                    value={newFactoryEmail}
                    onChange={(event) => setNewFactoryEmail(event.target.value)}
                  />
                  <Button
                    loading={createFactoryEmailMutation.isPending}
                    onClick={() => {
                      if (!createFactoryId) {
                        message.error("Сначала выберите фабрику");
                        return;
                      }
                      const email = trimOrUndefined(newFactoryEmail);
                      if (!email) {
                        message.error("Введите email");
                        return;
                      }
                      createFactoryEmailMutation.mutate({ factoryId: createFactoryId, email });
                    }}
                  >
                    Добавить email
                  </Button>
                </Space.Compact>
              ) : null}

              {createFactoryMode === "create" && canInlineCreatePostcodeCity ? (
                <div className="crm-order-create-inline-actions">
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      placeholder="Новый индекс (inline create)"
                      value={inlinePostcodeValue}
                      onChange={(event) => setInlinePostcodeValue(event.target.value)}
                    />
                    <Button
                      loading={createPostcodeMutation.isPending}
                      onClick={() => {
                        if (!createFactoryCountryId) {
                          message.error("Сначала выберите страну фабрики");
                          return;
                        }
                        const postcode = trimOrUndefined(inlinePostcodeValue);
                        if (!postcode) {
                          message.error("Введите индекс");
                          return;
                        }
                        createPostcodeMutation.mutate({ country_id: createFactoryCountryId, postcode });
                      }}
                    >
                      Создать индекс
                    </Button>
                  </Space.Compact>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      placeholder="Новый город (inline create)"
                      value={inlineCityValue}
                      onChange={(event) => setInlineCityValue(event.target.value)}
                    />
                    <Button
                      loading={createPostcodeCityMutation.isPending}
                      onClick={() => {
                        if (!createFactoryPostcodeId) {
                          message.error("Сначала выберите индекс");
                          return;
                        }
                        const city = trimOrUndefined(inlineCityValue);
                        if (!city) {
                          message.error("Введите город");
                          return;
                        }
                        createPostcodeCityMutation.mutate({ postcodeId: createFactoryPostcodeId, city });
                      }}
                    >
                      Создать город
                    </Button>
                  </Space.Compact>
                </div>
              ) : null}
            </Card>
          </div>

          {!isClientRole ? (
            <div className="crm-order-create-section">
              <Typography.Title level={5} className="crm-order-create-section-title">
                Операционные поля
              </Typography.Title>
              <div className="crm-order-create-grid">
                <Form.Item name="measurement_status" label="Статус измерений" className="crm-order-create-col">
                  <Select allowClear options={measurementStatusOptions} />
                </Form.Item>
                <Form.Item name="measurement_comment" label="Комментарий измерений" className="crm-order-create-col">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="weighing_status" label="Статус взвешивания" className="crm-order-create-col">
                  <Select allowClear options={weighingStatusOptions} />
                </Form.Item>
                <Form.Item name="weighing_comment" label="Комментарий взвешивания" className="crm-order-create-col">
                  <Input.TextArea rows={2} />
                </Form.Item>
                {canEditRestrictedCreateFields ? (
                  <Form.Item name="user_comment" label="Комментарий клиента (внутр.)" className="crm-order-create-col">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                ) : null}
                {canEditRestrictedCreateFields ? (
                  <Form.Item
                    name="forwarder_comment"
                    label="Комментарий экспедитора (внутр.)"
                    className="crm-order-create-col"
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                ) : null}
                {canEditRestrictedCreateFields ? (
                  <Form.Item name="warehouse_comment" label="Комментарий склада (внутр.)" className="crm-order-create-col">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="crm-order-create-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Список товаров
            </Typography.Title>
            <Form.List name="goods_lines">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Строка #${field.name + 1}`}
                      extra={
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          Удалить
                        </Button>
                      }
                    >
                      <div className="crm-order-create-grid">
                        <Form.Item name={[field.name, "item_type"]} label="Тип позиции" className="crm-order-create-col">
                          <Select allowClear options={itemTypeOptions} />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "custom_item_type"]}
                          label="Custom тип (если other)"
                          className="crm-order-create-col"
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "description"]} label="Описание" className="crm-order-create-col">
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "weight_kg"]} label="Вес, кг" className="crm-order-create-col">
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "quantity_unit"]} label="Ед. изм." className="crm-order-create-col">
                          <Select allowClear options={quantityUnitOptions} />
                        </Form.Item>
                        <Form.Item name={[field.name, "quantity_value"]} label="Количество" className="crm-order-create-col">
                          <Input />
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button onClick={() => add()} block>
                    Добавить строку товара
                  </Button>
                </Space>
              )}
            </Form.List>
          </div>

          <div className="crm-order-create-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Данные заказа
            </Typography.Title>
            <div className="crm-order-create-grid">
              <Form.Item name="declared_volume_m3" label="Заявленный объем, м3" className="crm-order-create-col">
                <Input />
              </Form.Item>
              <Form.Item
                name="declared_total_weight_kg"
                label="Вес, кг"
                className="crm-order-create-col"
              >
                <Input />
              </Form.Item>
              <Form.Item name="cargo_places_qty" label="Кол-во мест" className="crm-order-create-col">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="client_goods_value_amount" label="Сумма" className="crm-order-create-col">
                <Input />
              </Form.Item>
              <Form.Item name="client_goods_value_currency" label="Валюта" className="crm-order-create-col">
                <Select
                  options={[
                    { label: "USD", value: "USD" },
                    { label: "EUR", value: "EUR" },
                    { label: "OTHER", value: "OTHER" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, next) =>
                  prev.client_goods_value_currency !== next.client_goods_value_currency
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue("client_goods_value_currency") === "OTHER" ? (
                    <Form.Item
                      name="client_goods_value_currency_other_label"
                      label="Другая валюта"
                      rules={[{ required: true, message: "Укажите валюту" }]}
                      className="crm-order-create-col"
                    >
                      <Input />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
              {!isClientRole ? (
                <Form.Item name="is_1c" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>1С</Checkbox>
                </Form.Item>
              ) : null}
            </div>
          </div>

          {!isClientRole && canEditRestrictedCreateFields ? (
            <div className="crm-order-create-section">
              <Typography.Title level={5} className="crm-order-create-section-title">
                Оплата / Проверка
              </Typography.Title>
              <div className="crm-order-create-grid">
                <Form.Item name="is_factory_payment_via_company" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>Оплата через компанию</Checkbox>
                </Form.Item>
                <Form.Item name="is_factory_payment_completed" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>Оплачено компанией</Checkbox>
                </Form.Item>
                <Form.Item name="is_checked" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>Проверен</Checkbox>
                </Form.Item>
              </div>
            </div>
          ) : null}

          <div className="crm-order-create-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Документы (до 10 файлов)
            </Typography.Title>
            <Form.List name="documents">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Документ #${field.name + 1}`}
                      extra={
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          Удалить
                        </Button>
                      }
                    >
                      <div className="crm-order-create-grid">
                        <Form.Item
                          name={[field.name, "document_type"]}
                          label="Тип документа"
                          rules={[{ required: true, message: "Укажите тип документа" }]}
                          className="crm-order-create-col"
                        >
                          <Select allowClear options={documentTypeOptions} />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "display_name"]}
                          label="Отображаемое имя (опционально)"
                          className="crm-order-create-col"
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "file_list"]}
                          label="Файл"
                          valuePropName="fileList"
                          getValueFromEvent={(event) => event?.fileList}
                          rules={[{ required: true, message: "Выберите файл" }]}
                          className="crm-order-create-col"
                        >
                          <Upload beforeUpload={() => false} maxCount={1}>
                            <Button>Выбрать файл</Button>
                          </Upload>
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button onClick={() => add()} block disabled={fields.length >= 10}>
                    Добавить документ
                  </Button>
                </Space>
              )}
            </Form.List>
          </div>
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
          onFinish={(values: {
            amount?: number | null;
            currency?: string;
            special_tariff_currency_other_label?: string;
          }) => {
            if (!selected) return;
            specialTariffMutation.mutate({
              id: selected.id,
              amount: values.amount,
              currency: values.currency || "EUR",
              special_tariff_currency_other_label: values.special_tariff_currency_other_label,
            });
          }}
        >
          <Form.Item name="amount" label="Сумма (пусто = очистить)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "USD", value: "USD" },
                { label: "EUR", value: "EUR" },
                { label: "OTHER", value: "OTHER" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.currency !== next.currency}>
            {({ getFieldValue }) =>
              getFieldValue("currency") === "OTHER" ? (
                <Form.Item
                  name="special_tariff_currency_other_label"
                  label="Текст валюты для OTHER"
                  rules={[{ required: true, message: "Укажите текст валюты" }]}
                >
                  <Input />
                </Form.Item>
              ) : null
            }
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
          onFinish={(values: { amount: number; currency?: string; quote_price_currency_other_label?: string }) => {
            if (!selected) return;
            quotePriceMutation.mutate({
              id: selected.id,
              amount: values.amount,
              currency: values.currency,
              quote_price_currency_other_label: values.quote_price_currency_other_label,
            });
          }}
        >
          <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "USD", value: "USD" },
                { label: "EUR", value: "EUR" },
                { label: "OTHER", value: "OTHER" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.currency !== next.currency}>
            {({ getFieldValue }) =>
              getFieldValue("currency") === "OTHER" ? (
                <Form.Item
                  name="quote_price_currency_other_label"
                  label="Текст валюты для OTHER"
                  rules={[{ required: true, message: "Укажите текст валюты" }]}
                >
                  <Input />
                </Form.Item>
              ) : null
            }
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
          onFinish={(values: {
            amount?: number | null;
            currency?: string;
            special_tariff_currency_other_label?: string;
          }) => {
            try {
              const normalized = normalizeCurrencyPayload(
                values.currency,
                values.special_tariff_currency_other_label,
                "special_tariff_currency_other_label",
              );
              runBulkMutation("special-tariff", {
                amount: values.amount ?? null,
                currency: normalized.currency,
                special_tariff_currency_other_label: normalized.otherLabel,
              });
            } catch (error) {
              message.error(error instanceof Error ? error.message : "Ошибка в валюте спецтарифа");
            }
          }}
        >
          <Form.Item name="amount" label="Сумма (пусто = очистить)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "USD", value: "USD" },
                { label: "EUR", value: "EUR" },
                { label: "OTHER", value: "OTHER" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.currency !== next.currency}>
            {({ getFieldValue }) =>
              getFieldValue("currency") === "OTHER" ? (
                <Form.Item
                  name="special_tariff_currency_other_label"
                  label="Текст валюты для OTHER"
                  rules={[{ required: true, message: "Укажите текст валюты" }]}
                >
                  <Input />
                </Form.Item>
              ) : null
            }
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
