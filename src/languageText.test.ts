import { describe, expect, it } from "vitest";
import { assertNoUndLanguageTexts, canonicalizeLanguageTag, normalizeLanguageTexts, normalizeLanguageTextsForWrite, pickLanguageText, specificLanguageTag } from "./languageText";

describe("language text variants", () => {
  it("canonicalizes BCP-47 tags and selects exact then base-language matches", () => {
    const variants = normalizeLanguageTexts([{ language: "EN-gb", value: "British" }, { language: "ja", value: "日本語" }]);
    expect(variants[0].language).toBe("en-GB");
    expect(pickLanguageText(variants, "en-GB")).toBe("British");
    expect(pickLanguageText(variants, "en-US")).toBe("British");
  });

  it("rejects malformed and duplicate variants instead of dropping data", () => {
    expect(() => normalizeLanguageTexts([{ language: "en", value: "one" }, { language: "EN", value: "two" }])).toThrow("Duplicate");
    expect(() => normalizeLanguageTexts([{ language: "en" }])).toThrow("Malformed");
    expect(() => canonicalizeLanguageTag("not a tag")).toThrow("Invalid BCP-47");
  });

  it("allows und for reading but rejects it for new writes", () => {
    expect(normalizeLanguageTexts([{ language: "und", value: "Unknown" }])).toHaveLength(1);
    expect(() => normalizeLanguageTextsForWrite([{ language: "und", value: "Unknown" }])).toThrow("specific language");
    expect(() => specificLanguageTag("und")).toThrow("specific BCP-47");
    expect(() => specificLanguageTag("und-Latn")).toThrow("specific BCP-47");
    expect(() => assertNoUndLanguageTexts({ nested: [{ language: "und-Latn", value: "Unknown" }] })).toThrow("Run Migration");
  });
});
