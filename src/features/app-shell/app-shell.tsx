"use client";

import {
  ApartmentOutlined,
  CarOutlined,
  LogoutOutlined,
  MenuOutlined,
  OrderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const menuItems = useMemo(
    () => [
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
    ],
    [],
  );

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries();
      router.replace("/login");
    } catch {
      message.error("Не удалось выйти из системы");
    }
  }

  return (
    <Layout className="crm-layout">
      {screens.lg ? (
        <Sider
          className="crm-sider"
          width={250}
          collapsedWidth={72}
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
        >
          <div className="crm-logo">
            <span className="crm-logo-dot" />
            <span>CRM</span>
          </div>
          <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
        </Sider>
      ) : (
        <Drawer
          title="CRM"
          placement="left"
          width={260}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={() => setMobileMenuOpen(false)}
          />
        </Drawer>
      )}

      <Layout>
        <Header className="crm-header">
          <Space>
            {!screens.lg ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                aria-label="Открыть меню"
                onClick={() => setMobileMenuOpen(true)}
              />
            ) : null}
            <div className="crm-header-user">
              <Avatar icon={<UserOutlined />} />
              <div className="crm-header-user-meta">
                <Typography.Text strong>
                  {meQuery.data?.username ?? "Пользователь"}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {meQuery.data?.is_superuser ? "Администратор" : "Пользователь"}
                </Typography.Text>
              </div>
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
