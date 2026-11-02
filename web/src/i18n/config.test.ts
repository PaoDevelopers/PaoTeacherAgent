import {
  SUPPORTED_LOCALES,
  htmlDirForLocale,
  messageLocale,
  runtimeLocale,
} from "@/i18n/config";

describe("SUPPORTED_LOCALES", () => {
  it("lists the two languages this deployment ships", () => {
    // Each value must also exist in the backend `SupportedLanguage` enum
    // (backend/onyx/db/enums.py). The backend keeps the removed languages.
    expect([...SUPPORTED_LOCALES]).toEqual(["en", "zh"]);
  });
});

describe("runtime locale", () => {
  it("leaves the runtime tag equal to the locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(runtimeLocale(locale)).toBe(locale);
    }
  });

  it("recovers the stored language from a runtime tag, English for unknown tags", () => {
    expect(messageLocale("zh")).toBe("zh");
    expect(messageLocale("zh-u-nu-hans")).toBe("zh");
    expect(messageLocale("ar-u-nu-arab")).toBe("en");
    expect(messageLocale("xx")).toBe("en");
  });

  it("renders both languages left to right", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(htmlDirForLocale(locale)).toBe("ltr");
    }
  });
});
