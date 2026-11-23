import { brandCss } from "@/lib/pao/brand";

describe("brandCss", () => {
  test("returns nothing for a missing or malformed colour", () => {
    expect(brandCss(null)).toBe("");
    expect(brandCss("")).toBe("");
    expect(brandCss("red")).toBe("");
    expect(brandCss("#12345")).toBe("");
    expect(brandCss("#12345g")).toBe("");
  });

  test("sets the three variables for both themes", () => {
    const css = brandCss("#5cb531");
    for (const n of ["04", "05", "06"]) {
      expect(css).toContain(`--theme-primary-${n}:`);
    }
    expect(css).toContain(":root:root{");
    expect(css).toContain(":root.dark{");
  });

  test("caps light-mode lightness so white text stays readable", () => {
    // Pure white would otherwise give a white button.
    expect(brandCss("#ffffff")).toContain(
      ":root:root{--theme-primary-04:hsl(0 0% 36%)"
    );
  });

  test("cannot inject CSS", () => {
    expect(brandCss("#000000;}body{display:none")).toBe("");
  });
});
