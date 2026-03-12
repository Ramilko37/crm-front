"use client";

import {
  ApartmentOutlined,
  CarOutlined,
  LogoutOutlined,
  OrderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Grid, Layout, Menu, Space, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";

const { Header, Sider, Content } = Layout;

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);

  const meQuery = useCurrentUser(true);

  useEffect(() => {
    if (!meQuery.error) {
      return;
    }

    const error = meQuery.error;
    if (error instanceof ApiError && error.status === 401) {
      void apiRequest("/api/auth/logout", { method: "POST" }).finally(() => {
        router.replace("/login");
      });
    }
  }, [meQuery.error, router]);

  const selectedKey = useMemo(() => {
    if (pathname.startsWith("/orders")) return "/orders";
    if (pathname.startsWith("/factories")) return "/factories";
    if (pathname.startsWith("/trips")) return "/trips";
    if (pathname.startsWith("/profile")) return "/profile";
    return "/orders";
  }, [pathname]);

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries();
      router.replace("/login");
    } catch {
      message.error("Не удалось выйти из системы");
    }
  }

  const effectiveCollapsed = screens.lg ? collapsed : true;

  return (
    <Layout className="crm-layout">
      <Sider
        width={250}
        collapsedWidth={72}
        theme="light"
        collapsible
        collapsed={effectiveCollapsed}
        onCollapse={(next) => {
          if (screens.lg) {
            setCollapsed(next);
          }
        }}
      >
        <div className="crm-logo">CRM</div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: "/orders",
              icon: <OrderedListOutlined />,
              label: <Link href="/orders">Заказы</Link>,
            },
            {
              key: "/factories",
              icon: <ApartmentOutlined />,
              label: <Link href="/factories">Фабрики</Link>,
            },
            {
              key: "/trips",
              icon: <CarOutlined />,
              label: <Link href="/trips">Рейсы</Link>,
            },
            {
              key: "/profile",
              icon: <UserOutlined />,
              label: <Link href="/profile">Профиль</Link>,
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header className="crm-header">
          <Space>
            <Avatar icon={<UserOutlined />} />
            <div>
              <Typography.Text strong>
                {meQuery.data?.username ?? "Пользователь"}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {meQuery.data?.is_superuser ? "Администратор" : "Пользователь"}
              </Typography.Text>
            </div>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Выйти
          </Button>
        </Header>

        <Content className="crm-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
