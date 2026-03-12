"use client";

import { Card, Descriptions, Space, Typography } from "antd";

import { useCurrentUser } from "@/features/auth/use-current-user";

export default function ProfilePage() {
  const meQuery = useCurrentUser(true);

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <Card className="crm-panel" loading={meQuery.isLoading}>
        <Typography.Title level={2} className="crm-page-title">
          Профиль
        </Typography.Title>
        <Typography.Paragraph className="crm-page-subtitle">
          Данные текущего пользователя и уровень системного доступа.
        </Typography.Paragraph>
      </Card>

      <Card className="crm-panel" loading={meQuery.isLoading} title="Учетная запись">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Логин">{meQuery.data?.username ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Администратор">
            {meQuery.data?.is_superuser ? "Да" : "Нет"}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
