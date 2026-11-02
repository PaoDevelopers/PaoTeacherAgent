"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCard } from "@opal/components";
import { SvgInfo } from "@opal/icons";

/** localStorage flag, set once a teacher closes the welcome card. */
const DISMISSED_KEY = "pao:onboardingCardDismissed";

/** Tells a new teacher what the assistants are for. Stays hidden after a close. */
export default function OnboardingCard() {
  const t = useTranslations("chat.welcome.onboarding");
  const [visible, setVisible] = useState(false);

  // Read after mount: the server cannot see localStorage.
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISSED_KEY) !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss(): void {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Storage is blocked: the card shows again on the next visit.
    }
  }

  if (!visible) return null;

  return (
    <div
      data-testid="onboarding-card"
      className="w-full max-w-(--app-page-main-content-width) mt-4"
    >
      <MessageCard
        variant="success"
        icon={SvgInfo}
        title={t("title")}
        description={t("description")}
        onClose={dismiss}
      />
    </div>
  );
}
