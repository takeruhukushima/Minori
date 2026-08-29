import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  load: vi.fn(),
  resolveIdentity: vi.fn(),
  resolveDidToHandle: vi.fn(),
  Agent: vi.fn(),
}));

vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: { load: mocks.load },
  buildLoopbackClientId: vi.fn(() => "http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2F"),
}));

vi.mock("@atproto/api", () => ({ Agent: mocks.Agent }));
vi.mock("./public/identity", () => ({ resolveDidToHandle: mocks.resolveDidToHandle }));

describe("initOAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.init.mockReset().mockResolvedValue(undefined);
    mocks.load.mockReset().mockResolvedValue({ init: mocks.init });
    mocks.resolveIdentity.mockReset();
    mocks.resolveDidToHandle.mockReset();
    mocks.Agent.mockReset().mockReturnValue({
      com: { atproto: { identity: { resolveIdentity: mocks.resolveIdentity } } },
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { hostname: "127.0.0.1", pathname: "/", port: "5173", origin: "http://127.0.0.1:5173" },
    });
  });

  it("deduplicates concurrent callback initialization", async () => {
    const { initOAuth } = await import("./oauth");
    const [first, second] = await Promise.all([initOAuth(), initOAuth()]);
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.init).toHaveBeenCalledOnce();
  });

  it("uses the validated account handle instead of the profile display name", async () => {
    mocks.init.mockResolvedValue({ session: { did: "did:plc:abc123" } } as any);
    mocks.resolveIdentity.mockResolvedValue({ data: { handle: "takeru.example.com" } });

    const { initOAuth } = await import("./oauth");
    const result = await initOAuth();

    expect(result?.handle).toBe("takeru.example.com");
    expect(mocks.resolveIdentity).toHaveBeenCalledWith({ identifier: "did:plc:abc123" });
  });

  it("falls back to the DID document when the PDS cannot resolve identity", async () => {
    mocks.init.mockResolvedValue({ session: { did: "did:plc:abc123" } } as any);
    mocks.resolveIdentity.mockRejectedValue(new Error("Method not implemented"));
    mocks.resolveDidToHandle.mockResolvedValue("alice.bsky.social");

    const { initOAuth } = await import("./oauth");
    const result = await initOAuth();

    expect(result?.handle).toBe("alice.bsky.social");
    expect(mocks.resolveDidToHandle).toHaveBeenCalledWith("did:plc:abc123");
  });
});
