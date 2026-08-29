# Minori Self-Host CV

Generate a **static, self-owned academic CV** from your AT Protocol PDS and host
it on your own GitHub Pages / custom domain. Your CV content lives in your PDS
(the source of truth) — this repository only fetches it at build time and
renders a single static HTML page that is readable **with JavaScript disabled**
and search-engine friendly (canonical URL, Open Graph, sitemap, `robots.txt`,
schema.org `Person` / `ScholarlyArticle`).

## Fork vs. Use this template

- **Use this template** (recommended default): creates a fresh repository you
  fully own and can redesign. Best if you want your own look and structure.
- **Fork**: keeps a link to upstream Minori so you can pull in improvements.
  Best if you mainly want the default CV and future updates.

## Setup

1. Create your repo (template or fork) and enable **Settings → Pages →
   Source: GitHub Actions**.
2. Edit [`minori.config.ts`](./minori.config.ts):
   ```ts
   const config = {
     handle: "you.example.com",          // your handle or did:plc:...
     siteUrl: "https://you.example.com", // your custom domain or https://<user>.github.io/<repo>
     deploymentMode: "static",
     locale: "ja",                        // or "en"
   };
   ```
3. (Optional) Replace `public/default-og.svg` with your own share image.
4. Commit. The workflow builds and deploys automatically.

## Local preview

```bash
pnpm install     # or npm install
pnpm build       # fetches your PDS records and writes ./dist
pnpm preview
```

If your handle cannot be resolved, or your PDS is unreachable, **the build
fails on purpose** so a broken run never replaces your last good deploy.

## Updating after you change your CV

Your published CV does not change until you rebuild. Re-run the
**"Build self-host CV"** GitHub Action (Actions tab → Run workflow), or wait for
the weekly scheduled rebuild. Tune the schedule in
`.github/workflows/selfhost-build.yml`.

## Custom domain

Add a `CNAME` file (or configure it under Settings → Pages → Custom domain) with
your domain, point your DNS at GitHub Pages, and set `siteUrl` to the same
domain so canonical/OGP/sitemap all match.
