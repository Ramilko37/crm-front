"use client";

import { App, Button, Card, Form, Input, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ApiError } from "@/shared/lib/errors";
import { apiRequest } from "@/shared/lib/api";
import type { AuthTokenResponse } from "@/shared/types/entities";

function LoginPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const nextPath = searchParams.get("next") || "/orders";

  async function handleSubmit(values: { username: string; password: string }) {
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
      <Card className="login-card">
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          CRM Front
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Войдите под учетной записью backend (`root` / `root` по умолчанию).
        </Typography.Paragraph>

        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Логин" name="username" rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
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
          <Card className="login-card" loading />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
