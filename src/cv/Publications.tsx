import { useState } from "react";
import type { PublicationEntry } from "../public/cvModel";
import { pickLanguageText } from "../languageText";
import { EXTERNAL_LINK_REL, doiUrl, safeUrl } from "../public/sanitize";
import { useI18n } from "../i18n";

interface Props {
  id: string;
  entries: PublicationEntry[];
  status: "loading" | "ok" | "error";
  cvLang: string;
  collapseAfter?: number;
}

// Format one reference as an inline citation string from whatever fields exist.
function formatReference(reference: any, cvLang: string): { title: string; meta: string } {
  const title = pickLanguageText(reference?.title, cvLang) || "(untitled)";
  const authors = (reference?.contributors ?? [])
    .map((c: any) => pickLanguageText(c?.literal ?? c?.name, cvLang) || [c?.given, c?.family].filter(Boolean).join(" "))
    .filter(Boolean);
  const venue = pickLanguageText(reference?.containerTitle, cvLang);
  const year = reference?.issued?.year;
  const meta = [authors.join(", "), venue, year].filter(Boolean).join(" · ");
  return { title, meta };
}

export function Publications({ id, entries, status, cvLang, collapseAfter = 15 }: Props) {
  const { text } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, collapseAfter);
  const hiddenCount = entries.length - shown.length;

  return (
    <section className="cv-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="cv-section-title">
        {text("論文・文献", "Publications")} <span className="cv-count">{entries.length}</span>
      </h2>
      {status === "error" && (
        <p className="cv-section-error" role="status">
          {text("業績の取得に失敗しました。", "Publications could not be loaded.")}
        </p>
      )}
      <ol className="cv-pub-list">
        {shown.map(({ authorship, reference }) => {
          const a = authorship.value ?? {};
          const links = referenceLinks(reference?.value);
          if (!reference) {
            return (
              <li key={authorship.uri} className="cv-pub cv-pub-missing">
                {text("参照レコードを取得できませんでした。", "Reference record unavailable.")}
              </li>
            );
          }
          const { title, meta } = formatReference(reference.value, cvLang);
          return (
            <li key={authorship.uri} className="cv-pub">
              <div className="cv-pub-title">
                {title}
                {a.isFeatured && <span className="cv-pub-badge" title={text("主要な業績", "Selected work")}>★</span>}
              </div>
              <div className="cv-pub-meta">
                {meta}
                {a.outputCategory && <span className="cv-pub-cat"> · {a.outputCategory}</span>}
                {authorshipRole(a, text)}
              </div>
              {links.length > 0 && (
                <div className="cv-pub-links">
                  {links.map((l, i) => (
                    <a key={i} href={l.href} target="_blank" rel={EXTERNAL_LINK_REL}>{l.label}</a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {hiddenCount > 0 && (
        <button type="button" className="cv-showall btn-link" onClick={() => setExpanded(true)}>
          {text(`すべて表示 (残り${hiddenCount}件)`, `Show all (${hiddenCount} more)`)}
        </button>
      )}
    </section>
  );
}

function authorshipRole(a: any, text: (ja: string, en: string) => string): string {
  const parts: string[] = [];
  if (a.role && a.role !== "author") parts.push(a.role);
  if (a.authorPosition && a.totalAuthors) parts.push(`${a.authorPosition}/${a.totalAuthors}`);
  if (a.isCorresponding) parts.push(text("責任著者", "corresponding"));
  return parts.length ? ` · ${parts.join(", ")}` : "";
}

function referenceLinks(value: any): { href: string; label: string }[] {
  if (!value) return [];
  const out: { href: string; label: string }[] = [];
  const doi = doiUrl(value.doi);
  if (doi) out.push({ href: doi, label: "DOI" });
  const url = safeUrl(value.url);
  if (url && !doi) out.push({ href: url, label: "URL" });
  if (value.arxivId) out.push({ href: `https://arxiv.org/abs/${encodeURIComponent(value.arxivId)}`, label: "arXiv" });
  return out;
}
