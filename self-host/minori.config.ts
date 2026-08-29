// Self-host configuration. Fork or "Use this template", set your handle and
// site URL below, then deploy self-host/ to GitHub Pages. Your CV content is
// NOT stored here — it is fetched from your PDS at build time.

export interface MinoriConfig {
  /** Your AT Protocol handle or DID, e.g. "researcher.example.com" or "did:plc:...". */
  handle: string;
  /** The canonical URL where this site is served (custom domain or *.github.io/<repo>). */
  siteUrl: string;
  /** Only "static" is supported for the self-host build. */
  deploymentMode: "static";
  /** Default CV content + UI language. */
  locale: "ja" | "en";
}

const config: MinoriConfig = {
  handle: "researcher.example.com",
  siteUrl: "https://researcher.example.com",
  deploymentMode: "static",
  locale: "ja",
};

export default config;
