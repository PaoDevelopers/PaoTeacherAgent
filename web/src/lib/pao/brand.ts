// PaoTeacherAgent: turns the brand colour chosen on the dean page into the
// three --theme-primary-* variables (see src/app/css/paoteacheragent.css).

const HEX = /^#[0-9a-f]{6}$/i;

function toHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

/**
 * CSS that replaces the brand variables, or "" when `color` is not #rrggbb.
 * Light mode is capped at 36% lightness so white button text keeps its
 * contrast; dark mode is floored at 45% so the colour shows on dark surfaces.
 */
export function brandCss(color: string | null | undefined): string {
  if (!color || !HEX.test(color)) return "";
  const [h, s, l] = toHsl(color);
  const light = Math.min(l, 0.36);
  const dark = Math.max(l, 0.45);
  return (
    `:root:root{--theme-primary-04:${hsl(h, s, light)};` +
    `--theme-primary-05:${hsl(h, s, light - 0.03)};` +
    `--theme-primary-06:${hsl(h, s, light - 0.07)}}` +
    `:root.dark{--theme-primary-04:${hsl(h, s, dark + 0.05)};` +
    `--theme-primary-05:${hsl(h, s, dark)};` +
    `--theme-primary-06:${hsl(h, s, dark - 0.05)}}`
  );
}
