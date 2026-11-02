"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SelectOption, SelectOptions } from "@opal/components";
import { SvgOrganization, SvgUsers } from "@opal/icons";
import type { IconFunctionComponent } from "@opal/types";
import { markdown } from "@opal/utils";
import type { PlanColor, PlanMetadata } from "@/lib/tiers/types";
import { Tier } from "@/lib/tiers/types";
import { tierAtLeast } from "@/lib/tiers/utils";
import { useSettings } from "@/lib/settings/hooks";

/**
 * True when the current tenant's tier is `required` or higher.
 *
 *   useTierAtLeast(Tier.BUSINESS)   // BUSINESS or ENTERPRISE
 *   useTierAtLeast(Tier.ENTERPRISE) // ENTERPRISE only
 *
 * Returns false when the tier is undefined (loading, no license).
 */
export function useTierAtLeast(required: Tier): boolean {
  const settings = useSettings();
  return tierAtLeast(settings.tier, required);
}

const PLAN_STYLES: Record<
  Tier,
  {
    color: PlanColor;
    icon: IconFunctionComponent | undefined;
    // The tier's key under `common.plans`; the UI calls COMMUNITY "Free".
    copyKey: "free" | "business" | "enterprise";
  }
> = {
  [Tier.COMMUNITY]: { color: "gray", icon: undefined, copyKey: "free" },
  [Tier.BUSINESS]: { color: "green", icon: SvgUsers, copyKey: "business" },
  [Tier.ENTERPRISE]: {
    color: "amber",
    icon: SvgOrganization,
    copyKey: "enterprise",
  },
};

/**
 * The app's plan badges and their copy, by tier. Use these wherever a
 * feature is limited to a tier, so every such feature reads the same.
 */
export function usePlans(): Record<Tier, PlanMetadata> {
  const t = useTranslations("common.plans");
  return useMemo(() => {
    const metadata = (tier: Tier): PlanMetadata => {
      const { color, icon, copyKey } = PLAN_STYLES[tier];
      const title: string = t(`${copyKey}.title`);
      return {
        title,
        icon,
        color,
        tag: { title, color, icon },
        tooltip: markdown(t(`${copyKey}.tooltip`)),
      };
    };
    return {
      [Tier.COMMUNITY]: metadata(Tier.COMMUNITY),
      [Tier.BUSINESS]: metadata(Tier.BUSINESS),
      [Tier.ENTERPRISE]: metadata(Tier.ENTERPRISE),
    };
  }, [t]);
}

/**
 * Returns a select's options that need `required`. Below that tier the options
 * are dropped, with no upgrade row. At or above it: the options as they are.
 *
 *   const lockForBusiness = useTierLockedOptions(Tier.BUSINESS);
 *   options={[...everyTier, ...lockForBusiness(businessOnly)]}
 */
export function useTierLockedOptions(
  required: Tier
): (options: SelectOption[]) => SelectOptions {
  const locked: boolean = !useTierAtLeast(required);
  return useCallback(
    (options: SelectOption[]): SelectOptions => (locked ? [] : options),
    [locked]
  );
}
