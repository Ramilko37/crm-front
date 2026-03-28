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
import { canAccessModule, getVisibleModules, normalizeRoleName, type AppModule } from "@/shared/lib/rbac";

const { Header, Content } = Layout;

type Props = {
  children: React.ReactNode;
};

type ModuleMenuConfig = {
  key: string;
  module: AppModule;
  label: string;
};

const MODULE_MENU_CONFIG: ModuleMenuConfig[] = [
  { key: "/orders", module: "orders", label: "Заказы" },
  { key: "/client-messages", module: "client-messages", label: "Сообщения" },
  { key: "/requests", module: "requests", label: "Заявки" },
  { key: "/path-points", module: "path-points", label: "Путевые точки" },
  { key: "/factories", module: "factories", label: "Фабрики" },
  { key: "/trips", module: "trips", label: "Рейсы" },
  { key: "/users", module: "users", label: "Пользователи" },
  { key: "/countries", module: "countries", label: "Страны" },
  { key: "/normative-documents", module: "normative-documents", label: "Нормативные документы" },
  { key: "/email-templates", module: "email-templates", label: "Email шаблоны" },
  { key: "/profile", module: "profile", label: "Профиль" },
];

function resolveModule(pathname: string): AppModule {
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/client-messages")) return "client-messages";
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/path-points")) return "path-points";
  if (pathname.startsWith("/factories")) return "factories";
  if (pathname.startsWith("/trips")) return "trips";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/countries")) return "countries";
  if (pathname.startsWith("/normative-documents")) return "normative-documents";
  if (pathname.startsWith("/email-templates")) return "email-templates";
  return "profile";
}

export function AppShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const meQuery = useCurrentUser(true);
  const currentModule = useMemo(() => resolveModule(pathname), [pathname]);

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

  useEffect(() => {
    const me = meQuery.data;
    if (!me) {
      return;
    }

    const allowed = canAccessModule(currentModule, me.role_name, me.is_superuser);
    if (!allowed && pathname !== "/orders") {
      message.warning("Раздел недоступен для вашей роли");
      router.replace("/orders");
    }
  }, [currentModule, meQuery.data, message, pathname, router]);

  const selectedKey = useMemo(() => {
    if (pathname.startsWith("/orders")) return "/orders";
    if (pathname.startsWith("/client-messages")) return "/client-messages";
    if (pathname.startsWith("/requests")) return "/requests";
    if (pathname.startsWith("/path-points")) return "/path-points";
    if (pathname.startsWith("/factories")) return "/factories";
    if (pathname.startsWith("/trips")) return "/trips";
    if (pathname.startsWith("/users")) return "/users";
    if (pathname.startsWith("/countries")) return "/countries";
    if (pathname.startsWith("/normative-documents")) return "/normative-documents";
    if (pathname.startsWith("/email-templates")) return "/email-templates";
    if (pathname.startsWith("/profile")) return "/profile";
    return "/orders";
  }, [pathname]);

  const menuItems = useMemo(() => {
    const me = meQuery.data;
    const visibleModules = getVisibleModules(me?.role_name, me?.is_superuser);
    return MODULE_MENU_CONFIG.filter((item) => visibleModules.includes(item.module)).map((item) => ({
      key: item.key,
      label: item.label,
    }));
  }, [meQuery.data]);

  const roleLabelByName: Record<string, string> = {
    administrator: "Администратор",
    manager: "Менеджер",
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
