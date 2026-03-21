"use client";

import {
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Drawer, Grid, Layout, Menu, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { normalizeRoleName } from "@/shared/lib/rbac";

const { Header, Content } = Layout;

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
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
        label: "Заказы",
      },
      {
        key: "/factories",
        label: "Фабрики",
      },
      {
        key: "/trips",
        label: "Рейсы",
      },
      {
        key: "/profile",
        label: "Профиль",
      },
    ],
    [],
  );

  const roleLabelByName: Record<string, string> = {
    administrator: "Администратор",
    logist: "Логист",
    accountant: "Бухгалтер",
    forwarder: "Экспедитор",
    warehouse: "Склад",
    client: "Клиент",
    anonymous: "Пользователь",
  };

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries();
      router.replace("/login");
    } catch {
      message.error("Не удалось выйти из системы");
    }
  }

  function handleMenuClick(key: string) {
    router.push(key);
    setMobileMenuOpen(false);
  }

  return (
    <Layout className="crm-layout crm-layout-topnav">
      <Header className="crm-top-nav">
        <div className="crm-top-nav-shell">
          <div className="crm-top-nav-left">
            {!screens.md ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                aria-label="Открыть меню"
                onClick={() => setMobileMenuOpen(true)}
              />
            ) : null}

            <button className="crm-brand" onClick={() => handleMenuClick("/orders")}>
              CRM
            </button>

            {screens.md ? (
              <Menu
                mode="horizontal"
                selectedKeys={[selectedKey]}
                items={menuItems}
                className="crm-top-nav-menu"
                onClick={({ key }) => handleMenuClick(String(key))}
              />
            ) : null}
          </div>

          <div className="crm-top-nav-right">
            <div className="crm-user-chip">
              <Avatar size={28} icon={<UserOutlined />} />
              <div className="crm-user-chip-meta">
                <Typography.Text strong ellipsis style={{ maxWidth: 170 }}>
                  {meQuery.data?.full_name || meQuery.data?.login || "Пользователь"}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {meQuery.data?.is_superuser
                    ? "Суперпользователь"
                    : roleLabelByName[normalizeRoleName(meQuery.data?.role_name)] ?? "Пользователь"}
                </Typography.Text>
              </div>
            </div>

            <Button icon={<LogoutOutlined />} size="small" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>
      </Header>

      <Drawer
        title="Навигация"
        placement="left"
        width={270}
        open={!screens.md && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(String(key))}
        />
      </Drawer>

      <Content className="crm-content">{children}</Content>
    </Layout>
  );
}
