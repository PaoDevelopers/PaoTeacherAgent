// Locale registry for the web UI.
//
// Every value must exist in the backend `SupportedLanguage` enum in
// backend/onyx/db/enums.py — config.test.ts pins this list, and
// `PATCH /user/language` rejects values outside that enum.
// PaoTeacherAgent ships English and Simplified Chinese only (see CUSTOMIZATIONS.md).
// The backend enum keeps the other languages, so it accepts a superset of this list.
export const SUPPORTED_LOCALES = ["en", "zh"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Cookie the server layout reads for the locale. The backend owns it: PATCH
// /user/language and GET /me set it to the effective language (stored
// preference, else Settings.default_language). The client never writes it.
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

// Endonyms (each language named in itself) so users can always find their own
// language in the picker, whatever the current UI language is.
export const LOCALE_ENDONYMS = {
  en: "English",
  zh: "简体中文",
} satisfies Record<Locale, string>;

// Picker rows shared by the user and admin language selects.
export const LOCALE_OPTIONS: { value: Locale; title: string }[] =
  SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    title: LOCALE_ENDONYMS[locale],
  }));

export function isSupportedLocale(
  value: string | null | undefined
): value is Locale {
  // SAFETY: the cast narrows only to satisfy the readonly-array
  // `includes` signature. Membership is still checked at runtime.
  return SUPPORTED_LOCALES.includes(value as Locale);
}

// Locales whose UI renders right-to-left. Drives <html dir> and the
// Radix DirectionProvider in the root layout. A new RTL locale is
// registered here after joining SUPPORTED_LOCALES.
export const RTL_LOCALES: readonly Locale[] = [];

export type HtmlDir = "ltr" | "rtl";

export function htmlDirForLocale(locale: Locale): HtmlDir {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

// A locale that needs a non-Latin numbering system registers it here. The system
// rides on the runtime locale tag, so any Intl call given useLocale() shapes digits
// without a numberingSystem option. English and Chinese use Latin digits.
const NUMBERING_SYSTEMS: Partial<Record<Locale, string>> = {};

export type RuntimeLocale = Locale | `${Locale}-u-nu-${string}`;

/** The locale handed to next-intl and Intl for a UI language. */
export function runtimeLocale(locale: Locale): RuntimeLocale {
  const system = NUMBERING_SYSTEMS[locale];
  return system ? `${locale}-u-nu-${system}` : locale;
}

/** The UI language behind a runtime tag ("zh-u-nu-hans" is "zh"). Unknown tags fall back to English. */
export function messageLocale(locale: string): Locale {
  const base = locale.split("-u-")[0] ?? locale;
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}
