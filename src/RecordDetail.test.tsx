import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordDetailDialog } from "./RecordDetail";
import { I18nProvider } from "./i18n";

describe("RecordDetailDialog", () => {
  it("renders every nested record value and raw JSON", () => {
    const html = renderToStaticMarkup(
      <I18nProvider defaultLocale="ja">
        <RecordDetailDialog
          detail={{
            title: "Example paper",
            uri: "at://did:plc:test/pub.paper.reference/3test",
            cid: "bafytest",
            value: {
              $type: "pub.paper.reference",
              contributors: [{ literal: "福島 岳", corresponding: true }],
              issued: { year: 2026 },
            },
          }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(html).toContain("pub.paper.reference");
    expect(html).toContain("at://did:plc:test/pub.paper.reference/3test");
    expect(html).toContain("福島 岳");
    expect(html).toContain("corresponding");
    expect(html).toContain("2026");
    expect(html).toContain("JSON（未加工）");
    expect(html).toContain("フォームで編集");
    expect(html).toContain("削除");
  });
});
