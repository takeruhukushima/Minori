import { describe, expect, it } from "vitest";
import { doiUrl, orcidUrl, safeUrl } from "./sanitize";

describe("safeUrl", () => {
  it("allows http/https/mailto and rejects javascript:", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("  ")).toBeNull();
    expect(safeUrl(42)).toBeNull();
  });
});

describe("doiUrl", () => {
  it("canonicalizes bare and prefixed DOIs, rejects non-DOIs", () => {
    expect(doiUrl("10.1000/xyz")).toBe("https://doi.org/10.1000/xyz");
    expect(doiUrl("https://doi.org/10.1000/xyz")).toBe("https://doi.org/10.1000/xyz");
    expect(doiUrl("doi:10.1000/xyz")).toBe("https://doi.org/10.1000/xyz");
    expect(doiUrl("not-a-doi")).toBeNull();
  });
});

describe("orcidUrl", () => {
  it("accepts valid iDs including trailing X and rejects junk", () => {
    expect(orcidUrl("0000-0002-1825-0097")).toBe("https://orcid.org/0000-0002-1825-0097");
    expect(orcidUrl("https://orcid.org/0000-0002-1825-009X")).toBe("https://orcid.org/0000-0002-1825-009X");
    expect(orcidUrl("1234")).toBeNull();
  });
});
