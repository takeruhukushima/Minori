import type { APIRoute } from "astro";
import config from "../../minori.config.ts";

// robots.txt pointing crawlers at the sitemap (requirement 15A).
export const GET: APIRoute = () => {
  const site = config.siteUrl.replace(/\/+$/, "");
  const body = `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
};
