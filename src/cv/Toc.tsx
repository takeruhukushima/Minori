import { useI18n } from "../i18n";
import { cvHref } from "../hashRoute";

export interface TocEntry {
  anchor: string;
  label: string;
}

// Table of contents, generated from the sections that actually have data.
// Section links remain within the handle-scoped hash route.
export function Toc({ entries, handle }: { entries: TocEntry[]; handle: string }) {
  const { text } = useI18n();
  if (entries.length === 0) return null;
  return (
    <nav className="cv-toc no-print" aria-label={text("目次", "Table of contents")}>
      <ul>
        {entries.map((e) => (
          <li key={e.anchor}>
            <a href={cvHref(handle, e.anchor)}>{e.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
