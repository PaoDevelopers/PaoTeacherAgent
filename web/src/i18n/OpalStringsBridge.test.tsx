import { NextIntlClientProvider } from "next-intl";
import { render } from "@tests/setup/test-utils";
import Footer from "@opal/components/table/Footer";
import { type RuntimeLocale } from "@/i18n/config";
import OpalStringsBridge from "@/i18n/OpalStringsBridge";
import englishMessages from "@/i18n/messages/en.json";
import chineseMessages from "@/i18n/messages/zh.json";

type Messages = typeof englishMessages;

function renderFooterThroughBridge(locale: RuntimeLocale, messages: Messages) {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <OpalStringsBridge>
        <Footer
          mode="summary"
          rangeStart={1}
          rangeEnd={10}
          totalItems={22}
          currentPage={1}
          totalPages={3}
          onPageChange={() => {}}
          units="users"
        />
      </OpalStringsBridge>
    </NextIntlClientProvider>
  );
  const summaryRow =
    container.querySelector(".table-footer")?.firstElementChild
      ?.firstElementChild;
  if (!summaryRow) throw new Error("footer summary did not render");
  return summaryRow;
}

describe("OpalStringsBridge", () => {
  it("keeps the English footer summary as four sibling spans", () => {
    const row = renderFooterThroughBridge("en", englishMessages);
    expect(row.textContent).toBe("Showing 1~10 of 22 users");
    expect([...row.children].map((child) => child.tagName)).toEqual([
      "SPAN",
      "SPAN",
      "SPAN",
      "SPAN",
    ]);
  });

  it("splits a translated rich message into the same span layout", () => {
    const row = renderFooterThroughBridge("zh", chineseMessages);
    expect(row.textContent).toBe("显示 1~10，共 22 users");
    expect([...row.children].map((child) => child.tagName)).toEqual([
      "SPAN",
      "SPAN",
      "SPAN",
      "SPAN",
    ]);
  });
});
