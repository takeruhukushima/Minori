import { I18nProvider, type Locale } from "../i18n";
import { CvBody } from "./CvBody";
import type { LoadedCv } from "../public/cvModel";
import "./print.css";

// Static, JS-free rendering of a CV for the Astro self-host build. Wraps the
// shared CvBody in a fixed-locale I18nProvider and expands every section (no
// interactivity is available without hydration). The identical CvBody drives
// the SPA, so the two renderings agree (requirement 16/18).
export function StaticCv({ cv, locale }: { cv: LoadedCv; locale: Locale }) {
  const text = (ja: string, en: string) => (locale === "ja" ? ja : en);
  return (
    <I18nProvider defaultLocale={locale}>
      <div className="cv-page">
        <CvBody
          handle={cv.handle}
          did={cv.did}
          profile={cv.profile}
          avatar={cv.avatar}
          collections={cv.collections}
          publications={cv.publications}
          publicationsStatus={cv.publicationsStatus}
          projects={cv.projects}
          cvLang={locale}
          collapseAfter={100000}
        />
        <footer className="cv-footer">
          <p>{text(
            "この公開CVはPDS上の公開情報から生成されています。",
            "This public CV is generated from public records on the author's PDS.",
          )}</p>
        </footer>
      </div>
    </I18nProvider>
  );
}
