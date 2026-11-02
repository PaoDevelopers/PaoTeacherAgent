import type { IconProps } from "@opal/types";
// PaoTeacherAgent: renders the YK Pao School logo from /public/yk-pao-logo.png.
// Replace that file to change the logo everywhere (see CUSTOMIZATIONS.md).
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
      href="/yk-pao-logo.png"
      width="64"
      height="64"
      preserveAspectRatio="xMidYMid meet"
    />
  </svg>
);
export default SvgOnyxLogo;
