"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Form, Grid, Input, Select, Space, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import type { Order, PaginatedResponse, Trip } from "@/shared/types/entities";

const statusOptions = [
  "new",
  "processing",
  "ready",
  "in_transit",
  "in_moscow",
  "archived",
  "in_review",
];

const statusLabels: Record<string, string> = {
  new: "Новый",
  processing: "В обработке",
  ready: "Готов",
  in_transit: "В пути",
  in_moscow: "В Москве",
  archived: "В архиве",
  in_review: "На проверке",
};

const statusTagColors: Record<string, string> = {
  new: "blue",
  processing: "gold",
  ready: "green",
  in_transit: "cyan",
  in_moscow: "geekblue",
  archived: "default",
  in_review: "purple",
};

function formatOrderStatus(value: string | null) {
  if (!value) return "-";
  return statusLabels[value] ?? value;
}

function renderOrderStatus(value: string | null) {
  if (!value) {
    return <Tag className="crm-status-tag">-</Tag>;
  }

  return (
    <Tag color={statusTagColors[value] ?? "default"} className="crm-status-tag">
      {formatOrderStatus(value)}
    </Tag>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [patchForm] = Form.useForm<{ comment?: string }>();
  const [statusForm] = Form.useForm<{ status_name: string }>();
  const [assignForm] = Form.useForm<{ trip_id?: number }>();

  const orderQuery = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => apiRequest<Order>(`/api/orders/${orderId}`),
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list({ page: 1, page_size: 200 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Trip>>("/api/trips", {
        query: { page: 1, page_size: 200 },
      }),
  });

  const patchMutation = useMutation({
    mutationFn: (payload: { comment?: string }) =>
      apiRequest<Order>(`/api/orders/${orderId}`, {
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
    mutationFn: (payload: { status_name: string }) =>
      apiRequest<Order>(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Статус обновлен");
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления статуса");
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { trip_id?: number }) =>
      apiRequest<Order>(`/api/orders/${orderId}/assign-trip`, {
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

  const order = orderQuery.data;

  useEffect(() => {
    if (!order) {
      return;
    }
    patchForm.setFieldsValue({ comment: order.comment ?? "" });
    statusForm.setFieldsValue({ status_name: order.status_name ?? undefined });
    assignForm.setFieldsValue({ trip_id: order.trip_id ?? undefined });
  }, [assignForm, order, patchForm, statusForm]);

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
      <Card className="crm-panel">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Typography.Title level={2} className="crm-page-title">
              Заказ #{order.id}
            </Typography.Title>
            <Typography.Paragraph className="crm-page-subtitle">
              Детальная карточка заказа, статусные операции и привязка к рейсу.
            </Typography.Paragraph>
          </div>
          <Link href="/orders">Назад к заказам</Link>
        </Space>
      </Card>

      <Card className="crm-panel" title="Общие данные">
        <Descriptions bordered size="small" column={screens.lg ? 2 : 1}>
          <Descriptions.Item label="Номер заказа">{order.order_number}</Descriptions.Item>
          <Descriptions.Item label="Статус">{renderOrderStatus(order.status_name)}</Descriptions.Item>
          <Descriptions.Item label="ID пользователя">{order.user_id}</Descriptions.Item>
          <Descriptions.Item label="ID фабрики">{order.factory_id}</Descriptions.Item>
          <Descriptions.Item label="ID рейса">{order.trip_id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Инвойс">{order.invoice_number ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Страна">{order.country ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="MRN">{order.mrn ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата заказа">{order.order_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата готовности">{order.ready_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Дата статуса">{order.status_date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Комментарий">{order.comment ?? "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="crm-panel" title="Изменить комментарий">
        <Form
          form={patchForm}
          layout="vertical"
          onFinish={(values: { comment?: string }) => patchMutation.mutate(values)}
        >
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={patchMutation.isPending}>
            Сохранить
          </Button>
        </Form>
      </Card>

      <Card className="crm-panel" title="Изменить статус">
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={(values: { status_name: string }) => statusMutation.mutate(values)}
        >
          <Form.Item name="status_name" label="Статус" rules={[{ required: true }]}>
            <Select
              options={statusOptions.map((status) => ({
                label: formatOrderStatus(status),
                value: status,
              }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={statusMutation.isPending}>
            Обновить статус
          </Button>
        </Form>
      </Card>

      <Card className="crm-panel" title="Назначить рейс">
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values: { trip_id?: number }) => assignMutation.mutate(values)}
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
          <Button type="primary" htmlType="submit" loading={assignMutation.isPending}>
            Сохранить рейс
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
