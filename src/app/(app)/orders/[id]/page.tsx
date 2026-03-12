"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Form, Input, Select, Space, Typography } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import type { Order, Trip, PaginatedResponse } from "@/shared/types/entities";

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

function formatOrderStatus(value: string | null) {
  if (!value) return "-";
  return statusLabels[value] ?? value;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
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
      message.success("Статус обновлён");
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

  if (orderQuery.isLoading) {
    return <Card loading />;
  }

  if (orderQuery.error || !order) {
    return (
      <Card>
        <Typography.Text type="danger">
          {orderQuery.error instanceof ApiError ? orderQuery.error.detail : "Заказ не найден"}
        </Typography.Text>
      </Card>
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Заказ #{order.id}
          </Typography.Title>
          <Button type="link">
            <Link href="/orders">Назад к заказам</Link>
          </Button>
        </Space>
      </Card>

      <Card>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Номер заказа">{order.order_number}</Descriptions.Item>
          <Descriptions.Item label="Статус">{formatOrderStatus(order.status_name)}</Descriptions.Item>
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

      <Card title="Изменить комментарий">
        <Form
          form={patchForm}
          layout="vertical"
          initialValues={{ comment: order.comment ?? "" }}
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

      <Card title="Изменить статус">
        <Form
          form={statusForm}
          layout="vertical"
          initialValues={{ status_name: order.status_name ?? undefined }}
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

      <Card title="Назначить рейс">
        <Form
          form={assignForm}
          layout="vertical"
          initialValues={{ trip_id: order.trip_id ?? undefined }}
          onFinish={(values: { trip_id?: number }) => assignMutation.mutate(values)}
        >
          <Form.Item name="trip_id" label="Рейс">
            <Select
              allowClear
              loading={tripsQuery.isLoading}
              options={(tripsQuery.data?.items ?? []).map((trip) => ({
                label: `${trip.id} — ${trip.name}`,
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
