"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Select } from "antd";

import { apiRequest } from "@/shared/lib/api";
import { formatEnumCode, TRIP_STATUS_VALUES, type TripStatus } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import type { Trip } from "@/shared/types/entities";

type TripCreateForm = {
  name: string;
  truck_plate?: string;
  truck_company_name?: string;
  status_name?: TripStatus;
};

type TripCreateWizardModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TripCreateWizardModal({ open, onClose }: TripCreateWizardModalProps) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<TripCreateForm>();

  const createTripMutation = useMutation({
    mutationFn: (payload: TripCreateForm) =>
      apiRequest<Trip>("/api/trips", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Рейс создан");
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      onClose();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания рейса");
    },
  });

  return (
    <Modal
      title="Создать рейс"
      open={open}
      width={640}
      destroyOnHidden
      okText="Создать"
      cancelText="Отмена"
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={createTripMutation.isPending}
    >
      <Form<TripCreateForm>
        form={form}
        layout="vertical"
        onFinish={(values) => createTripMutation.mutate(values)}
      >
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
    </Modal>
  );
}
