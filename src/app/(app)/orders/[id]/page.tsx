"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Grid,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode, ORDER_STATUS_VALUES, type OrderStatus } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { downloadFileWithCredentials, getFileOperationErrorMessage } from "@/shared/lib/file-operations";
import { queryKeys } from "@/shared/lib/query-keys";
import { normalizeRoleName } from "@/shared/lib/rbac";
import { PageHeader } from "@/shared/ui/page-frame";
import type {
  OrderCertificate,
  OrderChatMessage,
  OrderDetail,
  OrderDocument,
  OrderStatusHistoryItem,
  PaginatedResponse,
  Trip,
  UserAdmin,
} from "@/shared/types/entities";

function renderOrderNumber(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

function renderOrderStatus(value: OrderStatus | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return <Tag className="crm-status-tag">{formatEnumCode(value)}</Tag>;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canLoadOperationalLookups =
    Boolean(meQuery.data?.is_superuser) || ["administrator", "manager", "logist", "accountant", "warehouse"].includes(normalizedRole);

  const [patchForm] = Form.useForm<{ comment?: string }>();
  const [statusForm] = Form.useForm<{ status_name: OrderStatus }>();
  const [assignTripForm] = Form.useForm<{ trip_id?: number }>();
  const [assignForwarderForm] = Form.useForm<{ assigned_forwarder_user_id?: number }>();
  const [pickupForm] = Form.useForm<{ pickup_date?: string }>();
  const [specialTariffForm] = Form.useForm<{ amount?: number; currency?: string }>();
  const [requestToFactoryForm] = Form.useForm<{ comment?: string; template_id?: number }>();
  const [chatForm] = Form.useForm<{ message: string }>();
  const [documentUploadForm] = Form.useForm<{ document_type?: string; display_name?: string; file?: FileList }>();
  const [certificateMetaForm] = Form.useForm<{
    number?: string;
    status?: string;
    issued_date?: string;
    expires_date?: string;
  }>();
  const [certificateFileForm] = Form.useForm<{ file?: FileList }>();
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [certificateDownloadPending, setCertificateDownloadPending] = useState(false);

  const orderQuery = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${orderId}`),
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: { page: 1, page_size: 200 },
      }),
    enabled: canLoadOperationalLookups,
  });

  const forwardersQuery = useQuery({
    queryKey: queryKeys.users.list({ page: 1, page_size: 200, role_name: "forwarder" }),
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin>>("/api/users", {
        query: { page: 1, page_size: 200, role_name: "forwarder" },
      }),
    enabled: canLoadOperationalLookups,
  });

  const documentsFallbackQuery = useQuery({
    queryKey: queryKeys.orders.documents(orderId),
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderDocument>>(`/api/orders/${orderId}/documents`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: orderQuery.isSuccess && !(orderQuery.data?.documents?.length ?? 0),
  });

  const statusFallbackQuery = useQuery({
    queryKey: queryKeys.orders.statusHistory(orderId),
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderStatusHistoryItem>>(`/api/orders/${orderId}/status-history`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: orderQuery.isSuccess && !(orderQuery.data?.status_history?.length ?? 0),
  });

  const chatFallbackQuery = useQuery({
    queryKey: queryKeys.orders.chatMessages(orderId),
    queryFn: () =>
      apiRequest<PaginatedResponse<OrderChatMessage>>(`/api/orders/${orderId}/chat-messages`, {
        query: { page: 1, page_size: 200 },
      }),
    enabled: orderQuery.isSuccess && !(orderQuery.data?.chat_messages?.length ?? 0),
  });

  const certificateFallbackQuery = useQuery({
    queryKey: queryKeys.orders.certificate(orderId),
    queryFn: () => apiRequest<OrderCertificate>(`/api/orders/${orderId}/certificate`),
    enabled: orderQuery.isSuccess && !orderQuery.data?.certificate,
  });

  const patchMutation = useMutation({
    mutationFn: (payload: { comment?: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Комментарий сохранен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка сохранения");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { status_name: OrderStatus }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Статус обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.statusHistory(orderId) });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления статуса");
    },
  });

  const assignTripMutation = useMutation({
    mutationFn: (payload: { trip_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}/assign-trip`, {
        method: "POST",
        body: {
          trip_id: payload.trip_id ?? null,
        },
      }),
    onSuccess: async () => {
      message.success("Рейс обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения рейса");
    },
  });

  const assignForwarderMutation = useMutation({
    mutationFn: (payload: { assigned_forwarder_user_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}/assign-forwarder`, {
        method: "POST",
        body: {
          assigned_forwarder_user_id: payload.assigned_forwarder_user_id ?? null,
        },
      }),
    onSuccess: async () => {
      message.success("Экспедитор обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка назначения экспедитора");
    },
  });

  const pickupMutation = useMutation({
    mutationFn: (payload: { pickup_date?: string }) =>
      payload.pickup_date
        ? apiRequest<OrderDetail>(`/api/orders/${orderId}/pickup-date`, {
            method: "POST",
            body: { pickup_date: payload.pickup_date },
          })
        : apiRequest<OrderDetail>(`/api/orders/${orderId}/cancel-pickup`, {
            method: "POST",
          }),
    onSuccess: async () => {
      message.success("Дата вывоза обновлена");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления даты вывоза");
    },
  });

  const specialTariffMutation = useMutation({
    mutationFn: (payload: { amount?: number; currency?: string }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}/special-tariff`, {
        method: "POST",
        body: {
          amount: payload.amount ?? null,
          currency: payload.currency || "EUR",
        },
      }),
    onSuccess: async () => {
      message.success("Спецтариф обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления спецтарифа");
    },
  });

  const requestToFactoryMutation = useMutation({
    mutationFn: (payload: { comment?: string; template_id?: number }) =>
      apiRequest<OrderDetail>(`/api/orders/${orderId}/request-to-factory`, {
        method: "POST",
        body: {
          comment: payload.comment ?? null,
          template_id: payload.template_id ?? null,
        },
      }),
    onSuccess: async () => {
      message.success("Запрос на фабрику отправлен");
      requestToFactoryForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.statusHistory(orderId) });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка запроса на фабрику");
    },
  });

  const postChatMutation = useMutation({
    mutationFn: (payload: { message: string }) =>
      apiRequest<OrderChatMessage>(`/api/orders/${orderId}/chat-messages`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Сообщение отправлено");
      chatForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.chatMessages(orderId) });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка отправки сообщения");
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (values: { document_type?: string; display_name?: string; file?: FileList }) => {
      const file = values.file?.[0];
      if (!file) {
        throw new ApiError(400, "Выберите файл");
      }

      const payload = {
        document_type: values.document_type,
        display_name: values.display_name,
      };

      const formData = new FormData();
      formData.set("payload", JSON.stringify(payload));
      formData.set("file", file);

      return apiRequest<OrderDocument>(`/api/orders/${orderId}/documents`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      message.success("Документ загружен");
      documentUploadForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.documents(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(getFileOperationErrorMessage(error, "Ошибка загрузки документа"));
    },
  });

  const patchCertificateMetaMutation = useMutation({
    mutationFn: (payload: { number?: string; status?: string; issued_date?: string; expires_date?: string }) =>
      apiRequest<OrderCertificate>(`/api/orders/${orderId}/certificate`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Сертификат обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.certificate(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления сертификата");
    },
  });

  const patchCertificateFileMutation = useMutation({
    mutationFn: async (values: { file?: FileList }) => {
      const file = values.file?.[0];
      if (!file) {
        throw new ApiError(400, "Выберите файл сертификата");
      }

      const formData = new FormData();
      formData.set("payload", JSON.stringify({}));
      formData.set("file", file);

      return apiRequest<OrderCertificate>(`/api/orders/${orderId}/certificate`, {
        method: "PATCH",
        body: formData,
      });
    },
    onSuccess: async () => {
      message.success("Файл сертификата обновлен");
      certificateFileForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.certificate(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(getFileOperationErrorMessage(error, "Ошибка загрузки файла сертификата"));
    },
  });

  const order = orderQuery.data;
  const documents = order?.documents?.length ? order.documents : (documentsFallbackQuery.data?.items ?? []);
  const statusHistory = order?.status_history?.length ? order.status_history : (statusFallbackQuery.data?.items ?? []);
  const chatMessages = order?.chat_messages?.length ? order.chat_messages : (chatFallbackQuery.data?.items ?? []);
  const certificate = order?.certificate ?? certificateFallbackQuery.data ?? null;

  useEffect(() => {
    if (!order) {
      return;
    }
    patchForm.setFieldsValue({ comment: order.comment ?? "" });
    statusForm.setFieldsValue({ status_name: order.status_name ?? undefined });
    assignTripForm.setFieldsValue({ trip_id: order.trip_id ?? undefined });
    assignForwarderForm.setFieldsValue({ assigned_forwarder_user_id: order.assigned_forwarder_user_id ?? undefined });
    pickupForm.setFieldsValue({ pickup_date: order.pickup_date ?? undefined });
    specialTariffForm.setFieldsValue({
      amount: order.special_tariff_amount ? Number(order.special_tariff_amount) : undefined,
      currency: order.special_tariff_currency ?? "EUR",
    });
    certificateMetaForm.setFieldsValue({
      number: certificate?.number ?? undefined,
      status: certificate?.status ?? undefined,
      issued_date: certificate?.issued_date ?? undefined,
      expires_date: certificate?.expires_date ?? undefined,
    });
  }, [
    assignForwarderForm,
    assignTripForm,
    certificate?.expires_date,
    certificate?.issued_date,
    certificate?.number,
    certificate?.status,
    certificateMetaForm,
    order,
    patchForm,
    pickupForm,
    specialTariffForm,
    statusForm,
  ]);

  const documentColumns: ColumnsType<OrderDocument> = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    { title: "Тип", dataIndex: "document_type", key: "document_type", width: 220, render: (value) => value ?? "-" },
    { title: "Имя", dataIndex: "file_name", key: "file_name", render: (value) => value ?? "-" },
    { title: "Загружен", dataIndex: "uploaded_at", key: "uploaded_at", width: 190, render: (value) => value ?? "-" },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          loading={downloadingDocumentId === row.id}
          onClick={() => {
            void handleDocumentDownload(row);
          }}
        >
          Скачать
        </Button>
      ),
    },
  ];

  const statusColumns: ColumnsType<OrderStatusHistoryItem> = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    {
      title: "Статус",
      dataIndex: "status_name",
      key: "status_name",
      width: 210,
      render: (value: OrderStatus) => formatEnumCode(value),
    },
    { title: "Дата статуса", dataIndex: "status_date", key: "status_date", width: 140, render: (value) => value ?? "-" },
    { title: "Комментарий", dataIndex: "comment", key: "comment", render: (value) => value ?? "-" },
    {
      title: "Изменил",
      dataIndex: "changed_by_user_id",
      key: "changed_by_user_id",
      width: 120,
      render: (value) => value ?? "-",
    },
  ];

  const chatColumns: ColumnsType<OrderChatMessage> = [
    { title: "Время", dataIndex: "created_at", key: "created_at", width: 200 },
    {
      title: "Автор",
      key: "author",
      width: 260,
      render: (_, row) => [row.author_full_name, row.author_role_name].filter(Boolean).join(" / ") || "-",
    },
    {
      title: "Клиент",
      dataIndex: "is_from_client",
      key: "is_from_client",
      width: 100,
      render: (value: boolean) => (value ? "Да" : "Нет"),
    },
    { title: "Сообщение", dataIndex: "message", key: "message" },
  ];

  const goodsLines = useMemo(() => order?.goods_lines ?? [], [order?.goods_lines]);

  async function handleDocumentDownload(row: OrderDocument) {
    const fallbackName = row.file_name || `order-${orderId}-document-${row.id}`;
    setDownloadingDocumentId(row.id);
    try {
      await downloadFileWithCredentials(`/api/orders/${orderId}/documents/${row.id}/download`, fallbackName);
    } catch (error) {
      message.error(getFileOperationErrorMessage(error, "Ошибка скачивания документа"));
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  async function handleCertificateDownload() {
    setCertificateDownloadPending(true);
    try {
      await downloadFileWithCredentials(`/api/orders/${orderId}/certificate/download`, `order-${orderId}-certificate`);
    } catch (error) {
      message.error(getFileOperationErrorMessage(error, "Ошибка скачивания сертификата"));
    } finally {
      setCertificateDownloadPending(false);
    }
  }

  if (orderQuery.isLoading) {
    return <Card className="crm-panel" loading />;
  }

  if (orderQuery.error || !order) {
    return (
      <Card className="crm-panel">
        <Typography.Text type="danger">
          {orderQuery.error instanceof ApiError ? orderQuery.error.detail : "Заказ не найден"}
        </Typography.Text>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title={`Заказ #${order.id}`}
        subtitle="Aggregate order card: данные, действия, чат и файлы"
        actions={<Link href="/orders">Назад к заказам</Link>}
      />

      <Card className="crm-panel" title="Общие данные">
        <Descriptions bordered size="small" column={screens.lg ? 3 : 1}>
          <Descriptions.Item label="Номер заказа">{renderOrderNumber(order.order_number)}</Descriptions.Item>
          <Descriptions.Item label="Статус">{renderOrderStatus(order.status_name)}</Descriptions.Item>
          <Descriptions.Item label="Тип заказа">{order.order_type ? formatEnumCode(order.order_type) : "-"}</Descriptions.Item>
          <Descriptions.Item label="Компания">{order.client?.company_name ?? order.company_id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Клиент">{order.client?.user_full_name ?? order.user_id}</Descriptions.Item>
          <Descriptions.Item label="Фабрика">{order.factory?.factory_name ?? order.factory_id}</Descriptions.Item>
          <Descriptions.Item label="Рейс">{order.trip_name ?? order.trip_id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Экспедитор">{order.assigned_forwarder?.full_name ?? order.assigned_forwarder_user_id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Инвойс">{order.invoice_number ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата заказа">{order.order_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата готовности">{order.ready_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата вывоза">{order.pickup_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Активен дней">{order.days_active ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дней в статусе">{order.days_in_current_status ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Коэф. цены">{order.price_coefficient ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Коэф. веса">{order.weight_coefficient ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Последний запрос на фабрику">{order.latest_factory_request_at ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Комментарий" span={screens.lg ? 3 : 1}>
            {order.comment ?? "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="crm-panel" title="Операционные действия">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Form form={patchForm} layout="vertical" onFinish={(values: { comment?: string }) => patchMutation.mutate(values)}>
            <Form.Item name="comment" label="Комментарий">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={patchMutation.isPending}>
              Сохранить комментарий
            </Button>
          </Form>

          <Divider />

          <Form
            form={statusForm}
            layout="vertical"
            onFinish={(values: { status_name: OrderStatus }) => statusMutation.mutate(values)}
          >
            <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}> 
              <Select
                options={ORDER_STATUS_VALUES.map((status) => ({
                  label: formatEnumCode(status),
                  value: status,
                }))}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={statusMutation.isPending}>
              Обновить статус
            </Button>
          </Form>

          <Divider />

          <Form
            form={assignTripForm}
            layout="vertical"
            onFinish={(values: { trip_id?: number }) => assignTripMutation.mutate(values)}
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
            <Button type="primary" htmlType="submit" loading={assignTripMutation.isPending}>
              Сохранить рейс
            </Button>
          </Form>

          <Divider />

          <Form
            form={assignForwarderForm}
            layout="vertical"
            onFinish={(values: { assigned_forwarder_user_id?: number }) => assignForwarderMutation.mutate(values)}
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
            <Button type="primary" htmlType="submit" loading={assignForwarderMutation.isPending}>
              Назначить экспедитора
            </Button>
          </Form>

          <Divider />

          <Form form={pickupForm} layout="vertical" onFinish={(values: { pickup_date?: string }) => pickupMutation.mutate(values)}>
            <Form.Item name="pickup_date" label="Дата вывоза (пусто = отменить)">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={pickupMutation.isPending}>
              Обновить дату вывоза
            </Button>
          </Form>

          <Divider />

          <Form
            form={specialTariffForm}
            layout="vertical"
            onFinish={(values: { amount?: number; currency?: string }) => specialTariffMutation.mutate(values)}
          >
            <Form.Item name="amount" label="Спецтариф (пусто = очистить)">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="Валюта" rules={[{ required: true }]}> 
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={specialTariffMutation.isPending}>
              Обновить спецтариф
            </Button>
          </Form>

          <Divider />

          <Form
            form={requestToFactoryForm}
            layout="vertical"
            onFinish={(values: { comment?: string; template_id?: number }) => requestToFactoryMutation.mutate(values)}
          >
            <Form.Item name="comment" label="Комментарий к запросу">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="template_id" label="ID email шаблона (опционально)">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={requestToFactoryMutation.isPending}>
              Отправить запрос на фабрику
            </Button>
          </Form>
        </Space>
      </Card>

      <Card className="crm-panel" title="Товары">
        {goodsLines.length ? (
          <Table
            rowKey="id"
            dataSource={goodsLines}
            pagination={false}
            columns={[
              { title: "ID", dataIndex: "id", key: "id", width: 80 },
              { title: "Товар", dataIndex: "product_name", key: "product_name", render: (v) => v ?? "-" },
              { title: "Описание", dataIndex: "description", key: "description", render: (v) => v ?? "-" },
              { title: "Вес кг", dataIndex: "weight_kg", key: "weight_kg", width: 120, render: (v) => v ?? "-" },
              { title: "Кол-во", dataIndex: "quantity", key: "quantity", width: 120, render: (v) => v ?? "-" },
              { title: "Ед.", dataIndex: "unit", key: "unit", width: 100, render: (v) => v ?? "-" },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">Нет строк товаров</Typography.Text>
        )}
      </Card>

      <Card className="crm-panel" title="Документы">
        <Form
          form={documentUploadForm}
          layout="vertical"
          onFinish={(values: { document_type?: string; display_name?: string; file?: FileList }) =>
            uploadDocumentMutation.mutate(values)
          }
        >
          <Form.Item name="document_type" label="Тип документа">
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label="Отображаемое имя">
            <Input />
          </Form.Item>
          <Form.Item
            name="file"
            label="Файл"
            valuePropName="fileList"
            getValueFromEvent={(event) => (event?.target?.files as FileList | undefined) || undefined}
            rules={[{ required: true, message: "Выберите файл" }]}
          >
            <Input type="file" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={uploadDocumentMutation.isPending}>
            Загрузить документ
          </Button>
        </Form>

        <Divider />

        <Table<OrderDocument>
          rowKey="id"
          loading={documentsFallbackQuery.isLoading}
          dataSource={documents}
          columns={documentColumns}
          pagination={false}
          locale={{ emptyText: "Нет документов" }}
        />
      </Card>

      <Card className="crm-panel" title="Сертификат">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Descriptions bordered size="small" column={screens.lg ? 2 : 1}>
            <Descriptions.Item label="Номер">{certificate?.number ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Статус">{certificate?.status ? formatEnumCode(certificate.status) : "-"}</Descriptions.Item>
            <Descriptions.Item label="Выдан">{certificate?.issued_date ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Истекает">{certificate?.expires_date ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Файл" span={screens.lg ? 2 : 1}>
              {certificate?.file_path ? (
                <Button
                  size="small"
                  type="link"
                  loading={certificateDownloadPending}
                  onClick={() => {
                    void handleCertificateDownload();
                  }}
                >
                  Скачать сертификат
                </Button>
              ) : (
                "-"
              )}
            </Descriptions.Item>
          </Descriptions>

          <Form
            form={certificateMetaForm}
            layout="vertical"
            onFinish={(values: { number?: string; status?: string; issued_date?: string; expires_date?: string }) =>
              patchCertificateMetaMutation.mutate(values)
            }
          >
            <Form.Item name="number" label="Номер">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Статус">
              <Input />
            </Form.Item>
            <Form.Item name="issued_date" label="Дата выдачи (YYYY-MM-DD)">
              <Input />
            </Form.Item>
            <Form.Item name="expires_date" label="Дата окончания (YYYY-MM-DD)">
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={patchCertificateMetaMutation.isPending}>
              Обновить метаданные сертификата
            </Button>
          </Form>

          <Divider />

          <Form
            form={certificateFileForm}
            layout="vertical"
            onFinish={(values: { file?: FileList }) => patchCertificateFileMutation.mutate(values)}
          >
            <Form.Item
              name="file"
              label="Новый файл сертификата"
              valuePropName="fileList"
              getValueFromEvent={(event) => (event?.target?.files as FileList | undefined) || undefined}
              rules={[{ required: true, message: "Выберите файл" }]}
            >
              <Input type="file" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={patchCertificateFileMutation.isPending}>
              Загрузить файл сертификата
            </Button>
          </Form>
        </Space>
      </Card>

      <Card className="crm-panel" title="История статусов">
        <Table<OrderStatusHistoryItem>
          rowKey="id"
          loading={statusFallbackQuery.isLoading}
          dataSource={statusHistory}
          columns={statusColumns}
          pagination={false}
          locale={{ emptyText: "Нет записей" }}
        />
      </Card>

      <Card className="crm-panel" title="Чат по заказу">
        <Form
          form={chatForm}
          layout="vertical"
          onFinish={(values: { message: string }) => postChatMutation.mutate(values)}
        >
          <Form.Item name="message" label="Сообщение" rules={[{ required: true }]}> 
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={postChatMutation.isPending}>
            Отправить
          </Button>
        </Form>

        <Divider />

        <Table<OrderChatMessage>
          rowKey="id"
          loading={chatFallbackQuery.isLoading}
          dataSource={chatMessages}
          columns={chatColumns}
          pagination={false}
          locale={{ emptyText: "Нет сообщений" }}
        />
      </Card>
    </Space>
  );
}
