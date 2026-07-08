"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  AutoComplete,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Switch,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { requiredWhenForwarder } from "@/shared/lib/user-flow";
import { PageHeader } from "@/shared/ui/page-frame";
import type {
  Country,
  PaginatedResponse,
  UserCityLookupItem,
  UserPasswordChangePayload,
  UserProfile,
  UserProfileUpdatePayload,
} from "@/shared/types/entities";

type ProfileForm = UserProfileUpdatePayload & {
  login: string;
  company_name?: string;
  selectedCountryId?: number;
};

type PasswordForm = UserPasswordChangePayload;

function extractItems<T>(response: T[] | { items?: T[] } | undefined): T[] {
  if (!response) return [];
  return Array.isArray(response) ? response : (response.items ?? []);
}

function countryLabel(country: Country) {
  return country.name_en || country.name_ru;
}

function optionCountryId(option: unknown) {
  const maybeOption = option as { countryId?: number };
  return maybeOption.countryId;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const authQuery = useCurrentUser(true);
  const { message } = App.useApp();
  const [profileForm] = Form.useForm<ProfileForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const selectedCountryId = Form.useWatch("selectedCountryId", profileForm) as number | undefined;

  const profileQuery = useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => apiRequest<UserProfile>("/api/users/me"),
    enabled: Boolean(authQuery.data && !authQuery.data.is_superuser),
    retry: false,
  });
  const effectiveCountrySearch = countrySearch || profileQuery.data?.country || "";
  const effectiveCitySearch = citySearch || profileQuery.data?.city || "";

  const countriesQuery = useQuery({
    queryKey: queryKeys.countries.list({ query: effectiveCountrySearch || undefined, page: 1, page_size: 50 }),
    queryFn: () =>
      apiRequest<PaginatedResponse<Country>>("/api/countries", {
        query: { query: effectiveCountrySearch || undefined, page: 1, page_size: 50 },
      }),
    enabled: Boolean(authQuery.data && !authQuery.data.is_superuser),
  });

  const citiesQuery = useQuery({
    queryKey: queryKeys.users.lookupCities({ country_id: selectedCountryId, query: effectiveCitySearch || undefined }),
    queryFn: () =>
      apiRequest<UserCityLookupItem[] | { items: UserCityLookupItem[] }>("/api/users/lookups/cities", {
        query: { country_id: selectedCountryId, query: effectiveCitySearch || undefined },
      }),
    enabled: Boolean(selectedCountryId),
  });

  const countryOptions = useMemo(
    () =>
      (countriesQuery.data?.items ?? []).map((country) => ({
        label: countryLabel(country),
        value: countryLabel(country),
        countryId: country.id,
      })),
    [countriesQuery.data?.items],
  );

  const cityOptions = useMemo(
    () => extractItems(citiesQuery.data).map((item) => ({ label: item.city, value: item.city })),
    [citiesQuery.data],
  );

  useEffect(() => {
    if (selectedCountryId) return;
    const currentCountry = profileForm.getFieldValue("country");
    if (!currentCountry) return;

    const matchedCountry = countriesQuery.data?.items.find(
      (country) => country.name_ru === currentCountry || country.name_en === currentCountry,
    );
    if (matchedCountry) {
      profileForm.setFieldValue("selectedCountryId", matchedCountry.id);
    }
  }, [countriesQuery.data?.items, profileForm, selectedCountryId]);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    profileForm.setFieldsValue({
      login: profileQuery.data.login,
      company_name: profileQuery.data.company_name ?? undefined,
      full_name: profileQuery.data.full_name,
      email: profileQuery.data.email ?? undefined,
      phone: profileQuery.data.phone ?? undefined,
      country: profileQuery.data.country ?? undefined,
      city: profileQuery.data.city ?? undefined,
      address: profileQuery.data.address ?? undefined,
      selectedCountryId: undefined,
      receives_newsletter: profileQuery.data.receives_newsletter,
      exclude_from_promotions: profileQuery.data.exclude_from_promotions,
    });
  }, [profileForm, profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UserProfileUpdatePayload) =>
      apiRequest<UserProfile>("/api/users/me", {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Профиль обновлен");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.users.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
      ]);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось обновить профиль");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: UserPasswordChangePayload) =>
      apiRequest<null>("/api/users/me/password", {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: () => {
      message.success("Пароль обновлен");
      passwordForm.resetFields();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Не удалось обновить пароль");
    },
  });

  const authContext = authQuery.data;
  const isSuperuser = Boolean(authContext?.is_superuser);
  const profileRoleName = profileQuery.data?.role_name ?? authContext?.role_name;

  return (
    <Space orientation="vertical" size={16} className="crm-page-stack">
      <PageHeader title="Профиль" subtitle="Настройки персонального профиля и смена пароля." />

      <Card className="crm-panel" title="Контекст авторизации" loading={authQuery.isLoading}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="ID">{authContext?.id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="ID компании">{authContext?.company_id ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Логин">{authContext?.login ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Полное имя">{authContext?.full_name ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Роль">{authContext?.role_name ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Суперпользователь">
            {authContext?.is_superuser ? "Да" : "Нет"}
          </Descriptions.Item>
          <Descriptions.Item label="Активен">{authContext?.is_active ? "Да" : "Нет"}</Descriptions.Item>
        </Descriptions>
      </Card>

      {isSuperuser ? (
        <Card className="crm-panel">
          <Typography.Text>
            Для встроенного superuser endpoint `/users/me` не поддерживается. Используйте раздел
            пользователей в административном контуре.
          </Typography.Text>
        </Card>
      ) : (
        <>
          <Card className="crm-panel" title="Личные данные" loading={profileQuery.isLoading}>
            {profileQuery.error ? (
              <Typography.Text type="danger">
                {profileQuery.error instanceof ApiError
                  ? profileQuery.error.detail
                  : "Не удалось загрузить профиль"}
              </Typography.Text>
            ) : null}

            <Form
              form={profileForm}
              layout="vertical"
              onFinish={(values: ProfileForm) => {
                updateMutation.mutate({
                  full_name: values.full_name,
                  email: values.email,
                  phone: values.phone,
                  country: values.country,
                  city: values.city,
                  address: values.address,
                  receives_newsletter: values.receives_newsletter,
                  exclude_from_promotions: values.exclude_from_promotions,
                });
              }}
            >
              <Form.Item name="selectedCountryId" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="login" label="Логин">
                <Input disabled />
              </Form.Item>
              <Form.Item name="company_name" label="Компания">
                <Input disabled />
              </Form.Item>
              <Form.Item name="full_name" label="ФИО">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Телефон">
                <Input />
              </Form.Item>
              <Form.Item
                name="country"
                label="Страна"
                rules={[requiredWhenForwarder(profileRoleName, "Выберите страну")]}
              >
                <AutoComplete
                  allowClear
                  options={countryOptions}
                  placeholder="Начните вводить страну"
                  onSearch={setCountrySearch}
                  onSelect={(value, option) => {
                    profileForm.setFieldsValue({
                      country: value,
                      selectedCountryId: optionCountryId(option),
                      city: undefined,
                    });
                    setCitySearch("");
                  }}
                  onChange={(value) => {
                    profileForm.setFieldValue("country", value);
                    if (!value) {
                      profileForm.setFieldsValue({ selectedCountryId: undefined, city: undefined });
                      setCitySearch("");
                    }
                  }}
                />
              </Form.Item>
              <Form.Item
                name="city"
                label="Город"
                rules={[requiredWhenForwarder(profileRoleName, "Выберите город")]}
              >
                <AutoComplete
                  allowClear
                  disabled={!selectedCountryId}
                  options={cityOptions}
                  placeholder={selectedCountryId ? "Начните вводить город" : "Сначала выберите страну"}
                  onSearch={setCitySearch}
                />
              </Form.Item>
              <Form.Item
                name="address"
                label="Адрес"
                rules={[requiredWhenForwarder(profileRoleName, "Укажите адрес")]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="receives_newsletter" label="Получать рассылку" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                name="exclude_from_promotions"
                label="Исключить из промо-рассылок"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Сохранить изменения
              </Button>
            </Form>
          </Card>

          <Card className="crm-panel" title="Смена пароля">
            <Form<PasswordForm>
              form={passwordForm}
              layout="vertical"
              onFinish={(values) => changePasswordMutation.mutate(values)}
            >
              <Form.Item name="current_password" label="Текущий пароль" rules={[{ required: true }]}>
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Form.Item name="new_password" label="Новый пароль" rules={[{ required: true }]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={changePasswordMutation.isPending}>
                Обновить пароль
              </Button>
            </Form>
          </Card>
        </>
      )}
    </Space>
  );
}
