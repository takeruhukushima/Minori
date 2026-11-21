// MAGI
import { describe, expect, it } from "vitest";
import { detectLocale } from "./i18n";

describe("detectLocale", () => {
  it("follows the first supported browser language", () => {
    expect(detectLocale(["ja-JP", "en-US"], "America/New_York")).toBe("ja");
    expect(detectLocale(["en-US", "ja"], "Asia/Tokyo")).toBe("en");
    expect(detectLocale(["fr-FR", "ja"], "Europe/Paris")).toBe("ja");
  });

  it("falls back to the visitor's country when no language is supported", () => {
    expect(detectLocale(["ko-KR"], "Asia/Tokyo")).toBe("ja");
    expect(detectLocale(["zh-Hant-JP"], "UTC")).toBe("ja");
    expect(detectLocale(["ko-KR"], "Asia/Seoul")).toBe("en");
    expect(detectLocale([undefined], undefined)).toBe("en");
  });
});
// /MAGI
