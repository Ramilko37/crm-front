"use client";

import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { LoadingPointFormFields } from "@/features/trips/loading-point-form-fields";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  TRIP_STATUS_VALUES,
  TRIP_TYPE_VALUES,
  type LoadingPointType,
  type TripStatus,
  type TripType,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { isBackOfficeRole } from "@/shared/lib/rbac";
import {
  buildLoadingPointApiPayload,
  formatLoadingPointDate,
  formatLoadingPointLocationLabel,
  formatLoadingPointType,
  pathPointActualAtFromCompleted,
  pathPointIsCompleted,
  resolveLoadingPointLocationId,
  type LoadingPointFormValues,
} from "@/shared/lib/trip-point-forms";
import { PageHeader } from "@/shared/ui/page-frame";
import type {
  Factory,
  PaginatedResponse,
  PathPoint,
  TripDetail,
  TripLoadingPoint,
  TripLoadingPointUpdatePayload,
  TripPathPoint,
  TripPathPointUpdatePayload,
  TripWritePayload,
} from "@/shared/types/entities";

type TripForm = {
  name?: string;
  current_point_id?: number;
  current_point_name?: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
  type_name?: TripType;
};

type PathPointFormValues = {
  path_point_id: number;
  is_completed?: boolean;
};

const tripStatusTagColors: Record<string, string> = {
  new: "blue",
  in_transit: "cyan",
  in_russia_customs: "orange",
  in_moscow_warehouse: "geekblue",
  unloaded: "green",
};

function TripDetailPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const tripId = Number(params.id);

  const meQuery = useCurrentUser(true);
  const canMutate = isBackOfficeRole(meQuery.data?.role_name, meQuery.data?.is_superuser);

  const [editTripOpen, setEditTripOpen] = useState(false);
  const [pathPointModalOpen, setPathPointModalOpen] = useState(false);
  const [loadingPointModalOpen, setLoadingPointModalOpen] = useState(false);
  const [selectedPathPoint, setSelectedPathPoint] = useState<TripPathPoint | null>(null);
  const [selectedLoadingPoint, setSelectedLoadingPoint] = useState<TripLoadingPoint | null>(null);

  const [tripForm] = Form.useForm<TripForm>();
  const [pathPointForm] = Form.useForm<PathPointFormValues>();
  const [loadingPointForm] = Form.useForm<LoadingPointFormValues>();

  const detailQuery = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => apiRequest<TripDetail>(`/api/trips/${tripId}`),
    enabled: Number.isFinite(tripId) && tripId > 0,
  });

  const pathPointsCatalogQuery = useQuery({
    queryKey: queryKeys.pathPoints.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const factoriesQuery = useQuery({
    queryKey: queryKeys.factories.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const factories = factoriesQuery.data?.items ?? [];
  const pathPoints = pathPointsCatalogQuery.data?.items ?? [];

  const pathPointOptions = useMemo(
    () =>
      (pathPointsCatalogQuery.data?.items ?? []).map((point) => ({
        label: point.name_ru,
        value: point.id,
      })),
    [pathPointsCatalogQuery.data?.items],
  );

  const pathPointNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const point of pathPointsCatalogQuery.data?.items ?? []) {
      map.set(point.id, point.name_ru);
    }
    return map;
  }, [pathPointsCatalogQuery.data?.items]);

  const updateTripMutation = useMutation({
    mutationFn: (payload: TripWritePayload) =>
      apiRequest<TripDetail>(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс обновлён");
      setEditTripOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления рейса");
    },
  });

  const savePathPointMutation = useMutation({
    mutationFn: async (values: PathPointFormValues) => {
      const sequence = selectedPathPoint?.sequence ?? (trip?.path_points.length ?? 0) + 1;
      const actualAt = pathPointActualAtFromCompleted(
        values.is_completed ?? false,
        selectedPathPoint?.actual_at,
      );
      const payload = {
        path_point_id: values.path_point_id,
        sequence,
        factory_id: null,
        planned_at: null,
        actual_at: actualAt,
      };

      if (selectedPathPoint) {
        const updatePayload: TripPathPointUpdatePayload = payload;
        return apiRequest<TripPathPoint>(`/api/trips/${tripId}/path-points/${selectedPathPoint.id}`, {
          method: "PATCH",
          body: updatePayload,
        });
      }

      return apiRequest<TripPathPoint>(`/api/trips/${tripId}/path-points`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: async () => {
      message.success(selectedPathPoint ? "Точка маршрута обновлена" : "Точка маршрута добавлена");
      setPathPointModalOpen(false);
      setSelectedPathPoint(null);
      pathPointForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка сохранения точки маршрута");
    },
  });

  const saveLoadingPointMutation = useMutation({
    mutationFn: async (values: LoadingPointFormValues) => {
      const payload = buildLoadingPointApiPayload(values, { factories, pathPoints });

      if (selectedLoadingPoint) {
        const updatePayload: TripLoadingPointUpdatePayload = payload;
        return apiRequest<TripLoadingPoint>(
          `/api/trips/${tripId}/loading-points/${selectedLoadingPoint.id}`,
          {
            method: "PATCH",
            body: updatePayload,
          },
        );
      }

      return apiRequest<TripLoadingPoint>(`/api/trips/${tripId}/loading-points`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: async () => {
      message.success(selectedLoadingPoint ? "Точка погрузки обновлена" : "Точка погрузки добавлена");
      setLoadingPointModalOpen(false);
      setSelectedLoadingPoint(null);
      loadingPointForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
    onError: (error) => {
      message.error(
        error instanceof ApiError
          ? error.detail
          : error instanceof Error
            ? error.message
            : "Ошибка сохранения точки погрузки",
      );
    },
  });

  const trip = detailQuery.data;

  function openEditTrip() {
    if (!trip) return;
    tripForm.setFieldsValue({
      name: trip.name,
      current_point_id: trip.current_point_id ?? undefined,
      current_point_name: trip.current_point_name ?? undefined,
      truck_plate: trip.truck_plate ?? undefined,
      truck_company_name: trip.truck_company_name ?? undefined,
      status_name: trip.status_name ?? undefined,
      type_name: trip.type_name ?? undefined,
    });
    setEditTripOpen(true);
  }

  function openCreatePathPoint() {
    setSelectedPathPoint(null);
    pathPointForm.resetFields();
    pathPointForm.setFieldsValue({ is_completed: false });
    setPathPointModalOpen(true);
  }

  function openEditPathPoint(record: TripPathPoint) {
    setSelectedPathPoint(record);
    pathPointForm.setFieldsValue({
      path_point_id: record.path_point_id,
      is_completed: pathPointIsCompleted(record.actual_at),
    });
    setPathPointModalOpen(true);
  }

  function openCreateLoadingPoint() {
    setSelectedLoadingPoint(null);
    loadingPointForm.resetFields();
    loadingPointForm.setFieldsValue({
      loading_point_type: "factory",
      is_completed: false,
    });
    setLoadingPointModalOpen(true);
  }

  function openEditLoadingPoint(record: TripLoadingPoint) {
    setSelectedLoadingPoint(record);
    loadingPointForm.setFieldsValue({
      loading_point_type: record.type,
      location_id: resolveLoadingPointLocationId(record, pathPoints),
      planned_loading_at: record.planned_loading_at ? dayjs(record.planned_loading_at) : undefined,
      actual_loading_at: record.actual_loading_at ? dayjs(record.actual_loading_at) : undefined,
      is_completed: record.is_completed,
    });
    setLoadingPointModalOpen(true);
  }

  const pathPointColumns: ColumnsType<TripPathPoint> = [
    {
      title: "Путевая точка",
      key: "path_point",
      render: (_, record) => pathPointNameById.get(record.path_point_id) ?? `#${record.path_point_id}`,
    },
    {
      title: "Завершено",
      key: "is_completed",
      width: 120,
      render: (_, record) => (pathPointIsCompleted(record.actual_at) ? "Да" : "Нет"),
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, record) =>
        canMutate ? (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditPathPoint(record)}>
            Изменить
          </Button>
        ) : null,
    },
  ];

  const loadingPointColumns: ColumnsType<TripLoadingPoint> = [
    {
      title: "Тип",
      dataIndex: "type",
      render: (value: LoadingPointType) => formatLoadingPointType(value),
      width: 160,
    },
    {
      title: "Фабрика / склад",
      key: "location",
      render: (_, record) => formatLoadingPointLocationLabel(record, factories, pathPoints),
    },
    {
      title: "Дата загрузки",
      dataIndex: "planned_loading_at",
      render: (value: string | null) => formatLoadingPointDate(value),
      width: 140,
    },
    {
      title: "Актуальная дата",
      dataIndex: "actual_loading_at",
      render: (value: string | null) => formatLoadingPointDate(value),
      width: 140,
    },
    {
      title: "Завершено",
      dataIndex: "is_completed",
      render: (value: boolean) => (value ? "Да" : "Нет"),
      width: 110,
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, record) =>
        canMutate ? (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditLoadingPoint(record)}>
            Изменить
          </Button>
        ) : null,
    },
  ];

  if (!Number.isFinite(tripId) || tripId <= 0) {
    return <Typography.Text type="danger">Некорректный ID рейса</Typography.Text>;
  }

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title={trip ? `Рейс #${trip.id}` : "Рейс"}
        subtitle={trip?.name}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/trips")}>
              К списку
            </Button>
            {canMutate && trip ? (
              <Button type="primary" icon={<EditOutlined />} onClick={openEditTrip}>
                Редактировать рейс
              </Button>
            ) : null}
          </Space>
        }
      />

      {detailQuery.isLoading ? (
        <Card loading />
      ) : detailQuery.error ? (
        <Typography.Text type="danger">
          {detailQuery.error instanceof ApiError ? detailQuery.error.detail : "Ошибка загрузки рейса"}
        </Typography.Text>
      ) : trip ? (
        <>
          <Card className="crm-panel">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="Название">{trip.name}</Descriptions.Item>
              <Descriptions.Item label="Статус">
                {trip.status_name ? (
                  <Tag color={tripStatusTagColors[trip.status_name] ?? "default"} className="crm-status-tag">
                    {formatEnumCode(trip.status_name)}
                  </Tag>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Тип">{trip.type_name ? formatEnumCode(trip.type_name) : "—"}</Descriptions.Item>
              <Descriptions.Item label="Текущая точка">{trip.current_point_name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Номер тягача">{trip.truck_plate ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Транспортная компания">{trip.truck_company_name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Создан">{trip.created_at ?? "—"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            className="crm-panel crm-table-card"
            title="Маршрут"
            extra={
              canMutate ? (
                <Button size="small" icon={<PlusOutlined />} onClick={openCreatePathPoint}>
                  Добавить
                </Button>
              ) : null
            }
          >
            <Table<TripPathPoint>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={[...(trip.path_points ?? [])].sort((a, b) => a.sequence - b.sequence)}
              columns={pathPointColumns}
              locale={{ emptyText: "Точки маршрута не добавлены" }}
            />
          </Card>

          <Card
            className="crm-panel crm-table-card"
            title="Точки погрузки"
            extra={
              canMutate ? (
                <Button size="small" icon={<PlusOutlined />} onClick={openCreateLoadingPoint}>
                  Добавить
                </Button>
              ) : null
            }
          >
            <Table<TripLoadingPoint>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={trip.loading_points ?? []}
              columns={loadingPointColumns}
              locale={{ emptyText: "Точки погрузки не добавлены" }}
            />
          </Card>
        </>
      ) : null}

      <Modal
        title={`Редактировать рейс #${trip?.id ?? ""}`}
        open={editTripOpen}
        destroyOnHidden
        onCancel={() => setEditTripOpen(false)}
        onOk={() => tripForm.submit()}
        confirmLoading={updateTripMutation.isPending}
      >
        <Form<TripForm>
          form={tripForm}
          layout="vertical"
          onFinish={(values) => updateTripMutation.mutate(values)}
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
                label: formatEnumCode(value),
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="type_name" label="Тип">
            <Select
              allowClear
              options={TRIP_TYPE_VALUES.map((value) => ({
                label: formatEnumCode(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedPathPoint ? "Редактировать точку маршрута" : "Добавить точку маршрута"}
        open={pathPointModalOpen}
        destroyOnHidden
        onCancel={() => {
          setPathPointModalOpen(false);
          setSelectedPathPoint(null);
        }}
        onOk={() => pathPointForm.submit()}
        confirmLoading={savePathPointMutation.isPending}
      >
        <Form
          form={pathPointForm}
          layout="vertical"
          onFinish={(values) => savePathPointMutation.mutate(values)}
        >
          <Form.Item name="path_point_id" label="Название путевой точки" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={pathPointOptions} />
          </Form.Item>
          <Form.Item name="is_completed" valuePropName="checked">
            <Checkbox>Завершено</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedLoadingPoint ? "Редактировать точку погрузки" : "Добавить точку погрузки"}
        open={loadingPointModalOpen}
        destroyOnHidden
        onCancel={() => {
          setLoadingPointModalOpen(false);
          setSelectedLoadingPoint(null);
        }}
        onOk={() => loadingPointForm.submit()}
        confirmLoading={saveLoadingPointMutation.isPending}
      >
        <Form
          form={loadingPointForm}
          layout="vertical"
          onFinish={(values) => saveLoadingPointMutation.mutate(values)}
        >
          <LoadingPointFormFields
            form={loadingPointForm}
            factories={factories}
            pathPoints={pathPoints}
            factoriesLoading={factoriesQuery.isLoading}
            pathPointsLoading={pathPointsCatalogQuery.isLoading}
          />
        </Form>
      </Modal>
    </Space>
  );
}

export default function TripDetailPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <TripDetailPageContent />
    </Suspense>
  );
}
