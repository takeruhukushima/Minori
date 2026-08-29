import type { ProjectEntry } from "../public/cvModel";
import { pickLanguageText } from "../languageText";
import { useI18n } from "../i18n";
import { rkeyFromUri } from "../atproto";
import { collectionHref } from "../hashRoute";

interface Props {
  id: string;
  projects: ProjectEntry[];
  cvLang: string;
  handle: string;
}

// Keep the CV concise: list collection summaries here and render their complete
// bibliographies on dedicated hash routes.
export function ProjectSection({ id, projects, cvLang, handle }: Props) {
  const { text } = useI18n();
  const nonEmpty = projects.filter((p) => p.items.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <section className="cv-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="cv-section-title">
        {text("文献リスト", "Literature lists")} <span className="cv-count">{nonEmpty.length}</span>
      </h2>
      {nonEmpty.map(({ collection, items }) => {
        const name = pickLanguageText(collection.value?.name, cvLang) || text("（名称未設定）", "(untitled list)");
        const desc = pickLanguageText(collection.value?.description, cvLang);
        return (
          <div key={collection.uri} className="cv-project">
            <h3 className="cv-project-name">
              <a href={collectionHref(handle, rkeyFromUri(collection.uri))}>{name}</a>
              <span className="cv-count">{text(`${items.length}件`, `${items.length} items`)}</span>
            </h3>
            {desc && <p className="cv-project-desc">{desc}</p>}
          </div>
        );
      })}
    </section>
  );
}
