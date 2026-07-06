import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";

import { AppProviders } from "@/shared/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Front",
  description: "Frontend-приложение CRM для работы с заказами, фабриками и рейсами",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
