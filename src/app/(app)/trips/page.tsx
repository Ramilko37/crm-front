"use client";

import { EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
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
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  TRIP_STATUS_VALUES,
  TRIP_TYPE_VALUES,
  type TripStatus,
  type TripType,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { parseSearchArray, setSearchPatch } from "@/shared/lib/query-string";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type { BulkMutationResponse, PaginatedResponse, Trip, TripFilterParams, TripWritePayload } from "@/shared/types/entities";

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

function getParams(searchParams: URLSearchParams): TripFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    quick_tab: searchParams.get("quick_tab") ?? undefined,
    status_names: parseSearchArray(searchParams, "status_names") as TripStatus[],
    type_names: parseSearchArray(searchParams, "type_names") as TripType[],
    truck_plate: searchParams.get("truck_plate") ?? undefined,
    truck_company_name: searchParams.get("truck_company_name") ?? undefined,
    created_at_from: searchParams.get("created_at_from") ?? undefined,
    created_at_to: searchParams.get("created_at_to") ?? undefined,
    current_point_id: parseNumber(searchParams.get("current_point_id")),
  };
}

type TripForm = {
  name: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
  type_name?: TripType;
};

const tripStatusTagColors: Record<string, string> = {
  new: "blue",
  in_transit: "cyan",
  in_russia_customs: "orange",
  in_moscow_warehouse: "geekblue",
  unloaded: "green",
};

function formatTripStatus(value: TripStatus | null) {
  return formatEnumCode(value);
}

function formatTripType(value: TripType | null) {
  return formatEnumCode(value);
}

function renderTripStatus(value: TripStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={tripStatusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatTripStatus(value)}
    </Tag>
  );
}

function TripsPageContent() {
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
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const [createForm] = Form.useForm<TripForm>();
  const [editForm] = Form.useForm<TripForm>();
  const [bulkStatusForm] = Form.useForm<{ status_name: TripStatus }>();
  const [bulkTypeForm] = Form.useForm<{ type_name: TripType }>();
  const [filterForm] = Form.useForm<{
    query?: string;
    status_names?: TripStatus[];
    type_names?: TripType[];
    truck_plate?: string;
    truck_company_name?: string;
    created_at_from?: dayjs.Dayjs;
    created_at_to?: dayjs.Dayjs;
  }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);
  const effectiveParams = useMemo(
    () => (params.quick_tab ? { ...params, status_names: undefined } : params),
    [params],
  );
  const hasActiveFilters = Boolean(
    params.query ||
      params.truck_plate ||
      params.truck_company_name ||
      params.created_at_from ||
      params.created_at_to ||
      (params.status_names?.length ?? 0) > 0 ||
      (params.type_names?.length ?? 0) > 0,
  );
  const [filtersOpen, setFiltersOpen] = useState(() => hasActiveFilters);

  useEffect(() => {
    filterForm.setFieldsValue({
      query: params.query,
      status_names: params.status_names?.length ? params.status_names : undefined,
      type_names: params.type_names?.length ? params.type_names : undefined,
      truck_plate: params.truck_plate,
      truck_company_name: params.truck_company_name,
      created_at_from: params.created_at_from ? dayjs(params.created_at_from) : undefined,
      created_at_to: params.created_at_to ? dayjs(params.created_at_to) : undefined,
    });
  }, [
    filterForm,
    params.created_at_from,
    params.created_at_to,
    params.query,
    params.status_names,
    params.truck_company_name,
    params.truck_plate,
    params.type_names,
  ]);

  const listQuery = useQuery({
    queryKey: queryKeys.trips.list(effectiveParams),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: effectiveParams,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TripForm) =>
      apiRequest<Trip>("/api/trips", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания рейса");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TripWritePayload }) =>
      apiRequest<Trip>(`/api/trips/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления рейса");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: "status" | "type" | "delete"; body: Record<string, unknown> }) =>
      apiRequest<BulkMutationResponse<Trip>>(`/api/trips/bulk/${endpoint}`, {
        method: "POST",
        body,
      }),
    onSuccess: async (payload) => {
      message.success(`Операция выполнена. Обновлено: ${payload.updated_count}`);
      setBulkStatusOpen(false);
      setBulkTypeOpen(false);
      bulkStatusForm.resetFields();
      bulkTypeForm.resetFields();
      setSelectedRowKeys([]);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка массовой операции");
    },
  });

  function openEdit(record: Trip) {
    setSelected(record);
    editForm.setFieldsValue({
      ...record,
      current_point_id: record.current_point_id ?? undefined,
      current_point_name: record.current_point_name ?? undefined,
      truck_plate: record.truck_plate ?? undefined,
      truck_company_name: record.truck_company_name ?? undefined,
      status_name: record.status_name ?? undefined,
      type_name: record.type_name ?? undefined,
    });
    setEditOpen(true);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  const columns: ColumnsType<Trip> = [
    { title: "ID", dataIndex: "id", key: "id", sorter: true, sortOrder: sortOrderFor("id"), width: 90 },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      sorter: true,
      sortOrder: sortOrderFor("name"),
    },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      sorter: true,
      sortOrder: sortOrderFor("status_name"),
      render: (v: TripStatus | null) => renderTripStatus(v),
      width: 220,
    },
    {
      title: "Тип",
      dataIndex: "type_name",
      key: "type_name",
      sorter: true,
      sortOrder: sortOrderFor("type_name"),
      render: (v: TripType | null) => formatTripType(v),
      width: 120,
    },
    {
      title: "Текущая точка",
      dataIndex: "current_point_name",
      key: "current_point_name",
      sorter: true,
      sortOrder: sortOrderFor("current_point_name"),
      render: (v) => v ?? "-",
    },
    {
      title: "Номер тягача",
      dataIndex: "truck_plate",
      key: "truck_plate",
      sorter: true,
      sortOrder: sortOrderFor("truck_plate"),
      render: (v) => v ?? "-",
      width: 160,
    },
    {
      title: "Создан",
      dataIndex: "created_at",
      key: "created_at",
      sorter: true,
      sortOrder: sortOrderFor("created_at"),
      render: (v: string | null | undefined) => v ?? "—",
      width: 190,
    },
    {
      title: "Действия",
      key: "actions",
      width: 150,
      render: (_, record) =>
        canMutate ? (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Редактировать
          </Button>
        ) : (
          "-"
        ),
    },
  ];

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/trips${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<Trip> | SorterResult<Trip>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Trip> | undefined)
      : (sorter as SorterResult<Trip>);

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
  const quickTabs = listQuery.data?.meta.quick_tabs ?? [
    { code: "all", label: "Все", count: totalRows, is_active: !params.quick_tab || params.quick_tab === "all" },
  ];

  function toggleRowSelection(id: number, checked: boolean) {
    setSelectedRowKeys((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((currentId) => currentId !== id);
    });
  }

  function askBulkDeleteConfirm() {
    Modal.confirm({
      title: "Удалить выбранные рейсы",
      content: "Удаление возможно только для рейсов без связанных заказов.",
      okText: "Подтвердить",
      cancelText: "Отмена",
      onOk: () => {
        bulkMutation.mutate({
          endpoint: "delete",
          body: { trip_ids: selectedRowKeys },
        });
      },
    });
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Рейсы"
        subtitle="Планирование перемещений и массовые операции по статусу/типу рейсов."
        actions={
          canMutate ? (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Создать рейс
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
            key={params.query ?? "trips-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по названию рейса"
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
            status_names?: TripStatus[];
            type_names?: TripType[];
            truck_plate?: string;
            truck_company_name?: string;
            created_at_from?: dayjs.Dayjs;
            created_at_to?: dayjs.Dayjs;
          }) => {
            const createdFrom = values.created_at_from?.startOf("day");
            const createdTo = values.created_at_to?.startOf("day");
            if (createdFrom && createdTo && createdFrom.isAfter(createdTo)) {
              message.error("Период создания указан некорректно: дата \"от\" позже даты \"до\".");
              return;
            }
            applySearchPatch({
              quick_tab: null,
              query: values.query,
              status_names: values.status_names,
              type_names: values.type_names,
              truck_plate: values.truck_plate,
              truck_company_name: values.truck_company_name,
              created_at_from: values.created_at_from?.format("YYYY-MM-DD"),
              created_at_to: values.created_at_to?.format("YYYY-MM-DD"),
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск по названию" allowClear />
            </Form.Item>
            <Form.Item name="truck_plate" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Номер тягача" allowClear />
            </Form.Item>
            <Form.Item name="truck_company_name" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Input placeholder="Транспортная компания" allowClear />
            </Form.Item>
            <Form.Item name="status_names" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Статус"
                options={TRIP_STATUS_VALUES.map((value) => ({
                  label: formatTripStatus(value),
                  value,
                }))}
              />
            </Form.Item>
            <Form.Item name="type_names" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="Тип"
                options={TRIP_TYPE_VALUES.map((value) => ({
                  label: formatTripType(value),
                  value,
                }))}
              />
            </Form.Item>
            <Form.Item name="created_at_from" className="crm-col-2" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан от" />
            </Form.Item>
            <Form.Item name="created_at_to" className="crm-col-2" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Создан до" />
            </Form.Item>
          </div>

          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/trips");
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
                    status_names: null,
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

      {canMutate && selectedRowKeys.length > 0 ? (
        <Card className="crm-panel crm-bulk-card">
          <Space wrap>
            <Typography.Text strong>Выбрано рейсов: {selectedRowKeys.length}</Typography.Text>
            <Button onClick={() => setBulkStatusOpen(true)}>Массово: статус</Button>
            <Button onClick={() => setBulkTypeOpen(true)}>Массово: тип</Button>
            <Button danger onClick={askBulkDeleteConfirm}>
              Удалить
            </Button>
            <Button onClick={() => setSelectedRowKeys([])}>Снять выделение</Button>
          </Space>
        </Card>
      ) : null}

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError
              ? listQuery.error.detail.toLowerCase().includes("created_at_from") &&
                listQuery.error.detail.toLowerCase().includes("created_at_to")
                ? "Период создания указан некорректно: дата \"от\" позже даты \"до\"."
                : listQuery.error.detail
              : "Ошибка загрузки рейсов"}
          </Typography.Text>
        ) : null}

        {isMobile ? (
          <>
            <div className="crm-mobile-list">
              {rows.map((record) => (
                <article key={record.id} className="crm-row-card">
                  <div className="crm-row-card-head">
                    <div>
                      {canMutate ? (
                        <Checkbox
                          checked={selectedRowKeys.includes(record.id)}
                          onChange={(event) => toggleRowSelection(record.id, event.target.checked)}
                          style={{ marginBottom: 8 }}
                        >
                          Выбрать
                        </Checkbox>
                      ) : null}
                      <div className="crm-row-title">{record.name}</div>
                      <Typography.Text type="secondary">ID #{record.id}</Typography.Text>
                    </div>
                    {renderTripStatus(record.status_name)}
                  </div>

                  <div className="crm-row-meta">
                    <div className="crm-row-meta-item">
                      Тип
                      <strong>{formatTripType(record.type_name)}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Точка
                      <strong>{record.current_point_name ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Тягач
                      <strong>{record.truck_plate ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Компания
                      <strong>{record.truck_company_name ?? "-"}</strong>
                    </div>
                    <div className="crm-row-meta-item">
                      Создан
                      <strong>{record.created_at ?? "—"}</strong>
                    </div>
                  </div>

                  <div className="crm-row-actions">
                    {canMutate ? (
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                        Редактировать
                      </Button>
                    ) : null}
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
          <Table<Trip>
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            rowSelection={
              canMutate
                ? {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }
                : undefined
            }
            scroll={{ x: 1120 }}
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
        title="Создать рейс"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<TripForm> form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="current_point_id" label="ID текущей точки">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="current_point_name" label="Текущая точка">
            <Input />
          </Form.Item>
          <Form.Item name="truck_plate" label="Номер тягача">
            <Input />
          </Form.Item>
          <Form.Item name="truck_company_name" label="Транспортная компания">
            <Input />
          </Form.Item>
          <Form.Item name="status_name" label="Статус">
            <Select
              allowClear
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatTripStatus(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Select
              allowClear
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Редактировать рейс #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<TripForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({ id: selected.id, payload: values });
          }}
        >
          <Form.Item name="name" label="Название">
            <Input />
          </Form.Item>
          <Form.Item name="current_point_id" label="ID текущей точки">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="current_point_name" label="Текущая точка">
            <Input />
          </Form.Item>
          <Form.Item name="truck_plate" label="Номер тягача">
            <Input />
          </Form.Item>
          <Form.Item name="truck_company_name" label="Транспортная компания">
            <Input />
          </Form.Item>
          <Form.Item name="status_name" label="Статус">
            <Select
              allowClear
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatTripStatus(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Select
              allowClear
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массовое изменение статуса"
        open={bulkStatusOpen}
        destroyOnHidden
        onCancel={() => setBulkStatusOpen(false)}
        onOk={() => bulkStatusForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkStatusForm}
          layout="vertical"
          onFinish={(values: { status_name: TripStatus }) => {
            bulkMutation.mutate({
              endpoint: "status",
              body: {
                trip_ids: selectedRowKeys,
                status_name: values.status_name,
              },
            });
          }}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}> 
            <Select
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatTripStatus(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Массовое изменение типа"
        open={bulkTypeOpen}
        destroyOnHidden
        onCancel={() => setBulkTypeOpen(false)}
        onOk={() => bulkTypeForm.submit()}
        confirmLoading={bulkMutation.isPending}
      >
        <Form
          form={bulkTypeForm}
          layout="vertical"
          onFinish={(values: { type_name: TripType }) => {
            bulkMutation.mutate({
              endpoint: "type",
              body: {
                trip_ids: selectedRowKeys,
                type_name: values.type_name,
              },
            });
          }}
        >
          <Form.Item name="type_name" label="Тип" rules={[{ required: true }]}> 
            <Select
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatTripType(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <TripsPageContent />
    </Suspense>
  );
}
