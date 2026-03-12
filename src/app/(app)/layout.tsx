import { AppShell } from "@/features/app-shell/app-shell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
