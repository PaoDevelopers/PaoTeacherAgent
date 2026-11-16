"use client";

import { IconLoader } from "@opal/loaders";
import AdminSidebar from "@/sections/sidebar/AdminSidebar";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings/hooks";
import { useAdminDocumentTitle } from "@/lib/app/hooks";
import { useUser } from "@/providers/UserProvider";
import { Button } from "@opal/components";
import useScreenSize from "@/hooks/useScreenSize";
import { SvgSidebar } from "@opal/icons";
import { RootLayout, useSidebarState } from "@opal/layouts";
import { Section } from "@/layouts/general-layouts";
import { isVectorDbRequiredRoute, matchAdminRoute } from "@/lib/admin-routes";
import {
  getFirstPermittedAdminRoute,
  hasAnyAdminPermission,
  hasPermission,
} from "@/lib/permissions/utils";
import { OpenSearchResourceBanner } from "@/sections/banners/OpenSearchResourceWarning";
import LiteModeIndexingNotice from "@/sections/admin/LiteModeIndexingNotice";
import { useTranslations } from "next-intl";

export interface AdminChromeProps {
  children: React.ReactNode;
  // Server-fetched seed (AdminSSChrome) used until /api/me loads client-side.
  initialAdminCapabilities: string[];
}

export default function AdminChrome({
  children,
  initialAdminCapabilities,
}: AdminChromeProps) {
  const t = useTranslations("common");
  const { setFolded } = useSidebarState();
  const { isMobile } = useScreenSize();
  const pathname = usePathname();
  const { vectorDbEnabled, isLoading } = useSettings();
  useAdminDocumentTitle();
  const router = useRouter();
  const { adminCapabilities: liveAdminCapabilities, isUserLoading } = useUser();

  // Seed only in flight — otherwise logout would leave the page authorized by a stale seed.
  const adminCapabilities = isUserLoading
    ? initialAdminCapabilities
    : liveAdminCapabilities;

  // Match-only per-page gate: if this page is a known admin route the user lacks the
  // permission for (a group manager landing on a full-admin page), send them to their
  // first permitted admin page. Unlisted detail sub-pages are left to the backend gate.
  const matched = matchAdminRoute(pathname);
  const denied =
    matched !== undefined &&
    !hasPermission(adminCapabilities, matched.requiredPermission);

  useEffect(() => {
    if (!denied) return;
    // Some reach left → first permitted page; fully revoked → /app (else they'd bounce to an
    // admin page they still can't open).
    router.replace(
      (hasAnyAdminPermission(adminCapabilities)
        ? getFirstPermittedAdminRoute(adminCapabilities)
        : "/app") as Route
    );
  }, [denied, router, adminCapabilities]);

  let content = children;
  if (isVectorDbRequiredRoute(pathname)) {
    if (isLoading) {
      content = (
        <Section padding={8}>
          <IconLoader className="h-6 w-6" />
        </Section>
      );
    } else if (!vectorDbEnabled) {
      content = <LiteModeIndexingNotice />;
    }
  }

  if (denied) return null;

  return (
    <RootLayout.Root>
      <AdminSidebar />

      <RootLayout.App data-main-container>
        {/* On mobile every sidebar is an off-screen overlay, so the main
              column always needs a control to bring it back. */}
        {isMobile && (
          <RootLayout.Header>
            <div className="h-full flex items-center px-4 py-2">
              <Button
                prominence="internal"
                icon={SvgSidebar}
                aria-label={t("adminChrome.openSidebar.ariaLabel")}
                onClick={() => setFolded(false)}
              />
            </div>
          </RootLayout.Header>
        )}
        <OpenSearchResourceBanner />
        <RootLayout.MainContent>{content}</RootLayout.MainContent>
      </RootLayout.App>
    </RootLayout.Root>
  );
}
