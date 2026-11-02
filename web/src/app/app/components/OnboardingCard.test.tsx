import { NextIntlClientProvider } from "next-intl";
import { render, screen, setupUser } from "@tests/setup/test-utils";
import OnboardingCard from "@/app/app/components/OnboardingCard";
import englishMessages from "@/i18n/messages/en.json";

const DISMISSED_KEY = "pao:onboardingCardDismissed";

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={englishMessages}>
      <OnboardingCard />
    </NextIntlClientProvider>
  );
}

describe("OnboardingCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the welcome text to a teacher who has not closed it", () => {
    renderCard();
    expect(screen.getByText("New to PaoTeacherAgent?")).toBeInTheDocument();
    expect(
      screen.getByText(/never make disciplinary decisions/)
    ).toBeInTheDocument();
  });

  it("hides after the close button and stays hidden on the next visit", async () => {
    const user = setupUser();
    const first = renderCard();

    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("New to PaoTeacherAgent?")).toBeNull();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("true");

    first.unmount();
    renderCard();
    expect(screen.queryByText("New to PaoTeacherAgent?")).toBeNull();
  });
});
