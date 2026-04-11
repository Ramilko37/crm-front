import type {
  FactoryCertificateStatus,
  OrderType,
  OrderStatus,
  QuoteStatus,
  RequestStatus,
  RoleName,
  TripStatus,
  TripType,
} from "@/shared/lib/domain-enums";

export type ApiErrorPayload = {
  detail: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthUser = {
  id: number | null;
  company_id: number | null;
  login: string;
  full_name: string | null;
  role_name: RoleName | string;
  is_superuser: boolean;
  is_active: boolean;
};

export type UserProfile = {
  id: number;
  company_id: number | null;
  company_name: string | null;
  personal_manager_id: number | null;
  full_name: string;
  login: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  role_name: RoleName | string;
  is_active: boolean;
  is_logist: boolean;
  receives_newsletter: boolean;
  exclude_from_promotions: boolean;
};

export type UserProfileUpdatePayload = {
  full_name?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  receives_newsletter?: boolean;
  exclude_from_promotions?: boolean;
};

export type UserPasswordChangePayload = {
  current_password: string;
  new_password: string;
};

export type PageMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type QuickTabMetaItem = {
  code: string;
  label: string;
  count: number;
  is_active: boolean;
};

export type PaginatedMeta = PageMeta & {
  quick_tabs?: QuickTabMetaItem[];
  new_count?: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginatedMeta;
};

export type BulkMutationResponse<T> = {
  order_ids?: number[];
  trip_ids?: number[];
  updated_count: number;
  items: T[];
};

export type OrderTag = {
  code: string;
  label: string;
};

export type DictionaryOption = {
  code: string;
  label: string;
};

export type MeasurementPayload = {
  status: "not_required" | "required" | "required_in_truck" | "completed";
  comment?: string | null;
};

export type OrderDocument = {
  id: number;
  order_id: number;
  document_type: string | null;
  file_name?: string | null;
  file_path: string | null;
  uploaded_at: string | null;
  uploaded_by_user_id: number | null;
  display_name?: string | null;
};

export type OrderStatusHistoryItem = {
  id: number;
  order_id: number;
  status_name: OrderStatus;
  status_date: string | null;
  comment: string | null;
  changed_by_user_id: number | null;
  created_at: string | null;
};

export type OrderChatMessage = {
  id: number;
  order_id: number;
  author_user_id: number | null;
  author_full_name: string | null;
  author_role_name: string | null;
  is_from_client: boolean;
  message: string;
  created_at: string;
};

export type OrderCertificate = {
  id: number;
  factory_id: number | null;
  order_id: number | null;
  number: string | null;
  status: FactoryCertificateStatus | null;
  file_path: string | null;
  issued_date: string | null;
  expires_date: string | null;
};

export type OrderClientBlock = {
  company_id: number | null;
  company_name: string | null;
  user_id: number | null;
  user_full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  contact_name?: string | null;
  contact_job_title?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_messenger_type?: string | null;
  contact_messenger_value?: string | null;
  invoice_company_name: string | null;
};

export type OrderFactoryBlock = {
  factory_id: number | null;
  factory_name: string | null;
  country: string | null;
  primary_email: string | null;
  selected_loading_address: FactoryLoadingAddress | null;
};

export type AssignedForwarderBlock = {
  id: number;
  full_name: string | null;
  login: string | null;
  role_name: string | null;
};

export type OrderGoodsLine = {
  id: number;
  order_id: number;
  product_name: string | null;
  description: string | null;
  weight_kg: string | null;
  quantity: string | null;
  unit: string | null;
};

export type OrderListItem = {
  id: number;
  order_number: string | null;
  user_id: number;
  company_id: number | null;
  company_name?: string | null;
  contact_name_snapshot?: string | null;
  contact_phone_snapshot?: string | null;
  contact_email_snapshot?: string | null;
  personal_manager_id?: number | null;
  order_type: OrderType | null;
  quote_status: QuoteStatus | null;
  quote_price_amount: string | null;
  quote_price_currency: string | null;
  quote_price_currency_other_label?: string | null;
  special_tariff_amount: string | null;
  special_tariff_currency: string | null;
  special_tariff_currency_other_label?: string | null;
  quote_priced_at: string | null;
  quote_client_decision_at: string | null;
  factory_id: number;
  factory_name?: string | null;
  factory_loading_address_id: number | null;
  trip_id: number | null;
  trip_name?: string | null;
  invoice_number: string | null;
  country: string | null;
  volume_m3: string | null;
  actual_volume_m3: string | null;
  shipped_m3: string | null;
  box_qty: number | null;
  common_qty: number | null;
  actual_qty: number | null;
  quantity_whs: number | null;
  actual_weight_kg: string | null;
  order_date: string | null;
  ready_date: string | null;
  pickup_date?: string | null;
  status_date: string | null;
  status_name: OrderStatus | null;
  forwarder_name: string | null;
  assigned_forwarder_user_id?: number | null;
  whs_number: string | null;
  mrn: string | null;
  days_same_status: number | null;
  days_active?: number | null;
  days_in_current_status?: number | null;
  comment: string | null;
  user_comment: string | null;
  forwarder_comment: string | null;
  warehouse_comment: string | null;
  email: string | null;
  raw_payload: Record<string, unknown> | null;
  has_documents?: boolean;
  documents_count?: number;
  has_certificate?: boolean;
  has_description?: boolean;
  is_checked?: boolean;
  factory_payment_via_label?: string | null;
  is_factory_payment_completed?: boolean | null;
  client_goods_value_amount?: string | null;
  client_goods_value_currency?: string | null;
  price_coefficient?: string | number | null;
  weight_coefficient?: string | number | null;
  latest_factory_request_at?: string | null;
  priority_tags?: OrderTag[];
  office_mark_tags?: OrderTag[];
  product_characteristic_tags?: OrderTag[];
  office_marks?: Record<string, unknown> | null;
  product_characteristics?: Record<string, unknown> | null;
  measurement_payload?: MeasurementPayload | null;
  weighing_payload?: MeasurementPayload | null;
};

export type OrderDetail = OrderListItem & {
  client?: OrderClientBlock;
  factory?: OrderFactoryBlock;
  assigned_forwarder?: AssignedForwarderBlock | null;
  goods_lines?: OrderGoodsLine[];
  documents?: OrderDocument[];
  certificate?: OrderCertificate | null;
  status_history?: OrderStatusHistoryItem[];
  chat_messages?: OrderChatMessage[];
};

export type Order = OrderListItem;

export type OrderWritePayload = {
  order_number?: string;
  user_id?: number;
  factory_id?: number;
  order_type?: OrderType;
  quote_status?: QuoteStatus;
  trip_id?: number | null;
  invoice_number?: string;
  country?: string;
  volume_m3?: string;
  actual_volume_m3?: string;
  shipped_m3?: string;
  box_qty?: number;
  common_qty?: number;
  actual_qty?: number;
  quantity_whs?: number;
  actual_weight_kg?: string;
  order_date?: string;
  ready_date?: string;
  status_date?: string;
  status_name?: OrderStatus;
  forwarder_name?: string;
  whs_number?: string;
  mrn?: string;
  days_same_status?: number;
  comment?: string;
  user_comment?: string;
  forwarder_comment?: string;
  warehouse_comment?: string;
  email?: string;
  raw_payload?: Record<string, unknown>;
  client_goods_value_amount?: string | null;
  client_goods_value_currency?: string | null;
  assigned_forwarder_user_id?: number | null;
  factory_payment_via_label?: string | null;
  is_factory_payment_completed?: boolean;
  is_checked?: boolean;
  priority_codes?: string[];
  office_mark_codes?: string[];
  product_characteristic_codes?: string[];
};

export type Factory = {
  id: number;
  country_id: number | null;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  primary_email: string | null;
  certificate_status: FactoryCertificateStatus | null;
};

export type FactoryEmail = {
  id: number;
  factory_id: number;
  email: string;
  is_primary: boolean;
};

export type FactoryLoadingAddress = {
  id: number;
  factory_id: number;
  country_id: number | null;
  postcode_id?: number | null;
  city_id?: number | null;
  postcode: string | null;
  city: string | null;
  address: string | null;
  contact_name?: string | null;
  phone: string | null;
  fax: string | null;
  messenger_type: string | null;
  messenger_value: string | null;
  is_primary: boolean;
};

export type FactoryLoadingAddressWritePayload = {
  country_id?: number | null;
  postcode?: string | null;
  city?: string | null;
  postcode_id?: number | null;
  city_id?: number | null;
  address?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  fax?: string | null;
  messenger_type?: string | null;
  messenger_value?: string | null;
};

export type FactoryCertificate = {
  id: number;
  factory_id: number;
  order_id: number | null;
  number: string | null;
  status: FactoryCertificateStatus | null;
  file_path: string | null;
  issued_date: string | null;
  expires_date: string | null;
};

export type Trip = {
  id: number;
  name: string;
  current_point_id: number | null;
  current_point_name: string | null;
  truck_plate: string | null;
  truck_company_name: string | null;
  status_name: TripStatus | null;
  type_name: TripType | null;
  created_at?: string | null;
};

export type TripWritePayload = {
  name?: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
  type_name?: TripType;
};

export type ListParams = {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_desc?: boolean;
};

export type OrderFilterParams = ListParams & {
  id?: number;
  ids?: number[];
  query?: string;
  status_names?: OrderStatus[];
  order_types?: OrderType[];
  quote_statuses?: QuoteStatus[];
  user_id?: number;
  company_id?: number;
  personal_manager_id?: number;
  assigned_forwarder_user_id?: number;
  factory_id?: number;
  trip_id?: number;
  country?: string;
  forwarder_name?: string;
  invoice_number?: string;
  mrn?: string;
  document_type?: string;
  quick_tab?: string;
  has_mrn?: boolean;
  has_certificate?: boolean;
  has_documents?: boolean;
  is_checked?: boolean;
  priority_codes?: string[];
  office_mark_codes?: string[];
  order_date_from?: string;
  order_date_to?: string;
  ready_date_from?: string;
  ready_date_to?: string;
  status_date_from?: string;
  status_date_to?: string;
  days_same_status_min?: number;
  days_same_status_max?: number;
};

export type FactoryFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  country_id?: number;
  country?: string;
  city?: string;
  certificate_statuses?: FactoryCertificateStatus[];
  has_email?: boolean;
  has_loading_points?: boolean;
};

export type Postcode = {
  id: number;
  country_id: number | null;
  postcode: string;
};

export type PostcodeWritePayload = {
  country_id?: number;
  postcode?: string;
};

export type PostcodeCity = {
  id: number;
  postcode_id: number;
  city: string;
};

export type PostcodeCityWritePayload = {
  city?: string;
};

export type TripFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  quick_tab?: string;
  status_names?: TripStatus[];
  type_names?: TripType[];
  current_point_id?: number;
  truck_plate?: string;
  truck_company_name?: string;
  has_orders?: boolean;
  created_at_from?: string;
  created_at_to?: string;
};

export type UserAdmin = {
  id: number;
  company_id: number | null;
  company_name?: string | null;
  personal_manager_id: number | null;
  full_name: string;
  login: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  role_name: RoleName | string;
  is_active: boolean;
  is_logist: boolean;
  total_orders: number | null;
  last_order_date: string | null;
};

export type UserWritePayload = {
  company_name?: string | null;
  full_name?: string;
  login?: string;
  password?: string;
  role_name?: RoleName | string;
  personal_manager_id?: number | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  is_active?: boolean;
  is_logist?: boolean;
  total_orders?: number | null;
  last_order_date?: string | null;
};

export type UserFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  company_id?: number;
  role_name?: RoleName | string;
  personal_manager_id?: number;
  is_logist?: boolean;
  country?: string;
  city?: string;
  has_email?: boolean;
  has_orders?: boolean;
  last_order_date_from?: string;
  last_order_date_to?: string;
};

export type PathPoint = {
  id: number;
  name_ru: string;
  name_it: string | null;
  name_en: string | null;
};

export type PathPointWritePayload = {
  name_ru?: string;
  name_it?: string | null;
  name_en?: string | null;
};

export type PathPointFilterParams = ListParams & {
  query?: string;
  ids?: number[];
};

export type Country = {
  id: number;
  name_ru: string;
  name_en: string | null;
  iso2: string;
  iso3: string | null;
};

export type CountryWritePayload = {
  name_ru?: string;
  name_en?: string | null;
  iso2?: string;
  iso3?: string | null;
};

export type CountryFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  iso2?: string;
  iso3?: string;
};

export type NormativeDocument = {
  id: number;
  title: string;
  file_path: string;
  document_date: string;
};

export type NormativeDocumentWritePayload = {
  title?: string;
  file_path?: string;
  document_date?: string;
};

export type NormativeDocumentFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  document_date_from?: string;
  document_date_to?: string;
};

export type EmailTemplate = {
  id: number;
  title: string;
  subject: string;
  body: string | null;
  is_active: boolean;
};

export type EmailTemplateWritePayload = {
  title?: string;
  subject?: string;
  body?: string | null;
  is_active?: boolean;
};

export type EmailTemplateFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  is_active?: boolean;
};

export type RequestDocument = {
  id: number;
  request_id?: number;
  document_type: string | null;
  file_name?: string | null;
  file_path: string | null;
  uploaded_at: string | null;
  uploaded_by_user_id: number | null;
};

export type Request = {
  id: number;
  request_number: string;
  company_id: number;
  company_name?: string | null;
  company_contact_id?: number | null;
  user_id?: number | null;
  user_full_name?: string | null;
  user_email?: string | null;
  contact_user_id?: number | null;
  contact_name_snapshot?: string | null;
  payload_json: Record<string, unknown> | null;
  comment: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string | null;
  documents_count?: number;
  has_documents?: boolean;
  documents?: RequestDocument[];
};

export type RequestFilterParams = ListParams & {
  status?: RequestStatus;
  query?: string;
};

export type RequestCreatePayload = {
  request: {
    company_id: number;
    company_contact_id?: number;
    payload_json?: Record<string, unknown>;
    comment?: string;
  };
  documents?: Array<{
    document_type: string;
    file_slot: string;
    display_name?: string;
  }>;
};

export type OrderClientCompanyLookupContact = {
  id: number;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  messenger_type: string | null;
  messenger_value: string | null;
  is_primary: boolean;
};

export type OrderClientCompanyLookupItem = {
  company_id: number;
  company_name: string;
  contacts: OrderClientCompanyLookupContact[];
};

export type Company = {
  id: number;
  name: string;
  owner_user_id: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CompanyWritePayload = {
  name?: string;
};

export type CompanyContact = {
  id: number;
  company_id: number;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  messenger_type: string | null;
  messenger_value: string | null;
  is_primary: boolean;
  is_owner_managed?: boolean;
};

export type CompanyContactWritePayload = {
  full_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  messenger_type?: string | null;
  messenger_value?: string | null;
  is_primary?: boolean;
};

export type OrderCreateMetadata = {
  order_type_options: DictionaryOption[];
  priority_options: DictionaryOption[];
  office_mark_options: DictionaryOption[];
  product_characteristic_options: DictionaryOption[];
  item_type_options: DictionaryOption[];
  quantity_unit_options: DictionaryOption[];
  document_type_options: DictionaryOption[];
  measurement_status_options: DictionaryOption[];
  weighing_status_options: DictionaryOption[];
  self_delivery_forwarder_options: Array<{
    id: number;
    full_name: string | null;
    email: string | null;
  }>;
};

export type ClientOrderCreateMetadata = {
  order_type_options: DictionaryOption[];
  product_characteristic_options: DictionaryOption[];
  item_type_options: DictionaryOption[];
  quantity_unit_options: DictionaryOption[];
  document_type_options: DictionaryOption[];
};

export type ClientFactoryListItem = {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  primary_email: string | null;
};

export type ClientFactoryDetail = {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  postcode_id?: number | null;
  city_id?: number | null;
  phone: string | null;
  primary_email: string | null;
  loading_addresses: FactoryLoadingAddress[];
};

export type ClientMessageInboxItem = {
  order_id: number;
  order_number: string | null;
  company_id: number | null;
  company_name: string | null;
  factory_name: string | null;
  status_name: OrderStatus | null;
  latest_message_text: string | null;
  latest_message_at: string | null;
  latest_client_message_at: string | null;
  client_messages_count: number;
};
