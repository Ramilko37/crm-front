"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Checkbox,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { LoadingPointFormFields } from "@/features/trips/loading-point-form-fields";
import { apiRequest } from "@/shared/lib/api";
import {
  formatEnumCode,
  TRIP_STATUS_VALUES,
  type LoadingPointType,
  type TripStatus,
} from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  buildLoadingPointApiPayload,
  formatLoadingPointDate,
  formatLoadingPointLocationLabel,
  formatLoadingPointType,
  pathPointActualAtFromCompleted,
  pathPointIsCompleted,
  type LoadingPointFormValues,
} from "@/shared/lib/trip-point-forms";
import {
  TRIP_CREATE_WIZARD_STEPS,
  clampTripCreateWizardStep,
  type TripCreateWizardStep,
} from "@/shared/lib/trip-create-wizard";
import type {
  Factory,
  PaginatedResponse,
  PathPoint,
  Trip,
  TripLoadingPoint,
  TripPathPoint,
  TripPathPointWritePayload,
} from "@/shared/types/entities";

type TripStepForm = {
  name: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
};

type PathPointDraft = TripPathPointWritePayload & { key: string; is_completed?: boolean };
type LoadingPointDraft = ReturnType<typeof buildLoadingPointApiPayload> & { key: string };

type PathPointDraftForm = {
  path_point_id: number;
  is_completed?: boolean;
};

type TripCreateWizardModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TripCreateWizardModal({ open, onClose }: TripCreateWizardModalProps) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [step, setStep] = useState(0);
  const [createdTripId, setCreatedTripId] = useState<number | null>(null);
  const [pathPointDrafts, setPathPointDrafts] = useState<PathPointDraft[]>([]);
  const [loadingPointDrafts, setLoadingPointDrafts] = useState<LoadingPointDraft[]>([]);

  const [tripForm] = Form.useForm<TripStepForm>();
  const [pathPointForm] = Form.useForm<PathPointDraftForm>();
  const [loadingPointForm] = Form.useForm<LoadingPointFormValues>();

  const stepKey = TRIP_CREATE_WIZARD_STEPS[step]?.key ?? "trip";
  const lastStep = TRIP_CREATE_WIZARD_STEPS.length - 1;

  const pathPointsCatalogQuery = useQuery({
    queryKey: queryKeys.pathPoints.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<PathPoint>>("/api/path-points", {
        query: { page: 1, page_size: 200 },
      }),
    enabled: open,
  });

  const factoriesQuery = useQuery({
    queryKey: queryKeys.factories.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Factory>>("/api/factories", {
        query: { page: 1, page_size: 200 },
      }),
    enabled: open,
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

  const createTripMutation = useMutation({
    mutationFn: (payload: TripStepForm) =>
      apiRequest<Trip>("/api/trips", {
        method: "POST",
        body: payload,
      }),
  });

  const savePathPointsMutation = useMutation({
    mutationFn: async ({ tripId, drafts }: { tripId: number; drafts: PathPointDraft[] }) => {
      const created: TripPathPoint[] = [];
      for (const draft of drafts) {
        const item = await apiRequest<TripPathPoint>(`/api/trips/${tripId}/path-points`, {
          method: "POST",
          body: {
            path_point_id: draft.path_point_id,
            sequence: draft.sequence,
            factory_id: null,
            planned_at: null,
            actual_at: draft.actual_at ?? null,
          },
        });
        created.push(item);
      }
      return created;
    },
  });

  const saveLoadingPointsMutation = useMutation({
    mutationFn: async ({ tripId, drafts }: { tripId: number; drafts: LoadingPointDraft[] }) => {
      const created: TripLoadingPoint[] = [];
      for (const draft of drafts) {
        const item = await apiRequest<TripLoadingPoint>(`/api/trips/${tripId}/loading-points`, {
          method: "POST",
          body: {
            type: draft.type,
            name: draft.name,
            address: draft.address,
            factory_id: draft.factory_id ?? null,
            planned_loading_at: draft.planned_loading_at ?? null,
            actual_loading_at: draft.actual_loading_at ?? null,
            is_completed: draft.is_completed ?? false,
          },
        });
        created.push(item);
      }
      return created;
    },
  });

  const isBusy =
    createTripMutation.isPending || savePathPointsMutation.isPending || saveLoadingPointsMutation.isPending;

  function resetWizard() {
    setStep(0);
    setCreatedTripId(null);
    setPathPointDrafts([]);
    setLoadingPointDrafts([]);
    tripForm.resetFields();
    pathPointForm.resetFields();
    loadingPointForm.resetFields();
  }

  function handleClose() {
    resetWizard();
    onClose();
  }

  async function ensureTripCreated() {
    if (createdTripId) return createdTripId;
    const values = await tripForm.validateFields();
    const trip = await createTripMutation.mutateAsync(values);
    setCreatedTripId(trip.id);
    return trip.id;
  }

  async function goToStep(nextStep: number) {
    const clamped = clampTripCreateWizardStep(nextStep);
    if (clamped === step) return;

    if (clamped > step) {
      if (stepKey === "trip") {
        try {
          await ensureTripCreated();
        } catch (error) {
          if (error instanceof ApiError) {
            message.error(error.detail);
          }
          return;
        }
      }
    }

    setStep(clamped);
  }

  async function handleFinish() {
    try {
      const tripId = await ensureTripCreated();

      if (pathPointDrafts.length > 0) {
        await savePathPointsMutation.mutateAsync({ tripId, drafts: pathPointDrafts });
      }

      if (loadingPointDrafts.length > 0) {
        await saveLoadingPointsMutation.mutateAsync({ tripId, drafts: loadingPointDrafts });
      }

      message.success("Рейс создан");
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      handleClose();
    } catch (error) {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания рейса");
    }
  }

  function addPathPointDraft() {
    pathPointForm
      .validateFields()
      .then((values) => {
        const nextSequence = pathPointDrafts.length + 1;
        setPathPointDrafts((current) => [
          ...current,
          {
            key: `${values.path_point_id}-${nextSequence}-${Date.now()}`,
            path_point_id: values.path_point_id,
            sequence: nextSequence,
            is_completed: values.is_completed ?? false,
            actual_at: pathPointActualAtFromCompleted(values.is_completed ?? false),
          },
        ]);
        pathPointForm.resetFields();
      })
      .catch(() => undefined);
  }

  function addLoadingPointDraft() {
    loadingPointForm
      .validateFields()
      .then((values) => {
        try {
          setLoadingPointDrafts((current) => [
            ...current,
            {
              key: `${values.loading_point_type}-${values.location_id}-${Date.now()}`,
              ...buildLoadingPointApiPayload(values, { factories, pathPoints }),
            },
          ]);
          loadingPointForm.resetFields();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Не удалось добавить точку погрузки");
        }
      })
      .catch(() => undefined);
  }

  const pathPointColumns: ColumnsType<PathPointDraft> = [
    {
      title: "Путевая точка",
      key: "path_point",
      render: (_, record) =>
        pathPointsCatalogQuery.data?.items.find((item) => item.id === record.path_point_id)?.name_ru ??
        `#${record.path_point_id}`,
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
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            setPathPointDrafts((current) =>
              current
                .filter((item) => item.key !== record.key)
                .map((item, index) => ({ ...item, sequence: index + 1 })),
            );
          }}
        />
      ),
    },
  ];

  const loadingPointColumns: ColumnsType<LoadingPointDraft> = [
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
      render: (value: string | null | undefined) => formatLoadingPointDate(value),
      width: 140,
    },
    {
      title: "Актуальная дата",
      dataIndex: "actual_loading_at",
      render: (value: string | null | undefined) => formatLoadingPointDate(value),
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
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            setLoadingPointDrafts((current) => current.filter((item) => item.key !== record.key));
          }}
        />
      ),
    },
  ];

  function renderStepContent(currentStepKey: TripCreateWizardStep) {
    if (currentStepKey === "trip") {
      return (
        <Form form={tripForm} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Укажите название рейса" }]}>
            <Input placeholder="Рейс #42" />
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
              placeholder="По умолчанию"
              options={TRIP_STATUS_VALUES.map((value) => ({
                label: formatEnumCode(value),
                value,
              }))}
            />
          </Form.Item>
        </Form>
      );
    }

    if (currentStepKey === "path_points") {
      return (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            Добавьте путевые точки маршрута. Порядок в списке определяет sequence.
          </Typography.Text>

          <Form form={pathPointForm} layout="vertical">
            <Form.Item
              name="path_point_id"
              label="Название путевой точки"
              rules={[{ required: true, message: "Выберите точку" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={pathPointsCatalogQuery.isLoading}
                options={pathPointOptions}
                placeholder="Выберите из справочника"
              />
            </Form.Item>
            <Form.Item name="is_completed" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Checkbox>Завершено</Checkbox>
            </Form.Item>
            <Button icon={<PlusOutlined />} onClick={addPathPointDraft}>
              Добавить точку маршрута
            </Button>
          </Form>

          <Table<PathPointDraft>
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={pathPointDrafts}
            columns={pathPointColumns}
            locale={{ emptyText: "Точки маршрута не добавлены" }}
          />
        </Space>
      );
    }

    return (
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Text type="secondary">Добавьте точки погрузки.</Typography.Text>

        <Form
          form={loadingPointForm}
          layout="vertical"
          initialValues={{ loading_point_type: "factory", is_completed: false }}
        >
          <LoadingPointFormFields
            form={loadingPointForm}
            factories={factories}
            pathPoints={pathPoints}
            factoriesLoading={factoriesQuery.isLoading}
            pathPointsLoading={pathPointsCatalogQuery.isLoading}
          />
          <Button icon={<PlusOutlined />} onClick={addLoadingPointDraft}>
            Добавить точку погрузки
          </Button>
        </Form>

        <Table<LoadingPointDraft>
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={loadingPointDrafts}
          columns={loadingPointColumns}
          locale={{ emptyText: "Точки погрузки не добавлены" }}
        />
      </Space>
    );
  }

  return (
    <Modal
      title="Создать рейс"
      open={open}
      width={step === 0 ? 640 : 1080}
      destroyOnHidden
      onCancel={() => {
        if (createdTripId || pathPointDrafts.length || loadingPointDrafts.length) {
          Modal.confirm({
            title: "Отменить создание рейса?",
            content: createdTripId
              ? "Рейс уже создан на сервере. Черновик маршрута и погрузок будет потерян."
              : "Несохранённые данные будут потеряны.",
            okText: "Отменить",
            cancelText: "Продолжить",
            onOk: handleClose,
          });
          return;
        }
        handleClose();
      }}
      footer={
        <div className="crm-create-wizard-footer">
          <Button disabled={step === 0 || isBusy} onClick={() => void goToStep(step - 1)}>
            Назад
          </Button>
          {step < lastStep ? (
            <Button type="primary" loading={isBusy} onClick={() => void goToStep(step + 1)}>
              Далее
            </Button>
          ) : (
            <Button type="primary" loading={isBusy} onClick={() => void handleFinish()}>
              Готово
            </Button>
          )}
        </div>
      }
    >
      <div className="crm-create-wizard-head">
        <Typography.Text className="crm-create-wizard-step-counter">
          Шаг {step + 1} из {TRIP_CREATE_WIZARD_STEPS.length}
        </Typography.Text>
        <Steps
          size="small"
          current={step}
          className="crm-create-wizard-steps"
          orientation={isMobile ? "vertical" : "horizontal"}
          items={TRIP_CREATE_WIZARD_STEPS.map((item) => ({ title: item.title }))}
          onChange={(nextStep) => void goToStep(nextStep)}
        />
      </div>

      {renderStepContent(stepKey)}
    </Modal>
  );
}
