import type { APIRoute } from "astro";
import config from "../../minori.config.ts";

// Single-page sitemap for the root CV (requirement 15A). The CV is one page;
// sections are fragment anchors, not separate URLs, so only "/" is listed.
export const GET: APIRoute = () => {
  const site = config.siteUrl.replace(/\/+$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
