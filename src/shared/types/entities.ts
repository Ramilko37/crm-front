import type {
  FactoryCertificateStatus,
  OrderStatus,
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

export type PaginatedResponse<T> = {
  items: T[];
  meta: PageMeta;
};

export type BulkMutationResponse<T> = {
  order_ids?: number[];
  trip_ids?: number[];
  updated_count: number;
  items: T[];
};

export type Order = {
  id: number;
  order_number: string;
  user_id: number;
  company_id: number | null;
  factory_id: number;
  trip_id: number | null;
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
  status_date: string | null;
  status_name: OrderStatus | null;
  forwarder_name: string | null;
  whs_number: string | null;
  mrn: string | null;
  days_same_status: number | null;
  comment: string | null;
  user_comment: string | null;
  forwarder_comment: string | null;
  warehouse_comment: string | null;
  email: string | null;
  raw_payload: Record<string, unknown> | null;
};

export type OrderWritePayload = {
  order_number?: string;
  user_id?: number;
  factory_id?: number;
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
  query?: string;
  status_names?: OrderStatus[];
  user_id?: number;
  company_id?: number;
  factory_id?: number;
  trip_id?: number;
  country?: string;
  forwarder_name?: string;
  invoice_number?: string;
  mrn?: string;
  has_mrn?: boolean;
  has_certificate?: boolean;
  has_documents?: boolean;
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

export type TripFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  status_names?: TripStatus[];
  type_names?: TripType[];
  current_point_id?: number;
  truck_plate?: string;
  truck_company_name?: string;
  has_orders?: boolean;
};

export type UserAdmin = {
  id: number;
  company_id: number | null;
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
  company_id?: number;
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
