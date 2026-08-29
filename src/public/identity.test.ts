import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeHandle, pdsFromDidDocument, resolveDidToHandle, IdentityError } from "./identity";

afterEach(() => vi.unstubAllGlobals());

describe("normalizeHandle", () => {
  it("strips @, lowercases, trims", () => {
    expect(normalizeHandle("  @Alice.BSky.Social ")).toBe("alice.bsky.social");
  });
});

describe("pdsFromDidDocument", () => {
  it("extracts the atproto PDS endpoint", () => {
    const doc = {
      service: [
        { id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: "https://pds.example.com/" },
      ],
    };
    expect(pdsFromDidDocument(doc)).toBe("https://pds.example.com");
  });

  it("throws when there is no PDS service", () => {
    expect(() => pdsFromDidDocument({ service: [] })).toThrow(IdentityError);
  });
});

describe("resolveDidToHandle", () => {
  it("accepts an alsoKnownAs handle only when it resolves back to the DID", async () => {
    const did = "did:plc:nmhfq335cddnwt4ovrq4gzsm";
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ alsoKnownAs: ["at://takerufukushima.bsky.social"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ did }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(resolveDidToHandle(did)).resolves.toBe("takerufukushima.bsky.social");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
