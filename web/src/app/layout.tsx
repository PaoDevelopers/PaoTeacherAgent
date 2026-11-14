import "./globals.css";

import type { Metadata } from "next";
import { MODAL_ROOT_ID } from "@/lib/constants";
import AppProvider from "@/providers/AppProvider";
import Script from "next/script";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import StatsOverlayLoader from "@/components/dev/StatsOverlayLoader";
import { OpenSearchResourcePopup } from "@/sections/banners/OpenSearchResourceWarning";
import AppHealthBanner from "@/sections/banners/HealthBanner";
import BannerQueue from "@/sections/banners/BannerQueue";
import { AuthenticationShell } from "@/lib/auth/components";
import SWRConfigProvider from "@/providers/SWRConfigProvider";
import { NextIntlClientProvider } from "next-intl";
import OpalStringsBridge from "@/i18n/OpalStringsBridge";
import { getLocale, getMessages } from "next-intl/server";
import { DirectionProvider } from "@radix-ui/react-direction";
import { cookies } from "next/headers";
import { htmlDirForLocale, messageLocale, type HtmlDir } from "@/i18n/config";

// Fonts are vendored in ./fonts (SIL OFL texts beside them), so builds and
// browsers never contact Google. Each family is split in two files by
// unicode-range, as Google serves it. next/font needs literal option values,
// so the ranges and fallbacks are written out in each call.
//
// No generic at the end of either fallback list: the generic comes last in
// the composed --font-* variables on <html> below, after the per-locale CJK
// tail (--font-cjk-sans, defined in globals.css). A generic here would sit
// before the CJK fonts and swallow every CJK codepoint.
const googleSansLatin = localFont({
  src: "./fonts/GoogleSans-latin.woff2",
  weight: "400 700",
  display: "swap",
  fallback: ["Arial", "Liberation Sans", "Helvetica"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const googleSansLatinExt = localFont({
  src: "./fonts/GoogleSans-latin-ext.woff2",
  weight: "400 700",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const dmMonoLatin = localFont({
  src: "./fonts/DMMono-latin.woff2",
  weight: "400",
  display: "swap",
  fallback: [
    "SF Mono",
    "Monaco",
    "Cascadia Code",
    "Roboto Mono",
    "Consolas",
    "Courier New",
  ],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const dmMonoLatinExt = localFont({
  src: "./fonts/DMMono-latin-ext.woff2",
  weight: "400",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

// force-dynamic prevents Next.js from statically prerendering pages at build
// time — many child routes use cookies() which requires dynamic rendering.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { icons: { icon: "/yk-pao-logo.png" } };

interface LayoutProps {
  children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
  // The runtime tag comes from the NEXT_LOCALE cookie, or the workspace
  // default when there is none (see src/i18n/request.ts).
  const locale = await getLocale();
  const messages = await getMessages();
  // <html lang> and the direction drop the numbering extension, which belongs
  // to Intl, not the document. UserProvider refreshes when <html lang> differs
  // from the effective language.
  const language = messageLocale(locale);

  let dir: HtmlDir = htmlDirForLocale(language);
  // Dev-only escape hatch so QA can preview either direction without
  // switching account language: set an "onyx-dir" cookie to "rtl" or
  // "ltr" (with path=/) and reload.
  if (process.env.NODE_ENV === "development") {
    const dirOverride = (await cookies()).get("onyx-dir")?.value;
    if (dirOverride === "rtl" || dirOverride === "ltr") {
      dir = dirOverride;
    }
  }

  return (
    <html
      lang={language}
      dir={dir}
      // The app-wide font variables are composed here instead of with
      // next/font's `variable` option: the CJK tail (--font-cjk-sans,
      // globals.css) must vary with the locale, so the loaded-webfont chain
      // and the tail have to be joined in one declaration. Every
      // `var(--font-hanken-grotesk)` / `var(--font-dm-mono)` consumer (Opal
      // text presets, the font-hanken/font-sans utilities, app CSS) resolves
      // through these.
      style={
        {
          // PaoTeacherAgent: SF Pro through the system font keywords (the web cannot
          // load it by name), then Google Sans (OFL, self-hosted by next/font) where
          // they are absent. The variable keeps its upstream name so every consumer
          // resolves it. CJK text falls to the tail.
          "--font-hanken-grotesk": `-apple-system, BlinkMacSystemFont, ${googleSansLatin.style.fontFamily}, ${googleSansLatinExt.style.fontFamily}, var(--font-cjk-sans), sans-serif`,
          "--font-dm-mono": `${dmMonoLatin.style.fontFamily}, ${dmMonoLatinExt.style.fontFamily}, var(--font-cjk-sans), monospace`,
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, interactive-widget=resizes-content"
        />

        {/* When running inside the Tauri desktop wrapper on macOS, tag <html>
            as desktop so the native title-bar reservation in
            css/desktop-titlebar.css engages before paint. macOS is the only
            platform with an overlay title bar (traffic lights float over the
            content); Linux and Windows keep native window decorations, so
            reserving the strip there would only push content down. Tauri
            injects its IPC globals via an init script that runs before page
            scripts, so this synchronous check sees them; the class then
            persists across client-side navigations. No-op in a browser. */}
        <Script
          id="onyx-desktop-detector"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (
                ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) &&
                navigator.platform.startsWith('Mac')
              ) {
                document.documentElement.classList.add('onyx-desktop');
              }
            `,
          }}
        />
      </head>

      <body className={`relative font-hanken`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <OpalStringsBridge>
            {/* Radix reads direction from context, not the DOM, so popovers,
              menus and roving focus need this alongside <html dir>. */}
            <DirectionProvider dir={dir}>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <div className="text-text min-h-screen bg-background">
                  <TooltipProvider>
                    <SWRConfigProvider>
                      <AppHealthBanner />
                      <BannerQueue />
                      <AuthenticationShell>
                        <AppProvider>
                          <OpenSearchResourcePopup />
                          <div id={MODAL_ROOT_ID} className="h-screen w-screen">
                            {children}
                          </div>
                          {process.env.NEXT_PUBLIC_ENABLE_STATS === "true" && (
                            <StatsOverlayLoader />
                          )}
                        </AppProvider>
                      </AuthenticationShell>
                    </SWRConfigProvider>
                  </TooltipProvider>
                </div>
              </ThemeProvider>
            </DirectionProvider>
          </OpalStringsBridge>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
