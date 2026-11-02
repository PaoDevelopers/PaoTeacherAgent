import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireAdminAuth } from "@/lib/auth/svcSS";

export interface PluginsLayoutProps {
  children: React.ReactNode;
}

// PaoTeacherAgent: the member plugins pages are limited to admin-panel users.
export default async function PluginsLayout({ children }: PluginsLayoutProps) {
  const authResult = await requireAdminAuth();
  if (authResult.redirect) {
    return redirect(authResult.redirect as Route);
  }
  return children;
}
