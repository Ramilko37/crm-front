export type ApiErrorPayload = {
  detail: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthUser = {
  username: string;
  is_superuser: boolean;
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
  status_name: string | null;
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

export type Factory = {
  id: number;
  country_id: number | null;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  certificate_status: string | null;
};

export type Trip = {
  id: number;
  name: string;
  current_point_id: number | null;
  current_point_name: string | null;
  truck_plate: string | null;
  truck_company_name: string | null;
  status_name: string | null;
  type_name: string | null;
};

export type ListParams = {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_desc?: boolean;
};

export type OrderFilterParams = ListParams & {
  query?: string;
  status_names?: string[];
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
  certificate_statuses?: string[];
  has_email?: boolean;
  has_loading_points?: boolean;
};

export type TripFilterParams = ListParams & {
  query?: string;
  ids?: number[];
  status_names?: string[];
  type_names?: string[];
  current_point_id?: number;
  truck_plate?: string;
  truck_company_name?: string;
  has_orders?: boolean;
};
