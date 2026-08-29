import React, { useEffect, useMemo, useState } from "react";
import { useI18n, LocaleSwitcher } from "../i18n";
import { useCvData } from "./useCvData";
import { normalizeLanguageTexts } from "../languageText";
import { CvBody } from "./CvBody";
import "./print.css";

interface Props {
  handle: string;
  anchor: string | null;
}

// The public CV page: unauthenticated, driven entirely by PDS reads.
export function PublicCv({ handle, anchor }: Props) {
  const { locale, text } = useI18n();
  const data = useCvData(handle);
  const [cvLang, setCvLang] = useState<string>(locale);
  const [copied, setCopied] = useState(false);

  // Languages the CV content is actually available in, from the profile name.
  const cvLanguages = useMemo(() => availableLanguages(data.profile?.value), [data.profile]);

  // Default the content language to the UI locale if available, else the first.
  useEffect(() => {
    if (cvLanguages.length && !cvLanguages.includes(cvLang)) {
      setCvLang(cvLanguages.includes(locale) ? locale : cvLanguages[0]);
    }
  }, [cvLanguages, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the CV is ready, scroll to the requested anchor (requirement 21).
  useEffect(() => {
    if (data.status === "ready" && anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data.status, anchor, data.collections, data.publications, data.projects]);

  if (data.status === "resolving") {
    return <CenteredMessage>{text("読み込み中…", "Loading...")}</CenteredMessage>;
  }
  if (data.status === "error") {
    return (
      <CenteredMessage>
        <p>{text("公開CVを取得できませんでした。", "Could not load this public CV.")}</p>
        <p className="cv-error-detail">{data.error}</p>
        <button className="btn" onClick={data.retry}>{text("再試行", "Retry")}</button>
      </CenteredMessage>
    );
  }
  if (data.status === "notFound") {
    return (
      <CenteredMessage>
        {text(
          `${handle} には公開学術CV（id.career.profile）が見つかりませんでした。`,
          `No public academic CV (id.career.profile) was found for ${handle}.`,
        )}
      </CenteredMessage>
    );
  }

  return (
    <div className="cv-page">
      <div className="cv-toolbar no-print">
        <a className="btn ghost small" href={baseHref()}>{text("Minori", "Minori")}</a>
        <div className="cv-toolbar-right">
          <CvLangSwitcher languages={cvLanguages} value={cvLang} onChange={setCvLang} />
          <LocaleSwitcher />
          <button
            className="btn ghost small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard may be unavailable */
              }
            }}
          >
            {copied ? text("コピーしました", "Copied") : text("URLをコピー", "Copy URL")}
          </button>
        </div>
      </div>

      <CvBody
        handle={handle}
        did={data.did}
        profile={data.profile}
        avatar={data.avatar}
        collections={data.collections}
        publications={data.publications}
        publicationsStatus={data.publicationsStatus}
        projects={data.projects}
        cvLang={cvLang}
      />

      <footer className="cv-footer">
        <p>{text(
          "この公開CVはPDS上の公開情報から生成されています。",
          "This public CV is generated from public records on the author's PDS.",
        )}</p>
      </footer>
    </div>
  );
}

function availableLanguages(profile: any | null): string[] {
  if (!profile) return [];
  try {
    return normalizeLanguageTexts(profile.displayName).map((v) => v.language);
  } catch {
    return [];
  }
}

function CvLangSwitcher({ languages, value, onChange }: { languages: string[]; value: string; onChange: (l: string) => void }) {
  const { text } = useI18n();
  if (languages.length <= 1) return null;
  return (
    <label className="cv-lang-switcher">
      <span className="sr-only">{text("CV表示言語", "CV content language")}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={text("CV表示言語", "CV content language")}>
        {languages.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="cv-centered">
      <div className="panel">{children}</div>
    </div>
  );
}

// Link back to the app root, honoring the Vite base path.
function baseHref(): string {
  return import.meta.env.BASE_URL || "/";
}
