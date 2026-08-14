import { describe, expect, it } from "vitest";
import { canonicalizeLanguageTag, normalizeLanguageTexts, pickLanguageText } from "./languageText";

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
});
