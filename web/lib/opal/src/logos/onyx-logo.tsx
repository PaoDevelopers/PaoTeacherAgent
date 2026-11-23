import type { IconProps } from "@opal/types";
// PaoTeacherAgent: renders the YK Pao School logo from /public/yk-pao-logo.png.
// /pao-logo serves the logo uploaded on the dean page, else that file (see CUSTOMIZATIONS.md).
const SvgOnyxLogo = ({ size, ...props }: IconProps) => (
  <svg
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="YK Pao School"
    {...props}
  >
    <image
      href="/pao-logo"
      width="64"
      height="64"
      preserveAspectRatio="xMidYMid meet"
    />
  </svg>
);
export default SvgOnyxLogo;
