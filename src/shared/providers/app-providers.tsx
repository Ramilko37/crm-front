"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import ruRU from "antd/locale/ru_RU";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#0f5ec4",
          colorBgLayout: "#eef3fb",
          colorBgContainer: "#ffffff",
          colorBorderSecondary: "#d7e0ee",
          colorText: "#1f2937",
          colorTextSecondary: "#4b5e76",
          borderRadius: 12,
          borderRadiusLG: 16,
          boxShadowSecondary: "0 10px 28px rgba(15, 30, 58, 0.08)",
          controlHeight: 38,
        },
        components: {
          Layout: {
            bodyBg: "#eef3fb",
            siderBg: "#f8fbff",
            headerBg: "#ffffff",
          },
          Card: {
            borderRadiusLG: 16,
            bodyPadding: 20,
          },
          Table: {
            borderColor: "#e3eaf5",
            headerBg: "#f7faff",
          },
          Menu: {
            itemBorderRadius: 10,
            itemSelectedBg: "#e7f1ff",
            itemSelectedColor: "#0f5ec4",
            itemColor: "#32445a",
          },
          Button: {
            borderRadius: 10,
          },
          Input: {
            activeBorderColor: "#0f5ec4",
            hoverBorderColor: "#73a5e8",
          },
          Select: {
            activeBorderColor: "#0f5ec4",
            hoverBorderColor: "#73a5e8",
          },
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
