"use client";

import { DEFAULT_LOGO_SIZE_PX } from "@/lib/constants";
import { cn } from "@opal/utils";
import { SvgOnyxLogo, SvgOnyxLogoTyped } from "@opal/logos";
import { IconProps } from "@opal/types";

/**
 * The app mark alone. Shaped like an Opal icon, so it fits any `icon` slot
 * and honours the size or style the slot passes.
 */
export function Logo({ size, className, style }: IconProps) {
  return (
    <SvgOnyxLogo
      size={size ?? DEFAULT_LOGO_SIZE_PX}
      className={cn("shrink-0", className)}
      style={style}
    />
  );
}

export interface FoldableLogoProps extends IconProps {
  folded?: boolean;
}

/** The sidebar's brand block: the mark when folded, the wordmark otherwise. */
export function FoldableLogo({ folded, size, className }: FoldableLogoProps) {
  const resolvedSize = size ?? DEFAULT_LOGO_SIZE_PX;
  return folded ? (
    <Logo size={resolvedSize} className={className} />
  ) : (
    <SvgOnyxLogoTyped size={resolvedSize} className={className} />
  );
}
