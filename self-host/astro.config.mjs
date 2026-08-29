import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import config from "./minori.config.ts";

// Static self-host build. site is read from minori.config.ts so canonical,
// sitemap and OGP all point at the researcher's own domain (requirement 17).
export default defineConfig({
  site: config.siteUrl,
  output: "static",
  integrations: [react()],
});
