import { useI18n } from "../i18n";
import { GENERIC_SECTION_NSIDS } from "./useCvData";
import { Header } from "./Header";
import { Section } from "./Section";
import { Publications } from "./Publications";
import { ProjectSection } from "./ProjectSection";
import { Toc, type TocEntry } from "./Toc";
import { COLLECTIONS_ANCHOR, SECTION_META, PUBLICATIONS_ANCHOR } from "./sections";
import { NSID } from "../lexicons";
import type { CollectionResult, ProjectEntry, PublicationEntry, RawRecord } from "../public/cvModel";

// Presentational CV body, driven purely by props so it renders identically in
// the SPA (fed by useCvData) and in the Astro static build (fed by cvModel at
// build time). Contains no data fetching and no page-level chrome.
export interface CvBodyProps {
  handle: string;
  did: string | null;
  profile: RawRecord | null;
  avatar: string | null;
  collections: Record<string, CollectionResult>;
  publications: PublicationEntry[];
  publicationsStatus: CollectionResult["status"];
  projects: ProjectEntry[];
  cvLang: string;
  // Static builds pass a large number so every item renders without JS.
  collapseAfter?: number;
}

function has(collections: Record<string, CollectionResult>, nsid: string): boolean {
  return (collections[nsid]?.records.length ?? 0) > 0;
}

export function CvBody(props: CvBodyProps) {
  const { text } = useI18n();
  const { collections, publications, projects, cvLang, collapseAfter } = props;
  const positions = collections[NSID.position]?.records ?? [];
  const hasCollections = projects.some((project) => project.items.length > 0);
  const toc = buildToc(props, text);

  const generic = (nsid: string) =>
    has(collections, nsid) ? (
      <Section
        key={nsid}
        id={SECTION_META[nsid].anchor}
        nsid={nsid}
        title={text(SECTION_META[nsid].ja, SECTION_META[nsid].en)}
        result={collections[nsid]}
        cvLang={cvLang}
        collapseAfter={collapseAfter}
      />
    ) : null;

  return (
    <>
      <Header
        profile={props.profile?.value ?? null}
        avatar={props.avatar}
        handle={props.handle}
        did={props.did}
        positions={positions}
        cvLang={cvLang}
      />
      <Toc entries={toc} handle={props.handle} />
      <main className="cv-main">
        {generic(NSID.position)}
        {generic(NSID.education)}
        {hasCollections && <ProjectSection id={COLLECTIONS_ANCHOR} projects={projects} cvLang={cvLang} handle={props.handle} />}
        {publications.length > 0 && (
          <Publications id={PUBLICATIONS_ANCHOR} entries={publications} status={props.publicationsStatus} cvLang={cvLang} collapseAfter={collapseAfter} />
        )}
        {GENERIC_SECTION_NSIDS.filter((n) => n !== NSID.position && n !== NSID.education).map(generic)}
      </main>
    </>
  );
}

function buildToc(props: CvBodyProps, text: (ja: string, en: string) => string): TocEntry[] {
  const entries: TocEntry[] = [];
  const push = (nsid: string) => {
    if (has(props.collections, nsid)) entries.push({ anchor: SECTION_META[nsid].anchor, label: text(SECTION_META[nsid].ja, SECTION_META[nsid].en) });
  };
  push(NSID.position);
  push(NSID.education);
  if (props.projects.some((project) => project.items.length > 0)) entries.push({ anchor: COLLECTIONS_ANCHOR, label: text("文献リスト", "Literature lists") });
  if (props.publications.length > 0) entries.push({ anchor: PUBLICATIONS_ANCHOR, label: text("論文・文献", "Publications") });
  for (const nsid of GENERIC_SECTION_NSIDS) {
    if (nsid === NSID.position || nsid === NSID.education) continue;
    push(nsid);
  }
  return entries;
}
