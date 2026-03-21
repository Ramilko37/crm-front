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
          colorPrimary: "#2f67f6",
          colorBgLayout: "#eef0f4",
          colorBgContainer: "#ffffff",
          colorBorderSecondary: "#d8dde6",
          colorText: "#1f2937",
          colorTextSecondary: "#6b7280",
          borderRadius: 6,
          borderRadiusLG: 8,
          boxShadowSecondary: "none",
          controlHeight: 32,
          fontSize: 13,
        },
        components: {
          Layout: {
            bodyBg: "#eef0f4",
            headerBg: "#ffffff",
          },
          Card: {
            borderRadiusLG: 0,
            bodyPadding: 14,
            headerFontSize: 14,
          },
          Table: {
            borderColor: "#d8dde6",
            headerBg: "#d9dce2",
            cellPaddingBlock: 8,
            cellPaddingInline: 10,
            headerSplitColor: "#cfd5df",
          },
          Modal: {
            borderRadiusLG: 8,
            headerBg: "#ffffff",
            contentBg: "#ffffff",
            titleFontSize: 16,
            titleLineHeight: 1.3,
          },
          Menu: {
            itemBorderRadius: 0,
            itemSelectedBg: "transparent",
            itemSelectedColor: "#2f67f6",
            itemColor: "#374151",
            horizontalItemSelectedColor: "#2f67f6",
            horizontalItemHoverColor: "#2f67f6",
            horizontalItemBorderRadius: 0,
          },
          Button: {
            borderRadius: 6,
            controlHeight: 32,
          },
          Input: {
            activeBorderColor: "#2f67f6",
            hoverBorderColor: "#7f9dfb",
          },
          Select: {
            activeBorderColor: "#2f67f6",
            hoverBorderColor: "#7f9dfb",
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
