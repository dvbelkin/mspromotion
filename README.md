# MS Promotion

Static Astro site for MS Promotion with a small file-based admin backend.

## Stack

- Astro
- Tailwind CSS
- Markdown content collections
- Custom admin API for editing content in the browser

## What is inside

- Home page, services, contact, history, projects, events, promos
- Markdown content in `src/content/*`
- Public assets in `public/uploads/*`
- Admin UI in `public/admin/index.html`
- Admin API in `scripts/admin-server.mjs`

## Local development

```bash
npm install
npm run dev
```

Checks and build:

```bash
npm run check
npm run build
npm run preview
```

## Admin backend

The custom admin backend is the replacement for the old CMS.

It:

- protects `/admin` and `/api` by IP in `mspromotion.conf`
- uses a simple login form with `ADMIN_USER` and `ADMIN_PASSWORD`
- reads and writes markdown files in `src/content/*`
- uploads images into `public/uploads/admin/*`
- runs `npm run build` after saves and uploads

Start it locally:

```bash
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="change-me"
npm run admin
```

Environment variables:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ADMIN_PORT`
- `ADMIN_BUILD_COMMAND`

Default backend URL:

- `http://127.0.0.1:8787`

## Deployment

The deploy script uploads the source tree to the server, then runs `npm ci && npm run build` there.

The public site is still static and built with:

```bash
npm run build
```

The backend expects the same writable checkout on the server so edits can persist and rebuild there.

## Legacy

Old URLs are mapped by redirects in `astro.config.mjs` and `public/_redirects`.
