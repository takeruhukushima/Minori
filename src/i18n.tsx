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
  const [locale, setLocale] = useState<Locale>(() => defaultLocale ?? initialLocale());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
    document.documentElement.lang = locale;
  }, [locale]);

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

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ja" || stored === "en") return stored;
  } catch {
    // Fall back to the browser language when storage cannot be read.
  }
  if (typeof navigator !== "undefined") {
    const language = navigator.languages?.[0] || navigator.language;
    if (language.toLowerCase().startsWith("ja")) return "ja";
  }
  return "en";
}
