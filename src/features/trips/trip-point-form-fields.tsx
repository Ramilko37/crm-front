"use client";

import { Checkbox, DatePicker, Form, Select, Segmented } from "antd";

import {
  formatFactoryLocationLabel,
  formatForwarderLocationLabel,
  formatPathPointLocationLabel,
  type TripLoadingSource,
  type TripPointFormValues,
  type TripPointKind,
} from "@/shared/lib/trip-point-forms";
import type { Country, Factory, PathPoint, TripForwarderLookupItem } from "@/shared/types/entities";

type TripPointFormFieldsProps = {
  form: ReturnType<typeof Form.useForm<TripPointFormValues>>[0];
  countries: Country[];
  cities: string[];
  factories: Factory[];
  forwarders: TripForwarderLookupItem[];
  pathPoints: PathPoint[];
  countriesLoading?: boolean;
  citiesLoading?: boolean;
  factoriesLoading?: boolean;
  forwardersLoading?: boolean;
  pathPointsLoading?: boolean;
  onCountrySearch?: (value: string) => void;
  onCitySearch?: (value: string) => void;
  onFactorySearch?: (value: string) => void;
  onForwarderSearch?: (value: string) => void;
};

export function TripPointFormFields({
  form,
  countries,
  cities,
  factories,
  forwarders,
  pathPoints,
  countriesLoading,
  citiesLoading,
  factoriesLoading,
  forwardersLoading,
  pathPointsLoading,
  onCountrySearch,
  onCitySearch,
  onFactorySearch,
  onForwarderSearch,
}: TripPointFormFieldsProps) {
  const pointKind = Form.useWatch("point_kind", form) ?? "path";
  const loadingSource = Form.useWatch("loading_source", form) ?? "factory";
  const selectedCountryId = Form.useWatch("country_id", form);
  const selectedCity = Form.useWatch("city", form);

  return (
    <>
      <Form.Item name="point_kind" label="Тип точки" rules={[{ required: true }]}>
        <Segmented
          block
          options={[
            { label: "Маршрут", value: "path" },
            { label: "Погрузка", value: "loading" },
          ]}
          onChange={(value) => {
            const nextKind = value as TripPointKind;
            form.setFieldsValue({
              point_kind: nextKind,
              loading_source: nextKind === "loading" ? "factory" : undefined,
              path_point_id: undefined,
              country_id: undefined,
              city: undefined,
              factory_id: undefined,
              forwarder_user_id: undefined,
              country: undefined,
            });
          }}
        />
      </Form.Item>

      {pointKind === "path" ? (
        <Form.Item
          name="path_point_id"
          label="Маршрутная точка"
          rules={[{ required: true, message: "Выберите маршрутную точку" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={pathPointsLoading}
            placeholder="Выберите из справочника"
            options={pathPoints.map((point) => ({
              label: formatPathPointLocationLabel(point),
              value: point.id,
            }))}
          />
        </Form.Item>
      ) : (
        <>
          <Form.Item name="loading_source" label="Источник погрузки" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { label: "Фабрика", value: "factory" },
                { label: "Экспедитор", value: "forwarder" },
              ]}
              onChange={(value) => {
                form.setFieldsValue({
                  loading_source: value as TripLoadingSource,
                  country_id: undefined,
                  city: undefined,
                  factory_id: undefined,
                  forwarder_user_id: undefined,
                  country: undefined,
                });
              }}
            />
          </Form.Item>

          <Form.Item name="country_id" label="Страна" rules={[{ required: true, message: "Выберите страну" }]}>
            <Select
              showSearch
              filterOption={false}
              loading={countriesLoading}
              placeholder="Выберите страну"
              options={countries.map((country) => ({
                label: country.name_ru,
                value: country.id,
              }))}
              onSearch={onCountrySearch}
              onChange={(value) => {
                const country = countries.find((item) => item.id === value);
                form.setFieldsValue({
                  country_id: value,
                  country: country?.name_ru,
                  city: undefined,
                  factory_id: undefined,
                  forwarder_user_id: undefined,
                });
              }}
            />
          </Form.Item>

          <Form.Item name="city" label="Город" rules={[{ required: true, message: "Выберите город" }]}>
            <Select
              showSearch
              filterOption={false}
              loading={citiesLoading}
              placeholder="Выберите город"
              disabled={!selectedCountryId}
              options={cities.map((city) => ({
                label: city,
                value: city,
              }))}
              onSearch={onCitySearch}
              onChange={(value) => {
                form.setFieldsValue({
                  city: value,
                  factory_id: undefined,
                  forwarder_user_id: undefined,
                });
              }}
            />
          </Form.Item>

          {loadingSource === "forwarder" ? (
            <Form.Item
              name="forwarder_user_id"
              label="Название компании экспедитора"
              rules={[{ required: true, message: "Выберите экспедитора" }]}
            >
              <Select
                showSearch
                filterOption={false}
                loading={forwardersLoading}
                placeholder="Выберите экспедитора"
                disabled={!selectedCountryId || !selectedCity}
                options={forwarders.map((forwarder) => ({
                  label: formatForwarderLocationLabel(forwarder),
                  value: forwarder.id,
                }))}
                onSearch={onForwarderSearch}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="factory_id"
              label="Фабрика"
              rules={[{ required: true, message: "Выберите фабрику" }]}
            >
              <Select
                showSearch
                filterOption={false}
                loading={factoriesLoading}
                placeholder="Выберите фабрику"
                disabled={!selectedCountryId || !selectedCity}
                options={factories.map((factory) => ({
                  label: formatFactoryLocationLabel(factory),
                  value: factory.id,
                }))}
                onSearch={onFactorySearch}
              />
            </Form.Item>
          )}
        </>
      )}

      <Form.Item name="planned_at" label={pointKind === "path" ? "Плановая дата" : "Дата прохождения"}>
        <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
      </Form.Item>
      <Form.Item name="actual_at" label="Актуальная дата">
        <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
      </Form.Item>
      <Form.Item name="is_completed" valuePropName="checked" style={{ marginBottom: 12 }}>
        <Checkbox>Завершено</Checkbox>
      </Form.Item>
    </>
  );
}
