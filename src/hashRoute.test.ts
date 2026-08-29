import { describe, expect, it } from "vitest";
import { buildHashHref, collectionHref, cvHref, discoverHref, parseHash } from "./hashRoute";

describe("parseHash", () => {
  it("treats empty / root as the editor app", () => {
    expect(parseHash("")).toEqual({ kind: "app" });
    expect(parseHash("#")).toEqual({ kind: "app" });
    expect(parseHash("#/")).toEqual({ kind: "app" });
  });

  it("does not treat an OAuth callback fragment as a CV handle", () => {
    expect(parseHash("#state=abc&iss=https://bsky.social&code=cod-123")).toEqual({ kind: "app" });
  });

  it("parses the public CV discovery route", () => {
    expect(parseHash("#/discover")).toEqual({ kind: "discover" });
    expect(discoverHref()).toBe("/#/discover");
  });

  it("parses a handle-only CV route", () => {
    expect(parseHash("#/alice.bsky.social")).toEqual({ kind: "cv", handle: "alice.bsky.social", anchor: null });
  });

  it("parses handle + anchor", () => {
    expect(parseHash("#/alice.bsky.social/publications")).toEqual({
      kind: "cv",
      handle: "alice.bsky.social",
      anchor: "publications",
    });
  });

  it("decodes DID handles", () => {
    expect(parseHash("#/did:plc:abc123")).toEqual({ kind: "cv", handle: "did:plc:abc123", anchor: null });
  });

  it("parses a literature collection detail route", () => {
    expect(parseHash("#/alice.bsky.social/collections/3kabc")).toEqual({
      kind: "collection",
      handle: "alice.bsky.social",
      rkey: "3kabc",
    });
  });

  it("builds hash routes under the configured base", () => {
    expect(cvHref("alice.bsky.social")).toBe("/#/alice.bsky.social");
    expect(cvHref("alice.bsky.social", "publications")).toBe("/#/alice.bsky.social/publications");
    expect(collectionHref("alice.bsky.social", "3kabc")).toBe("/#/alice.bsky.social/collections/3kabc");
    expect(buildHashHref("/Minori/", "alice.bsky.social", "collections", "3kabc")).toBe(
      "/Minori/#/alice.bsky.social/collections/3kabc",
    );
  });
});
