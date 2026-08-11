import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const scope = [
  "atproto",
  "id.sifa.profile.position",
  "pub.paper.reference",
  "pub.paper.collection",
  "pub.paper.collectionItem",
  "id.career.profile",
  "id.career.education",
  "id.career.authorship",
  "id.career.presentation",
  "id.career.grant",
  "id.career.award",
  "id.career.service",
  "id.career.membership",
  "id.career.teaching",
  "id.career.supervision",
  "id.career.patent",
  "id.career.outreach",
  "id.career.work",
  "id.career.openSourceContribution",
].map((value, index) => index === 0 ? value : `repo:${value}`).join(" ");

function oauthMetadata(origin?: string): Plugin {
  return {
    name: "minori-oauth-metadata",
    generateBundle() {
      if (!origin) return;
      const normalized = origin.replace(/\/+$/, "");
      this.emitFile({
        type: "asset",
        fileName: "client-metadata.json",
        source: JSON.stringify({
          client_id: `${normalized}/client-metadata.json`,
          client_name: "Minori",
          client_uri: normalized,
          redirect_uris: [`${normalized}/`],
          scope,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          application_type: "web",
          token_endpoint_auth_method: "none",
          dpop_bound_access_tokens: true,
        }, null, 2),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Keep Git-connected Cloudflare builds OAuth-capable even when the build
  // variable has not been configured yet. VITE_PUBLIC_URL still overrides
  // this for a future custom domain.
  const publicUrl =
    env.VITE_PUBLIC_URL || env.CF_PAGES_URL || "https://minori.takeruf.workers.dev";
  return {
    plugins: [react(), oauthMetadata(publicUrl)],
    server: { host: "127.0.0.1", port: 5173 },
    build: {
      rollupOptions: {
        output: { manualChunks: { atproto: ["@atproto/api", "@atproto/oauth-client-browser"] } },
      },
    },
  };
});
