import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { AppProviders } from "@/shared/providers/app-providers";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM Front",
  description: "Frontend-приложение CRM для работы с заказами, фабриками и рейсами",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={manrope.variable}>
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
