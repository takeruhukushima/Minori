import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type Locale = "ja" | "en";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: (ja: string, en: string) => string;
}

const STORAGE_KEY = "minori.locale";
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, defaultLocale }: { children: ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => defaultLocale ?? initialLocale());

  // MAGI
  // Persist only an explicit choice, so visitors who never touch the switcher
  // keep following their browser language / region on later visits.
  function setLocale(next: Locale) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
    setLocaleState(next);
  }

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === "ja" ? "Minori — 学術CV / 文献管理" : "Minori — Academic CV & bibliography";
  }, [locale]);
  // /MAGI

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, text: (ja, en) => (locale === "ja" ? ja : en) }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}

export function LocaleSwitcher() {
  const { locale, setLocale, text } = useI18n();
  return (
    <div className="locale-switcher" role="group" aria-label={text("表示言語", "Display language")}>
      <button type="button" aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>
        日本語
      </button>
      <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

// MAGI
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ja" || stored === "en") return stored;
  } catch {
    // Fall back to browser detection when storage cannot be read.
  }
  if (typeof navigator === "undefined") return "en";
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Older or restricted environments may not expose the time zone.
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectLocale(languages, timeZone);
}

const JAPAN_TIME_ZONES = new Set(["Asia/Tokyo", "Japan"]);

/**
 * Picks the UI locale without any network request:
 * 1. the first browser language that Minori supports (ja / en) wins;
 * 2. otherwise the visitor's country decides — taken from a language region
 *    subtag (e.g. "ko-JP") or the system time zone (Asia/Tokyo) — Japan → ja;
 * 3. everyone else gets English.
 */
export function detectLocale(languages: readonly (string | undefined)[], timeZone?: string): Locale {
  const tags = languages.filter((tag): tag is string => !!tag).map((tag) => tag.toLowerCase());
  for (const tag of tags) {
    const base = tag.split(/[-_]/)[0];
    if (base === "ja" || base === "en") return base;
  }
  const inJapan =
    tags.some((tag) => tag.split(/[-_]/).slice(1).includes("jp")) ||
    (timeZone !== undefined && JAPAN_TIME_ZONES.has(timeZone));
  return inJapan ? "ja" : "en";
}
// /MAGI
