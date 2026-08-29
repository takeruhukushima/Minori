import { rkeyFromUri } from "../atproto";
import { cvHref } from "../hashRoute";
import { LocaleSwitcher, useI18n } from "../i18n";
import { pickLanguageText } from "../languageText";
import { EXTERNAL_LINK_REL, doiUrl, safeUrl } from "../public/sanitize";
import { useCvData } from "./useCvData";
import "./print.css";

interface Props {
  handle: string;
  rkey: string;
}

export function CollectionDetail({ handle, rkey }: Props) {
  const { locale, text } = useI18n();
  const data = useCvData(handle);

  if (data.status === "resolving" || data.projectsStatus === "loading") {
    return <CenteredMessage>{text("読み込み中…", "Loading...")}</CenteredMessage>;
  }
  if (data.status === "error" || data.projectsStatus === "error") {
    return (
      <CenteredMessage>
        <p>{text("文献リストを取得できませんでした。", "Could not load this literature list.")}</p>
        {data.error && <p className="cv-error-detail">{data.error}</p>}
        <button className="btn" onClick={data.retry}>{text("再試行", "Retry")}</button>
      </CenteredMessage>
    );
  }

  const project = data.projects.find(({ collection }) => rkeyFromUri(collection.uri) === rkey);
  if (!project) {
    return (
      <CenteredMessage>
        <p>{text("文献リストが見つかりませんでした。", "Literature list not found.")}</p>
        <a className="btn ghost" href={cvHref(handle)}>{text("公開CVへ戻る", "Back to public CV")}</a>
      </CenteredMessage>
    );
  }

  const name = pickLanguageText(project.collection.value?.name, locale) || text("（名称未設定）", "(untitled list)");
  const description = pickLanguageText(project.collection.value?.description, locale);

  return (
    <div className="cv-page">
      <div className="cv-toolbar no-print">
        <a className="btn ghost small" href={cvHref(handle, "collections")}>{text("公開CVへ戻る", "Back to public CV")}</a>
        <LocaleSwitcher />
      </div>
      <main className="cv-main">
        <section className="cv-section" aria-labelledby="collection-title">
          <h1 id="collection-title" className="cv-section-title">{name}</h1>
          {description && <p className="cv-project-desc">{description}</p>}
          <p className="cv-pub-meta">{text(`${project.items.length}件の文献`, `${project.items.length} references`)}</p>
          <ol className="cv-pub-list">
            {project.items.map(({ item, reference }) => {
              if (!reference) {
                return <li key={item.uri} className="cv-pub cv-pub-missing">{text("参照レコードを取得できませんでした。", "Reference record unavailable.")}</li>;
              }
              const value = reference.value ?? {};
              const title = pickLanguageText(value.title, locale) || text("（タイトル未設定）", "(untitled)");
              const authors = (value.contributors ?? [])
                .map((contributor: any) => pickLanguageText(contributor.literal ?? contributor.name, locale) || [contributor.given, contributor.family].filter(Boolean).join(" "))
                .filter(Boolean)
                .join(", ");
              const venue = pickLanguageText(value.containerTitle, locale);
              const doi = doiUrl(value.doi);
              const url = safeUrl(value.url);
              return (
                <li key={item.uri} className="cv-pub">
                  <div className="cv-pub-title">{title}</div>
                  <div className="cv-pub-meta">{[authors, venue, value.issued?.year].filter(Boolean).join(" · ")}</div>
                  <div className="cv-pub-links">
                    {doi && <a href={doi} target="_blank" rel={EXTERNAL_LINK_REL}>DOI</a>}
                    {url && !doi && <a href={url} target="_blank" rel={EXTERNAL_LINK_REL}>URL</a>}
                    {value.arxivId && <a href={`https://arxiv.org/abs/${encodeURIComponent(value.arxivId)}`} target="_blank" rel={EXTERNAL_LINK_REL}>arXiv</a>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="cv-centered"><div className="panel">{children}</div></div>;
}
