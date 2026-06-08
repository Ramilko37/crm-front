"use client";

import { Checkbox, DatePicker, Form, Select } from "antd";

import {
  LOADING_POINT_TYPE_VALUES,
  type LoadingPointType,
} from "@/shared/lib/domain-enums";
import {
  formatFactoryLocationLabel,
  formatLoadingPointType,
  formatPathPointLocationLabel,
  type LoadingPointFormValues,
} from "@/shared/lib/trip-point-forms";
import type { Factory, PathPoint } from "@/shared/types/entities";

type LoadingPointFormFieldsProps = {
  form: ReturnType<typeof Form.useForm<LoadingPointFormValues>>[0];
  factories: Factory[];
  pathPoints: PathPoint[];
  factoriesLoading?: boolean;
  pathPointsLoading?: boolean;
};

export function LoadingPointFormFields({
  form,
  factories,
  pathPoints,
  factoriesLoading,
  pathPointsLoading,
}: LoadingPointFormFieldsProps) {
  const loadingPointType = Form.useWatch("loading_point_type", form);

  return (
    <>
      <Form.Item name="loading_point_type" label="Тип" rules={[{ required: true }]}>
        <Select
          options={LOADING_POINT_TYPE_VALUES.map((value) => ({
            label: formatLoadingPointType(value),
            value,
          }))}
          onChange={(value: LoadingPointType) => {
            form.setFieldValue("loading_point_type", value);
            form.setFieldValue("location_id", undefined);
          }}
        />
      </Form.Item>

      {loadingPointType === "factory" ? (
        <Form.Item
          name="location_id"
          label="Фабрика"
          rules={[{ required: true, message: "Выберите фабрику" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={factoriesLoading}
            placeholder="Выберите фабрику"
            options={factories.map((factory) => ({
              label: formatFactoryLocationLabel(factory),
              value: factory.id,
            }))}
          />
        </Form.Item>
      ) : (
        <Form.Item
          name="location_id"
          label="Склад экспедитора"
          rules={[{ required: true, message: "Выберите склад" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={pathPointsLoading}
            placeholder="Выберите склад"
            options={pathPoints.map((pathPoint) => ({
              label: formatPathPointLocationLabel(pathPoint),
              value: pathPoint.id,
            }))}
          />
        </Form.Item>
      )}

      <Form.Item name="planned_loading_at" label="Дата загрузки">
        <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
      </Form.Item>
      <Form.Item name="actual_loading_at" label="Актуальная дата загрузки">
        <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
      </Form.Item>
      <Form.Item name="is_completed" valuePropName="checked" style={{ marginBottom: 12 }}>
        <Checkbox>Завершено</Checkbox>
      </Form.Item>
    </>
  );
}
