"use client";

import { Card, Descriptions, Typography } from "antd";

import { useCurrentUser } from "@/features/auth/use-current-user";

export default function ProfilePage() {
  const meQuery = useCurrentUser(true);

  return (
    <Card loading={meQuery.isLoading}>
      <Typography.Title level={3}>Профиль</Typography.Title>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Логин">{meQuery.data?.username ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Администратор">
          {meQuery.data?.is_superuser ? "Да" : "Нет"}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
