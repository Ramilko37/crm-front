"use client";

import { App, Button, Card, Form, Input, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import type { AuthTokenResponse } from "@/shared/types/entities";

function LoginPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const nextPath = searchParams.get("next") || "/orders";

  async function handleSubmit(values: { login: string; password: string }) {
    setLoading(true);
    try {
      await apiRequest<AuthTokenResponse>("/api/auth/login", {
        method: "POST",
        body: values,
      });
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        message.error(error.detail);
      } else {
        message.error("Ошибка авторизации");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <Card className="login-card crm-panel">
        <div className="login-eyebrow">CRM</div>
        <Typography.Title level={2} style={{ marginBottom: 6, marginTop: 0 }}>
          Вход в систему
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Авторизуйтесь, чтобы перейти в рабочий контур CRM.
        </Typography.Paragraph>

        <Form layout="vertical" onFinish={handleSubmit} size="large">
          <Form.Item label="Логин" name="login" rules={[{ required: true }]}>
            <Input autoComplete="username" placeholder="Введите логин" />
          </Form.Item>

          <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" placeholder="Введите пароль" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Войти
          </Button>
        </Form>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <Card className="login-card crm-panel" loading />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
