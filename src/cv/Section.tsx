import { useState } from "react";
import type { CollectionResult, RawRecord } from "../public/cvModel";
import { SECTION_RENDER } from "./sections";
import { useI18n } from "../i18n";

interface Props {
  id: string; // anchor / HTML id
  nsid: string;
  title: string;
  result: CollectionResult | undefined;
  cvLang: string;
  collapseAfter?: number;
}

// A generic CV section: renders a collection's records via the shared
// per-record formatter. Empty sections are not rendered by the parent, so this
// assumes at least one record when status is "ok" and non-empty.
export function Section({ id, nsid, title, result, cvLang, collapseAfter = 10 }: Props) {
  const { text } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const render = SECTION_RENDER[nsid];
  const records = result?.records ?? [];
  const shown = expanded ? records : records.slice(0, collapseAfter);
  const hiddenCount = records.length - shown.length;

  return (
    <section className="cv-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="cv-section-title">
        {title} <span className="cv-count">{records.length}</span>
      </h2>
      {result?.status === "error" && (
        <p className="cv-section-error" role="status">
          {text("この項目の取得に失敗しました。", "This section could not be loaded.")}
        </p>
      )}
      <ul className="cv-item-list">
        {shown.map((r: RawRecord) => {
          const { title: itemTitle, meta } = render(r.value, cvLang);
          return (
            <li key={r.uri} className="cv-item">
              <div className="cv-item-title">{itemTitle}</div>
              {meta && <div className="cv-item-meta">{meta}</div>}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button type="button" className="cv-showall btn-link" onClick={() => setExpanded(true)}>
          {text(`すべて表示 (残り${hiddenCount}件)`, `Show all (${hiddenCount} more)`)}
        </button>
      )}
    </section>
  );
}
