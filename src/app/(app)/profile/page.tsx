"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Switch,
  Typography,
} from "antd";
import { useEffect } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { PageHeader } from "@/shared/ui/page-frame";
import type { UserPasswordChangePayload, UserProfile, UserProfileUpdatePayload } from "@/shared/types/entities";

type ProfileForm = UserProfileUpdatePayload & {
  login: string;
};

type PasswordForm = UserPasswordChangePayload;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const authQuery = useCurrentUser(true);
  const { message } = App.useApp();
  const [profileForm] = Form.useForm<ProfileForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();

  const profileQuery = useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => apiRequest<UserProfile>("/api/users/me"),
    enabled: Boolean(authQuery.data && !authQuery.data.is_superuser),
    retry: false,
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    profileForm.setFieldsValue({
      login: profileQuery.data.login,
      full_name: profileQuery.data.full_name,
      email: profileQuery.data.email ?? undefined,
      phone: profileQuery.data.phone ?? undefined,
      country: profileQuery.data.country ?? undefined,
      city: profileQuery.data.city ?? undefined,
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

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
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
                  receives_newsletter: values.receives_newsletter,
                  exclude_from_promotions: values.exclude_from_promotions,
                });
              }}
            >
              <Form.Item name="login" label="Логин">
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
              <Form.Item name="country" label="Страна">
                <Input />
              </Form.Item>
              <Form.Item name="city" label="Город">
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
