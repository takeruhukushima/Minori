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
      throw new Error("Assign a specific language to every und variant before saving");
    }
  }
  Object.values(record).forEach(assertNoUndLanguageTexts);
}

export function pickLanguageText(value: unknown, requestedLanguage: string): string {
  return resolveLanguageText(value, requestedLanguage).value;
}

export interface ResolvedText {
  value: string;
  language: string;
  // True when the requested language (and its base subtag) had no variant and
  // we fell back to another one. Lets the public CV mark fallback content in a
  // consistent way (requirement 11).
  fellBack: boolean;
}

// Same resolution order as pickLanguageText (exact -> base subtag -> first
// available) but reports which variant was chosen and whether it was a
// fallback, so the UI can surface it.
export function resolveLanguageText(value: unknown, requestedLanguage: string): ResolvedText {
  // Records written before language variants were introduced stored these
  // fields as plain strings. Keep them readable without permitting new writes
  // in the legacy shape.
  if (typeof value === "string") {
    return { value: value.trim(), language: requestedLanguage, fellBack: false };
  }
  const variants = normalizeLanguageTexts(value);
  if (!variants.length) return { value: "", language: "", fellBack: false };
  const exact = variants.find((item) => item.language.toLowerCase() === requestedLanguage.toLowerCase());
  if (exact) return { value: exact.value, language: exact.language, fellBack: false };
  const base = requestedLanguage.split("-")[0].toLowerCase();
  const baseMatch = variants.find((item) => item.language.split("-")[0].toLowerCase() === base);
  if (baseMatch) return { value: baseMatch.value, language: baseMatch.language, fellBack: false };
  return { value: variants[0].value, language: variants[0].language, fellBack: true };
}

export function upsertLanguageText(value: unknown, language: string, text: string): LanguageText[] {
  const normalizedLanguage = canonicalizeLanguageTag(language);
  const variants = normalizeLanguageTexts(value).filter((item) => item.language !== normalizedLanguage);
  const normalizedText = text.trim();
  if (normalizedLanguage && normalizedText) variants.push({ language: normalizedLanguage, value: normalizedText });
  return variants;
}
