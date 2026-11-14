import type { Metadata } from "next";
import AdminSSChrome from "@/layouts/chromes/AdminSSChrome";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: `Admin — ${APP_NAME}` };

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  return await AdminSSChrome({ children });
}
