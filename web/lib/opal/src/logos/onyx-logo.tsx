import type { IconProps } from "@opal/types";
// PaoTeacherAgent: placeholder mark until the school logo arrives (see CUSTOMIZATIONS.md).
const SvgOnyxLogo = ({ size, ...props }: IconProps) => (
  <svg
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect width="64" height="64" rx="14" fill="rgb(92, 181, 49)" />
    <path
      d="M22 48V16H34.5C41.4 16 46 20.1 46 26.5C46 32.9 41.4 37 34.5 37H29V48H22ZM29 30.8H33.9C37 30.8 38.9 29.2 38.9 26.5C38.9 23.8 37 22.2 33.9 22.2H29V30.8Z"
      fill="#ffffff"
    />
  </svg>
);
export default SvgOnyxLogo;
