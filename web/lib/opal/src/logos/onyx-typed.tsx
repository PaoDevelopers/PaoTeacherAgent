import type { IconProps } from "@opal/types";
// PaoTeacherAgent: wordmark replaces the Onyx typed logo (see CUSTOMIZATIONS.md).
const SvgOnyxTyped = ({ size, ...props }: IconProps) => (
  <svg
    height={size}
    viewBox="0 0 330 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="PaoTeacherAgent"
    {...props}
  >
    <text
      x="0"
      y="46"
      fontFamily="inherit"
      fontSize="40"
      fontWeight="600"
      fill="var(--text-05)"
    >
      PaoTeacherAgent
    </text>
  </svg>
);
export default SvgOnyxTyped;
