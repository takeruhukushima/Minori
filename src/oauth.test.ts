import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  load: vi.fn(),
}));

vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: { load: mocks.load },
  buildLoopbackClientId: vi.fn(() => "http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2F"),
}));

vi.mock("@atproto/api", () => ({ Agent: vi.fn() }));

describe("initOAuth", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { hostname: "127.0.0.1", pathname: "/", port: "5173", origin: "http://127.0.0.1:5173" },
    });
    mocks.load.mockResolvedValue({ init: mocks.init });
  });

  it("deduplicates concurrent callback initialization", async () => {
    const { initOAuth } = await import("./oauth");
    const [first, second] = await Promise.all([initOAuth(), initOAuth()]);
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.init).toHaveBeenCalledOnce();
  });
});
