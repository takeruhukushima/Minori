export interface LanguageText {
  language: string;
  value: string;
}

export function isLanguageText(value: unknown): value is LanguageText[] {
  return Array.isArray(value) && value.every((item) => (
    typeof item === "object" && item !== null
      && typeof (item as LanguageText).language === "string"
      && typeof (item as LanguageText).value === "string"
  ));
}

export function normalizeLanguageTexts(value: unknown): LanguageText[] {
  if (!Array.isArray(value)) return [];
  const byLanguage = new Map<string, LanguageText>();
  for (const item of value) {
    if (typeof item !== "object" || item === null || typeof (item as LanguageText).language !== "string" || typeof (item as LanguageText).value !== "string") {
      throw new Error("Malformed language text variant");
    }
    const language = canonicalizeLanguageTag((item as LanguageText).language);
    const text = (item as LanguageText).value.trim();
    if (!text) continue;
    if (new TextEncoder().encode(text).length > 20000 || [...text].length > 5000) throw new Error(`Text for ${language} exceeds the Lexicon limit`);
    if (byLanguage.has(language)) throw new Error(`Duplicate language variant: ${language}`);
    byLanguage.set(language, { language, value: text });
  }
  if (byLanguage.size > 20) throw new Error("A field cannot contain more than 20 language variants");
  return [...byLanguage.values()];
}

export function canonicalizeLanguageTag(value: string): string {
  const tag = value.trim();
  if (!tag || tag.length > 32) throw new Error(`Invalid BCP-47 language tag: ${value}`);
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    throw new Error(`Invalid BCP-47 language tag: ${value}`);
  }
}

export function specificLanguageTag(value: string): string {
  const language = canonicalizeLanguageTag(value);
  if (language.split("-")[0].toLowerCase() === "und") throw new Error("Choose a specific BCP-47 language tag instead of und");
  return language;
}

export function normalizeLanguageTextsForWrite(value: unknown): LanguageText[] {
  const variants = normalizeLanguageTexts(value);
  if (variants.some((item) => item.language.split("-")[0].toLowerCase() === "und")) {
    throw new Error("Assign a specific language to every und variant before saving");
  }
  return variants;
}

export function assertNoUndLanguageTexts(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoUndLanguageTexts);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.language === "string" && typeof record.value === "string") {
    const language = canonicalizeLanguageTag(record.language);
    if (language.split("-")[0].toLowerCase() === "und") {
      throw new Error("Run Migration and assign a specific language to every und variant before saving");
    }
  }
  Object.values(record).forEach(assertNoUndLanguageTexts);
}

export function pickLanguageText(value: unknown, requestedLanguage: string): string {
  if (typeof value === "string") return value;
  const variants = normalizeLanguageTexts(value);
  if (!variants.length) return "";
  const exact = variants.find((item) => item.language.toLowerCase() === requestedLanguage.toLowerCase());
  if (exact) return exact.value;
  const base = requestedLanguage.split("-")[0].toLowerCase();
  return variants.find((item) => item.language.split("-")[0].toLowerCase() === base)?.value ?? variants[0].value;
}

export function upsertLanguageText(value: unknown, language: string, text: string): LanguageText[] {
  const normalizedLanguage = canonicalizeLanguageTag(language);
  const variants = normalizeLanguageTexts(value).filter((item) => item.language !== normalizedLanguage);
  const normalizedText = text.trim();
  if (normalizedLanguage && normalizedText) variants.push({ language: normalizedLanguage, value: normalizedText });
  return variants;
}
