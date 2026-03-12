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
          colorPrimary: "#0050b3",
          borderRadius: 10,
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
