import { createLocaleIntegerParser } from "@/i18n/numbers";

function parserFor(locale: string) {
  return createLocaleIntegerParser(
    new Intl.NumberFormat(locale, { useGrouping: false })
  );
}

describe("createLocaleIntegerParser", () => {
  it("reads Eastern Arabic-Indic and ASCII digits under that numbering system", () => {
    const parse = parserFor("ar-u-nu-arab");
    expect(parse("١٢")).toBe(12);
    expect(parse("12")).toBe(12);
    expect(parse("٠٣")).toBe(3);
  });

  it("returns null for anything that is not a whole number", () => {
    const parse = parserFor("en");
    expect(parse("")).toBeNull();
    expect(parse("1a")).toBeNull();
    expect(parse("-1")).toBeNull();
    expect(parse("1.5")).toBeNull();
    expect(parse("١")).toBeNull();
  });
});
