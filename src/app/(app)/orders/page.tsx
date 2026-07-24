"use client";

import {
  ApartmentOutlined,
  EditOutlined,
  FileTextOutlined,
  MessageOutlined,
  MoreOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Dropdown,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Tabs,
  Typography,
  Upload,
} from "antd";
import type { NamePath } from "antd/es/form/interface";
import type { ColumnType, ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs from "dayjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { OrderChatPanel } from "@/features/orders/order-chat-panel";
import { useCountryDirectory } from "@/shared/hooks/use-country-directory";
import { apiRequest } from "@/shared/lib/api";
import {
  findCountry,
  formatCountryEnglishName,
  getCountryEnglishName,
} from "@/shared/lib/countries";
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
import { downloadFileWithCredentials, getFileOperationErrorMessage } from "@/shared/lib/file-operations";
import {
  clampOrderCreateWizardStep,
  getOrderCreateWizardSteps,
} from "@/shared/lib/order-create-wizard";
import { getOrderActivityText, normalizeSpecialTariffText } from "@/shared/lib/order-activity";
import { buildOrderFactorySelectionPayload } from "@/shared/lib/order-factory-selection";
import {
  isCommercialOrderType,
  mapOrderValidationIssueToNamePath,
  resolvePostcodeCitySelection,
  validateOrderDecimal,
  validateOrderFormValues,
} from "@/shared/lib/order-form-validation";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { CREATE_ORDER_DRAFT_DEFAULTS, useOrderCreateDraftStore } from "@/shared/stores/order-create-draft-store";
import { useOrderEditDraftStore } from "@/shared/stores/order-edit-draft-store";
import { CountrySelect } from "@/shared/ui/country-select";
import { FilterPanel, PageToolbar } from "@/shared/ui/page-frame";
import type {
  BulkMutationResponse,
  ClientMessageInboxItem,
  ClientOrderCreateMetadata,
  Postcode,
  PostcodeCity,
  DictionaryOption,
  ClientFactoryDetail,
  ClientFactoryListItem,
  Country,
  Factory,
  FactoryLoadingAddress,
  MeasurementPayload,
  OrderEditFactorySelection,
  OrderClientCompanyLookupItem,
  OrderCreateMetadata,
  OrderDetail,
  OrderDocument,
  OrderFilterParams,
  OrderInternalEditRead,
  OrderListItem,
  OrderStatusHistoryItem,
  PaginatedResponse,
  Trip,
  UserAdmin,
} from "@/shared/types/entities";

type CreateMode = "existing" | "create";
type FactoryContactOption = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  is_primary?: boolean;
};

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
      name?: string;
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
  certificate_intent?: string | null;
  certificate_intent_enabled?: boolean;
  new_factory_email_contact_name?: string;
  new_factory_email_contact_phone?: string;
  client_measurement_ui?: string;
  client_weighing_ui?: string;
  loading_postcode_id_ui?: number;
  loading_city_id_ui?: number;
};

type OrderEditForm = {
  order_date?: dayjs.Dayjs;
  status_name?: OrderStatus;
  status_date?: dayjs.Dayjs;
  order_number?: string;
  company_id?: number;
  company_contact_id?: number;
  invoice_on_other_company?: boolean;
  invoice_company_name?: string;

  self_delivery?: boolean;
  assigned_forwarder_user_id?: number;
  self_delivery_forwarder_user_id?: number;
  factory_mode?: CreateMode;
  factory_country_id?: number;
  factory_id?: number;
  loading_address_id?: number;
  loading_postcode_id_ui?: number;
  loading_city_id_ui?: number;
  loading_address_line?: string;
  loading_address_fax?: string;
  factory_contact_id?: number;
  factory_contact_email?: string;
  factory_contact_name?: string;
  factory_contact_phone?: string;
  create_factory_contact?: {
    full_name?: string;
    phone?: string;
    email?: string;
  };
  create_factory?: {
    factory_name?: string;
    primary_email?: string;
    loading_address?: {
      name?: string;
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

  ready_date?: dayjs.Dayjs;
  pickup_date_from?: dayjs.Dayjs;
  pickup_date_to?: dayjs.Dayjs;
  certificate_intent_enabled?: boolean;
  certificate_intent?: string;

  invoice_number?: string;
  client_goods_value_amount?: string;
  client_goods_value_currency?: string;
  client_goods_value_currency_other_label?: string;
  goods_lines?: OrderCreateGoodsLineForm[];
  declared_volume_m3?: string;
  volume_m3?: string;
  declared_total_weight_kg?: string;
  cargo_places_qty?: number;
  measurement_status?: MeasurementPayload["status"];
  actual_volume_m3?: string;
  weighing_status?: MeasurementPayload["status"];
  actual_weight_kg?: string;
  actual_qty?: number;
  quantity_whs?: number;

  product_characteristic_codes?: string[];
  office_mark_codes?: string[];
  additional_description?: string;
  comment?: string;
  is_1c?: boolean;
  is_factory_payment_via_company?: boolean;
  is_checked?: boolean;
  is_factory_payment_completed?: boolean;
  mrn?: string;
  trip_id?: number;

  documents?: OrderCreateDocumentForm[];
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

function parseDayjsValue(value: string | null | undefined) {
  if (!value) return undefined;
  const next = dayjs(value);
  return next.isValid() ? next : undefined;
}

function toOptionalInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function normalizeGoodsLineFromDetail(line: unknown): OrderCreateGoodsLineForm {
  if (!line || typeof line !== "object" || Array.isArray(line)) {
    return {};
  }
  const source = line as Record<string, unknown>;
  const itemType = trimOrUndefined(typeof source.item_type === "string" ? source.item_type : undefined);
  const customItemType = trimOrUndefined(typeof source.custom_item_type === "string" ? source.custom_item_type : undefined);
  const description = trimOrUndefined(typeof source.description === "string" ? source.description : undefined);
  const weight = trimOrUndefined(
    typeof source.weight_kg === "string"
      ? source.weight_kg
      : typeof source.weight_kg === "number"
        ? String(source.weight_kg)
        : undefined,
  );
  const quantityValue = trimOrUndefined(
    typeof source.quantity_value === "string"
      ? source.quantity_value
      : typeof source.quantity_value === "number"
        ? String(source.quantity_value)
        : typeof source.quantity === "string"
          ? source.quantity
          : typeof source.quantity === "number"
            ? String(source.quantity)
            : undefined,
  );
  const quantityUnit = trimOrUndefined(
    typeof source.quantity_unit === "string"
      ? source.quantity_unit
      : typeof source.unit === "string"
        ? source.unit
        : undefined,
  );
  return {
    item_type: itemType,
    custom_item_type: itemType === "other" ? customItemType : undefined,
    description,
    weight_kg: weight,
    quantity_value: quantityValue,
    quantity_unit: quantityUnit,
  };
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
const ORDER_TRIP_SOURCE_MISMATCH_CODE = "order-trip-source-mismatch";
const REQUEST_DOCUMENT_TYPE_OPTIONS = [
  { label: "WORD", value: "word" },
  { label: "XLSX", value: "xlsx" },
  { label: "XLS", value: "xls" },
  { label: "PDF", value: "pdf" },
  { label: "ZIP", value: "zip" },
];
const REQUEST_BACKEND_DOCUMENT_TYPE = "goods_description_docs";
const ORDER_CURRENCY_OPTIONS = [
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "OTHER", value: "OTHER" },
];
const COMPACT_CREATE_MODAL_WIDTH = 720;
function formatRatio(numerator: string | undefined, denominator: string | undefined) {
  const nextNumerator = Number(numerator);
  const nextDenominator = Number(denominator);
  if (
    !Number.isFinite(nextNumerator) ||
    !Number.isFinite(nextDenominator) ||
    nextNumerator <= 0 ||
    nextDenominator <= 0
  ) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(nextNumerator / nextDenominator);
}

function isOrderTripSourceMismatch(detail: string | undefined) {
  if (!detail) return false;
  return detail.toLowerCase().includes(ORDER_TRIP_SOURCE_MISMATCH_CODE);
}

function getOrderTripSourceMismatchMessage() {
  return "Заказ не совпадает с точками выбранного рейса";
}

function formatOrderActivityDate(value: string | null | undefined) {
  return value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—";
}

function OrderActivityPanel({ items }: { items: OrderStatusHistoryItem[] }) {
  return (
    <>
      {items.length ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {items.map((item) => (
            <div className="crm-order-activity-item" key={item.id}>
              <Typography.Text>{getOrderActivityText(item)}</Typography.Text>
              <Typography.Text type="secondary" className="crm-order-activity-meta">
                {formatOrderActivityDate(item.created_at)} · Статус: {item.status_name} · Дата статуса:{" "}
                {item.status_date ?? "—"} · Пользователь: {item.changed_by_user_id ?? "—"}
              </Typography.Text>
            </div>
          ))}
        </Space>
      ) : (
        <Typography.Text type="secondary">Нет событий</Typography.Text>
      )}
    </>
  );
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

function asNamePathArray(name: NamePath) {
  return Array.isArray(name) ? name : [name];
}

function sameNamePath(left: NamePath, right: NamePath) {
  return JSON.stringify(asNamePathArray(left)) === JSON.stringify(asNamePathArray(right));
}

function getOrderDecimalMessage(
  fieldName: "client_goods_value_amount" | "declared_volume_m3" | "declared_total_weight_kg",
  reason: "required" | "invalid_number" | "must_be_positive",
) {
  const messages = {
    client_goods_value_amount: {
      required: "Укажите сумму инвойса",
      invalid_number: "Сумма инвойса должна быть числом",
      must_be_positive: "Сумма инвойса должна быть больше 0",
    },
    declared_volume_m3: {
      required: "Укажите заявленный объем",
      invalid_number: "Заявленный объем должен быть числом",
      must_be_positive: "Заявленный объем должен быть больше 0",
    },
    declared_total_weight_kg: {
      required: "Укажите заявленный вес",
      invalid_number: "Заявленный вес должен быть числом",
      must_be_positive: "Заявленный вес должен быть больше 0",
    },
  };
  return messages[fieldName][reason];
}

function createDecimalRule(
  fieldName: "client_goods_value_amount" | "declared_volume_m3" | "declared_total_weight_kg",
  required: boolean,
) {
  return {
    validator(_: unknown, value: string | undefined) {
      const result = validateOrderDecimal(value, { required });
      if (result.ok) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(getOrderDecimalMessage(fieldName, result.reason)));
    },
  };
}

function getOrderBackendIssueMessage(name: NamePath, fallback: string) {
  const key = asNamePathArray(name).at(-1);
  if (key === "invoice_number") return "Укажите номер инвойса";
  if (key === "client_goods_value_amount") return "Проверьте сумму инвойса";
  if (key === "client_goods_value_currency") return "Выберите валюту";
  if (key === "client_goods_value_currency_other_label") return "Для валюты OTHER укажите текстовое обозначение валюты";
  if (key === "declared_volume_m3") return "Проверьте заявленный объем";
  if (key === "declared_total_weight_kg") return "Проверьте заявленный вес";
  if (key === "loading_postcode_id_ui" || key === "postcode_id") return "Выберите индекс";
  if (key === "loading_city_id_ui" || key === "city_id") return "Выберите город";
  if (key === "company_contact_id") return "Выберите контакт компании";
  if (key === "factory_contact_id") return "Выберите email контакта фабрики";
  if (key === "loading_address_id") return "Выберите адрес погрузки";
  return fallback;
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
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [isHydrated, setIsHydrated] = useState(false);
  const isMobile = isHydrated ? !screens.md : false;

  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const isClientRole = normalizedRole === "client" && !meQuery.data?.is_superuser;
  const countryDirectoryScope = isClientRole ? "client" : "staff";
  const countryDirectory = useCountryDirectory(countryDirectoryScope);
  const canWriteOrder =
    meQuery.data?.is_superuser ||
    ["administrator", "manager", "logist", "accountant", "warehouse"].includes(normalizedRole);
  const canCreate =
    isClientRole ||
    meQuery.data?.is_superuser ||
    ["administrator", "manager", "logist", "forwarder"].includes(normalizedRole);
  const canRunOperationalActions =
    meQuery.data?.is_superuser || ["administrator", "manager", "logist"].includes(normalizedRole);
  const canQuotePrice = meQuery.data?.is_superuser || normalizedRole === "administrator" || normalizedRole === "manager";
  const permissionsReady = isHydrated && meQuery.isSuccess;
  const canCreateUi = permissionsReady && canCreate;
  const canWriteOrderUi = permissionsReady && canWriteOrder;
  const canRunOperationalActionsUi = permissionsReady && canRunOperationalActions;
  const canQuotePriceUi = permissionsReady && canQuotePrice;
  const isClientRoleUi = permissionsReady && isClientRole;
  const canEditRestrictedCreateFields =
    meQuery.data?.is_superuser || ["administrator", "manager", "logist"].includes(normalizedRole);
  const canInlineCreatePostcodeCity = canEditRestrictedCreateFields && !isClientRole;
  const canUseMessengerFields = canEditRestrictedCreateFields && !isClientRole;

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [orderSidePanel, setOrderSidePanel] = useState<"chat" | "archive">(
    searchParams.get("panel") === "archive" ? "archive" : "chat",
  );
  const [isEditMode, setIsEditMode] = useState(false);
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
  const [documentsOrder, setDocumentsOrder] = useState<OrderListItem | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [clientOrder, setClientOrder] = useState<OrderListItem | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [factoryOrder, setFactoryOrder] = useState<OrderListItem | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [forwarderOrder, setForwarderOrder] = useState<OrderListItem | null>(null);
  const [forwarderOpen, setForwarderOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderListItem | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [descriptionOrder, setDescriptionOrder] = useState<OrderListItem | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [clientCompaniesQueryText, setClientCompaniesQueryText] = useState("");
  const [factoryContactModalOpen, setFactoryContactModalOpen] = useState(false);
  const [factoryLoadingAddressModalOpen, setFactoryLoadingAddressModalOpen] = useState(false);
  const [editFactoryLoadingAddressModalOpen, setEditFactoryLoadingAddressModalOpen] = useState(false);
  const [goodsLineModalOpen, setGoodsLineModalOpen] = useState(false);
  const [goodsLineEditIndex, setGoodsLineEditIndex] = useState<number | null>(null);
  const [editFactoryContactModalOpen, setEditFactoryContactModalOpen] = useState(false);
  const [editGoodsLineModalOpen, setEditGoodsLineModalOpen] = useState(false);
  const [editGoodsLineEditIndex, setEditGoodsLineEditIndex] = useState<number | null>(null);
  const [editCompanyQueryText, setEditCompanyQueryText] = useState("");
  const [editPostcodeQuery, setEditPostcodeQuery] = useState("");
  const [editPostcodeQueryDebounced, setEditPostcodeQueryDebounced] = useState("");
  const [editContactEmailOptions, setEditContactEmailOptions] = useState<FactoryContactOption[]>([]);
  const [factoryCreateConfirmed, setFactoryCreateConfirmed] = useState(false);
  const [factoryCreateSubmitting, setFactoryCreateSubmitting] = useState(false);
  const [editFactoryCreateConfirmed, setEditFactoryCreateConfirmed] = useState(false);
  const [editFactoryCreateSubmitting, setEditFactoryCreateSubmitting] = useState(false);
  const [postcodeQuery, setPostcodeQuery] = useState("");
  const [factorySearchTerm, setFactorySearchTerm] = useState("");
  const [editFactorySearchTerm, setEditFactorySearchTerm] = useState("");
  const [createdFactoryOption, setCreatedFactoryOption] = useState<{ id: number; name: string; subtitle: string } | null>(null);
  const [createdLoadingAddressOption, setCreatedLoadingAddressOption] = useState<FactoryLoadingAddress | null>(null);
  const [editCreatedFactoryOption, setEditCreatedFactoryOption] = useState<{ id: number; name: string; subtitle: string } | null>(null);
  const [editCreatedLoadingAddressOption, setEditCreatedLoadingAddressOption] = useState<FactoryLoadingAddress | null>(null);
  const [postcodeQueryDebounced, setPostcodeQueryDebounced] = useState("");
  const createDraft = useOrderCreateDraftStore((state) => state.draft);
  const setCreateDraft = useOrderCreateDraftStore((state) => state.setDraft);
  const mergeCreateDraft = useOrderCreateDraftStore((state) => state.mergeDraft);
  const resetCreateDraft = useOrderCreateDraftStore((state) => state.resetDraft);
  const editDraftsByOrderId = useOrderEditDraftStore((state) => state.draftsByOrderId);
  const setEditDraft = useOrderEditDraftStore((state) => state.setDraft);
  const mergeEditDraft = useOrderEditDraftStore((state) => state.mergeDraft);
  const resetEditDraft = useOrderEditDraftStore((state) => state.resetDraft);
  const isRehydratingCreateFormRef = useRef(false);
  const isRehydratingEditFormRef = useRef(false);
  const hydratedEditOrderIdRef = useRef<number | null>(null);

  const [createForm] = Form.useForm<OrderCreateForm>();
  const [editForm] = Form.useForm<OrderEditForm>();
  const [statusForm] = Form.useForm<{ status_name: OrderStatus; status_date?: dayjs.Dayjs }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();
  const [assignForwarderForm] = Form.useForm<{ assigned_forwarder_user_id?: number }>();
  const [pickupForm] = Form.useForm<{ pickup_date: dayjs.Dayjs }>();
  const [specialTariffForm] = Form.useForm<{ special_tariff?: string | null }>();
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
  const [bulkSpecialTariffForm] = Form.useForm<{ special_tariff?: string | null }>();
  const [bulkCommentForm] = Form.useForm<{ comment: string }>();
  const [factoryContactQuickForm] = Form.useForm<{ full_name?: string; phone?: string; email?: string }>();
  const [editFactoryContactQuickForm] = Form.useForm<{ full_name?: string; phone?: string; email?: string }>();
  const [factoryLoadingAddressQuickForm] = Form.useForm<{ name?: string; address?: string; postcode_id?: number; city_id?: number }>();
  const [editFactoryLoadingAddressQuickForm] = Form.useForm<{ name?: string; address?: string; postcode_id?: number; city_id?: number }>();
  const [goodsLineQuickForm] = Form.useForm<OrderCreateGoodsLineForm>();
  const [editGoodsLineQuickForm] = Form.useForm<OrderCreateGoodsLineForm>();
  const loadingAddressQuickPostcodeId = Form.useWatch("postcode_id", factoryLoadingAddressQuickForm) as number | undefined;
  const editLoadingAddressQuickPostcodeId = Form.useWatch("postcode_id", editFactoryLoadingAddressQuickForm) as number | undefined;
  const createFactoryId = Form.useWatch("factory_id", createForm);
  const createFactoryMode = (Form.useWatch("factory_mode", createForm) as CreateMode | undefined) ?? "existing";
  const goodsLineRows = useMemo(
    () => ((createDraft.goods_lines as OrderCreateGoodsLineForm[] | undefined) ?? []),
    [createDraft.goods_lines],
  );
  const createClientGoodsValueCurrency = Form.useWatch("client_goods_value_currency", createForm);
  const createOrderType = Form.useWatch("order_type", createForm);
  const createSelfDelivery = Boolean(Form.useWatch("self_delivery", createForm));
  const createCertificateIntentEnabled = Boolean(Form.useWatch("certificate_intent_enabled", createForm));
  const createClientGoodsValueAmount = Form.useWatch("client_goods_value_amount", createForm);
  const createDeclaredVolumeM3 = Form.useWatch("declared_volume_m3", createForm);
  const createDeclaredTotalWeightKg = Form.useWatch("declared_total_weight_kg", createForm);
  const createCompanyId = Form.useWatch("company_id", createForm);
  const createFactoryCountryId = Form.useWatch("factory_country_id", createForm) as number | undefined;
  const createLoadingAddressId = Form.useWatch("loading_address_id", createForm);
  const createFactoryContactId = Form.useWatch("factory_contact_id", createForm) as number | undefined;
  const currentCreateOrderType = (createOrderType ??
    (createDraft.order_type as OrderType | undefined) ??
    "delivery") as OrderType;
  const isRequestCreate = currentCreateOrderType === "request";
  const createWizardSteps = useMemo(() => getOrderCreateWizardSteps(currentCreateOrderType), [currentCreateOrderType]);
  const createWizardLastStep = createWizardSteps.length - 1;
  const createWizardStepKey = createWizardSteps[createStep]?.key ?? createWizardSteps[createWizardLastStep]?.key;
  const selectedOrderId = selected?.id;
  const editFactoryId = Form.useWatch("factory_id", editForm) as number | undefined;
  const editFactoryMode = (Form.useWatch("factory_mode", editForm) as CreateMode | undefined) ?? "existing";
  const editCompanyId = Form.useWatch("company_id", editForm) as number | undefined;
  const editFactoryCountryId = Form.useWatch("factory_country_id", editForm) as number | undefined;
  const editLoadingAddressId = Form.useWatch("loading_address_id", editForm) as number | undefined;
  const editLoadingPostcodeIdUi = Form.useWatch("loading_postcode_id_ui", editForm) as number | undefined;
  const editSelfDelivery = Boolean(Form.useWatch("self_delivery", editForm));
  const editCertificateIntentEnabled = Boolean(Form.useWatch("certificate_intent_enabled", editForm));
  const editClientGoodsCurrency = Form.useWatch("client_goods_value_currency", editForm);
  const editMeasurementStatus = Form.useWatch("measurement_status", editForm);
  const editWeighingStatus = Form.useWatch("weighing_status", editForm);
  const currentEditOrderType = (selected?.order_type ?? "delivery") as OrderType;
  const isCommercialCreate = isCommercialOrderType(currentCreateOrderType);
  const isCommercialEdit = isCommercialOrderType(currentEditOrderType);
  const editDraftRecord = selectedOrderId ? editDraftsByOrderId[selectedOrderId] : undefined;
  const editGoodsLineRowsFromForm = Form.useWatch("goods_lines", editForm) as OrderCreateGoodsLineForm[] | undefined;
  const editGoodsLineRows = useMemo(
    () => editGoodsLineRowsFromForm ?? ((editDraftRecord?.values.goods_lines as OrderCreateGoodsLineForm[] | undefined) ?? []),
    [editDraftRecord?.values.goods_lines, editGoodsLineRowsFromForm],
  );

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const pathnameOrderId = useMemo(() => {
    const matched = pathname.match(/^\/orders\/(\d+)$/);
    if (!matched) return undefined;
    const parsed = Number(matched[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [pathname]);
  const deepLinkEditOrderId = pathnameOrderId ?? parseNumber(searchParams.get("edit_order_id"));
  const standaloneOrderView = pathnameOrderId !== undefined || searchParams.get("single_order_view") === "1";
  const deepLinkedOrderIdRef = useRef<number | null>(null);
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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnWidthsHydrated, setColumnWidthsHydrated] = useState(false);

  useEffect(() => {
    if (columnWidthsHydrated || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ORDER_TABLE_COLUMN_WIDTH_STORAGE_KEY);
      if (!raw) {
        setColumnWidthsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next = Object.entries(parsed).reduce<Record<string, number>>((acc, [key, value]) => {
        if (typeof value === "number" && Number.isFinite(value) && value >= ORDER_TABLE_MIN_COLUMN_WIDTH) {
          acc[key] = Math.round(value);
        }
        return acc;
      }, {});
      setColumnWidths(next);
    } catch {
      // ignore storage parse issues
    } finally {
      setColumnWidthsHydrated(true);
    }
  }, [columnWidthsHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!columnWidthsHydrated) return;
    try {
      window.localStorage.setItem(ORDER_TABLE_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // no-op: ignore storage write issues
    }
  }, [columnWidths, columnWidthsHydrated]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const requestedPanel = searchParams.get("panel") === "archive" ? "archive" : "chat";
    setOrderSidePanel((current) => (current === requestedPanel ? current : requestedPanel));
  }, [searchParams]);

  useEffect(() => {
    const nextStep = clampOrderCreateWizardStep(createStep, currentCreateOrderType);
    if (nextStep !== createStep) {
      setCreateStep(nextStep);
    }
  }, [createStep, currentCreateOrderType]);

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

  const editDetailQuery = useQuery({
    queryKey: selectedOrderId ? queryKeys.orders.detail(selectedOrderId) : ["orders", "detail", "none"],
    queryFn: () => apiRequest<OrderInternalEditRead>(`/api/orders/${selectedOrderId}`),
    enabled: editOpen && Boolean(selectedOrderId),
  });

  const documentsQuery = useQuery({
    queryKey: documentsOrder ? queryKeys.orders.documents(documentsOrder.id) : ["orders", "documents", "idle"],
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderDocument>>(`/api/orders/${documentsOrder?.id}/documents`, {
        query: { page: 1, page_size: 100 },
      }),
    enabled: documentsOpen && Boolean(documentsOrder),
  });

  const clientDetailQuery = useQuery({
    queryKey: clientOrder ? queryKeys.orders.detail(clientOrder.id) : ["orders", "client-detail", "idle"],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${clientOrder?.id}`),
    enabled: clientOpen && Boolean(clientOrder),
  });

  const factoryDetailQuery = useQuery({
    queryKey: factoryOrder ? queryKeys.orders.detail(factoryOrder.id) : ["orders", "factory-detail", "idle"],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${factoryOrder?.id}`),
    enabled: factoryOpen && Boolean(factoryOrder),
  });

  const forwarderDetailQuery = useQuery({
    queryKey: forwarderOrder ? queryKeys.orders.detail(forwarderOrder.id) : ["orders", "forwarder-detail", "idle"],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${forwarderOrder?.id}`),
    enabled: forwarderOpen && Boolean(forwarderOrder),
  });

  const forwarderUserId = forwarderDetailQuery.data?.assigned_forwarder_user_id ?? forwarderOrder?.assigned_forwarder_user_id;
  const personalManagerId = forwarderDetailQuery.data?.personal_manager_id ?? forwarderOrder?.personal_manager_id;

  const forwarderUserQuery = useQuery({
    queryKey: forwarderUserId ? queryKeys.users.detail(forwarderUserId) : ["users", "forwarder-detail", "idle"],
    queryFn: () => apiRequest<UserAdmin>(`/api/users/${forwarderUserId}`),
    enabled: forwarderOpen && Boolean(forwarderUserId),
  });

  const personalManagerQuery = useQuery({
    queryKey: personalManagerId ? queryKeys.users.detail(personalManagerId) : ["users", "personal-manager-detail", "idle"],
    queryFn: () => apiRequest<UserAdmin>(`/api/users/${personalManagerId}`),
    enabled: forwarderOpen && Boolean(personalManagerId),
  });

  const descriptionDetailQuery = useQuery({
    queryKey: descriptionOrder ? queryKeys.orders.detail(descriptionOrder.id) : ["orders", "description-detail", "idle"],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${descriptionOrder?.id}`),
    enabled: descriptionOpen && Boolean(descriptionOrder),
  });

  const deepLinkOrderQuery = useQuery({
    queryKey: deepLinkEditOrderId ? queryKeys.orders.detail(deepLinkEditOrderId) : ["orders", "deep-link", "none"],
    queryFn: () => apiRequest<OrderInternalEditRead>(`/api/orders/${deepLinkEditOrderId}`),
    enabled: standaloneOrderView && Boolean(deepLinkEditOrderId) && meQuery.isSuccess,
  });

  const createMetadataQuery = useQuery({
    queryKey: ["orders", "create-metadata", isClientRole],
    queryFn: () =>
      isClientRole
        ? apiRequest<ClientOrderCreateMetadata>("/api/client/orders/create-metadata")
        : apiRequest<OrderCreateMetadata>("/api/orders/create-metadata"),
    enabled: createOpen && canCreate,
  });

  const editMetadataQuery = useQuery({
    queryKey: ["orders", "edit-metadata"],
    queryFn: () => apiRequest<OrderCreateMetadata>("/api/orders/create-metadata"),
    enabled: editOpen && canWriteOrder,
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

  const editClientCompaniesQuery = useQuery({
    queryKey: ["orders", "edit-client-companies", editCompanyQueryText],
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderClientCompanyLookupItem>>("/api/orders/client-companies", {
        query: {
          page: 1,
          page_size: 50,
          query: editCompanyQueryText || undefined,
        },
      }),
    enabled: editOpen && !isClientRole && canWriteOrder,
  });

  const selectedEditCompany = useMemo(
    () =>
      (editClientCompaniesQuery.data?.items ?? []).find(
        (item) => item.company_id === editCompanyId,
      ),
    [editClientCompaniesQuery.data?.items, editCompanyId],
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
          subtitle: [
            formatCountryEnglishName(
              countryDirectory.countries,
              factory.country,
              "country_id" in factory && typeof factory.country_id === "number"
                ? factory.country_id
                : undefined,
            ),
            factory.city,
          ]
            .filter(Boolean)
            .join(", "),
        }));
      }

      const response = await apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200, sort_desc: false, country_id: createFactoryCountryId },
      });
      return response.items.map((factory) => ({
        id: factory.id,
        name: factory.name,
        subtitle: [
          formatCountryEnglishName(countryDirectory.countries, factory.country, factory.country_id),
          factory.city,
        ]
          .filter(Boolean)
          .join(", "),
      }));
    },
    enabled: createOpen && canCreate && createFactoryMode === "existing" && Boolean(createFactoryCountryId),
  });

  const editFactoryOptionsQuery = useQuery({
    queryKey: ["factories", "order-edit-options", editFactoryCountryId],
    queryFn: async () => {
      if (!editFactoryCountryId) {
        return [] as Array<{ id: number; name: string; subtitle: string }>;
      }
      const response = await apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200, sort_desc: false, country_id: editFactoryCountryId },
      });
      return response.items.map((factory) => ({
        id: factory.id,
        name: factory.name,
        subtitle: [
          formatCountryEnglishName(countryDirectory.countries, factory.country, factory.country_id),
          factory.city,
        ]
          .filter(Boolean)
          .join(", "),
      }));
    },
    enabled: editOpen && canWriteOrder && Boolean(editFactoryCountryId),
  });

  const factoryContactsQuery = useQuery({
    queryKey: ["orders", "create-factory-contacts", createFactoryId],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryContactOption>>(`/api/factories/${createFactoryId}/contacts`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: createOpen && !isClientRole && canCreate && createFactoryMode === "existing" && Boolean(createFactoryId),
  });

  const editFactoryContactsQuery = useQuery({
    queryKey: ["orders", "edit-factory-contacts", editFactoryId],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryContactOption>>(`/api/factories/${editFactoryId}/contacts`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: editOpen && canWriteOrder && Boolean(editFactoryId),
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

  const editLoadingAddressesQuery = useQuery({
    queryKey: ["orders", "edit-loading-addresses", editFactoryId],
    queryFn: () =>
      apiRequest<PaginatedResponse<FactoryLoadingAddress>>(`/api/factories/${editFactoryId}/loading-addresses`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: editOpen && canWriteOrder && Boolean(editFactoryId),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPostcodeQueryDebounced(postcodeQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [postcodeQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEditPostcodeQueryDebounced(editPostcodeQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [editPostcodeQuery]);

  const postcodeOptionsQuery = useQuery({
    queryKey: ["orders", "create-postcodes", isClientRole, createFactoryCountryId, postcodeQueryDebounced],
    queryFn: () =>
      apiRequest<PaginatedResponse<Postcode>>(isClientRole ? "/api/client/postcodes" : "/api/postcodes", {
        query: {
          page: 1,
          page_size: 200,
          country_id: createFactoryCountryId,
          query: postcodeQueryDebounced || undefined,
        },
      }),
    enabled: createOpen && canCreate && Boolean(createFactoryCountryId),
  });

  const editPostcodeOptionsQuery = useQuery({
    queryKey: ["orders", "edit-postcodes", editFactoryCountryId, editPostcodeQueryDebounced],
    queryFn: () =>
      apiRequest<PaginatedResponse<Postcode>>("/api/postcodes", {
        query: {
          page: 1,
          page_size: 200,
          country_id: editFactoryCountryId,
          query: editPostcodeQueryDebounced || undefined,
        },
      }),
    enabled: editOpen && canWriteOrder && Boolean(editFactoryCountryId),
  });

  const createLoadingPostcodeIdUi = Form.useWatch("loading_postcode_id_ui", createForm) as number | undefined;

  const postcodeCitiesQuery = useQuery({
    queryKey: ["orders", "create-postcode-cities", isClientRole, createLoadingPostcodeIdUi],
    queryFn: () =>
      apiRequest<PaginatedResponse<PostcodeCity>>(
        isClientRole
          ? `/api/client/postcodes/${createLoadingPostcodeIdUi}/cities`
          : `/api/postcodes/${createLoadingPostcodeIdUi}/cities`,
        {
          query: { page: 1, page_size: 200 },
        },
      ),
    enabled: createOpen && canCreate && Boolean(createLoadingPostcodeIdUi),
  });

  const editPostcodeCitiesQuery = useQuery({
    queryKey: ["orders", "edit-postcode-cities", editLoadingPostcodeIdUi],
    queryFn: () =>
      apiRequest<PaginatedResponse<PostcodeCity>>(`/api/postcodes/${editLoadingPostcodeIdUi}/cities`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: editOpen && canWriteOrder && Boolean(editLoadingPostcodeIdUi),
  });

  const loadingAddressQuickCitiesQuery = useQuery({
    queryKey: ["orders", "create-loading-address-quick-cities", isClientRole, loadingAddressQuickPostcodeId],
    queryFn: () =>
      apiRequest<PaginatedResponse<PostcodeCity>>(
        isClientRole
          ? `/api/client/postcodes/${loadingAddressQuickPostcodeId}/cities`
          : `/api/postcodes/${loadingAddressQuickPostcodeId}/cities`,
        { query: { page: 1, page_size: 200 } },
      ),
    enabled: createOpen && factoryLoadingAddressModalOpen && Boolean(loadingAddressQuickPostcodeId),
  });

  const editLoadingAddressQuickCitiesQuery = useQuery({
    queryKey: ["orders", "edit-loading-address-quick-cities", editLoadingAddressQuickPostcodeId],
    queryFn: () =>
      apiRequest<PaginatedResponse<PostcodeCity>>(`/api/postcodes/${editLoadingAddressQuickPostcodeId}/cities`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: editOpen && editFactoryLoadingAddressModalOpen && Boolean(editLoadingAddressQuickPostcodeId),
  });

  useEffect(() => {
    if (!factoryLoadingAddressModalOpen || !loadingAddressQuickPostcodeId || loadingAddressQuickCitiesQuery.isLoading) return;
    const currentCityId = factoryLoadingAddressQuickForm.getFieldValue("city_id") as number | undefined;
    const selection = resolvePostcodeCitySelection(currentCityId, loadingAddressQuickCitiesQuery.data?.items ?? []);
    if (selection.reason === "kept" || selection.reason === "multiple") return;
    factoryLoadingAddressQuickForm.setFieldValue("city_id", selection.value);
  }, [
    factoryLoadingAddressModalOpen,
    factoryLoadingAddressQuickForm,
    loadingAddressQuickCitiesQuery.data?.items,
    loadingAddressQuickCitiesQuery.isLoading,
    loadingAddressQuickPostcodeId,
  ]);

  useEffect(() => {
    if (!editFactoryLoadingAddressModalOpen || !editLoadingAddressQuickPostcodeId || editLoadingAddressQuickCitiesQuery.isLoading) return;
    const currentCityId = editFactoryLoadingAddressQuickForm.getFieldValue("city_id") as number | undefined;
    const selection = resolvePostcodeCitySelection(currentCityId, editLoadingAddressQuickCitiesQuery.data?.items ?? []);
    if (selection.reason === "kept" || selection.reason === "multiple") return;
    editFactoryLoadingAddressQuickForm.setFieldValue("city_id", selection.value);
  }, [
    editFactoryLoadingAddressModalOpen,
    editFactoryLoadingAddressQuickForm,
    editLoadingAddressQuickCitiesQuery.data?.items,
    editLoadingAddressQuickCitiesQuery.isLoading,
    editLoadingAddressQuickPostcodeId,
  ]);

  const toEditFormValues = useCallback(
    (detail: OrderInternalEditRead): OrderEditForm => {
      const order = detail.order;
      const factorySelection = (detail.factory_selection ?? {}) as OrderEditFactorySelection;
      const loadingAddress = factorySelection.loading_address ?? null;
      const factoryContact = factorySelection.factory_contact ?? null;
      const rawCertificateIntent = order.raw_payload?.certificate_intent;
      const certificateIntent = typeof rawCertificateIntent === "string" ? rawCertificateIntent : undefined;
      const goodsLines = (detail.goods_lines ?? []).map((line) => normalizeGoodsLineFromDetail(line));

      return {
        order_date: parseDayjsValue(order.order_date ?? undefined),
        status_name: order.status_name ?? undefined,
        status_date: parseDayjsValue(order.status_date ?? undefined),
        order_number: order.order_number ?? undefined,
        company_id: order.company_id ?? undefined,
        company_contact_id: undefined,
        invoice_on_other_company: toOptionalBoolean(order.raw_payload?.invoice_on_other_company),
        invoice_company_name: (order.raw_payload?.invoice_company_name as string | undefined) ?? undefined,
        self_delivery: toOptionalBoolean(order.raw_payload?.self_delivery),
        assigned_forwarder_user_id: order.assigned_forwarder_user_id ?? undefined,
        self_delivery_forwarder_user_id: toOptionalInteger(order.raw_payload?.self_delivery_forwarder_user_id),
        factory_mode: "existing",
        factory_country_id: factorySelection.country_id ?? undefined,
        factory_id: factorySelection.factory_id ?? undefined,
        loading_address_id: factorySelection.loading_address_id ?? undefined,
        loading_postcode_id_ui: loadingAddress?.postcode_id ?? undefined,
        loading_city_id_ui: loadingAddress?.city_id ?? undefined,
        loading_address_line: loadingAddress?.address ?? undefined,
        loading_address_fax: loadingAddress?.fax ?? undefined,
        factory_contact_id: factorySelection.factory_contact_id ?? undefined,
        factory_contact_email: factoryContact?.email ?? undefined,
        factory_contact_name: factoryContact?.full_name ?? undefined,
        factory_contact_phone: factoryContact?.phone ?? undefined,
        ready_date: parseDayjsValue(order.ready_date ?? undefined),
        pickup_date_from: parseDayjsValue((order.raw_payload?.pickup_date_from as string | undefined) ?? undefined),
        pickup_date_to: parseDayjsValue((order.raw_payload?.pickup_date_to as string | undefined) ?? undefined),
        certificate_intent_enabled: Boolean(certificateIntent),
        certificate_intent: certificateIntent,
        invoice_number: order.invoice_number ?? undefined,
        client_goods_value_amount:
          typeof order.client_goods_value_amount === "number"
            ? String(order.client_goods_value_amount)
            : (order.client_goods_value_amount ?? undefined),
        client_goods_value_currency: order.client_goods_value_currency ?? "EUR",
        client_goods_value_currency_other_label:
          (order.raw_payload?.client_goods_value_currency_other_label as string | undefined) ?? undefined,
        goods_lines: goodsLines,
        declared_volume_m3:
          typeof order.declared_volume_m3 === "number" ? String(order.declared_volume_m3) : (order.declared_volume_m3 ?? undefined),
        volume_m3: typeof order.volume_m3 === "number" ? String(order.volume_m3) : (order.volume_m3 ?? undefined),
        declared_total_weight_kg:
          (order.raw_payload?.declared_total_weight_kg as string | undefined) ??
          (typeof order.actual_weight_kg === "number" ? String(order.actual_weight_kg) : (order.actual_weight_kg ?? undefined)),
        cargo_places_qty: order.box_qty ?? undefined,
        measurement_status: order.measurement_payload?.status ?? undefined,
        actual_volume_m3: order.actual_volume_m3 ?? undefined,
        weighing_status: order.weighing_payload?.status ?? undefined,
        actual_weight_kg: order.actual_weight_kg ?? undefined,
        actual_qty: order.actual_qty ?? undefined,
        quantity_whs: order.quantity_whs ?? undefined,
        product_characteristic_codes: order.product_characteristic_tags?.map((tag) => tag.code) ?? undefined,
        office_mark_codes: order.office_mark_tags?.map((tag) => tag.code) ?? undefined,
        additional_description: order.additional_description ?? undefined,
        comment: order.comment ?? undefined,
        is_1c: toOptionalBoolean(order.raw_payload?.is_1c),
        is_factory_payment_via_company: toOptionalBoolean(order.raw_payload?.is_factory_payment_via_company),
        is_checked: order.is_checked ?? undefined,
        is_factory_payment_completed: order.is_factory_payment_completed ?? undefined,
        mrn: order.mrn ?? undefined,
        trip_id: order.trip_id ?? undefined,
      };
    },
    [],
  );

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
      setFactoryCreateConfirmed(false);
      createForm.setFieldValue("factory_id", undefined);
      createForm.setFieldValue("loading_address_id", undefined);
      createForm.setFieldValue("factory_contact_id", undefined);
      return;
    }
    setFactoryCreateConfirmed(false);
    createForm.setFieldValue(["create_factory"], undefined);
  }, [createFactoryMode, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    if (!createLoadingPostcodeIdUi) {
      createForm.setFieldValue("loading_city_id_ui", undefined);
      if (createFactoryMode === "create") {
        createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
      }
      return;
    }

    if (createFactoryMode === "create") {
      createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], createLoadingPostcodeIdUi);
    }
  }, [createFactoryMode, createForm, createLoadingPostcodeIdUi, createOpen]);

  useEffect(() => {
    if (!createOpen || createFactoryMode !== "create" || !createLoadingPostcodeIdUi || postcodeCitiesQuery.isLoading) return;
    const currentCityId = createForm.getFieldValue("loading_city_id_ui") as number | undefined;
    const selection = resolvePostcodeCitySelection(currentCityId, postcodeCitiesQuery.data?.items ?? []);
    if (selection.reason === "kept" || selection.reason === "multiple") return;
    createForm.setFieldValue("loading_city_id_ui", selection.value);
    createForm.setFieldValue(["create_factory", "loading_address", "city_id"], selection.value);
  }, [
    createFactoryMode,
    createForm,
    createLoadingPostcodeIdUi,
    createOpen,
    postcodeCitiesQuery.data?.items,
    postcodeCitiesQuery.isLoading,
  ]);

  async function handleCreateFactoryFromCreateForm() {
    try {
      await createForm.validateFields([
        "factory_country_id",
        ["create_factory", "factory_name"],
        ["create_factory", "loading_address", "name"],
        ["create_factory", "loading_address", "address"],
        "loading_postcode_id_ui",
        "loading_city_id_ui",
      ]);
    } catch {
      return;
    }

    const values = createForm.getFieldsValue(true) as OrderCreateForm;
    const factoryName = trimOrUndefined(values.create_factory?.factory_name);
    const countryId = values.factory_country_id;
    const address = trimOrUndefined(values.create_factory?.loading_address?.address);
    const loadingAddressName =
      trimOrUndefined(values.create_factory?.loading_address?.name) ??
      trimOrUndefined(values.create_factory?.loading_address?.address) ??
      trimOrUndefined(values.create_factory?.factory_name) ??
      "Основной адрес";
    const postcodeId = values.loading_postcode_id_ui;
    const cityId = values.loading_city_id_ui;
    const primaryContactName =
      trimOrUndefined(values.create_factory_contact?.full_name) ??
      trimOrUndefined(values.create_factory?.loading_address?.contact_name) ??
      "Primary Contact";
    const primaryContactPhone =
      trimOrUndefined(values.create_factory_contact?.phone) ??
      trimOrUndefined(values.create_factory?.loading_address?.phone) ??
      "+70000000000";
    const primaryContactEmail =
      trimOrUndefined(values.create_factory_contact?.email) ?? `factory.${Date.now()}@example.com`;

    if (!factoryName || !countryId || !address || !postcodeId || !cityId) {
      message.error("Заполните данные фабрики");
      return;
    }

    setFactoryCreateSubmitting(true);
    try {
      const createdFactory = await apiRequest<Factory>("/api/factories", {
        method: "POST",
        body: {
          name: factoryName,
          country_id: countryId,
          country: getCountryEnglishName(findCountry(countryDirectory.countries, countryId)),
          city: postcodeCitiesQuery.data?.items?.find((city) => city.id === cityId)?.city,
          address,
          postcode: postcodeOptionsQuery.data?.items?.find((postcode) => postcode.id === postcodeId)?.postcode,
          phone: trimOrUndefined(values.create_factory_contact?.phone),
          primary_contact: {
            full_name: primaryContactName,
            phone: primaryContactPhone,
            email: primaryContactEmail,
          },
        },
      });

      const createdAddress = await apiRequest<FactoryLoadingAddress>(
        `/api/factories/${createdFactory.id}/loading-addresses`,
        {
          method: "POST",
          body: {
            name: loadingAddressName,
            country_id: countryId,
            postcode_id: postcodeId,
            city_id: cityId,
            address,
            contact_name: trimOrUndefined(values.create_factory?.loading_address?.contact_name) ?? primaryContactName,
            phone: trimOrUndefined(values.create_factory?.loading_address?.phone) ?? primaryContactPhone,
          },
        },
      );

      createForm.setFieldValue("factory_mode", "existing");
      setCreatedFactoryOption({
        id: createdFactory.id,
        name: createdFactory.name,
        subtitle: [
          formatCountryEnglishName(
            countryDirectory.countries,
            createdFactory.country,
            createdFactory.country_id,
          ),
          createdFactory.city,
        ]
          .filter(Boolean)
          .join(", "),
      });
      setCreatedLoadingAddressOption(createdAddress);
      createForm.setFieldValue("factory_id", createdFactory.id);
      createForm.setFieldValue("loading_address_id", createdAddress.id);
      setFactoryCreateConfirmed(true);
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-factory-contacts", createdFactory.id] });
      message.success("Фабрика создана");
    } catch {
      message.error("Произошла ошибка");
    } finally {
      setFactoryCreateSubmitting(false);
    }
  }

  useEffect(() => {
    if (!createOpen) return;
    if (createClientGoodsValueCurrency !== "OTHER") {
      createForm.setFieldValue("client_goods_value_currency_other_label", undefined);
    }
  }, [createClientGoodsValueCurrency, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    if (!createCertificateIntentEnabled) {
      createForm.setFieldValue("certificate_intent", undefined);
    }
  }, [createCertificateIntentEnabled, createForm, createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    const assignedForwarder = createForm.getFieldValue("assigned_forwarder_user_id");
    const selfDeliveryForwarder = createForm.getFieldValue("self_delivery_forwarder_user_id");
    if (createSelfDelivery) {
      if (!selfDeliveryForwarder && assignedForwarder) {
        createForm.setFieldValue("self_delivery_forwarder_user_id", assignedForwarder);
      }
      return;
    }
    if (!assignedForwarder && selfDeliveryForwarder) {
      createForm.setFieldValue("assigned_forwarder_user_id", selfDeliveryForwarder);
    }
  }, [createForm, createOpen, createSelfDelivery]);

  useEffect(() => {
    if (!editOpen) return;
    if (editFactoryMode === "create") {
      setEditFactoryCreateConfirmed(false);
      editForm.setFieldValue("factory_id", undefined);
      editForm.setFieldValue("loading_address_id", undefined);
      editForm.setFieldValue("factory_contact_id", undefined);
      editForm.setFieldValue("factory_contact_email", undefined);
      editForm.setFieldValue("factory_contact_name", undefined);
      editForm.setFieldValue("factory_contact_phone", undefined);
      if (selectedOrderId) {
        mergeEditDraft(selectedOrderId, {
          factory_id: undefined,
          loading_address_id: undefined,
          factory_contact_id: undefined,
          factory_contact_email: undefined,
          factory_contact_name: undefined,
          factory_contact_phone: undefined,
        });
      }
      return;
    }
    setEditFactoryCreateConfirmed(false);
    editForm.setFieldValue(["create_factory"], undefined);
  }, [editFactoryMode, editForm, editOpen, mergeEditDraft, selectedOrderId]);

  useEffect(() => {
    if (!editOpen) return;
    if (!editLoadingPostcodeIdUi) {
      editForm.setFieldValue("loading_city_id_ui", undefined);
      if (editFactoryMode === "create") {
        editForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
      }
      return;
    }

    if (editFactoryMode === "create") {
      editForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], editLoadingPostcodeIdUi);
    }
  }, [editFactoryMode, editForm, editLoadingPostcodeIdUi, editOpen]);

  useEffect(() => {
    if (!editOpen || editFactoryMode !== "create" || !editLoadingPostcodeIdUi || editPostcodeCitiesQuery.isLoading) return;
    const currentCityId = editForm.getFieldValue("loading_city_id_ui") as number | undefined;
    const selection = resolvePostcodeCitySelection(currentCityId, editPostcodeCitiesQuery.data?.items ?? []);
    if (selection.reason === "kept" || selection.reason === "multiple") return;
    editForm.setFieldValue("loading_city_id_ui", selection.value);
    editForm.setFieldValue(["create_factory", "loading_address", "city_id"], selection.value);
  }, [
    editFactoryMode,
    editForm,
    editLoadingPostcodeIdUi,
    editOpen,
    editPostcodeCitiesQuery.data?.items,
    editPostcodeCitiesQuery.isLoading,
  ]);

  async function handleCreateFactoryFromEditForm() {
    try {
      await editForm.validateFields([
        "factory_country_id",
        ["create_factory", "factory_name"],
        ["create_factory", "loading_address", "name"],
        ["create_factory", "loading_address", "address"],
        "loading_postcode_id_ui",
        "loading_city_id_ui",
      ]);
    } catch {
      return;
    }

    const values = editForm.getFieldsValue(true) as OrderEditForm;
    const factoryName = trimOrUndefined(values.create_factory?.factory_name);
    const countryId = values.factory_country_id;
    const address = trimOrUndefined(values.create_factory?.loading_address?.address);
    const loadingAddressName =
      trimOrUndefined(values.create_factory?.loading_address?.name) ??
      trimOrUndefined(values.create_factory?.loading_address?.address) ??
      trimOrUndefined(values.create_factory?.factory_name) ??
      "Основной адрес";
    const postcodeId = values.loading_postcode_id_ui;
    const cityId = values.loading_city_id_ui;
    const primaryContactName =
      trimOrUndefined(values.create_factory_contact?.full_name) ??
      trimOrUndefined(values.create_factory?.loading_address?.contact_name) ??
      "Primary Contact";
    const primaryContactPhone =
      trimOrUndefined(values.create_factory_contact?.phone) ??
      trimOrUndefined(values.create_factory?.loading_address?.phone) ??
      "+70000000000";
    const primaryContactEmail =
      trimOrUndefined(values.create_factory_contact?.email) ?? `factory.${Date.now()}@example.com`;

    if (!factoryName || !countryId || !address || !postcodeId || !cityId) {
      message.error("Заполните данные фабрики");
      return;
    }

    setEditFactoryCreateSubmitting(true);
    try {
      const createdFactory = await apiRequest<Factory>("/api/factories", {
        method: "POST",
        body: {
          name: factoryName,
          country_id: countryId,
          country: getCountryEnglishName(findCountry(countryDirectory.countries, countryId)),
          city: editPostcodeCitiesQuery.data?.items?.find((city) => city.id === cityId)?.city,
          address,
          postcode: editPostcodeOptionsQuery.data?.items?.find((postcode) => postcode.id === postcodeId)?.postcode,
          phone: trimOrUndefined(values.create_factory_contact?.phone),
          primary_contact: {
            full_name: primaryContactName,
            phone: primaryContactPhone,
            email: primaryContactEmail,
          },
        },
      });

      const createdAddress = await apiRequest<FactoryLoadingAddress>(
        `/api/factories/${createdFactory.id}/loading-addresses`,
        {
          method: "POST",
          body: {
            name: loadingAddressName,
            country_id: countryId,
            postcode_id: postcodeId,
            city_id: cityId,
            address,
            contact_name: trimOrUndefined(values.create_factory?.loading_address?.contact_name) ?? primaryContactName,
            phone: trimOrUndefined(values.create_factory?.loading_address?.phone) ?? primaryContactPhone,
          },
        },
      );

      const nextPatch = {
        factory_mode: "existing" as const,
        factory_id: createdFactory.id,
        loading_address_id: createdAddress.id,
      };
      editForm.setFieldsValue(nextPatch);
      setEditCreatedFactoryOption({
        id: createdFactory.id,
        name: createdFactory.name,
        subtitle: [
          formatCountryEnglishName(
            countryDirectory.countries,
            createdFactory.country,
            createdFactory.country_id,
          ),
          createdFactory.city,
        ]
          .filter(Boolean)
          .join(", "),
      });
      setEditCreatedLoadingAddressOption(createdAddress);
      setEditFactoryCreateConfirmed(true);
      if (selectedOrderId) {
        mergeEditDraft(selectedOrderId, nextPatch);
      }
      await queryClient.invalidateQueries({ queryKey: ["factories"] });
      await queryClient.invalidateQueries({ queryKey: ["orders", "edit-factory-contacts", createdFactory.id] });
      message.success("Фабрика создана");
    } catch {
      message.error("Произошла ошибка");
    } finally {
      setEditFactoryCreateSubmitting(false);
    }
  }

  function invalidateOrdersQueries(orderId?: number) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      orderId ? queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) }) : Promise.resolve(),
    ]);
  }

  const createFactoryContactMutation = useMutation({
    mutationFn: (payload: { factoryId: number; full_name: string; phone: string; email: string }) =>
      apiRequest<FactoryContactOption>(`/api/factories/${payload.factoryId}/contacts`, {
        method: "POST",
        body: {
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email,
          is_primary: false,
        },
      }),
    onSuccess: async (result) => {
      message.success("Контакт фабрики добавлен");
      setFactoryContactModalOpen(false);
      factoryContactQuickForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-factory-contacts", createFactoryId] });
      if (result?.id) {
        createForm.setFieldValue("factory_contact_id", result.id);
        createForm.setFieldValue(["create_factory_contact", "full_name"], result.full_name);
        createForm.setFieldValue(["create_factory_contact", "phone"], result.phone);
        createForm.setFieldValue(["create_factory_contact", "email"], result.email ?? undefined);
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления контакта");
    },
  });

  const editFactoryContactMutation = useMutation({
    mutationFn: (payload: { factoryId: number; full_name: string; phone: string; email: string }) =>
      apiRequest<FactoryContactOption>(`/api/factories/${payload.factoryId}/contacts`, {
        method: "POST",
        body: {
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email,
          is_primary: false,
        },
      }),
    onSuccess: async (result) => {
      message.success("Контакт фабрики добавлен");
      setEditFactoryContactModalOpen(false);
      editFactoryContactQuickForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["orders", "edit-factory-contacts", editFactoryId] });
      const updatedOptions = [result, ...(editContactEmailOptions.filter((item) => item.id !== result.id))];
      setEditContactEmailOptions(updatedOptions);
      editForm.setFieldValue("factory_contact_id", result.id);
      editForm.setFieldValue("factory_contact_email", result.email ?? undefined);
      editForm.setFieldValue("factory_contact_name", result.full_name ?? undefined);
      editForm.setFieldValue("factory_contact_phone", result.phone ?? undefined);
      if (selectedOrderId) {
        mergeEditDraft(selectedOrderId, {
          factory_contact_id: result.id,
          factory_contact_email: result.email ?? undefined,
          factory_contact_name: result.full_name ?? undefined,
          factory_contact_phone: result.phone ?? undefined,
        });
      }
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления контакта");
    },
  });

  const createFactoryLoadingAddressMutation = useMutation({
    mutationFn: (payload: { factoryId: number; countryId: number; name: string; address: string; postcode_id: number; city_id: number }) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${payload.factoryId}/loading-addresses`, {
        method: "POST",
        body: {
          name: payload.name,
          country_id: payload.countryId,
          postcode_id: payload.postcode_id,
          city_id: payload.city_id,
          address: payload.address,
          contact_name: trimOrUndefined(createForm.getFieldValue(["create_factory_contact", "full_name"])) ?? "Contact",
          phone: trimOrUndefined(createForm.getFieldValue(["create_factory_contact", "phone"])) ?? "+70000000000",
        },
      }),
    onSuccess: async (result) => {
      message.success("Адрес добавлен");
      setFactoryLoadingAddressModalOpen(false);
      factoryLoadingAddressQuickForm.resetFields();
      setCreatedLoadingAddressOption(result);
      createForm.setFieldValue("loading_address_id", result.id);
      await queryClient.invalidateQueries({ queryKey: ["orders", "create-loading-addresses", isClientRole, "existing", createFactoryId] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления адреса");
    },
  });

  const editFactoryLoadingAddressMutation = useMutation({
    mutationFn: (payload: { factoryId: number; countryId: number; name: string; address: string; postcode_id: number; city_id: number }) =>
      apiRequest<FactoryLoadingAddress>(`/api/factories/${payload.factoryId}/loading-addresses`, {
        method: "POST",
        body: {
          name: payload.name,
          country_id: payload.countryId,
          postcode_id: payload.postcode_id,
          city_id: payload.city_id,
          address: payload.address,
          contact_name: trimOrUndefined(editForm.getFieldValue("factory_contact_name")) ?? "Contact",
          phone: trimOrUndefined(editForm.getFieldValue("factory_contact_phone")) ?? "+70000000000",
        },
      }),
    onSuccess: async (result) => {
      message.success("Адрес добавлен");
      setEditFactoryLoadingAddressModalOpen(false);
      editFactoryLoadingAddressQuickForm.resetFields();
      setEditCreatedLoadingAddressOption(result);
      editForm.setFieldValue("loading_address_id", result.id);
      if (selectedOrderId) {
        mergeEditDraft(selectedOrderId, { loading_address_id: result.id });
      }
      await queryClient.invalidateQueries({ queryKey: ["orders", "edit-loading-addresses", editFactoryId] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка добавления адреса");
    },
  });

  function scrollCreateToField(name: NamePath) {
    const targetStep = getCreateStepIndexForField(name);
    if (targetStep >= 0 && targetStep !== createStep) {
      setCreateStep(targetStep);
    }
    window.setTimeout(() => createForm.scrollToField(name, { block: "center" }), 0);
  }

  function getCreateStepIndexForField(name: NamePath) {
    return createWizardSteps.findIndex((_, stepIndex) =>
      getCreateStepFieldNames(stepIndex).some((fieldName) => sameNamePath(fieldName, name)),
    );
  }

  function applyCreateFieldErrors(fieldErrors: Array<{ name: NamePath; message: string }>) {
    if (!fieldErrors.length) return false;
    const sortedFieldErrors = [...fieldErrors].sort((left, right) => {
      const leftStep = getCreateStepIndexForField(left.name);
      const rightStep = getCreateStepIndexForField(right.name);
      return (leftStep === -1 ? Number.MAX_SAFE_INTEGER : leftStep) - (rightStep === -1 ? Number.MAX_SAFE_INTEGER : rightStep);
    });
    createForm.setFields(
      sortedFieldErrors.map((fieldError) => ({ name: fieldError.name, errors: [fieldError.message] })) as Parameters<
        typeof createForm.setFields
      >[0],
    );
    scrollCreateToField(sortedFieldErrors[0].name);
    return true;
  }

  function applyEditFieldErrors(fieldErrors: Array<{ name: NamePath; message: string }>) {
    if (!fieldErrors.length) return false;
    editForm.setFields(
      fieldErrors.map((fieldError) => ({ name: fieldError.name, errors: [fieldError.message] })) as Parameters<
        typeof editForm.setFields
      >[0],
    );
    window.setTimeout(() => editForm.scrollToField(fieldErrors[0].name, { block: "center" }), 0);
    return true;
  }

  function applyStructured422FieldErrors(error: ApiError, target: "create" | "edit") {
    const fieldErrors = error.issues.flatMap((issue) => {
      const name = mapOrderValidationIssueToNamePath(issue);
      if (!name) return [];
      return [{ name, message: getOrderBackendIssueMessage(name, issue.msg) }];
    });
    return target === "create" ? applyCreateFieldErrors(fieldErrors) : applyEditFieldErrors(fieldErrors);
  }

  function applyCreate422FieldErrors(detail: string) {
    const text = detail.toLowerCase();
    const fieldErrors: Array<{ name: NamePath; message: string }> = [];

    const mark = (name: (string | number)[] | string, messageText: string) => {
      fieldErrors.push({ name: Array.isArray(name) ? name : [name], message: messageText });
    };

    if (text.includes("invoice_company_name")) {
      mark("invoice_company_name", "Укажите название компании для инвойса");
    }

    if (text.includes("company_contact_id")) {
      mark("company_contact_id", "Выберите контакт компании");
    }

    if (text.includes("email_id") || text.includes("factory_contact_id")) {
      mark("factory_contact_id", "Выберите email контакта фабрики");
    }

    if (text.includes("self_delivery_forwarder_user_id")) {
      mark("self_delivery_forwarder_user_id", "Выберите экспедитора для self-delivery");
    }

    if (text.includes("pickup_date_from") || text.includes("pickup_date_to")) {
      mark("pickup_date_from", "Проверьте диапазон дат вывоза");
      mark("pickup_date_to", "Проверьте диапазон дат вывоза");
    }

    if (
      text.includes("factory_contact_id") || text.includes("create_factory_contact") || text.includes("xor")
    ) {
      mark("factory_contact_id", "Выберите контакт фабрики");
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
      mark("loading_postcode_id_ui", "Выберите индекс");
    }

    if (text.includes("loading_address.city_id") || text.includes("create_city")) {
      mark(["create_factory", "loading_address", "city_id"], "Выберите город");
      mark("loading_city_id_ui", "Выберите город");
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

    return applyCreateFieldErrors(fieldErrors);
  }

  function applyEdit422FieldErrors(detail: string) {
    const text = detail.toLowerCase();
    const fieldErrors: Array<{ name: NamePath; message: string }> = [];
    const mark = (name: (string | number)[] | string, messageText: string) => {
      fieldErrors.push({ name: Array.isArray(name) ? name : [name], message: messageText });
    };

    if (text.includes("company_contact_id")) {
      mark("company_contact_id", "Выберите клиента");
    }
    if (text.includes("loading_address_id")) {
      mark("loading_address_id", "Выберите адрес погрузки");
    }
    if (text.includes("factory_contact_id") || text.includes("email_id")) {
      mark("factory_contact_id", "Выберите email контакта фабрики");
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
    if (text.includes("loading_address.postcode_id") || text.includes("create_postcode")) {
      mark(["create_factory", "loading_address", "postcode_id"], "Выберите индекс");
      mark("loading_postcode_id_ui", "Выберите индекс");
    }
    if (text.includes("loading_address.city_id") || text.includes("create_city")) {
      mark(["create_factory", "loading_address", "city_id"], "Выберите город");
      mark("loading_city_id_ui", "Выберите город");
    }
    if (text.includes("pickup_date_from") || text.includes("pickup_date_to")) {
      mark("pickup_date_from", "Проверьте диапазон дат вывоза");
      mark("pickup_date_to", "Проверьте диапазон дат вывоза");
    }
    if (text.includes("certificate_intent")) {
      mark("certificate_intent", "Проверьте значение сертификата");
    }
    if (text.includes("client_goods_value_currency_other_label")) {
      mark("client_goods_value_currency_other_label", "Для OTHER укажите валюту");
    }
    if (text.includes("goods_lines")) {
      mark("goods_lines", "Проверьте строки товаров");
    }

    return applyEditFieldErrors(fieldErrors);
  }

  function validateCreateOrderBeforeSubmit(values: OrderCreateForm) {
    const isRequestOrder = (values.order_type ?? "delivery") === "request";
    const validation = validateOrderFormValues({
      order_type: values.order_type,
      invoice_number: values.invoice_number,
      client_goods_value_amount: values.client_goods_value_amount,
      client_goods_value_currency: values.client_goods_value_currency,
      client_goods_value_currency_other_label: values.client_goods_value_currency_other_label,
      declared_volume_m3: values.declared_volume_m3,
      declared_total_weight_kg: values.declared_total_weight_kg,
    });
    const fieldErrors: Array<{ name: NamePath; message: string }> = validation.ok ? [] : [...validation.fieldErrors];

    if (!isRequestOrder && values.factory_mode === "create") {
      if (!values.loading_postcode_id_ui) {
        fieldErrors.push({ name: ["loading_postcode_id_ui"], message: "Выберите индекс" });
      }
      if (!values.loading_city_id_ui) {
        fieldErrors.push({ name: ["loading_city_id_ui"], message: "Выберите город" });
      }
    }

    if (!isRequestOrder && values.factory_mode !== "create" && selectedLoadingAddress) {
      if (!selectedLoadingAddress.postcode_id || !selectedLoadingAddress.city_id) {
        fieldErrors.push({
          name: ["loading_address_id"],
          message: "Выберите адрес с индексом и городом или добавьте новый адрес",
        });
      }
    }

    if (fieldErrors.length) {
      applyCreateFieldErrors(fieldErrors);
      return null;
    }

    if (isRequestOrder) {
      return {};
    }
    return validation.ok ? validation.values : null;
  }

  function validateEditOrderBeforeSubmit(values: OrderEditForm) {
    const validation = validateOrderFormValues({
      order_type: currentEditOrderType,
      invoice_number: values.invoice_number,
      client_goods_value_amount: values.client_goods_value_amount,
      client_goods_value_currency: values.client_goods_value_currency,
      client_goods_value_currency_other_label: values.client_goods_value_currency_other_label,
      declared_volume_m3: values.declared_volume_m3,
      declared_total_weight_kg: values.declared_total_weight_kg,
    });
    const fieldErrors: Array<{ name: NamePath; message: string }> = validation.ok ? [] : [...validation.fieldErrors];

    if (values.factory_mode === "create") {
      if (!values.loading_postcode_id_ui) {
        fieldErrors.push({ name: ["loading_postcode_id_ui"], message: "Выберите индекс" });
      }
      if (!values.loading_city_id_ui) {
        fieldErrors.push({ name: ["loading_city_id_ui"], message: "Выберите город" });
      }
    }

    if (values.factory_mode !== "create" && selectedEditLoadingAddress) {
      if (!selectedEditLoadingAddress.postcode_id || !selectedEditLoadingAddress.city_id) {
        fieldErrors.push({
          name: ["loading_address_id"],
          message: "Выберите адрес с индексом и городом или добавьте новый адрес",
        });
      }
    }

    if (fieldErrors.length) {
      applyEditFieldErrors(fieldErrors);
      return null;
    }

    return validation.ok ? validation.values : null;
  }

  function closeAndResetCreateModal() {
    setCreateOpen(false);
    setCreateStep(0);
    setFactoryContactModalOpen(false);
    setFactoryLoadingAddressModalOpen(false);
    setGoodsLineModalOpen(false);
    setGoodsLineEditIndex(null);
    setFactoryCreateConfirmed(false);
    setFactoryCreateSubmitting(false);
    resetCreateDraft();
    createForm.resetFields();
    createForm.setFieldsValue(CREATE_ORDER_DRAFT_DEFAULTS as Partial<OrderCreateForm>);
    factoryContactQuickForm.resetFields();
    factoryLoadingAddressQuickForm.resetFields();
    goodsLineQuickForm.resetFields();
    setClientCompaniesQueryText("");
    setPostcodeQuery("");
    setPostcodeQueryDebounced("");
  }

  function openCreateModal() {
    setCreateStep(0);
    setGoodsLineModalOpen(false);
    setGoodsLineEditIndex(null);
    setFactoryCreateConfirmed(false);
    setFactoryCreateSubmitting(false);
    resetCreateDraft();
    setCreateOpen(true);
    createForm.setFieldsValue(CREATE_ORDER_DRAFT_DEFAULTS as Partial<OrderCreateForm>);
  }

  useEffect(() => {
    if (!createOpen) return;
    isRehydratingCreateFormRef.current = true;
    createForm.setFieldsValue(createDraft);
    queueMicrotask(() => {
      isRehydratingCreateFormRef.current = false;
    });
  }, [createDraft, createForm, createOpen]);

  useEffect(() => {
    if (!editOpen || !selectedOrderId) {
      hydratedEditOrderIdRef.current = null;
      return;
    }
    if (hydratedEditOrderIdRef.current === selectedOrderId) return;

    const existingDraftValues = editDraftsByOrderId[selectedOrderId]?.values;
    if (existingDraftValues) {
      isRehydratingEditFormRef.current = true;
      editForm.setFieldsValue(existingDraftValues as Partial<OrderEditForm>);
      queueMicrotask(() => {
        isRehydratingEditFormRef.current = false;
      });
      hydratedEditOrderIdRef.current = selectedOrderId;
      return;
    }

    if (!editDetailQuery.data) return;
    const nextValues = toEditFormValues(editDetailQuery.data);
    setEditDraft(selectedOrderId, nextValues as Record<string, unknown>, {
      dirty: false,
      hydratedAt: new Date().toISOString(),
    });
    isRehydratingEditFormRef.current = true;
    editForm.setFieldsValue(nextValues);
    queueMicrotask(() => {
      isRehydratingEditFormRef.current = false;
    });
    hydratedEditOrderIdRef.current = selectedOrderId;
  }, [editDetailQuery.data, editDraftsByOrderId, editForm, editOpen, selectedOrderId, setEditDraft, toEditFormValues]);

  useEffect(() => {
    if (!editOpen) return;
    if (!editCertificateIntentEnabled) {
      editForm.setFieldValue("certificate_intent", undefined);
    }
  }, [editCertificateIntentEnabled, editForm, editOpen]);

  useEffect(() => {
    if (!editOpen) return;
    if (editClientGoodsCurrency !== "OTHER") {
      editForm.setFieldValue("client_goods_value_currency_other_label", undefined);
    }
  }, [editClientGoodsCurrency, editForm, editOpen]);

  useEffect(() => {
    if (!standaloneOrderView || !editOpen || !selectedOrderId) return;
    if (!editDraftsByOrderId[selectedOrderId]?.dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editDraftsByOrderId, editOpen, selectedOrderId, standaloneOrderView]);

  useEffect(() => {
    if (!standaloneOrderView || !editOpen || !selectedOrderId) return;
    if (!editDraftsByOrderId[selectedOrderId]?.dirty) return;

    const confirmLeave = () => window.confirm("Уверены, что хотите отменить изменения?");

    const handleAnchorNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const nextUrl = new URL(href, window.location.href);
      const sameLocation =
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search &&
        nextUrl.hash === window.location.hash;
      if (sameLocation) return;

      if (confirmLeave()) {
        resetEditDraft(selectedOrderId);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const handlePopState = () => {
      if (confirmLeave()) {
        resetEditDraft(selectedOrderId);
        return;
      }
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("click", handleAnchorNavigation, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("click", handleAnchorNavigation, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [editDraftsByOrderId, editOpen, resetEditDraft, selectedOrderId, standaloneOrderView]);

  useEffect(() => {
    if (!editOpen) return;
    if (editSelfDelivery) {
      const assigned = editForm.getFieldValue("assigned_forwarder_user_id");
      const self = editForm.getFieldValue("self_delivery_forwarder_user_id");
      if (!self && assigned) {
        editForm.setFieldValue("self_delivery_forwarder_user_id", assigned);
      }
      return;
    }
    editForm.setFieldValue("self_delivery_forwarder_user_id", undefined);
  }, [editForm, editOpen, editSelfDelivery]);

  useEffect(() => {
    if (!editOpen || !selectedOrderId || !editFactoryContactsQuery.data?.items) return;
    const items = editFactoryContactsQuery.data.items;
    setEditContactEmailOptions(items);
    const selectedContactId = editForm.getFieldValue("factory_contact_id") as number | undefined;
    const byId = items.find((contact) => contact.id === selectedContactId);
    if (!byId) return;
    editForm.setFieldValue("factory_contact_email", byId.email ?? undefined);
    editForm.setFieldValue("factory_contact_name", byId.full_name ?? undefined);
    editForm.setFieldValue("factory_contact_phone", byId.phone ?? undefined);
  }, [editFactoryContactsQuery.data?.items, editForm, editOpen, selectedOrderId]);

  useEffect(() => {
    if (!editOpen || !selectedOrderId || !editLoadingAddressId) return;
    const selectedAddress = (editLoadingAddressesQuery.data?.items ?? []).find((item) => item.id === editLoadingAddressId);
    if (!selectedAddress) return;
    editForm.setFieldValue("loading_postcode_id_ui", selectedAddress.postcode_id ?? undefined);
    editForm.setFieldValue("loading_city_id_ui", selectedAddress.city_id ?? undefined);
    editForm.setFieldValue("loading_address_line", selectedAddress.address ?? undefined);
    editForm.setFieldValue("loading_address_fax", selectedAddress.fax ?? undefined);
  }, [editForm, editLoadingAddressId, editLoadingAddressesQuery.data?.items, editOpen, selectedOrderId]);

  function getCreateStepFieldNames(step: number): NamePath[] {
    const values = createForm.getFieldsValue(true) as OrderCreateForm;
    const stepKey = getOrderCreateWizardSteps(values.order_type)[step]?.key;

    if (stepKey === "base") {
      if (isClientRole) {
        return ["order_number", "order_type", "invoice_on_other_company", "invoice_company_name", "request_payload_json"];
      }

      return ["order_number", "order_type", "invoice_on_other_company", "invoice_company_name", "request_payload_json", "company_id", "company_contact_id"];
    }

    if (stepKey === "factory") {
      if (isClientRole) {
        return [
          "factory_mode",
          "factory_country_id",
          "factory_id",
          "loading_address_id",
          "loading_postcode_id_ui",
          "loading_city_id_ui",
          "ready_date",
          "pickup_date_from",
          "pickup_date_to",
        ];
      }

      const names: NamePath[] = [
        "self_delivery",
        "ready_date",
        "pickup_date_from",
        "pickup_date_to",
        "factory_mode",
        "factory_country_id",
        "factory_contact_id",
        "loading_postcode_id_ui",
        "loading_city_id_ui",
      ];

      names.push("assigned_forwarder_user_id");
      if (values.self_delivery) {
        names.push("self_delivery_forwarder_user_id");
      }

      if (values.factory_mode === "create") {
        names.push(
          ["create_factory", "factory_name"],
          ["create_factory", "primary_email"],
          ["create_factory", "loading_address", "address"],
          ["create_factory", "loading_address", "postcode_id"],
          ["create_factory", "loading_address", "city_id"],
          ["create_factory", "loading_address", "phone"],
          ["create_factory", "loading_address", "contact_name"],
          ["create_factory", "loading_address", "fax"],
          ["create_factory", "loading_address", "messenger_type"],
          ["create_factory", "loading_address", "messenger_value"],
        );
      } else {
        names.push("factory_id", "loading_address_id");
      }

      return names;
    }

    if (stepKey === "order_data") {
      const names: NamePath[] = [
        "invoice_number",
        "client_goods_value_currency",
        "client_goods_value_currency_other_label",
        "client_goods_value_amount",
        "declared_volume_m3",
        "declared_total_weight_kg",
        "cargo_places_qty",
      ];
      if (!isClientRole) {
        names.push("certificate_intent_enabled");
        if (values.certificate_intent_enabled) {
          names.push("certificate_intent");
        }
        names.push("measurement_status", "weighing_status");
      }
      return names;
    }

    if (stepKey === "goods") {
      const names: NamePath[] = ["additional_description", "comment", "product_characteristic_codes", "goods_lines"];
      if (!isClientRole && canEditRestrictedCreateFields) {
        names.push("user_comment", "forwarder_comment", "warehouse_comment");
      }
      if (canEditRestrictedCreateFields && !isClientRole) {
        names.push(
          "office_mark_codes",
          "is_1c",
          "is_factory_payment_via_company",
          "is_checked",
          "is_factory_payment_completed",
        );
      }

      (values.goods_lines ?? []).forEach((_, index) => {
        names.push(
          ["goods_lines", index, "item_type"],
          ["goods_lines", index, "custom_item_type"],
          ["goods_lines", index, "description"],
          ["goods_lines", index, "weight_kg"],
          ["goods_lines", index, "quantity_unit"],
          ["goods_lines", index, "quantity_value"],
        );
      });

      return names;
    }

    const names: NamePath[] = values.order_type === "request" ? ["additional_description", "documents"] : ["documents"];
    (values.documents ?? []).forEach((_, index) => {
      names.push(
        ["documents", index, "document_type"],
        ["documents", index, "file_list"],
      );
    });
    return names;
  }

  async function validateCreateStep(step: number) {
    const names = getCreateStepFieldNames(step);
    if (!names.length) return;
    await createForm.validateFields(names);
  }

  async function goToCreateStep(nextStep: number) {
    const latestValues = createForm.getFieldsValue(true) as OrderCreateForm;
    const latestLastStep = getOrderCreateWizardSteps(latestValues.order_type ?? currentCreateOrderType).length - 1;
    const clampedNextStep = Math.min(nextStep, latestLastStep);
    if (nextStep === createStep) return;
    if (nextStep < createStep) {
      setCreateStep(clampedNextStep);
      return;
    }

    try {
      await validateCreateStep(createStep);
      setCreateStep(clampedNextStep);
    } catch {
      // Form validation messages are shown inline by antd.
    }
  }

  async function goToNextCreateStep() {
    if (createStep >= createWizardLastStep) return;
    await goToCreateStep(createStep + 1);
  }

  async function resolveRequestFactorySelection(values: OrderCreateForm) {
    if (values.factory_country_id && values.factory_id && values.loading_address_id && values.factory_contact_id) {
      const selectedAddress = allLoadingAddresses.find((address) => address.id === values.loading_address_id);
      if (selectedAddress && (!selectedAddress.postcode_id || !selectedAddress.city_id)) {
        throw new Error("Для создания заявки выберите адрес погрузки с индексом и городом");
      }
      return {
        factory_mode: "existing",
        country_id: values.factory_country_id,
        factory_id: values.factory_id,
        loading_address_id: values.loading_address_id,
        factory_contact_id: values.factory_contact_id,
      };
    }

    const factories = await apiRequest<PaginatedResponse<Factory>>("/api/factories", {
      query: { page: 1, page_size: 20 },
    });

    for (const factory of factories.items) {
      if (!factory.id || !factory.country_id) continue;

      const [addresses, contacts] = await Promise.all([
        apiRequest<PaginatedResponse<FactoryLoadingAddress>>(`/api/factories/${factory.id}/loading-addresses`, {
          query: { page: 1, page_size: 20 },
        }),
        apiRequest<PaginatedResponse<FactoryContactOption> | FactoryContactOption[]>(`/api/factories/${factory.id}/contacts`, {
          query: { page: 1, page_size: 1 },
        }),
      ]);

      const address = addresses.items.find((item) => Boolean(item.id && item.postcode_id && item.city_id));
      const contactItems = Array.isArray(contacts) ? contacts : contacts.items;
      const contact = contactItems[0];
      if (!address?.id || !contact?.id) continue;

      return {
        factory_mode: "existing",
        country_id: factory.country_id,
        factory_id: factory.id,
        loading_address_id: address.id,
        factory_contact_id: contact.id,
      };
    }

    throw new Error("Для создания заявки нужна фабрика с адресом погрузки, индексом, городом и контактом");
  }

  const createMutation = useMutation({
    mutationFn: async (values: OrderCreateForm) => {
      const isRequestOrder = (values.order_type ?? "delivery") === "request";
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
        const slot = `doc_${index + 1}`;
        filesToUpload.push({ slot, file });
        const resolvedDocumentType = isRequestOrder
          ? REQUEST_BACKEND_DOCUMENT_TYPE
          : trimOrUndefined(document.document_type) ?? createMetadataQuery.data?.document_type_options?.[0]?.code;
        if (!resolvedDocumentType) {
          throw new Error(`Документ #${index + 1}: не найден доступный тип документа`);
        }
        return {
          document_type: resolvedDocumentType,
          file_slot: slot,
          display_name: file.name,
        };
      });

      if (!isClientRole && !values.company_id) {
        throw new Error("Выберите клиента");
      }

      if (!isClientRole && !values.company_contact_id) {
        throw new Error("Выберите контакт компании");
      }

      if (!isRequestOrder && !values.factory_mode) {
        throw new Error("Выберите режим фабрики");
      }

      if (!isRequestOrder && !values.ready_date) {
        throw new Error("Укажите дату готовности");
      }

      const today = dayjs().startOf("day");
      if (!isRequestOrder && values.ready_date?.startOf("day").isBefore(today)) {
        throw new Error("Дата готовности не может быть в прошлом");
      }

      if (values.invoice_on_other_company && !trimOrUndefined(values.invoice_company_name)) {
        throw new Error("Для инвойса на другую компанию заполните название компании");
      }

      if (!isRequestOrder && !isClientRole && values.self_delivery && !values.assigned_forwarder_user_id && !values.self_delivery_forwarder_user_id) {
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

      if (isRequestOrder && !trimOrUndefined(values.additional_description)) {
        throw new Error("Заполните описание");
      }

      if (!isRequestOrder && !goodsLines.length && !trimOrUndefined(values.additional_description)) {
        throw new Error("Если строки товара пустые, заполните описание груза");
      }

      let requestRawPayload: Record<string, unknown> | undefined;
      if (isRequestOrder && trimOrUndefined(values.request_payload_json)) {
        requestRawPayload = JSON.parse(values.request_payload_json as string) as Record<string, unknown>;
      }

      let factorySelection: Record<string, unknown>;
      if (isRequestOrder) {
        factorySelection = await resolveRequestFactorySelection(values);
      } else if (isClientRole) {
        if (values.factory_mode === "create") {
          throw new Error("Для client create в этой версии доступен только existing сценарий фабрики");
        }
        if (!values.factory_country_id || !values.factory_id || !values.loading_address_id) {
          throw new Error("Выберите страну, фабрику и адрес загрузки");
        }
        factorySelection = {
          factory_mode: "existing",
          country_id: values.factory_country_id,
          factory_id: values.factory_id,
          loading_address_id: values.loading_address_id,
        };
      } else {
        if (!values.factory_contact_id) {
          throw new Error("Выберите контакт фабрики");
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
            factory_contact_id: values.factory_contact_id,
          };
        } else {
          if (!values.factory_country_id || !values.factory_id || !values.loading_address_id) {
            throw new Error("Выберите фабрику и адрес загрузки");
          }
          factorySelection = {
            factory_mode: "existing",
            country_id: values.factory_country_id,
            factory_id: values.factory_id,
            loading_address_id: values.loading_address_id,
            factory_contact_id: values.factory_contact_id,
          };
        }
      }

      const normalizedOrderValues = validateCreateOrderBeforeSubmit(values);
      if (!normalizedOrderValues) {
        throw new Error("Проверьте поля заказа");
      }

      const orderPayload: Record<string, unknown> = {
        order_number: trimOrUndefined(values.order_number),
        order_type: values.order_type ?? "delivery",
        ready_date: isRequestOrder
          ? (values.ready_date ?? dayjs()).format("YYYY-MM-DD")
          : values.ready_date?.format("YYYY-MM-DD"),
        pickup_date_from: values.pickup_date_from?.format("YYYY-MM-DD"),
        pickup_date_to: values.pickup_date_to?.format("YYYY-MM-DD"),
        invoice_on_other_company: Boolean(values.invoice_on_other_company),
        invoice_company_name: trimOrUndefined(values.invoice_company_name),
        invoice_number: normalizedOrderValues.invoice_number,
        declared_volume_m3: normalizedOrderValues.declared_volume_m3,
        declared_total_weight_kg: normalizedOrderValues.declared_total_weight_kg,
        cargo_places_qty: values.cargo_places_qty,
        client_goods_value_amount: normalizedOrderValues.client_goods_value_amount,
        client_goods_value_currency: normalizedOrderValues.client_goods_value_currency,
        client_goods_value_currency_other_label: normalizedOrderValues.client_goods_value_currency_other_label,
        product_characteristic_codes: values.product_characteristic_codes,
        additional_description: trimOrUndefined(values.additional_description),
        comment: trimOrUndefined(values.comment),
        certificate_intent:
          values.certificate_intent_enabled && trimOrUndefined(values.certificate_intent ?? undefined)
            ? String(trimOrUndefined(values.certificate_intent ?? undefined)).toLowerCase()
            : undefined,
        raw_payload: requestRawPayload,
      };

      if (!isClientRole) {
        const resolvedSelfDeliveryForwarderId = values.self_delivery
          ? values.assigned_forwarder_user_id ?? values.self_delivery_forwarder_user_id
          : undefined;
        const assignedForwarderUserId = canEditRestrictedCreateFields ? values.assigned_forwarder_user_id : undefined;
        Object.assign(orderPayload, {
          company_id: values.company_id,
          company_contact_id: values.company_contact_id,
          user_comment: trimOrUndefined(values.user_comment),
          forwarder_comment: trimOrUndefined(values.forwarder_comment),
          warehouse_comment: trimOrUndefined(values.warehouse_comment),
          self_delivery: isRequestOrder ? undefined : Boolean(values.self_delivery),
          self_delivery_forwarder_user_id: isRequestOrder ? undefined : resolvedSelfDeliveryForwarderId,
          is_1c: values.is_1c,
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
          assigned_forwarder_user_id: isRequestOrder ? undefined : assignedForwarderUserId,
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
          const applied = applyStructured422FieldErrors(error, "create") || applyCreate422FieldErrors(error.detail);
          if (applied) {
            return;
          }
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
    mutationFn: async ({ id, payload }: { id: number; payload: OrderEditForm }) => {
      const compact = <T extends Record<string, unknown>>(source: T) =>
        Object.fromEntries(
          Object.entries(source).filter(([, value]) => value !== undefined),
        ) as Partial<T>;

      const normalizedOrderValues = validateEditOrderBeforeSubmit(payload);
      if (!normalizedOrderValues) {
        throw new Error("Проверьте поля заказа");
      }

      const orderPayload = compact({
        order_date: payload.order_date?.format("YYYY-MM-DD"),
        status_name: payload.status_name,
        status_date: payload.status_date?.format("YYYY-MM-DD"),
        order_number: trimOrUndefined(payload.order_number),
        company_contact_id: payload.company_contact_id,
        invoice_on_other_company: payload.invoice_on_other_company,
        invoice_company_name: trimOrUndefined(payload.invoice_company_name),
        self_delivery: payload.self_delivery,
        assigned_forwarder_user_id: payload.assigned_forwarder_user_id,
        self_delivery_forwarder_user_id: payload.self_delivery ? payload.self_delivery_forwarder_user_id : undefined,
        ready_date: payload.ready_date?.format("YYYY-MM-DD"),
        pickup_date_from: payload.pickup_date_from?.format("YYYY-MM-DD"),
        pickup_date_to: payload.pickup_date_to?.format("YYYY-MM-DD"),
        certificate_intent: payload.certificate_intent_enabled
          ? trimOrUndefined(payload.certificate_intent) ?? null
          : null,
        invoice_number: normalizedOrderValues.invoice_number,
        client_goods_value_amount: normalizedOrderValues.client_goods_value_amount,
        client_goods_value_currency: normalizedOrderValues.client_goods_value_currency,
        client_goods_value_currency_other_label: normalizedOrderValues.client_goods_value_currency_other_label ?? null,
        declared_volume_m3: normalizedOrderValues.declared_volume_m3,
        volume_m3: trimOrUndefined(payload.volume_m3),
        declared_total_weight_kg: normalizedOrderValues.declared_total_weight_kg,
        cargo_places_qty: payload.cargo_places_qty,
        measurement_payload: payload.measurement_status ? { status: payload.measurement_status } : undefined,
        actual_volume_m3: trimOrUndefined(payload.actual_volume_m3),
        weighing_payload: payload.weighing_status ? { status: payload.weighing_status } : undefined,
        actual_weight_kg: trimOrUndefined(payload.actual_weight_kg),
        actual_qty: payload.actual_qty,
        quantity_whs: payload.quantity_whs,
        product_characteristic_codes: payload.product_characteristic_codes,
        office_mark_codes: payload.office_mark_codes,
        additional_description: trimOrUndefined(payload.additional_description),
        comment: trimOrUndefined(payload.comment),
        is_1c: payload.is_1c,
        is_factory_payment_via_company: payload.is_factory_payment_via_company,
        is_checked: payload.is_checked,
        is_factory_payment_completed: payload.is_factory_payment_completed,
        mrn: trimOrUndefined(payload.mrn),
        trip_id: payload.trip_id ?? null,
      });

      const factorySelection = buildOrderFactorySelectionPayload(payload);

      const goodsLines = (payload.goods_lines ?? [])
        .map((line) =>
          compact({
            item_type: trimOrUndefined(line.item_type),
            custom_item_type: trimOrUndefined(line.custom_item_type),
            description: trimOrUndefined(line.description),
            weight_kg: trimOrUndefined(line.weight_kg),
            quantity_value: trimOrUndefined(line.quantity_value),
            quantity_unit: trimOrUndefined(line.quantity_unit),
          }),
        )
        .filter((line) => Object.keys(line).length > 0);

      const filesToUpload: Array<{ slot: string; file: File }> = [];
      const documentsPayload = (payload.documents ?? []).flatMap((entry, index) => {
        const docType = trimOrUndefined(entry.document_type);
        const file = entry.file_list?.[0]?.originFileObj;
        if (!docType || !file) return [];
        const slot = `edit_doc_${Date.now()}_${index}`;
        filesToUpload.push({ slot, file });
        return [
          compact({
            document_type: docType,
            display_name: file.name,
            file_slot: slot,
          }),
        ];
      });

      const multipartPayload = {
        order: orderPayload,
        factory_selection: factorySelection,
        goods_lines: goodsLines,
        documents: documentsPayload,
      };

      const formData = new FormData();
      formData.set("payload", JSON.stringify(multipartPayload));
      filesToUpload.forEach(({ slot, file }) => formData.append(slot, file));

      return apiRequest<OrderDetail>(`/api/orders/${id}`, {
        method: "PATCH",
        body: formData,
      });
    },
    onSuccess: async (_, values) => {
      message.success("Заказ обновлен");
      if (values?.id) {
        resetEditDraft(values.id);
      }
      if (selected?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(selected.id) });
        await editDetailQuery.refetch();
      }
      await invalidateOrdersQueries(values.id);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 422) {
          const applied = applyStructured422FieldErrors(error, "edit") || applyEdit422FieldErrors(error.detail);
          if (applied) {
            return;
          }
        }
        message.error(error.detail);
        return;
      }
      if (error instanceof Error) {
        message.error(error.message);
        return;
      }
      message.error("Ошибка обновления заказа");
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
      if (error instanceof ApiError && isOrderTripSourceMismatch(error.detail)) {
        message.error(getOrderTripSourceMismatchMessage());
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
      special_tariff,
    }: {
      id: number;
      special_tariff?: string | null;
    }) => {
      const formData = new FormData();
      formData.set(
        "payload",
        JSON.stringify({
          order: {
            special_tariff: normalizeSpecialTariffText(special_tariff),
          },
        }),
      );

      return apiRequest<OrderDetail>(`/api/orders/${id}`, {
        method: "PATCH",
        body: formData,
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
      if (error instanceof ApiError && isOrderTripSourceMismatch(error.detail)) {
        message.error(getOrderTripSourceMismatchMessage());
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
    router.push(`/orders/${record.id}`);
  }

  function openView(record: OrderListItem) {
    router.push(`/orders/${record.id}`);
  }

  function clearOrderChatUnread(orderId: number) {
    queryClient.setQueryData<OrderInternalEditRead>(queryKeys.orders.detail(orderId), (detail) => {
      if (!detail) return detail;
      return {
        ...detail,
        card: {
          ...detail.card,
          has_unread_client_messages: false,
          unread_client_messages_count: 0,
        },
      };
    });
    queryClient.setQueriesData<PaginatedResponse<ClientMessageInboxItem>>(
      { queryKey: ["orders", "client-messages"] },
      (previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((item) =>
                item.order_id === orderId
                  ? { ...item, has_unread_client_messages: false, unread_client_messages_count: 0 }
                  : item,
              ),
            }
          : previous,
    );
  }

  useEffect(() => {
    if (!standaloneOrderView || !deepLinkEditOrderId) {
      deepLinkedOrderIdRef.current = null;
      return;
    }
    if (deepLinkedOrderIdRef.current === deepLinkEditOrderId) return;
    if (!deepLinkOrderQuery.data?.order) return;
    const order = deepLinkOrderQuery.data.order;
    setSelected(order);
    setEditCompanyQueryText(order.company_name ?? "");
    const existingDraft = editDraftsByOrderId[order.id]?.values;
    if (existingDraft) {
      editForm.setFieldsValue(existingDraft as Partial<OrderEditForm>);
    } else {
      editForm.setFieldsValue({
        order_number: order.order_number ?? undefined,
        comment: order.comment ?? undefined,
        status_name: order.status_name ?? undefined,
        trip_id: order.trip_id ?? undefined,
        order_date: parseDayjsValue(order.order_date ?? undefined),
        status_date: parseDayjsValue(order.status_date ?? undefined),
      });
    }
    setEditOpen(true);
    setIsEditMode(false);
    setEditFactoryCreateSubmitting(false);
    deepLinkedOrderIdRef.current = deepLinkEditOrderId;
  }, [deepLinkEditOrderId, deepLinkOrderQuery.data?.order, editDraftsByOrderId, editForm, standaloneOrderView]);

  useEffect(() => {
    if (!standaloneOrderView || !deepLinkEditOrderId) return;
    if (!deepLinkOrderQuery.isError) return;
    message.error(deepLinkOrderQuery.error instanceof ApiError ? deepLinkOrderQuery.error.detail : "Заказ не найден");
    router.replace("/orders");
  }, [deepLinkEditOrderId, deepLinkOrderQuery.error, deepLinkOrderQuery.isError, message, router, standaloneOrderView]);

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
      special_tariff: record.special_tariff ?? undefined,
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

    if (canWriteOrderUi) {
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

    if (canRunOperationalActionsUi) {
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
      canQuotePriceUi && record.order_type === "quote_request"
    ) {
      actions.push({
        key: "quote-price",
        label: "Выставить цену",
        icon: <SwapOutlined />,
        onClick: () => openQuotePrice(record),
      });
    }

    if (isClientRoleUi && record.order_type === "quote_request" && record.quote_status === "priced_waiting_client") {
      actions.push({
        key: "quote-decision",
        label: "Решение по квоте",
        icon: <SwapOutlined />,
        onClick: () => openQuoteDecision(record),
      });
    }

    return actions;
  }

  function renderPickupWindow(record: OrderListItem) {
    const pickupDateFrom =
      typeof record.raw_payload?.pickup_date_from === "string" ? record.raw_payload.pickup_date_from : undefined;
    const pickupDateTo = typeof record.raw_payload?.pickup_date_to === "string" ? record.raw_payload.pickup_date_to : undefined;
    if (pickupDateFrom || pickupDateTo) {
      return [pickupDateFrom, pickupDateTo].filter(Boolean).join(" - ");
    }

    return record.pickup_date ?? record.trip_name ?? "—";
  }

  function openDocumentsPopup(record: OrderListItem) {
    setDocumentsOrder(record);
    setDocumentsOpen(true);
  }

  function openClientPopup(record: OrderListItem) {
    setClientOrder(record);
    setClientOpen(true);
  }

  function openFactoryPopup(record: OrderListItem) {
    setFactoryOrder(record);
    setFactoryOpen(true);
  }

  function openForwarderPopup(record: OrderListItem) {
    setForwarderOrder(record);
    setForwarderOpen(true);
  }

  function openInvoicePopup(record: OrderListItem) {
    if (!record.invoice_number) return;
    setInvoiceOrder(record);
    setInvoiceOpen(true);
  }

  function openDescriptionPopup(record: OrderListItem) {
    if (!record.additional_description && !record.has_description) return;
    setDescriptionOrder(record);
    setDescriptionOpen(true);
  }

  function getStringValue(source: Record<string, unknown> | null | undefined, keys: string[]) {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
    return undefined;
  }

  function getClientPopupInfo() {
    const detail = clientDetailQuery.data;
    const fallback = clientOrder;
    const rawPayload = detail?.raw_payload ?? fallback?.raw_payload;
    const rawRecord = detail as unknown as Record<string, unknown> | undefined;
    const rawClient = detail?.client as unknown as Record<string, unknown> | undefined;

    return {
      name:
        detail?.client?.contact_name ??
        detail?.client?.user_full_name ??
        detail?.contact_name_snapshot ??
        fallback?.contact_name_snapshot ??
        detail?.company_name ??
        fallback?.company_name ??
        "—",
      address:
        getStringValue(rawClient, ["address", "company_address", "legal_address", "actual_address"]) ??
        getStringValue(rawPayload, ["address", "company_address", "legal_address", "actual_address", "delivery_address"]) ??
        getStringValue(rawRecord, ["address", "company_address", "legal_address", "actual_address"]) ??
        "—",
      phone:
        detail?.client?.contact_phone ??
        detail?.client?.user_phone ??
        detail?.contact_phone_snapshot ??
        fallback?.contact_phone_snapshot ??
        "—",
      email:
        detail?.client?.contact_email ??
        detail?.client?.user_email ??
        detail?.contact_email_snapshot ??
        fallback?.contact_email_snapshot ??
        "—",
    };
  }

  function getFactoryPopupInfo() {
    const detail = factoryDetailQuery.data;
    const fallback = factoryOrder;
    const address = detail?.factory?.selected_loading_address;

    return {
      name: detail?.factory?.factory_name ?? fallback?.factory_name ?? "—",
      postcode: address?.postcode ?? "—",
      address: address?.address ?? "—",
      phone: address?.phone ?? "—",
      email: detail?.factory?.primary_email ?? "—",
    };
  }

function getUserAddress(user: UserAdmin | undefined, source: Record<string, unknown> | null | undefined) {
    const address =
      getStringValue(user as unknown as Record<string, unknown> | undefined, ["address", "legal_address", "actual_address"]) ??
      getStringValue(source, ["forwarder_address", "assigned_forwarder_address", "address"]) ??
      [formatCountryEnglishName(countryDirectory.countries, user?.country), user?.city].filter(Boolean).join(", ");

    return address || "—";
  }

  function getForwarderPopupInfo() {
    const detail = forwarderDetailQuery.data;
    const fallback = forwarderOrder;
    const forwarder = forwarderUserQuery.data;
    const rawPayload = detail?.raw_payload ?? fallback?.raw_payload;

    return {
      name: forwarder?.full_name ?? detail?.assigned_forwarder?.full_name ?? fallback?.forwarder_name ?? "—",
      address: getUserAddress(forwarder, rawPayload),
      email: forwarder?.email ?? getStringValue(rawPayload, ["forwarder_email", "assigned_forwarder_email"]) ?? "—",
      phone: forwarder?.phone ?? getStringValue(rawPayload, ["forwarder_phone", "assigned_forwarder_phone"]) ?? "—",
      personalManagerName: personalManagerQuery.data?.full_name ?? "—",
    };
  }

  function formatQuantityUnit(unitCode: string | undefined) {
    if (!unitCode) return undefined;

    const label = quantityUnitLabelByValue.get(unitCode) ?? unitCode;
    const normalized = label.trim().toLowerCase();

    if (["pcs", "piece", "pieces", "шт", "шт."].includes(normalized)) {
      return "шт.";
    }

    if (["m2", "m²", "square meter", "square meters", "кв. м", "кв. м."].includes(normalized)) {
      return "м²";
    }

    return label;
  }

  function getGoodsLinePopupText(line: OrderCreateGoodsLineForm) {
    const itemTypeCode = trimOrUndefined(line.item_type);
    const customItemType = trimOrUndefined(line.custom_item_type);
    const itemType =
      itemTypeCode === "other"
        ? customItemType
        : itemTypeCode
          ? (itemTypeLabelByValue.get(itemTypeCode) ?? itemTypeCode)
          : undefined;
    const description = trimOrUndefined(line.description);
    const weight = trimOrUndefined(line.weight_kg);
    const quantity = trimOrUndefined(line.quantity_value);
    const unitCode = trimOrUndefined(line.quantity_unit);
    const unit = formatQuantityUnit(unitCode);
    const name = [itemType, description].filter(Boolean).join(" ");
    const details = [
      weight ? `вес ${weight} кг` : undefined,
      quantity ? `количество ${quantity}${unit ? ` ${unit}` : ""}` : undefined,
    ].filter(Boolean);
    return [name || "Строка товара", ...details].join(" - ");
  }

  function getDescriptionPopupText() {
    const detail = descriptionDetailQuery.data;
    const goodsLines = (detail?.goods_lines ?? []).map((line) => getGoodsLinePopupText(normalizeGoodsLineFromDetail(line)));
    const description = trimOrUndefined(detail?.additional_description ?? descriptionOrder?.additional_description ?? undefined);
    return [...goodsLines, description].filter(Boolean).join("\n");
  }

  async function copyDescriptionPopupText() {
    const text = getDescriptionPopupText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      message.success("Описание скопировано");
    } catch {
      message.error("Не удалось скопировать описание");
    }
  }

  async function handleOrderDocumentDownload(orderId: number, row: OrderDocument) {
    const fallbackName = row.file_name || row.display_name || `order-${orderId}-document-${row.id}`;
    setDownloadingDocumentId(row.id);
    try {
      await downloadFileWithCredentials(`/api/orders/${orderId}/documents/${row.id}/download`, fallbackName);
    } catch (error) {
      message.error(getFileOperationErrorMessage(error, "Ошибка скачивания документа"));
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  function renderPaymentId(value: number, record: OrderListItem) {
    const isPaymentCompleted = Boolean(record.is_factory_payment_completed);
    const isPaymentViaCompany =
      Boolean(record.factory_payment_via_label) || Boolean(record.raw_payload?.is_factory_payment_via_company);
    const color = isPaymentCompleted ? "#16a34a" : isPaymentViaCompany ? "#1677ff" : undefined;
    const background = isPaymentCompleted ? "#f0fdf4" : isPaymentViaCompany ? "#eff6ff" : "transparent";

    return (
      <span
        style={{
          alignItems: "center",
          background,
          borderRadius: 6,
          color,
          display: "inline-flex",
          fontSize: "inherit",
          fontWeight: color ? 600 : 400,
          height: 24,
          justifyContent: "center",
          lineHeight: "24px",
          minWidth: 32,
        }}
      >
        {value}
      </span>
    );
  }

  const columns: ColumnsType<OrderListItem> = [
    {
      title: "Documents",
      key: "documents",
      width: 105,
      align: "center",
      render: (_, record) => {
        const documentsCount = record.documents_count ?? 0;
        const hasDocuments = record.has_documents || documentsCount > 0;
        return (
          <Button
            type="link"
            size="small"
            title={hasDocuments ? `Документы: ${documentsCount || "есть"}` : "Документов нет"}
            style={{ padding: 0 }}
            onClick={() => openDocumentsPopup(record)}
          >
            <FileTextOutlined style={{ opacity: hasDocuments ? 1 : 0.35 }} />
            {documentsCount > 0 ? <span style={{ marginLeft: 6 }}>{documentsCount}</span> : null}
          </Button>
        );
      },
    },
    {
      title: "Id",
      dataIndex: "id",
      key: "id",
      sorter: true,
      sortOrder: sortOrderFor("id"),
      width: 84,
      align: "center",
      render: (value: number, record) => renderPaymentId(value, record),
    },
    {
      title: "Внутренняя нумерация",
      dataIndex: "order_number",
      key: "order_number",
      sorter: true,
      sortOrder: sortOrderFor("order_number"),
      width: 180,
      render: (value: string | null) => renderOrderNumber(value),
    },
    {
      title: "Клиент",
      dataIndex: "company_name",
      key: "company_name",
      width: 180,
      render: (value: string | null | undefined, record) =>
        value ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openClientPopup(record)}>
            {value}
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: "Страна",
      dataIndex: "country",
      key: "country",
      width: 120,
      render: (value: string | null | undefined) => formatCountryEnglishName(countryDirectory.countries, value),
    },
    {
      title: "Название фабрики",
      dataIndex: "factory_name",
      key: "factory_name",
      width: 180,
      render: (value: string | null | undefined, record) =>
        value ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openFactoryPopup(record)}>
            {value}
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: "Экспедитор",
      dataIndex: "forwarder_name",
      key: "forwarder_name",
      width: 140,
      render: (value: string | null | undefined, record) =>
        value ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openForwarderPopup(record)}>
            {value}
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: "Инвойс/проформа",
      dataIndex: "invoice_number",
      key: "invoice_number",
      width: 160,
      render: (value: string | null | undefined, record) =>
        value ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openInvoicePopup(record)}>
            {value}
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: "Объем m3",
      dataIndex: "volume_m3",
      key: "volume_m3",
      width: 100,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Объем из инвойса",
      dataIndex: "declared_volume_m3",
      key: "declared_volume_m3",
      width: 155,
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
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (value: OrderStatus | null) => renderOrderStatus(value),
      width: 190,
    },
    {
      title: "Дней в текущем статусе",
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
      title: "Вывоз (от - до)",
      key: "pickup_window",
      width: 150,
      render: (_, record) => renderPickupWindow(record),
    },
    {
      title: "Описание",
      dataIndex: "additional_description",
      key: "additional_description",
      width: 180,
      render: (value: string | null | undefined, record) =>
        value || record.has_description ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openDescriptionPopup(record)}>
            {value ?? "Описание"}
          </Button>
        ) : (
          "—"
        ),
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
      title: "Спецтариф",
      dataIndex: "special_tariff",
      key: "special_tariff",
      width: 190,
      render: (value: string | null | undefined) => value || "—",
    },
    {
      title: "Комм. склада",
      dataIndex: "warehouse_comment",
      key: "warehouse_comment",
      width: 190,
      render: (value: string | null | undefined) => value ?? "—",
    },
    {
      title: "Сертификат",
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
          <Button size="small" type="link" onClick={() => openView(record)}>
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

  function openCreateGoodsLineModal() {
    setGoodsLineEditIndex(null);
    goodsLineQuickForm.resetFields();
    setGoodsLineModalOpen(true);
  }

  function openEditGoodsLineModal(index: number) {
    const line = goodsLineRows[index];
    if (!line) return;
    setGoodsLineEditIndex(index);
    goodsLineQuickForm.setFieldsValue(line);
    setGoodsLineModalOpen(true);
  }

  function removeGoodsLine(index: number) {
    const nextLines = goodsLineRows.filter((_, currentIndex) => currentIndex !== index);
    createForm.setFieldsValue({ goods_lines: nextLines });
    mergeCreateDraft({ goods_lines: nextLines });
  }

  async function saveGoodsLine(values: OrderCreateGoodsLineForm) {
    const itemType = trimOrUndefined(values.item_type);
    const customItemType = trimOrUndefined(values.custom_item_type);
    if (itemType === "other" && !customItemType) {
      goodsLineQuickForm.setFields([
        { name: ["custom_item_type"], errors: ["Укажите свой тип для 'другой'"] },
      ]);
      return;
    }

    const nextLine: OrderCreateGoodsLineForm = {
      item_type: itemType,
      custom_item_type: itemType === "other" ? customItemType : undefined,
      description: trimOrUndefined(values.description),
      weight_kg: trimOrUndefined(values.weight_kg),
      quantity_value: trimOrUndefined(values.quantity_value),
      quantity_unit: trimOrUndefined(values.quantity_unit),
    };

    const nextLines = [...goodsLineRows];
    if (goodsLineEditIndex === null) {
      nextLines.push(nextLine);
    } else {
      nextLines[goodsLineEditIndex] = nextLine;
    }
    createForm.setFieldsValue({ goods_lines: nextLines });
    mergeCreateDraft({ goods_lines: nextLines });
    setGoodsLineModalOpen(false);
    setGoodsLineEditIndex(null);
    goodsLineQuickForm.resetFields();
  }

  function getGoodsLineSummary(line: OrderCreateGoodsLineForm) {
    const itemTypeCode = trimOrUndefined(line.item_type);
    const customItemType = trimOrUndefined(line.custom_item_type);
    const itemTypeLabel =
      itemTypeCode === "other"
        ? customItemType
        : itemTypeCode
          ? (itemTypeLabelByValue.get(itemTypeCode) ?? itemTypeCode)
          : undefined;
    const weight = trimOrUndefined(line.weight_kg);
    const quantity = trimOrUndefined(line.quantity_value);
    const unitCode = trimOrUndefined(line.quantity_unit);
    const unit = formatQuantityUnit(unitCode);
    const parts = [
      itemTypeLabel,
      weight ? `вес ${weight} кг` : undefined,
      quantity ? `количество ${quantity}${unit ? ` ${unit}` : ""}` : undefined,
    ].filter(Boolean);

    return parts.join(" · ") || "Строка товара";
  }

  function openEditOrderGoodsLineModal() {
    setEditGoodsLineEditIndex(null);
    editGoodsLineQuickForm.resetFields();
    setEditGoodsLineModalOpen(true);
  }

  function openUpdateOrderGoodsLineModal(index: number) {
    const line = editGoodsLineRows[index];
    if (!line) return;
    setEditGoodsLineEditIndex(index);
    editGoodsLineQuickForm.setFieldsValue(line);
    setEditGoodsLineModalOpen(true);
  }

  function removeEditOrderGoodsLine(index: number) {
    if (!selectedOrderId) return;
    const nextLines = editGoodsLineRows.filter((_, currentIndex) => currentIndex !== index);
    editForm.setFieldValue("goods_lines", nextLines);
    mergeEditDraft(selectedOrderId, { goods_lines: nextLines });
  }

  async function saveEditOrderGoodsLine(values: OrderCreateGoodsLineForm) {
    if (!selectedOrderId) return;
    const itemType = trimOrUndefined(values.item_type);
    const customItemType = trimOrUndefined(values.custom_item_type);
    if (itemType === "other" && !customItemType) {
      editGoodsLineQuickForm.setFields([
        { name: ["custom_item_type"], errors: ["Укажите свой тип для 'другой'"] },
      ]);
      return;
    }

    const nextLine: OrderCreateGoodsLineForm = {
      item_type: itemType,
      custom_item_type: itemType === "other" ? customItemType : undefined,
      description: trimOrUndefined(values.description),
      weight_kg: trimOrUndefined(values.weight_kg),
      quantity_value: trimOrUndefined(values.quantity_value),
      quantity_unit: trimOrUndefined(values.quantity_unit),
    };

    const nextLines = [...editGoodsLineRows];
    if (editGoodsLineEditIndex === null) {
      nextLines.push(nextLine);
    } else {
      nextLines[editGoodsLineEditIndex] = nextLine;
    }

    editForm.setFieldValue("goods_lines", nextLines);
    mergeEditDraft(selectedOrderId, { goods_lines: nextLines });
    setEditGoodsLineModalOpen(false);
    setEditGoodsLineEditIndex(null);
    editGoodsLineQuickForm.resetFields();
  }

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
  const certificateIntentOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.certificate_intent_options,
  );
  const itemTypeOptions = toSelectOptions(createMetadataQuery.data?.item_type_options);
  const quantityUnitOptions =
    toSelectOptions(createMetadataQuery.data?.quantity_unit_options).length > 0
      ? toSelectOptions(createMetadataQuery.data?.quantity_unit_options)
      : QUANTITY_UNIT_FALLBACK_OPTIONS;
  const itemTypeLabelByValue = useMemo(
    () =>
      new Map(
        itemTypeOptions.map((option) => [option.value, typeof option.label === "string" ? option.label : String(option.label)]),
      ),
    [itemTypeOptions],
  );
  const quantityUnitLabelByValue = useMemo(
    () =>
      new Map(
        quantityUnitOptions.map((option) => [
          option.value,
          typeof option.label === "string" ? option.label : String(option.label),
        ]),
      ),
    [quantityUnitOptions],
  );
  const documentTypeOptions = toSelectOptions(createMetadataQuery.data?.document_type_options);
  const measurementStatusOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.measurement_status_options,
  );
  const weighingStatusOptions = toSelectOptions(
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.weighing_status_options,
  );
  const clientCompanyOptions = (clientCompaniesQuery.data?.items ?? []).map((item) => ({
    label: item.company_name,
    value: item.company_id,
  }));
  const selectedCompanyContacts = selectedClientCompany?.contacts ?? [];
  const clientCompanyLabel = meQuery.data?.company_id ? "Компания" : "Компания из токена";
  const clientContactUiOptions = meQuery.data?.id
    ? [
        {
          label: [meQuery.data.full_name, meQuery.data.login].filter(Boolean).join(" · ") || "Пользователь",
          value: meQuery.data.id,
        },
      ]
    : [];
  const selectedLoadingAddress = useMemo(
    () => (loadingAddressesQuery.data ?? []).find((address) => address.id === createLoadingAddressId),
    [createLoadingAddressId, loadingAddressesQuery.data],
  );
  const selectedFactoryContact = useMemo(
    () => (factoryContactsQuery.data?.items ?? []).find((contact) => contact.id === createFactoryContactId),
    [createFactoryContactId, factoryContactsQuery.data?.items],
  );
  const postcodeOptions = useMemo(
    () =>
      (postcodeOptionsQuery.data?.items ?? []).map((postcode) => ({
        label: postcode.postcode,
        value: postcode.id,
      })),
    [postcodeOptionsQuery.data?.items],
  );
  const cityOptions = useMemo(
    () =>
      (postcodeCitiesQuery.data?.items ?? []).map((city) => ({
        label: city.city,
        value: city.id,
      })),
    [postcodeCitiesQuery.data?.items],
  );
  const allLoadingAddresses = useMemo(() => {
    const source = loadingAddressesQuery.data ?? [];
    return createdLoadingAddressOption && !source.some((address) => address.id === createdLoadingAddressOption.id)
      ? [createdLoadingAddressOption, ...source]
      : source;
  }, [createdLoadingAddressOption, loadingAddressesQuery.data]);
  const allEditLoadingAddresses = useMemo(() => {
    const source = editLoadingAddressesQuery.data?.items ?? [];
    return editCreatedLoadingAddressOption && !source.some((address) => address.id === editCreatedLoadingAddressOption.id)
      ? [editCreatedLoadingAddressOption, ...source]
      : source;
  }, [editCreatedLoadingAddressOption, editLoadingAddressesQuery.data?.items]);
  const selectedEditLoadingAddress = useMemo(
    () => allEditLoadingAddresses.find((address) => address.id === editLoadingAddressId),
    [allEditLoadingAddresses, editLoadingAddressId],
  );

  useEffect(() => {
    if (!createOpen || createFactoryMode !== "existing") return;
    if (!createLoadingAddressId) return;
    const stillVisible = allLoadingAddresses.some((address) => address.id === createLoadingAddressId);
    if (!stillVisible) {
      createForm.setFieldValue("loading_address_id", undefined);
    }
  }, [
    createFactoryMode,
    createForm,
    createLoadingAddressId,
    createOpen,
    allLoadingAddresses,
  ]);

  useEffect(() => {
    if (!createOpen || !selectedLoadingAddress) return;
    createForm.setFieldValue("loading_postcode_id_ui", selectedLoadingAddress.postcode_id ?? undefined);
    createForm.setFieldValue("loading_city_id_ui", selectedLoadingAddress.city_id ?? undefined);
    if (createFactoryMode === "create") {
      createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], selectedLoadingAddress.postcode_id ?? undefined);
      createForm.setFieldValue(["create_factory", "loading_address", "city_id"], selectedLoadingAddress.city_id ?? undefined);
    }
  }, [createFactoryMode, createForm, createOpen, selectedLoadingAddress]);

  useEffect(() => {
    if (!editOpen || editFactoryMode !== "existing") return;
    if (!editLoadingAddressId) return;
    const stillVisible = allEditLoadingAddresses.some((address) => address.id === editLoadingAddressId);
    if (!stillVisible) {
      editForm.setFieldValue("loading_address_id", undefined);
      if (selectedOrderId) {
        mergeEditDraft(selectedOrderId, { loading_address_id: undefined });
      }
    }
  }, [
    allEditLoadingAddresses,
    editFactoryMode,
    editForm,
    editLoadingAddressId,
    editOpen,
    mergeEditDraft,
    selectedOrderId,
  ]);

  useEffect(() => {
    if (!editOpen || !selectedEditLoadingAddress) return;
    editForm.setFieldValue("loading_postcode_id_ui", selectedEditLoadingAddress.postcode_id ?? undefined);
    editForm.setFieldValue("loading_city_id_ui", selectedEditLoadingAddress.city_id ?? undefined);
    editForm.setFieldValue("loading_address_line", selectedEditLoadingAddress.address ?? undefined);
    editForm.setFieldValue("loading_address_fax", selectedEditLoadingAddress.fax ?? undefined);
  }, [editForm, editOpen, selectedEditLoadingAddress]);
  const priceCoefficient = formatRatio(createClientGoodsValueAmount, createDeclaredVolumeM3);
  const weightCoefficient = formatRatio(createDeclaredVolumeM3, createDeclaredTotalWeightKg);
  const selfDeliveryForwarderOptions = (
    (createMetadataQuery.data as OrderCreateMetadata | undefined)?.self_delivery_forwarder_options ?? []
  ).map((forwarder) => ({
    label: [forwarder.full_name, forwarder.email].filter(Boolean).join(" · ") || "Экспедитор",
    value: forwarder.id,
  }));
  const clientForwarderUiOptions =
    selfDeliveryForwarderOptions.length > 0
      ? selfDeliveryForwarderOptions
      : [
          {
            label: "UI-only (до backend parity)",
            value: -1,
          },
        ];
  const factoryContactEmailOptions = (factoryContactsQuery.data?.items ?? [])
    .filter((item) => Boolean(item.email))
    .map((item) => ({
      label: `${item.email}${item.is_primary ? " (primary)" : ""}`,
      value: item.id,
    }));
  const editOfficeMarkOptions = toSelectOptions(editMetadataQuery.data?.office_mark_options);
  const editProductCharacteristicOptions = toSelectOptions(editMetadataQuery.data?.product_characteristic_options);
  const editCertificateIntentOptions = toSelectOptions(editMetadataQuery.data?.certificate_intent_options);
  const editItemTypeOptions = toSelectOptions(editMetadataQuery.data?.item_type_options);
  const editQuantityUnitOptions =
    toSelectOptions(editMetadataQuery.data?.quantity_unit_options).length > 0
      ? toSelectOptions(editMetadataQuery.data?.quantity_unit_options)
      : QUANTITY_UNIT_FALLBACK_OPTIONS;
  const editDocumentTypeOptions = toSelectOptions(editMetadataQuery.data?.document_type_options);
  const editMeasurementStatusOptions = toSelectOptions(editMetadataQuery.data?.measurement_status_options);
  const editWeighingStatusOptions = toSelectOptions(editMetadataQuery.data?.weighing_status_options);
  const editFactoryContactEmailSelectOptions = editContactEmailOptions
    .filter((item) => Boolean(item.email))
    .map((item) => ({
      label: `${item.email}${item.is_primary ? " (primary)" : ""}`,
      value: item.id,
    }));
  const editFactoryOptionSource =
    editCreatedFactoryOption && !(editFactoryOptionsQuery.data ?? []).some((factory) => factory.id === editCreatedFactoryOption.id)
      ? [editCreatedFactoryOption, ...(editFactoryOptionsQuery.data ?? [])]
      : (editFactoryOptionsQuery.data ?? []);
  const editFactoryOptions = editFactoryOptionSource.map((factory) => ({
    label: [factory.name, factory.subtitle].filter(Boolean).join(" (") + (factory.subtitle ? ")" : ""),
    value: factory.id,
  }));
  const editLoadingAddressOptions = allEditLoadingAddresses.map((address) => ({
    label: (address.name?.trim() || address.address || "Адрес") + (address.is_primary ? " (Primary)" : ""),
    value: address.id,
  }));
  const editPostcodeOptions = (editPostcodeOptionsQuery.data?.items ?? []).map((postcode) => ({
    label: postcode.postcode,
    value: postcode.id,
  }));
  const editCityOptions = (editPostcodeCitiesQuery.data?.items ?? []).map((city) => ({
    label: city.city,
    value: city.id,
  }));
  const editPriceCoefficient = formatRatio(
    Form.useWatch("client_goods_value_amount", editForm),
    Form.useWatch("declared_volume_m3", editForm),
  );
  const editWeightCoefficient = formatRatio(
    Form.useWatch("declared_volume_m3", editForm),
    Form.useWatch("declared_total_weight_kg", editForm),
  );
  const editCompanyOptions = (editClientCompaniesQuery.data?.items ?? []).map((item) => ({
    label: item.company_name,
    value: item.company_id,
  }));
  const selectedEditCompanyContacts = selectedEditCompany?.contacts ?? [];

  useEffect(() => {
    if (!createOpen || isClientRole) return;
    if (!selectedFactoryContact) {
      createForm.setFieldValue(["create_factory_contact", "full_name"], undefined);
      createForm.setFieldValue(["create_factory_contact", "phone"], undefined);
      createForm.setFieldValue(["create_factory_contact", "email"], undefined);
      return;
    }
    createForm.setFieldValue(["create_factory_contact", "full_name"], selectedFactoryContact.full_name);
    createForm.setFieldValue(["create_factory_contact", "phone"], selectedFactoryContact.phone);
    createForm.setFieldValue(["create_factory_contact", "email"], selectedFactoryContact.email ?? undefined);
  }, [createForm, createOpen, isClientRole, selectedFactoryContact]);

  useEffect(() => {
    if (!editOpen || !selectedOrderId) return;
    const contactId = editForm.getFieldValue("factory_contact_id") as number | undefined;
    if (!contactId) return;
    const selectedContact = editContactEmailOptions.find((item) => item.id === contactId);
    if (!selectedContact) return;
    editForm.setFieldValue("factory_contact_email", selectedContact.email ?? undefined);
    editForm.setFieldValue("factory_contact_name", selectedContact.full_name ?? undefined);
    editForm.setFieldValue("factory_contact_phone", selectedContact.phone ?? undefined);
  }, [editContactEmailOptions, editForm, editOpen, selectedOrderId]);

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      {!standaloneOrderView ? (
        <>
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
          canCreateUi ? (
            <Button type="primary" onClick={openCreateModal}>
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
            <Form.Item
              name="country"
              className="crm-col-2"
              style={{ marginBottom: 0 }}
              getValueProps={(countryName?: string) => ({
                value: findCountry(countryDirectory.countries, countryName)?.id,
              })}
              getValueFromEvent={(_countryId: number | undefined, country: Country | undefined) =>
                getCountryEnglishName(country) ?? undefined
              }
            >
              <CountrySelect scope={countryDirectoryScope} allowClear placeholder="Страна" />
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

      {canWriteOrderUi ? (
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
                      {canWriteOrderUi ? (
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
                      <Button
                        type="link"
                        className="crm-row-title"
                        style={{ padding: 0, height: "auto" }}
                        onClick={() => openView(record)}
                      >
                        {renderOrderNumber(record.order_number)}
                      </Button>
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
                      <strong>{record.trip_name ?? "-"}</strong>
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
                    <Button size="small" type="primary" ghost onClick={() => openView(record)}>
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
              canWriteOrderUi
                ? {
                    fixed: true,
                    columnWidth: 56,
                    columnTitle: (checkboxNode) => <span className="crm-selection-column-title">{checkboxNode}</span>,
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

        </>
      ) : null}

      {!isHydrated ? (
        <>
          <Form form={createForm} component={false} />
          <Form form={editForm} component={false} />
          <Form form={statusForm} component={false} />
          <Form form={assignForm} component={false} />
          <Form form={assignForwarderForm} component={false} />
          <Form form={pickupForm} component={false} />
          <Form form={specialTariffForm} component={false} />
          <Form form={requestToFactoryForm} component={false} />
          <Form form={quotePriceForm} component={false} />
          <Form form={quoteDecisionForm} component={false} />
          <Form form={filterForm} component={false} />
          <Form form={bulkStatusForm} component={false} />
          <Form form={bulkAssignForm} component={false} />
          <Form form={bulkPickupForm} component={false} />
          <Form form={bulkSpecialTariffForm} component={false} />
          <Form form={bulkCommentForm} component={false} />
          <Form form={factoryContactQuickForm} component={false} />
          <Form form={editFactoryContactQuickForm} component={false} />
          <Form form={factoryLoadingAddressQuickForm} component={false} />
          <Form form={editFactoryLoadingAddressQuickForm} component={false} />
          <Form form={goodsLineQuickForm} component={false} />
          <Form form={editGoodsLineQuickForm} component={false} />
        </>
      ) : null}

      {isHydrated ? (
        <>
      <Modal
        title={
          isClientRole
            ? "Создать заказ (клиентский контур)"
            : isRequestCreate
              ? "Создать заявку (request)"
              : "Создать заказ"
        }
        open={createOpen}
        className="crm-order-create-modal"
        forceRender
        onCancel={() => {
          Modal.confirm({
            title: "Вы уверены, что хотите отменить создание заказа?",
            okText: "Отменить создание",
            cancelText: "Продолжить заполнение",
            onOk: () => closeAndResetCreateModal(),
          });
        }}
        footer={
          <div className="crm-create-wizard-footer">
            <Button
              disabled={createStep === 0 || createMutation.isPending}
              onClick={() => void goToCreateStep(createStep - 1)}
            >
              Назад
            </Button>
            {createStep < createWizardLastStep ? (
              <Button type="primary" disabled={createMutation.isPending} onClick={() => void goToNextCreateStep()}>
                Далее
              </Button>
            ) : (
              <Button type="primary" loading={createMutation.isPending} onClick={() => createForm.submit()}>
                Готово
              </Button>
            )}
          </div>
        }
        width={createStep === 0 || isRequestCreate ? COMPACT_CREATE_MODAL_WIDTH : 1080}
      >
        <div className="crm-create-wizard-head">
          <Typography.Text className="crm-create-wizard-step-counter">
            Шаг {createStep + 1} из {createWizardSteps.length}
          </Typography.Text>
          <Steps
            size="small"
            current={createStep}
            className="crm-create-wizard-steps"
            orientation={isMobile ? "vertical" : "horizontal"}
            items={createWizardSteps.map((step) => ({ title: step.title }))}
            onChange={(nextStep) => void goToCreateStep(nextStep)}
          />
        </div>

        <Form<OrderCreateForm>
          form={createForm}
          layout="vertical"
          className="crm-order-create-form"
          initialValues={CREATE_ORDER_DRAFT_DEFAULTS as Partial<OrderCreateForm>}
          onValuesChange={(changedValues) => {
            if (isRehydratingCreateFormRef.current) {
              return;
            }
            const snapshot = createForm.getFieldsValue(true) as OrderCreateForm;
            const nextOrderType = snapshot.order_type ?? currentCreateOrderType;
            if ("order_type" in changedValues) {
              setCreateStep((previous) => clampOrderCreateWizardStep(previous, nextOrderType));
            }
            setCreateDraft({ ...snapshot, order_type: nextOrderType } as Record<string, unknown>);
          }}
          onFinish={(values) => {
            const snapshot = createForm.getFieldsValue(true) as OrderCreateForm;
            const latestLastStep = getOrderCreateWizardSteps(snapshot.order_type ?? currentCreateOrderType).length - 1;
            if (createStep < latestLastStep) {
              setCreateStep((previous) => Math.min(previous + 1, latestLastStep));
              return;
            }
            const draftPayload = (createDraft as Partial<OrderCreateForm>) ?? {};
            const nextValues = { ...draftPayload, ...snapshot, ...values };
            if (!validateCreateOrderBeforeSubmit(nextValues)) {
              return;
            }
            createMutation.mutate(nextValues);
          }}
        >
          {createWizardStepKey === "base" ? (
            <div className="crm-order-create-section">
              <div className="crm-order-create-grid">
                {!isClientRole ? (
                  <Form.Item
                    name="company_id"
                    label="Компания"
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
                ) : (
                  <Form.Item label="Компания" className="crm-order-create-col" extra="UI-only: определяется из профиля клиента">
                    <Input readOnly value={clientCompanyLabel} />
                  </Form.Item>
                )}

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
                            .join(" · ") || "Контакт",
                        value: contact.id,
                      }))}
                      placeholder={selectedCompanyContacts.length ? "Выберите контакт" : "Сначала выберите компанию"}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="company_contact_id"
                    label="Имя клиента"
                    className="crm-order-create-col"
                    extra="UI-only: в текущем client API поле не отправляется"
                  >
                    <Select allowClear options={clientContactUiOptions} placeholder="Опционально" />
                  </Form.Item>
                )}

                <Form.Item name="invoice_on_other_company" valuePropName="checked" className="crm-order-create-col">
                  <Checkbox>Инвойс на другую компанию</Checkbox>
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, next) => prev.invoice_on_other_company !== next.invoice_on_other_company}>
                  {({ getFieldValue }) =>
                    getFieldValue("invoice_on_other_company") ? (
                      <Form.Item
                        name="invoice_company_name"
                        label="Название компании"
                        rules={[{ required: true, message: "Укажите название компании" }]}
                        className="crm-order-create-col"
                      >
                        <Input />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>

                <Form.Item name="order_number" label="Ваша внутренняя нумерация" className="crm-order-create-col">
                  <Input />
                </Form.Item>

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
                    onChange={(value) => {
                      const orderType = value as OrderType;
                      const documents = orderType === "request" ? [] : createForm.getFieldValue("documents");
                      if (orderType === "request") {
                        createForm.setFieldValue("documents", []);
                      }
                      const nextValues = {
                        ...(createForm.getFieldsValue(true) as OrderCreateForm),
                        order_type: orderType,
                        documents,
                      };
                      setCreateDraft(nextValues as Record<string, unknown>);
                      setCreateStep((previous) => clampOrderCreateWizardStep(previous, orderType));
                    }}
                  />
                </Form.Item>

              </div>
            </div>
          ) : null}

          {createWizardStepKey === "factory" ? (
            <>
              <div className="crm-order-create-section">
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Фабрика
                </Typography.Title>
                <div className="crm-order-create-grid">
                  <Form.Item name="self_delivery" valuePropName="checked" className="crm-order-create-col">
                    <Checkbox>Самодоставка</Checkbox>
                  </Form.Item>

                  {createSelfDelivery ? (
                    <Form.Item
                      name="self_delivery_forwarder_user_id"
                      label="Экспедитор самодоставки"
                      rules={!isClientRole ? [{ required: true, message: "Выберите экспедитора самодоставки" }] : undefined}
                      className="crm-order-create-col"
                      extra={isClientRole ? "UI-only: не отправляется в client payload" : undefined}
                    >
                      <Select
                        allowClear
                        loading={!isClientRole && createMetadataQuery.isLoading}
                        options={isClientRole ? clientForwarderUiOptions : selfDeliveryForwarderOptions}
                        placeholder={
                          isClientRole
                            ? "UI-only поле"
                            : selfDeliveryForwarderOptions.length
                              ? undefined
                              : "Нет экспедиторов в metadata"
                        }
                        onChange={(value) => {
                          createForm.setFieldValue("assigned_forwarder_user_id", value ?? undefined);
                        }}
                      />
                    </Form.Item>
                  ) : null}

                  <Form.Item
                    name="assigned_forwarder_user_id"
                    label="Назначить экспедитора"
                    className="crm-order-create-col"
                    extra={isClientRole ? "UI-only: не отправляется в client payload" : undefined}
                  >
                    <Select
                      allowClear
                      loading={!isClientRole && forwardersQuery.isLoading}
                      options={
                        isClientRole
                          ? clientForwarderUiOptions
                          : (forwardersQuery.data?.items ?? []).map((user) => ({
                              label: [user.full_name, user.login].filter(Boolean).join(" · ") || "Экспедитор",
                              value: user.id,
                            }))
                      }
                      placeholder={isClientRole ? "UI-only поле" : undefined}
                    />
                  </Form.Item>

                  <Form.Item name="factory_mode" hidden initialValue="existing">
                    <Input />
                  </Form.Item>

                  <Form.Item
                    name="factory_country_id"
                    label="Страна"
                    rules={[{ required: true, message: "Выберите страну" }]}
                    className="crm-order-create-col"
                  >
                    <CountrySelect
                      scope={countryDirectoryScope}
                      onChange={() => {
                        createForm.setFieldValue("factory_id", undefined);
                        createForm.setFieldValue("loading_address_id", undefined);
                        createForm.setFieldValue("factory_contact_id", undefined);
                        createForm.setFieldValue("loading_postcode_id_ui", undefined);
                        createForm.setFieldValue("loading_city_id_ui", undefined);
                        createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], undefined);
                        createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
                        setPostcodeQuery("");
                        setPostcodeQueryDebounced("");
                      }}
                    />
                  </Form.Item>

                  {createFactoryMode === "existing" ? (
                    <Form.Item name="factory_id" label="Фабрика" rules={[{ required: true }]} className="crm-order-create-col">
                      {(() => {
                        const source = factoryOptionsQuery.data ?? [];
                        const options =
                          createdFactoryOption && !source.some((factory) => factory.id === createdFactoryOption.id)
                            ? [createdFactoryOption, ...source]
                            : source;
                        return (
                      <Select
                        showSearch
                        optionFilterProp="label"
                        loading={factoryOptionsQuery.isLoading}
                        disabled={!createFactoryCountryId}
                        options={options.map((factory) => ({
                          label: factory.subtitle ? `${factory.name} (${factory.subtitle})` : factory.name,
                          value: factory.id,
                        }))}
                        onSearch={setFactorySearchTerm}
                        onChange={() => {
                          createForm.setFieldValue("loading_address_id", undefined);
                          createForm.setFieldValue("factory_contact_id", undefined);
                          createForm.setFieldValue("loading_postcode_id_ui", undefined);
                          createForm.setFieldValue("loading_city_id_ui", undefined);
                        }}
                        dropdownRender={(menu) => (
                          <>
                            {menu}
                            <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                              <Button
                                type="link"
                                style={{ padding: 0 }}
                                onClick={() => {
                                  createForm.setFieldValue("factory_mode", "create");
                                  createForm.setFieldValue("factory_id", undefined);
                                  createForm.setFieldValue("loading_address_id", undefined);
                                  createForm.setFieldValue("factory_contact_id", undefined);
                                  createForm.setFieldValue(["create_factory", "factory_name"], factorySearchTerm?.trim() || undefined);
                                }}
                              >
                                Не нашли фабрику? Добавить вручную
                              </Button>
                            </div>
                          </>
                        )}
                        notFoundContent={createFactoryCountryId ? "Нет фабрик в выбранной стране" : "Сначала выберите страну"}
                      />
                        );
                      })()}
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item
                        name={["create_factory", "factory_name"]}
                        label="Фабрика"
                        rules={[{ required: true, message: "Введите название фабрики" }]}
                        className="crm-order-create-col"
                      >
                        <Input placeholder="Введите название фабрики" />
                      </Form.Item>
                      <Form.Item className="crm-order-create-col" style={{ marginTop: -8, marginBottom: 8 }}>
                        <Button
                          type="link"
                          style={{ padding: 0 }}
                          onClick={() => {
                            createForm.setFieldValue("factory_mode", "existing");
                            createForm.setFieldValue(["create_factory"], undefined);
                          }}
                        >
                          Вернуться к поиску по базе
                        </Button>
                      </Form.Item>
                    </>
                  )}

                  {createFactoryMode === "existing" ? (
                    <Form.Item
                      name="loading_address_id"
                      label="Название адреса"
                      rules={[{ required: true }]}
                      className="crm-order-create-col"
                      >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        loading={loadingAddressesQuery.isLoading}
                        disabled={!createFactoryId}
                        options={allLoadingAddresses.map((address) => ({
                          label: (address.name?.trim() || address.address || "Адрес") + (address.is_primary ? " (Primary)" : ""),
                          value: address.id,
                        }))}
                        onChange={(value) => {
                          if (!value) {
                            createForm.setFieldValue("loading_postcode_id_ui", undefined);
                            createForm.setFieldValue("loading_city_id_ui", undefined);
                          }
                        }}
                        dropdownRender={(menu) => (
                          <>
                            {menu}
                            <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                              <Button
                                type="link"
                                style={{ padding: 0 }}
                                onClick={() => {
                                  factoryLoadingAddressQuickForm.resetFields();
                                  setFactoryLoadingAddressModalOpen(true);
                                }}
                              >
                                Добавить адрес
                              </Button>
                            </div>
                          </>
                        )}
                        notFoundContent={createFactoryId ? "Нет адресов загрузки" : "Сначала выберите фабрику"}
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item
                        name={["create_factory", "loading_address", "name"]}
                        label="Название адреса"
                        rules={[{ required: true, message: "Введите название адреса" }]}
                        className="crm-order-create-col"
                      >
                        <Input placeholder="Например: Основной склад" />
                      </Form.Item>
                      <Form.Item
                        name={["create_factory", "loading_address", "address"]}
                        label="Адрес погрузки"
                        rules={[{ required: true, message: "Введите адрес погрузки" }]}
                        className="crm-order-create-col"
                      >
                        <Input placeholder="Введите адрес погрузки" />
                      </Form.Item>
                    </>
                  )}

                  {createFactoryMode === "existing" ? (
                    <Form.Item label="Адрес погрузки" className="crm-order-create-col">
                      <Input
                        readOnly
                        value={
                          selectedLoadingAddress
                            ? [
                                selectedLoadingAddress.postcode,
                                selectedLoadingAddress.city,
                                selectedLoadingAddress.address,
                              ]
                                .filter(Boolean)
                                .join(" -> ")
                            : ""
                        }
                        placeholder={createFactoryId ? "Выберите название адреса" : "Сначала выберите фабрику"}
                      />
                    </Form.Item>
                  ) : null}

                  <Form.Item
                    name="loading_postcode_id_ui"
                    label="Индекс"
                    rules={createFactoryMode === "create" ? [{ required: true, message: "Выберите индекс" }] : undefined}
                    className="crm-order-create-col"
                  >
                    <Select
                      showSearch
                      filterOption={false}
                      allowClear
                      disabled={!createFactoryCountryId || createFactoryMode === "existing"}
                      loading={postcodeOptionsQuery.isLoading}
                      options={postcodeOptions}
                      onSearch={(value) => setPostcodeQuery(value)}
                      onChange={(value) => {
                        createForm.setFieldValue("loading_city_id_ui", undefined);
                        if (createFactoryMode === "create") {
                          createForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], value ?? undefined);
                          createForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
                        }
                      }}
                      placeholder={createFactoryCountryId ? "Начните вводить индекс" : "Сначала выберите страну"}
                      notFoundContent={createFactoryCountryId ? "Индексы не найдены" : "Сначала выберите страну"}
                    />
                  </Form.Item>

                  <Form.Item
                    name="loading_city_id_ui"
                    label="Город"
                    rules={createFactoryMode === "create" ? [{ required: true, message: "Выберите город" }] : undefined}
                    className="crm-order-create-col"
                  >
                    <Select
                      allowClear
                      disabled={!createLoadingPostcodeIdUi || createFactoryMode === "existing"}
                      loading={postcodeCitiesQuery.isLoading}
                      options={cityOptions}
                      onChange={(value) => {
                        if (createFactoryMode === "create") {
                          createForm.setFieldValue(["create_factory", "loading_address", "city_id"], value ?? undefined);
                        }
                      }}
                      placeholder={createLoadingPostcodeIdUi ? "Выберите город" : "Сначала выберите индекс"}
                      notFoundContent={createLoadingPostcodeIdUi ? "Нет городов для индекса" : "Сначала выберите индекс"}
                    />
                  </Form.Item>

                  {createFactoryMode === "create" ? (
                    <Form.Item className="crm-order-create-col">
                      <Button
                        block
                        type="primary"
                        loading={factoryCreateSubmitting}
                        onClick={handleCreateFactoryFromCreateForm}
                      >
                        Создать фабрику
                      </Button>
                    </Form.Item>
                  ) : null}

                  {(createFactoryMode === "existing" || factoryCreateConfirmed) ? (
                  <div className="crm-order-create-col crm-order-create-contact-block">
                    <div className="crm-order-create-contact-head">
                      <Typography.Text strong>Контакты</Typography.Text>
                      <Button
                        onClick={() => {
                          factoryContactQuickForm.resetFields();
                          setFactoryContactModalOpen(true);
                        }}
                      >
                        Добавить
                      </Button>
                    </div>

                    {!isClientRole ? (
                      <Form.Item
                        name="factory_contact_id"
                        label="Email"
                        rules={[{ required: true, message: "Выберите email контакта фабрики" }]}
                        className="crm-order-create-col"
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          allowClear
                          loading={factoryContactsQuery.isLoading}
                          disabled={!createFactoryId}
                          options={factoryContactEmailOptions}
                          placeholder={createFactoryId ? "Выберите email контакта" : "Сначала выберите фабрику"}
                        />
                      </Form.Item>
                    ) : (
                      <Form.Item
                        name={["create_factory_contact", "email"]}
                        label="Email"
                        className="crm-order-create-col"
                        extra="UI-only до backend parity"
                      >
                        <Input />
                      </Form.Item>
                    )}

                    <Form.Item
                      name={["create_factory_contact", "full_name"]}
                      label="Имя"
                      rules={!isClientRole ? [{ required: true, message: "Укажите имя контакта фабрики" }] : undefined}
                      className="crm-order-create-col"
                      extra={isClientRole ? "UI-only до backend parity" : undefined}
                    >
                      <Input readOnly={!isClientRole} />
                    </Form.Item>

                    <Form.Item
                      name={["create_factory_contact", "phone"]}
                      label="Телефон"
                      rules={
                        !isClientRole
                          ? [
                              { required: true, message: "Укажите телефон контакта фабрики" },
                              { pattern: PHONE_FORMAT_REGEX, message: "Допустимы цифры, пробелы и символы + ( ) -" },
                            ]
                          : undefined
                      }
                      className="crm-order-create-col"
                      extra={isClientRole ? "UI-only до backend parity" : undefined}
                    >
                      <Input readOnly={!isClientRole} />
                    </Form.Item>
                  </div>
                  ) : (
                    <Typography.Text type="secondary" className="crm-order-create-col">
                      Заполните кастомную фабрику и подтвердите создание, чтобы перейти к контактам.
                    </Typography.Text>
                  )}

                  <Form.Item
                    name="ready_date"
                    label="Дата готовности"
                    rules={[{ required: true }]}
                    className="crm-order-create-col"
                  >
                    <DatePicker
                      style={{ width: "100%" }}
                      format="YYYY-MM-DD"
                      disabledDate={(current) =>
                        Boolean(current && current.startOf("day").isBefore(dayjs().startOf("day")))
                      }
                    />
                  </Form.Item>

                  <Form.Item label="Вывоз" className="crm-order-create-col">
                    <Space.Compact style={{ width: "100%" }}>
                      <Form.Item name="pickup_date_from" noStyle>
                        <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="От" />
                      </Form.Item>
                      <Form.Item
                        name="pickup_date_to"
                        noStyle
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
                      >
                        <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="До" />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </div>
              </div>
            </>
          ) : null}

          {createWizardStepKey === "order_data" ? (
            <>
              <div className="crm-order-create-section">
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Данные заказа
                </Typography.Title>
                <div className="crm-order-create-grid">
                  <Form.Item
                    name="invoice_number"
                    label="Номер инвойса"
                    rules={isCommercialCreate ? [{ required: true, message: "Укажите номер инвойса" }] : undefined}
                    className="crm-order-create-col"
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="Валюта" className="crm-order-create-col">
                    <div className="crm-order-currency-row">
                      <Form.Item
                        name="client_goods_value_currency"
                        className="crm-order-currency-inline-item"
                        rules={
                          isCommercialCreate
                            ? [{ required: true, message: "Выберите валюту" }]
                            : undefined
                        }
                      >
                        <Select
                          className="crm-order-currency-select"
                          options={ORDER_CURRENCY_OPTIONS}
                        />
                      </Form.Item>
                      {createClientGoodsValueCurrency === "OTHER" ? (
                        <Form.Item
                          name="client_goods_value_currency_other_label"
                          rules={[{ required: true, message: "Укажите валюту" }]}
                          className="crm-order-currency-inline-item"
                        >
                          <Input className="crm-order-currency-select" placeholder="Введите валюту" />
                        </Form.Item>
                      ) : null}
                    </div>
                  </Form.Item>
                  <Form.Item
                    name="client_goods_value_amount"
                    label="Сумма инвойса"
                    rules={[createDecimalRule("client_goods_value_amount", isCommercialCreate)]}
                    className="crm-order-create-col"
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="declared_volume_m3"
                    label="Заявленный объем"
                    rules={[createDecimalRule("declared_volume_m3", isCommercialCreate)]}
                    className="crm-order-create-col"
                  >
                    <Input addonAfter="м³" />
                  </Form.Item>
                  <div className="crm-order-create-col crm-order-inline-pair">
                    <Form.Item
                      name="declared_total_weight_kg"
                      label="Вес"
                      rules={[createDecimalRule("declared_total_weight_kg", isCommercialCreate)]}
                      className="crm-order-inline-pair-item"
                    >
                      <Input addonAfter="кг" />
                    </Form.Item>
                    <Form.Item name="cargo_places_qty" label="Кол-во мест" className="crm-order-inline-pair-item">
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </div>
                </div>
              </div>

              <div className="crm-order-create-section">
                <div className="crm-order-create-grid">
                  {!isClientRole ? (
                    <>
                      <Form.Item name="measurement_status" label="Перемер" className="crm-order-create-col">
                        <Select allowClear options={measurementStatusOptions} />
                      </Form.Item>
                      <Form.Item name="weighing_status" label="Взвешивание" className="crm-order-create-col">
                        <Select allowClear options={weighingStatusOptions} />
                      </Form.Item>
                    </>
                  ) : (
                    <>
                      <Form.Item
                        name="client_measurement_ui"
                        label="Перемер"
                        className="crm-order-create-col"
                        extra="UI-only до backend parity"
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name="client_weighing_ui"
                        label="Взвешивание"
                        className="crm-order-create-col"
                        extra="UI-only до backend parity"
                      >
                        <Input />
                      </Form.Item>
                    </>
                  )}
                  <Form.Item
                    label="Ценовой коэффициент"
                    className="crm-order-create-col"
                    extra="Расчет: client_goods_value_amount / declared_volume_m3"
                  >
                    <Input readOnly value={priceCoefficient} />
                  </Form.Item>
                  <Form.Item
                    label="Весовой коэффициент"
                    className="crm-order-create-col"
                    extra="Расчет: declared_volume_m3 / declared_total_weight_kg"
                  >
                    <Input readOnly value={weightCoefficient} />
                  </Form.Item>
                  <Form.Item name="certificate_intent_enabled" valuePropName="checked" className="crm-order-create-col">
                    <Checkbox>Сертификат</Checkbox>
                  </Form.Item>
                  {createCertificateIntentEnabled ? (
                    <Form.Item
                      name="certificate_intent"
                      label="Сертификат: вариант"
                      className="crm-order-create-col"
                      rules={[{ required: true, message: "Выберите вариант сертификата" }]}
                    >
                      <Select
                        allowClear
                        options={certificateIntentOptions}
                        placeholder={
                          certificateIntentOptions.length
                            ? "Выберите вариант"
                            : "Нет certificate_intent_options в metadata"
                        }
                      />
                    </Form.Item>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {createWizardStepKey === "goods" ? (
            <>
              <div className="crm-order-create-section">
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Товары
                </Typography.Title>
                <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                  <Button onClick={openCreateGoodsLineModal} block>
                    Добавить строку товара
                  </Button>
                  {goodsLineRows.map((line, index) => (
                    <Card
                      key={`goods-line-${index}`}
                      size="small"
                      extra={
                        <Space>
                          <Button size="small" onClick={() => openEditGoodsLineModal(index)}>
                            изменить
                          </Button>
                          <Button danger size="small" onClick={() => removeGoodsLine(index)}>
                            удалить
                          </Button>
                        </Space>
                      }
                    >
                      <Typography.Text>{getGoodsLineSummary(line)}</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        <Typography.Text type="secondary">
                          {trimOrUndefined(line.description) ?? "—"}
                        </Typography.Text>
                      </div>
                    </Card>
                  ))}
                </Space>
              </div>

              <div className="crm-order-create-section">
                <div className="crm-order-create-grid">
                  <Form.Item
                    name="additional_description"
                    label="Описание"
                    className="crm-order-create-col crm-order-create-col-full"
                  >
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Form.Item name="comment" label="Комментарий" className="crm-order-create-col">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item name="product_characteristic_codes" label="Характеристики" className="crm-order-create-col">
                    <Select mode="multiple" allowClear options={productCharacteristicOptions} />
                  </Form.Item>
                  {!isClientRole && canEditRestrictedCreateFields ? (
                    <Form.Item name="office_mark_codes" label="Отметки офиса" className="crm-order-create-col">
                      <Select mode="multiple" allowClear options={officeMarkOptions} />
                    </Form.Item>
                  ) : null}
                  {isClientRole ? (
                    <Form.Item
                      name="office_mark_codes"
                      label="Отметки офиса"
                      className="crm-order-create-col"
                      extra="UI-only до backend parity"
                    >
                      <Select mode="tags" allowClear tokenSeparators={[","]} />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    name="is_1c"
                    valuePropName="checked"
                    className="crm-order-create-col"
                    extra={isClientRole ? "UI-only до backend parity" : undefined}
                  >
                    <Checkbox>1С</Checkbox>
                  </Form.Item>
                  {!isClientRole && canEditRestrictedCreateFields ? (
                    <Form.Item name="is_factory_payment_via_company" valuePropName="checked" className="crm-order-create-col">
                      <Checkbox>Оплата через компанию</Checkbox>
                    </Form.Item>
                  ) : null}
                  {isClientRole ? (
                    <Form.Item
                      name="is_factory_payment_via_company"
                      valuePropName="checked"
                      className="crm-order-create-col"
                      extra="UI-only до backend parity"
                    >
                      <Checkbox>Оплата через компанию</Checkbox>
                    </Form.Item>
                  ) : null}
                  {!isClientRole && canEditRestrictedCreateFields ? (
                    <Form.Item name="is_checked" valuePropName="checked" className="crm-order-create-col">
                      <Checkbox>Проверен</Checkbox>
                    </Form.Item>
                  ) : null}
                  {isClientRole ? (
                    <Form.Item
                      name="is_checked"
                      valuePropName="checked"
                      className="crm-order-create-col"
                      extra="UI-only до backend parity"
                    >
                      <Checkbox>Проверен</Checkbox>
                    </Form.Item>
                  ) : null}
                  {!isClientRole && canEditRestrictedCreateFields ? (
                    <Form.Item name="is_factory_payment_completed" valuePropName="checked" className="crm-order-create-col">
                      <Checkbox>Оплачено компанией</Checkbox>
                    </Form.Item>
                  ) : null}
                  {isClientRole ? (
                    <Form.Item
                      name="is_factory_payment_completed"
                      valuePropName="checked"
                      className="crm-order-create-col"
                      extra="UI-only до backend parity"
                    >
                      <Checkbox>Оплачено компанией</Checkbox>
                    </Form.Item>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {createWizardStepKey === "documents" ? (
            <div className="crm-order-create-section">
              {isRequestCreate ? (
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Описание
                </Typography.Title>
              ) : (
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Документы
                </Typography.Title>
              )}
              {isRequestCreate ? (
                <Form.Item
                  name="additional_description"
                  rules={[{ required: true, message: "Заполните описание" }]}
                >
                  <Input.TextArea rows={10} />
                </Form.Item>
              ) : null}
              {isRequestCreate ? (
                <Typography.Title level={5} className="crm-order-create-section-title">
                  Документы
                </Typography.Title>
              ) : null}
              <Form.List name="documents">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                    <Button onClick={() => add()} block disabled={fields.length >= 10}>
                      Добавить документ
                    </Button>
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
                            <Select allowClear options={isRequestCreate ? REQUEST_DOCUMENT_TYPE_OPTIONS : documentTypeOptions} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "file_list"]}
                            label="Выбрать файл"
                            valuePropName="fileList"
                            getValueFromEvent={(event) => event?.fileList}
                            rules={[{ required: true, message: "Выберите файл" }]}
                            className="crm-order-create-col"
                          >
                            <Upload
                              accept={isRequestCreate ? ".doc,.docx,.xlsx,.xls,.pdf,.zip" : undefined}
                              beforeUpload={() => false}
                              maxCount={1}
                            >
                              <Button>Выбрать файл</Button>
                            </Upload>
                          </Form.Item>
                        </div>
                      </Card>
                    ))}
                  </Space>
                )}
              </Form.List>
            </div>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title="Новый контакт фабрики"
        open={factoryContactModalOpen}
        forceRender
        destroyOnHidden
        onCancel={() => setFactoryContactModalOpen(false)}
        onOk={() => factoryContactQuickForm.submit()}
      >
        <Form
          form={factoryContactQuickForm}
          layout="vertical"
          onFinish={(values: { full_name?: string; phone?: string; email?: string }) => {
            const fullName = trimOrUndefined(values.full_name);
            const phone = trimOrUndefined(values.phone);
            const email = trimOrUndefined(values.email);
            if (!fullName || !phone) {
              message.error("Заполните имя и телефон");
              return;
            }
            if (!email) {
              message.error("Заполните email");
              return;
            }
            if (!createFactoryId) {
              message.error("Сначала выберите фабрику");
              return;
            }
            createFactoryContactMutation.mutate({
              factoryId: createFactoryId,
              full_name: fullName,
              phone,
              email,
            });
          }}
        >
          <Form.Item name="full_name" label="Имя" rules={[{ required: true, message: "Укажите имя" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              { required: true, message: "Укажите телефон" },
              { pattern: PHONE_FORMAT_REGEX, message: "Допустимы цифры, пробелы и символы + ( ) -" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Укажите email" },
              { type: "email", message: "Введите корректный email" },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый адрес погрузки"
        open={factoryLoadingAddressModalOpen}
        forceRender
        destroyOnHidden
        onCancel={() => setFactoryLoadingAddressModalOpen(false)}
        onOk={() => factoryLoadingAddressQuickForm.submit()}
      >
        <Form
          form={factoryLoadingAddressQuickForm}
          layout="vertical"
          onFinish={(values: { name?: string; address?: string; postcode_id?: number; city_id?: number }) => {
            const name = trimOrUndefined(values.name);
            const address = trimOrUndefined(values.address);
            const postcodeId = values.postcode_id;
            const cityId = values.city_id;
            if (!name || !address || !postcodeId || !cityId) {
              message.error("Заполните название, индекс, город и адрес");
              return;
            }
            if (!createFactoryId || !createFactoryCountryId) {
              message.error("Сначала выберите фабрику и страну");
              return;
            }
            createFactoryLoadingAddressMutation.mutate({
              factoryId: createFactoryId,
              countryId: createFactoryCountryId,
              name,
              address,
              postcode_id: postcodeId,
              city_id: cityId,
            });
          }}
        >
          <Form.Item name="name" label="Название адреса" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="postcode_id" label="Индекс" rules={[{ required: true, message: "Выберите индекс" }]}>
            <Select
              showSearch
              filterOption={false}
              options={postcodeOptions}
              onSearch={(value) => setPostcodeQuery(value)}
              onChange={() => {
                factoryLoadingAddressQuickForm.setFieldValue("city_id", undefined);
              }}
              placeholder="Начните вводить индекс"
              notFoundContent="Индексы не найдены"
            />
          </Form.Item>
          <Form.Item
            name="city_id"
            label="Город"
            rules={[{ required: true, message: "Выберите город" }]}
            dependencies={["postcode_id"]}
          >
            <Select
              allowClear
              disabled={!factoryLoadingAddressQuickForm.getFieldValue("postcode_id")}
              loading={loadingAddressQuickCitiesQuery.isLoading}
              options={(loadingAddressQuickCitiesQuery.data?.items ?? []).map((city) => ({
                label: city.city,
                value: city.id,
              }))}
              placeholder="Выберите город"
              notFoundContent="Нет городов для индекса"
            />
          </Form.Item>
          <Form.Item name="address" label="Адрес погрузки" rules={[{ required: true, message: "Укажите адрес" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый адрес погрузки"
        open={editFactoryLoadingAddressModalOpen}
        forceRender
        destroyOnHidden
        onCancel={() => setEditFactoryLoadingAddressModalOpen(false)}
        onOk={() => editFactoryLoadingAddressQuickForm.submit()}
      >
        <Form
          form={editFactoryLoadingAddressQuickForm}
          layout="vertical"
          onFinish={(values: { name?: string; address?: string; postcode_id?: number; city_id?: number }) => {
            const name = trimOrUndefined(values.name);
            const address = trimOrUndefined(values.address);
            const postcodeId = values.postcode_id;
            const cityId = values.city_id;
            if (!name || !address || !postcodeId || !cityId) {
              message.error("Заполните название, индекс, город и адрес");
              return;
            }
            if (!editFactoryId || !editFactoryCountryId) {
              message.error("Сначала выберите фабрику и страну");
              return;
            }
            editFactoryLoadingAddressMutation.mutate({
              factoryId: editFactoryId,
              countryId: editFactoryCountryId,
              name,
              address,
              postcode_id: postcodeId,
              city_id: cityId,
            });
          }}
        >
          <Form.Item name="name" label="Название адреса" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="postcode_id" label="Индекс" rules={[{ required: true, message: "Выберите индекс" }]}>
            <Select
              showSearch
              filterOption={false}
              options={editPostcodeOptions}
              onSearch={(value) => setEditPostcodeQuery(value)}
              onChange={() => {
                editFactoryLoadingAddressQuickForm.setFieldValue("city_id", undefined);
              }}
              placeholder="Начните вводить индекс"
              notFoundContent="Индексы не найдены"
            />
          </Form.Item>
          <Form.Item
            name="city_id"
            label="Город"
            rules={[{ required: true, message: "Выберите город" }]}
            dependencies={["postcode_id"]}
          >
            <Select
              allowClear
              disabled={!editFactoryLoadingAddressQuickForm.getFieldValue("postcode_id")}
              loading={editLoadingAddressQuickCitiesQuery.isLoading}
              options={(editLoadingAddressQuickCitiesQuery.data?.items ?? []).map((city) => ({
                label: city.city,
                value: city.id,
              }))}
              placeholder="Выберите город"
              notFoundContent="Нет городов для индекса"
            />
          </Form.Item>
          <Form.Item name="address" label="Адрес погрузки" rules={[{ required: true, message: "Укажите адрес" }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={goodsLineEditIndex === null ? "Добавить строку товара" : "Изменить строку товара"}
        open={goodsLineModalOpen}
        forceRender
        onCancel={() => {
          setGoodsLineModalOpen(false);
          setGoodsLineEditIndex(null);
          goodsLineQuickForm.resetFields();
        }}
        onOk={() => goodsLineQuickForm.submit()}
      >
        <Form<OrderCreateGoodsLineForm> form={goodsLineQuickForm} layout="vertical" onFinish={saveGoodsLine}>
          <Form.Item name="item_type" label="Тип товара">
            <Select allowClear options={itemTypeOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.item_type !== next.item_type}>
            {({ getFieldValue }) =>
              getFieldValue("item_type") === "other" ? (
                <Form.Item
                  name="custom_item_type"
                  label="Свой тип (если другой)"
                  rules={[{ required: true, message: "Укажите свой тип для 'другой'" }]}
                >
                  <Input />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="weight_kg" label="Вес, кг">
            <Input />
          </Form.Item>
          <Form.Item name="quantity_unit" label="Единицы изм.">
            <Select allowClear options={quantityUnitOptions} />
          </Form.Item>
          <Form.Item name="quantity_value" label="Кол-во">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editGoodsLineEditIndex === null ? "Добавить строку товара" : "Изменить строку товара"}
        open={editGoodsLineModalOpen}
        forceRender
        onCancel={() => {
          setEditGoodsLineModalOpen(false);
          setEditGoodsLineEditIndex(null);
          editGoodsLineQuickForm.resetFields();
        }}
        onOk={() => editGoodsLineQuickForm.submit()}
      >
        <Form<OrderCreateGoodsLineForm> form={editGoodsLineQuickForm} layout="vertical" onFinish={saveEditOrderGoodsLine}>
          <Form.Item name="item_type" label="Тип товара">
            <Select allowClear options={editItemTypeOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.item_type !== next.item_type}>
            {({ getFieldValue }) =>
              getFieldValue("item_type") === "other" ? (
                <Form.Item
                  name="custom_item_type"
                  label="Свой тип (если другой)"
                  rules={[{ required: true, message: "Укажите свой тип для 'другой'" }]}
                >
                  <Input />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="weight_kg" label="Вес, кг">
            <Input />
          </Form.Item>
          <Form.Item name="quantity_unit" label="Единицы изм.">
            <Select allowClear options={editQuantityUnitOptions} />
          </Form.Item>
          <Form.Item name="quantity_value" label="Кол-во">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый контакт фабрики"
        open={editFactoryContactModalOpen}
        forceRender
        destroyOnHidden
        onCancel={() => setEditFactoryContactModalOpen(false)}
        onOk={() => editFactoryContactQuickForm.submit()}
      >
        <Form
          form={editFactoryContactQuickForm}
          layout="vertical"
          onFinish={(values: { full_name?: string; phone?: string; email?: string }) => {
            const fullName = trimOrUndefined(values.full_name);
            const phone = trimOrUndefined(values.phone);
            const email = trimOrUndefined(values.email);
            if (!fullName || !phone || !email) {
              message.error("Заполните имя, телефон и email");
              return;
            }
            if (!editFactoryId) {
              message.error("Сначала выберите фабрику");
              return;
            }
            editFactoryContactMutation.mutate({
              factoryId: editFactoryId,
              full_name: fullName,
              phone,
              email,
            });
          }}
        >
          <Form.Item name="full_name" label="Имя" rules={[{ required: true, message: "Укажите имя" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[
              { required: true, message: "Укажите телефон" },
              { pattern: PHONE_FORMAT_REGEX, message: "Допустимы цифры, пробелы и символы + ( ) -" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Укажите email" },
              { type: "email", message: "Введите корректный email" },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {standaloneOrderView ? (
        <div className="crm-order-detail-layout">
        {editOpen ? (
        <Card className="crm-panel crm-order-detail-left crm-order-edit-page-card">
        <div className="crm-order-edit-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {selected ? `Редактирование заказа #${selected.id}` : "Редактирование заказа"}
          </Typography.Title>
          <Typography.Text type="secondary">
            Последнее изменение:{" "}
            {editDetailQuery.data?.order?.status_date ? dayjs(editDetailQuery.data.order.status_date).format("DD.MM.YYYY HH:mm") : "—"}
          </Typography.Text>
          <Typography.Text type="secondary">Изменил: —</Typography.Text>
          {canWriteOrderUi && !isEditMode ? (
            <Button type="primary" onClick={() => setIsEditMode(true)}>
              Редактировать
            </Button>
          ) : null}
        </div>
        <Form<OrderEditForm>
          form={editForm}
          layout="vertical"
          disabled={!isEditMode}
          className={`crm-order-edit-form${isEditMode ? "" : " crm-order-edit-form-readonly"}`}
          onValuesChange={(changedValues, allValues) => {
            if (isRehydratingEditFormRef.current || !selectedOrderId) return;
            mergeEditDraft(selectedOrderId, {
              ...(allValues as Record<string, unknown>),
              ...(changedValues as Record<string, unknown>),
            });
          }}
          onFinish={(values) => {
            if (!selected) return;
            if (!validateEditOrderBeforeSubmit(values)) {
              return;
            }
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <div className="crm-order-create-section">
            <div className="crm-order-create-grid">
              <Form.Item name="order_date" label="Дата заказа">
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" disabled />
              </Form.Item>
              <Form.Item name="status_name" label="Статус">
                <Select allowClear options={ORDER_STATUS_VALUES.map((status) => ({ label: formatEnumCode(status), value: status }))} />
              </Form.Item>
              <Form.Item name="status_date" label="Дата изменения статуса">
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item name="order_number" label="Номер заказа (внутренний номер клиента)">
                <Input />
              </Form.Item>
              <Form.Item name="company_id" label="Компания">
                <Select
                  showSearch
                  filterOption={false}
                  loading={editClientCompaniesQuery.isLoading}
                  options={editCompanyOptions}
                  onSearch={(value) => setEditCompanyQueryText(value)}
                  placeholder="Введите название компании"
                  notFoundContent={editClientCompaniesQuery.isLoading ? "Загрузка..." : "Компании не найдены"}
                />
              </Form.Item>
              <Form.Item name="company_contact_id" label="Имя клиента">
                <Select
                  allowClear
                  disabled={!isEditMode || !editCompanyId}
                  options={selectedEditCompanyContacts.map((contact) => ({
                    label: [contact.full_name, contact.email, contact.phone].filter(Boolean).join(" · "),
                    value: contact.id,
                  }))}
                  placeholder={selectedEditCompanyContacts.length ? "Выберите клиента" : "Сначала выберите компанию"}
                />
              </Form.Item>
              <Form.Item name="invoice_on_other_company" valuePropName="checked">
                <Checkbox>Инвойс на другую компанию</Checkbox>
              </Form.Item>
              <Form.Item name="invoice_company_name" label="Название компании, на которую будет оформлен груз">
                <Input />
              </Form.Item>
            </div>
          </div>

          <div className="crm-order-create-section crm-order-create-factory-section">
            <Typography.Title level={5} className="crm-order-create-section-title">
              Фабрика
            </Typography.Title>
            <div className="crm-order-create-grid">
              <Form.Item name="self_delivery" valuePropName="checked">
                <Checkbox>Самодоставка</Checkbox>
              </Form.Item>
              <Form.Item name="assigned_forwarder_user_id" label="Назначить экспедитора">
                <Select
                  allowClear
                  loading={forwardersQuery.isLoading}
                  options={(forwardersQuery.data?.items ?? []).map((user) => ({
                    label: [user.full_name, user.login].filter(Boolean).join(" · "),
                    value: user.id,
                  }))}
                  notFoundContent={forwardersQuery.isLoading ? "Загрузка..." : "Экспедиторы не найдены"}
                />
              </Form.Item>
              {editSelfDelivery ? (
                <Form.Item name="self_delivery_forwarder_user_id" label="Экспедитор для самодоставки">
                  <Select
                    allowClear
                    loading={editMetadataQuery.isLoading}
                    options={(editMetadataQuery.data?.self_delivery_forwarder_options ?? []).map((forwarder) => ({
                      label: [forwarder.full_name, forwarder.email].filter(Boolean).join(" · "),
                      value: forwarder.id,
                    }))}
                    notFoundContent={editMetadataQuery.isLoading ? "Загрузка..." : "Экспедиторы не найдены"}
                  />
                </Form.Item>
              ) : null}
              <Form.Item name="factory_mode" hidden initialValue="existing">
                <Input />
              </Form.Item>
              <Form.Item name="factory_country_id" label="Страна">
                <CountrySelect
                  scope={countryDirectoryScope}
                  allowClear
                  disabled={!isEditMode || !canWriteOrder}
                  placeholder="Выберите страну"
                  onChange={() => {
                    editForm.setFieldValue("factory_mode", "existing");
                    editForm.setFieldValue("factory_id", undefined);
                    editForm.setFieldValue("loading_address_id", undefined);
                    editForm.setFieldValue("factory_contact_id", undefined);
                    editForm.setFieldValue(["create_factory"], undefined);
                    editForm.setFieldValue("loading_postcode_id_ui", undefined);
                    editForm.setFieldValue("loading_city_id_ui", undefined);
                    editForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], undefined);
                    editForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
                    editForm.setFieldValue("loading_address_line", undefined);
                    editForm.setFieldValue("loading_address_fax", undefined);
                    editForm.setFieldValue("factory_contact_email", undefined);
                    editForm.setFieldValue("factory_contact_name", undefined);
                    editForm.setFieldValue("factory_contact_phone", undefined);
                    setEditPostcodeQuery("");
                    setEditPostcodeQueryDebounced("");
                  }}
                />
              </Form.Item>
              {editFactoryMode === "existing" ? (
                <Form.Item name="factory_id" label="Фабрика" rules={[{ required: true, message: "Выберите фабрику" }]}>
                  <Select
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    loading={editFactoryOptionsQuery.isLoading}
                    disabled={!isEditMode || !editFactoryCountryId}
                    options={editFactoryOptions}
                    onSearch={setEditFactorySearchTerm}
                    onChange={() => {
                      editForm.setFieldValue("loading_address_id", undefined);
                      editForm.setFieldValue("factory_contact_id", undefined);
                      editForm.setFieldValue("loading_postcode_id_ui", undefined);
                      editForm.setFieldValue("loading_city_id_ui", undefined);
                      editForm.setFieldValue("factory_contact_email", undefined);
                      editForm.setFieldValue("factory_contact_name", undefined);
                      editForm.setFieldValue("factory_contact_phone", undefined);
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                          <Button
                            type="link"
                            style={{ padding: 0 }}
                            disabled={!isEditMode}
                            onClick={() => {
                              editForm.setFieldValue("factory_mode", "create");
                              editForm.setFieldValue("factory_id", undefined);
                              editForm.setFieldValue("loading_address_id", undefined);
                              editForm.setFieldValue("factory_contact_id", undefined);
                              editForm.setFieldValue(["create_factory", "factory_name"], editFactorySearchTerm?.trim() || undefined);
                            }}
                          >
                            Не нашли фабрику? Добавить вручную
                          </Button>
                        </div>
                      </>
                    )}
                    notFoundContent={editFactoryCountryId ? "Нет фабрик в выбранной стране" : "Сначала выберите страну"}
                  />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    name={["create_factory", "factory_name"]}
                    label="Фабрика"
                    rules={[{ required: true, message: "Введите название фабрики" }]}
                  >
                    <Input placeholder="Введите название фабрики" />
                  </Form.Item>
                  <Form.Item style={{ marginTop: -8, marginBottom: 8 }}>
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      disabled={!isEditMode}
                      onClick={() => {
                        editForm.setFieldValue("factory_mode", "existing");
                        editForm.setFieldValue(["create_factory"], undefined);
                      }}
                    >
                      Вернуться к поиску по базе
                    </Button>
                  </Form.Item>
                </>
              )}
              {editFactoryMode === "existing" ? (
                <Form.Item
                  name="loading_address_id"
                  label="Название адреса"
                  rules={[{ required: true, message: "Выберите адрес погрузки" }]}
                >
                  <Select
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    loading={editLoadingAddressesQuery.isLoading}
                    disabled={!isEditMode || !editFactoryId}
                    options={editLoadingAddressOptions}
                    onChange={(value) => {
                      if (!value) {
                        editForm.setFieldValue("loading_postcode_id_ui", undefined);
                        editForm.setFieldValue("loading_city_id_ui", undefined);
                      }
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                          <Button
                            type="link"
                            style={{ padding: 0 }}
                            disabled={!isEditMode}
                            onClick={() => {
                              editFactoryLoadingAddressQuickForm.resetFields();
                              setEditFactoryLoadingAddressModalOpen(true);
                            }}
                          >
                            Добавить адрес
                          </Button>
                        </div>
                      </>
                    )}
                    notFoundContent={editFactoryId ? "Нет адресов загрузки" : "Сначала выберите фабрику"}
                  />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    name={["create_factory", "loading_address", "name"]}
                    label="Название адреса"
                    rules={[{ required: true, message: "Введите название адреса" }]}
                  >
                    <Input placeholder="Например: Основной склад" />
                  </Form.Item>
                  <Form.Item
                    name={["create_factory", "loading_address", "address"]}
                    label="Адрес погрузки"
                    rules={[{ required: true, message: "Введите адрес погрузки" }]}
                  >
                    <Input placeholder="Введите адрес погрузки" />
                  </Form.Item>
                </>
              )}
              {editFactoryMode === "existing" ? (
                <Form.Item label="Адрес погрузки">
                  <Input
                    readOnly
                    value={
                      selectedEditLoadingAddress
                        ? [selectedEditLoadingAddress.postcode, selectedEditLoadingAddress.city, selectedEditLoadingAddress.address]
                            .filter(Boolean)
                            .join(" -> ")
                        : ""
                    }
                    placeholder={editFactoryId ? "Выберите название адреса" : "Сначала выберите фабрику"}
                  />
                </Form.Item>
              ) : null}
              <Form.Item
                name="loading_postcode_id_ui"
                label="Индекс"
                rules={editFactoryMode === "create" ? [{ required: true, message: "Выберите индекс" }] : undefined}
              >
                <Select
                  showSearch
                  filterOption={false}
                  allowClear
                  loading={editPostcodeOptionsQuery.isLoading}
                  options={editPostcodeOptions}
                  disabled={!isEditMode || !editFactoryCountryId || editFactoryMode === "existing"}
                  onSearch={(value) => setEditPostcodeQuery(value)}
                  onChange={(value) => {
                    editForm.setFieldValue("loading_city_id_ui", undefined);
                    if (editFactoryMode === "create") {
                      editForm.setFieldValue(["create_factory", "loading_address", "postcode_id"], value ?? undefined);
                      editForm.setFieldValue(["create_factory", "loading_address", "city_id"], undefined);
                    }
                  }}
                  placeholder={editFactoryCountryId ? "Начните вводить индекс" : "Сначала выберите страну"}
                  notFoundContent={editPostcodeOptionsQuery.isLoading ? "Загрузка..." : "Индексы не найдены"}
                />
              </Form.Item>
              <Form.Item
                name="loading_city_id_ui"
                label="Город"
                rules={editFactoryMode === "create" ? [{ required: true, message: "Выберите город" }] : undefined}
              >
                <Select
                  allowClear
                  loading={editPostcodeCitiesQuery.isLoading}
                  options={editCityOptions}
                  disabled={!isEditMode || !editLoadingPostcodeIdUi || editFactoryMode === "existing"}
                  onChange={(value) => {
                    if (editFactoryMode === "create") {
                      editForm.setFieldValue(["create_factory", "loading_address", "city_id"], value ?? undefined);
                    }
                  }}
                  placeholder={editLoadingPostcodeIdUi ? "Выберите город" : "Сначала выберите индекс"}
                  notFoundContent={editPostcodeCitiesQuery.isLoading ? "Загрузка..." : "Города не найдены"}
                />
              </Form.Item>
              {editFactoryMode === "create" ? (
                <Form.Item>
                  <Button
                    block
                    type="primary"
                    loading={editFactoryCreateSubmitting}
                    disabled={!isEditMode}
                    onClick={handleCreateFactoryFromEditForm}
                  >
                    Создать фабрику
                  </Button>
                </Form.Item>
              ) : null}
              <Form.Item name="loading_address_line" label="Адрес">
                <Input />
              </Form.Item>
              <Form.Item name="loading_address_fax" label="Факс">
                <Input />
              </Form.Item>
              {(editFactoryMode === "existing" || editFactoryCreateConfirmed) ? (
              <div className="crm-order-create-contact-block">
                <div className="crm-order-create-contact-head">
                  <Typography.Text strong>Контакты</Typography.Text>
                  <Button
                    disabled={!isEditMode || !editFactoryId}
                    onClick={() => {
                      editFactoryContactQuickForm.resetFields();
                      setEditFactoryContactModalOpen(true);
                    }}
                  >
                    Добавить
                  </Button>
                </div>
                <Form.Item name="factory_contact_id" label="Email" rules={[{ required: true, message: "Выберите email контакта фабрики" }]}>
                  <Select
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    loading={editFactoryContactsQuery.isLoading}
                    disabled={!isEditMode || !editFactoryId}
                    options={editFactoryContactEmailSelectOptions}
                    onChange={(value) => {
                      const selectedOption = editContactEmailOptions.find((item) => item.id === value);
                      editForm.setFieldValue("factory_contact_email", selectedOption?.email ?? undefined);
                      editForm.setFieldValue("factory_contact_name", selectedOption?.full_name ?? undefined);
                      editForm.setFieldValue("factory_contact_phone", selectedOption?.phone ?? undefined);
                      editForm.setFieldValue(["create_factory_contact", "email"], selectedOption?.email ?? undefined);
                      editForm.setFieldValue(["create_factory_contact", "full_name"], selectedOption?.full_name ?? undefined);
                      editForm.setFieldValue(["create_factory_contact", "phone"], selectedOption?.phone ?? undefined);
                    }}
                    notFoundContent={editFactoryContactsQuery.isLoading ? "Загрузка..." : "Контакты не найдены"}
                  />
                </Form.Item>
                <Form.Item name="factory_contact_name" label="Имя">
                  <Input readOnly />
                </Form.Item>
                <Form.Item name="factory_contact_phone" label="Телефон">
                  <Input readOnly />
                </Form.Item>
              </div>
              ) : (
                <Typography.Text type="secondary">
                  Заполните кастомную фабрику и подтвердите создание, чтобы перейти к контактам.
                </Typography.Text>
              )}
            </div>
          </div>

          <div className="crm-order-create-section">
            <div className="crm-order-create-grid">
              <Form.Item name="ready_date" label="Дата готовности">
                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item label="Вывоз">
                <Space.Compact style={{ width: "100%" }}>
                  <Form.Item name="pickup_date_from" noStyle>
                    <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="От" />
                  </Form.Item>
                  <Form.Item name="pickup_date_to" noStyle>
                    <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="До" />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
              <Form.Item name="certificate_intent_enabled" valuePropName="checked">
                <Checkbox>Сертификат</Checkbox>
              </Form.Item>
              {editCertificateIntentEnabled ? (
                <Form.Item name="certificate_intent" label="Вариант сертификата">
                  <Select
                    allowClear
                    loading={editMetadataQuery.isLoading}
                    options={editCertificateIntentOptions}
                    notFoundContent={editMetadataQuery.isLoading ? "Загрузка..." : "Варианты не найдены"}
                  />
                </Form.Item>
              ) : null}
            </div>
          </div>

          <div className="crm-order-create-section">
            <div className="crm-order-create-grid">
              <Form.Item
                name="invoice_number"
                label="Номер инвойса/проформы"
                rules={isCommercialEdit ? [{ required: true, message: "Укажите номер инвойса" }] : undefined}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="client_goods_value_amount"
                label="Стоимость товара от клиента"
                rules={[createDecimalRule("client_goods_value_amount", isCommercialEdit)]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="Валюта">
                <div className="crm-order-currency-row">
                  <Form.Item
                    name="client_goods_value_currency"
                    className="crm-order-currency-inline-item"
                    rules={isCommercialEdit ? [{ required: true, message: "Выберите валюту" }] : undefined}
                  >
                    <Select
                      className="crm-order-currency-select"
                      options={ORDER_CURRENCY_OPTIONS}
                    />
                  </Form.Item>
                  {editClientGoodsCurrency === "OTHER" ? (
                    <Form.Item
                      name="client_goods_value_currency_other_label"
                      rules={[{ required: true, message: "Укажите валюту" }]}
                      className="crm-order-currency-inline-item"
                    >
                      <Input className="crm-order-currency-select" placeholder="Введите валюту" />
                    </Form.Item>
                  ) : null}
                </div>
              </Form.Item>
              <Form.Item label="Перечень товаров">
                <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                  <Form.List name="goods_lines">{() => null}</Form.List>
                  {editGoodsLineRows.map((line, index) => (
                    <Card
                      key={`edit-goods-line-${index}`}
                      size="small"
                      extra={
                        <Space>
                          <Button size="small" disabled={!isEditMode} onClick={() => openUpdateOrderGoodsLineModal(index)}>
                            изменить
                          </Button>
                          <Button danger size="small" disabled={!isEditMode} onClick={() => removeEditOrderGoodsLine(index)}>
                            удалить
                          </Button>
                        </Space>
                      }
                    >
                      <Typography.Text>{getGoodsLineSummary(line)}</Typography.Text>
                    </Card>
                  ))}
                  <Button disabled={!isEditMode} onClick={openEditOrderGoodsLineModal}>Добавить строку товара</Button>
                </Space>
              </Form.Item>
              <Form.Item
                name="declared_volume_m3"
                label="Заявленный клиентом объем"
                rules={[createDecimalRule("declared_volume_m3", isCommercialEdit)]}
              >
                <Input addonAfter="м³" />
              </Form.Item>
              <Form.Item name="volume_m3" label="Объем из инвойса">
                <Input addonAfter="м³" />
              </Form.Item>
              <Form.Item
                name="declared_total_weight_kg"
                label="Суммарный вес товаров"
                rules={[createDecimalRule("declared_total_weight_kg", isCommercialEdit)]}
              >
                <Input addonAfter="кг" />
              </Form.Item>
              <Form.Item name="cargo_places_qty" label="Кол-во грузовых мест">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="measurement_status" label="Перемер">
                <Select allowClear options={editMeasurementStatusOptions} />
              </Form.Item>
              {String(editMeasurementStatus ?? "").toLowerCase() === "completed" ? (
                <Form.Item name="actual_volume_m3" label="Актуальный объем, м3">
                  <Input />
                </Form.Item>
              ) : null}
              <Form.Item name="weighing_status" label="Взвешивание">
                <Select allowClear options={editWeighingStatusOptions} />
              </Form.Item>
              {String(editWeighingStatus ?? "").toLowerCase() === "completed" ? (
                <Form.Item name="actual_weight_kg" label="Актуальный вес, кг">
                  <Input />
                </Form.Item>
              ) : null}
              <Form.Item name="actual_qty" label="Актуальное количество">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="quantity_whs" label="На складе">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item label="Ценовой коэффициент" extra="Расчет: client_goods_value_amount / declared_volume_m3">
                <Input readOnly value={editPriceCoefficient} />
              </Form.Item>
              <Form.Item label="Весовой коэффициент" extra="Расчет: declared_volume_m3 / declared_total_weight_kg">
                <Input readOnly value={editWeightCoefficient} />
              </Form.Item>
              <Form.Item name="product_characteristic_codes" label="Характеристики товара">
                <Select mode="multiple" allowClear options={editProductCharacteristicOptions} />
              </Form.Item>
              <Form.Item name="office_mark_codes" label="Отметки офиса">
                <Select mode="multiple" allowClear options={editOfficeMarkOptions} />
              </Form.Item>
              <Form.Item name="additional_description" label="Описание заказа">
                <Input.TextArea rows={5} />
              </Form.Item>
              <Form.Item name="comment" label="Комментарий (всё кроме описания заказа)">
                <Input.TextArea rows={5} />
              </Form.Item>
              <div className="crm-order-inline-pair">
                <Form.Item name="is_1c" valuePropName="checked" className="crm-order-inline-pair-item">
                  <Checkbox>1С</Checkbox>
                </Form.Item>
                <Form.Item name="is_factory_payment_via_company" valuePropName="checked" className="crm-order-inline-pair-item">
                  <Checkbox>Оплата через компанию</Checkbox>
                </Form.Item>
              </div>
              <div className="crm-order-inline-pair">
                <Form.Item name="is_checked" valuePropName="checked" className="crm-order-inline-pair-item">
                  <Checkbox>Проверен</Checkbox>
                </Form.Item>
                <Form.Item name="is_factory_payment_completed" valuePropName="checked" className="crm-order-inline-pair-item">
                  <Checkbox>Оплачено компанией</Checkbox>
                </Form.Item>
              </div>
              <Form.Item name="mrn" label="MRN">
                <Input />
              </Form.Item>
              <Form.Item name="trip_id" label="Рейс">
                <Select
                  allowClear
                  loading={tripsQuery.isLoading}
                  options={(tripsQuery.data?.items ?? []).map((trip) => ({
                    label: trip.name,
                    value: trip.id,
                  }))}
                  notFoundContent={tripsQuery.isLoading ? "Загрузка..." : "Рейсы не найдены"}
                />
              </Form.Item>
              <Form.List name="documents">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                    {fields.map((field) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`Документ #${field.name + 1}`}
                        extra={
                          <Button danger size="small" disabled={!isEditMode} onClick={() => remove(field.name)}>
                            Удалить
                          </Button>
                        }
                      >
                        <div className="crm-order-create-grid">
                          <Form.Item
                            name={[field.name, "document_type"]}
                            label="Тип документа"
                            rules={[{ required: true, message: "Укажите тип документа" }]}
                          >
                            <Select
                              allowClear
                              loading={editMetadataQuery.isLoading}
                              options={editDocumentTypeOptions}
                              notFoundContent={editMetadataQuery.isLoading ? "Загрузка..." : "Типы документов не найдены"}
                            />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "file_list"]}
                            label="Выбрать файл"
                            valuePropName="fileList"
                            getValueFromEvent={(event) => event?.fileList}
                            rules={[{ required: true, message: "Выберите файл" }]}
                          >
                            <Upload beforeUpload={() => false} maxCount={1}>
                              <Button>Выбрать файл</Button>
                            </Upload>
                          </Form.Item>
                        </div>
                      </Card>
                    ))}
                    <Button onClick={() => add()} disabled={!isEditMode || fields.length >= 10} block>
                      Добавить документ
                    </Button>
                  </Space>
                )}
              </Form.List>
            </div>
          </div>
        </Form>
        <div className="crm-order-edit-footer crm-order-edit-page-footer">
          {isEditMode ? (
            <>
              <Button
                onClick={() => {
                  if (!selectedOrderId) return;
                  const detail = editDetailQuery.data;
                  if (!detail) return;
                  const discardChanges = () => {
                    resetEditDraft(selectedOrderId);
                    isRehydratingEditFormRef.current = true;
                    editForm.setFieldsValue(toEditFormValues(detail));
                    queueMicrotask(() => {
                      isRehydratingEditFormRef.current = false;
                    });
                    setIsEditMode(false);
                  };

                  if (!editDraftRecord?.dirty) {
                    discardChanges();
                    return;
                  }

                  Modal.confirm({
                    title: "Уверены, что хотите отменить изменения?",
                    okText: "Да",
                    cancelText: "Нет",
                    onOk: discardChanges,
                  });
                }}
              >
                Отмена
              </Button>
              <Button type="primary" loading={updateMutation.isPending} onClick={() => editForm.submit()}>
                Сохранить
              </Button>
            </>
          ) : (
            <Button onClick={() => router.push("/orders")}>К списку заказов</Button>
          )}
        </div>
      </Card>
      ) : (
        <Card className="crm-panel crm-order-detail-left">
          {deepLinkOrderQuery.isLoading ? (
            <Typography.Text>Загрузка заказа...</Typography.Text>
          ) : deepLinkOrderQuery.isError ? (
            <Typography.Text type="danger">
              {deepLinkOrderQuery.error instanceof ApiError ? deepLinkOrderQuery.error.detail : "Ошибка загрузки заказа"}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">Подготовка формы редактирования...</Typography.Text>
          )}
        </Card>
      )}
      <Card className="crm-panel crm-order-detail-right">
        <Tabs
          activeKey={orderSidePanel}
          destroyOnHidden
          onChange={(key) => setOrderSidePanel(key === "archive" ? "archive" : "chat")}
          items={[
            {
              key: "chat",
              label: (
                <Badge
                  count={
                    meQuery.data?.is_superuser || !["administrator", "manager", "logist"].includes(normalizedRole)
                      ? 0
                      : (editDetailQuery.data?.card?.unread_client_messages_count ?? 0)
                  }
                  size="small"
                >
                  <span>Чат</span>
                </Badge>
              ),
              children:
                selectedOrderId && meQuery.data ? (
                  <OrderChatPanel
                    orderId={selectedOrderId}
                    active={orderSidePanel === "chat"}
                    documents={editDetailQuery.data?.documents ?? []}
                    currentUser={meQuery.data}
                    unreadCount={editDetailQuery.data?.card?.unread_client_messages_count ?? 0}
                    onUnreadCleared={() => clearOrderChatUnread(selectedOrderId)}
                  />
                ) : (
                  <Typography.Text type="secondary">Загрузка чата...</Typography.Text>
                ),
            },
            {
              key: "archive",
              label: "Архив",
              children: <OrderActivityPanel items={editDetailQuery.data?.card?.status_history ?? []} />,
            },
          ]}
        />
      </Card>
      </div>
      ) : null}

      <Modal
        title={documentsOrder ? `Documents #${documentsOrder.id}` : "Documents"}
        open={documentsOpen}
        footer={null}
        width={720}
        onCancel={() => {
          setDocumentsOpen(false);
          setDocumentsOrder(null);
        }}
      >
        <Table<OrderDocument>
          rowKey="id"
          size="small"
          loading={documentsQuery.isLoading}
          dataSource={documentsQuery.data?.items ?? []}
          pagination={false}
          columns={[
            {
              title: "Тип",
              dataIndex: "document_type",
              key: "document_type",
              width: 180,
              render: (value: string | null) => value ?? "—",
            },
            {
              title: "Файл",
              key: "file_name",
              render: (_, row) => row.file_name ?? row.display_name ?? row.file_path ?? "—",
            },
            {
              title: "Скачать",
              key: "download",
              width: 120,
              render: (_, row) =>
                documentsOrder ? (
                  <Button
                    size="small"
                    type="link"
                    loading={downloadingDocumentId === row.id}
                    onClick={() => void handleOrderDocumentDownload(documentsOrder.id, row)}
                  >
                    Скачать
                  </Button>
                ) : null,
            },
          ]}
          locale={{
            emptyText: documentsQuery.isError
              ? documentsQuery.error instanceof ApiError
                ? documentsQuery.error.detail
                : "Ошибка загрузки документов"
              : "Нет документов",
          }}
        />
      </Modal>

      <Modal
        title={clientOrder ? `Клиент #${clientOrder.id}` : "Клиент"}
        open={clientOpen}
        footer={null}
        onCancel={() => {
          setClientOpen(false);
          setClientOrder(null);
        }}
      >
        {clientDetailQuery.isError ? (
          <Typography.Text type="danger">
            {clientDetailQuery.error instanceof ApiError ? clientDetailQuery.error.detail : "Ошибка загрузки клиента"}
          </Typography.Text>
        ) : null}
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Имя">{getClientPopupInfo().name}</Descriptions.Item>
          <Descriptions.Item label="Адрес">{getClientPopupInfo().address}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{getClientPopupInfo().phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{getClientPopupInfo().email}</Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        title={factoryOrder ? `Фабрика #${factoryOrder.id}` : "Фабрика"}
        open={factoryOpen}
        footer={null}
        onCancel={() => {
          setFactoryOpen(false);
          setFactoryOrder(null);
        }}
      >
        {factoryDetailQuery.isError ? (
          <Typography.Text type="danger">
            {factoryDetailQuery.error instanceof ApiError ? factoryDetailQuery.error.detail : "Ошибка загрузки фабрики"}
          </Typography.Text>
        ) : null}
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Название">{getFactoryPopupInfo().name}</Descriptions.Item>
          <Descriptions.Item label="Индекс">{getFactoryPopupInfo().postcode}</Descriptions.Item>
          <Descriptions.Item label="Адрес">{getFactoryPopupInfo().address}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{getFactoryPopupInfo().phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{getFactoryPopupInfo().email}</Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        title={forwarderOrder ? `Экспедитор #${forwarderOrder.id}` : "Экспедитор"}
        open={forwarderOpen}
        footer={null}
        onCancel={() => {
          setForwarderOpen(false);
          setForwarderOrder(null);
        }}
      >
        {forwarderDetailQuery.isError || forwarderUserQuery.isError || personalManagerQuery.isError ? (
          <Typography.Text type="danger">Ошибка загрузки данных экспедитора</Typography.Text>
        ) : null}
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Имя">{getForwarderPopupInfo().name}</Descriptions.Item>
          <Descriptions.Item label="Адрес">{getForwarderPopupInfo().address}</Descriptions.Item>
          <Descriptions.Item label="Email">{getForwarderPopupInfo().email}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{getForwarderPopupInfo().phone}</Descriptions.Item>
          <Descriptions.Item label="Имя персонального менеджера">
            {getForwarderPopupInfo().personalManagerName}
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        title={invoiceOrder ? `Инвойс #${invoiceOrder.id}` : "Инвойс"}
        open={invoiceOpen}
        footer={null}
        onCancel={() => {
          setInvoiceOpen(false);
          setInvoiceOrder(null);
        }}
      >
        <Typography.Paragraph
          copyable={invoiceOrder?.invoice_number ? { text: invoiceOrder.invoice_number } : false}
          style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {invoiceOrder?.invoice_number ?? "—"}
        </Typography.Paragraph>
      </Modal>

      <Modal
        title={descriptionOrder ? `Описание #${descriptionOrder.id}` : "Описание"}
        open={descriptionOpen}
        footer={[
          <Button key="copy" type="primary" onClick={() => void copyDescriptionPopupText()}>
            Скопировать в буфер
          </Button>,
        ]}
        onCancel={() => {
          setDescriptionOpen(false);
          setDescriptionOrder(null);
        }}
      >
        {descriptionDetailQuery.isError ? (
          <Typography.Text type="danger">
            {descriptionDetailQuery.error instanceof ApiError
              ? descriptionDetailQuery.error.detail
              : "Ошибка загрузки описания"}
          </Typography.Text>
        ) : null}
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {getDescriptionPopupText() || (descriptionDetailQuery.isLoading ? "Загрузка..." : "—")}
        </Typography.Paragraph>
      </Modal>

      <Modal
        title={selected ? `Изменить статус #${selected.id}` : "Изменить статус"}
        open={statusOpen}
        forceRender
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
        forceRender
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
                label: trip.name,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Назначить экспедитора #${selected.id}` : "Назначить экспедитора"}
        open={assignForwarderOpen}
        forceRender
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
                label: [user.full_name, user.login].filter(Boolean).join(" · ") || "Экспедитор",
                value: user.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Назначить дату вывоза #${selected.id}` : "Назначить дату вывоза"}
        open={pickupOpen}
        forceRender
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
        forceRender
        destroyOnHidden
        onCancel={() => setSpecialTariffOpen(false)}
        onOk={() => specialTariffForm.submit()}
        confirmLoading={specialTariffMutation.isPending}
      >
        <Form
          form={specialTariffForm}
          layout="vertical"
          onFinish={(values: { special_tariff?: string | null }) => {
            if (!selected) return;
            specialTariffMutation.mutate({
              id: selected.id,
              special_tariff: values.special_tariff,
            });
          }}
        >
          <Form.Item name="special_tariff" label="Спецтариф (пусто = очистить)">
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selected ? `Запрос на фабрику #${selected.id}` : "Запрос на фабрику"}
        open={requestToFactoryOpen}
        forceRender
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
        forceRender
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
        forceRender
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
        forceRender
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
        forceRender
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
                label: trip.name,
                value: trip.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массово: назначить дату вывоза"
        open={bulkPickupOpen}
        forceRender
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
        forceRender
        destroyOnHidden
        onCancel={() => setBulkSpecialTariffOpen(false)}
        onOk={() => bulkSpecialTariffForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkSpecialTariffForm}
          layout="vertical"
          onFinish={(values: { special_tariff?: string | null }) => {
            runBulkMutation("special-tariff", {
              special_tariff: normalizeSpecialTariffText(values.special_tariff),
            });
          }}
        >
          <Form.Item name="special_tariff" label="Спецтариф (пусто = очистить)">
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Массово: ${bulkCommentTarget === "warehouse" ? "комментарий склада" : "комментарий экспедитора"}`}
        open={bulkCommentOpen}
        forceRender
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

        </>
      ) : null}
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
