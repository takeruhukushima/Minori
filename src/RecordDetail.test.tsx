import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordDetailDialog } from "./RecordDetail";

describe("RecordDetailDialog", () => {
  it("renders every nested record value and raw JSON", () => {
    const html = renderToStaticMarkup(
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
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(html).toContain("pub.paper.reference");
    expect(html).toContain("at://did:plc:test/pub.paper.reference/3test");
    expect(html).toContain("福島 岳");
    expect(html).toContain("corresponding");
    expect(html).toContain("2026");
    expect(html).toContain("Raw JSON");
    expect(html).toContain("編集");
    expect(html).toContain("削除");
  });
});
