import { resolveLanguageText } from "../languageText";
import { EXTERNAL_LINK_REL, orcidUrl, safeUrl } from "../public/sanitize";
import { SECTION_RENDER } from "./sections";
import { NSID } from "../lexicons";
import type { RawRecord } from "../public/cvModel";
import { useI18n } from "../i18n";

interface Props {
  profile: any | null;
  avatar: string | null;
  handle: string;
  did: string | null;
  positions: RawRecord[];
  cvLang: string;
}

// Current positions: no endedAt (the editor leaves it blank for current jobs),
// primary current position first.
function currentPositions(positions: RawRecord[]): RawRecord[] {
  return positions
    .filter((p) => !p.value?.endedAt)
    .sort((a, b) => (b.value?.isPrimary ? 1 : 0) - (a.value?.isPrimary ? 1 : 0));
}

export function Header({ profile, avatar, handle, did, positions, cvLang }: Props) {
  const { text } = useI18n();
  const name = resolveLanguageText(profile?.displayName, cvLang);
  const nativeName = resolveLanguageText(profile?.nativeName, cvLang);
  const headline = resolveLanguageText(profile?.headline, cvLang);
  const bio = resolveLanguageText(profile?.bio, cvLang);
  const current = currentPositions(positions);
  const keywords: string[] = (profile?.keywords ?? [])
    .map((k: any) => resolveLanguageText(k?.variants, cvLang).value)
    .filter(Boolean);

  const links = externalLinks(profile, cvLang);

  return (
    <header className="cv-header" id="cv-top">
      {avatar && (
        <img className="cv-avatar" src={avatar} alt={name.value || handle} loading="lazy" />
      )}
      <div className="cv-header-body">
        <h1 className="cv-name">
          {name.value || handle}
          {name.fellBack && name.language && <span className="cv-lang-tag" title={text("この言語の値がないため別言語を表示", "Shown in another language: no value for the selected language")}>{name.language}</span>}
        </h1>
        {nativeName.value && nativeName.value !== name.value && (
          <div className="cv-native-name">{nativeName.value}</div>
        )}
        {headline.value && <div className="cv-headline">{headline.value}</div>}
        {current.map((p) => {
          const { title } = SECTION_RENDER[NSID.position](p.value, cvLang);
          return <div key={p.uri} className="cv-current-position">{title}</div>;
        })}
        {bio.value && <p className="cv-bio">{bio.value}</p>}
        {keywords.length > 0 && (
          <ul className="cv-keywords" aria-label={text("研究分野・キーワード", "Research fields and keywords")}>
            {keywords.map((k, i) => (
              <li key={i} className="cv-keyword">{k}</li>
            ))}
          </ul>
        )}
        <div className="cv-handle">@{handle}{did && did !== handle ? ` · ${did}` : ""}</div>
        {links.length > 0 && (
          <ul className="cv-links" aria-label={text("外部リンク", "External links")}>
            {links.map((l, i) => (
              <li key={i}>
                <a href={l.href} target="_blank" rel={EXTERNAL_LINK_REL}>{l.label}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function externalLinks(profile: any | null, cvLang: string): { href: string; label: string }[] {
  if (!profile) return [];
  const out: { href: string; label: string }[] = [];
  for (const w of profile.websites ?? []) {
    const href = safeUrl(w?.url);
    if (href) out.push({ href, label: resolveLanguageText(w?.label, cvLang).value || hostname(href) });
  }
  const orcid = orcidUrl(profile.orcid);
  if (orcid) out.push({ href: orcid, label: "ORCID" });
  if (profile.researchmapId) out.push({ href: `https://researchmap.jp/${encodeURIComponent(profile.researchmapId)}`, label: "researchmap" });
  if (profile.googleScholarId) out.push({ href: `https://scholar.google.com/citations?user=${encodeURIComponent(profile.googleScholarId)}`, label: "Google Scholar" });
  return out;
}

function hostname(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
}
