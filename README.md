# MS Promotion

Static Astro site for MS Promotion with a file-based admin backend.

## Stack

- Astro
- Tailwind CSS
- Markdown content collections
- Custom admin API for browser editing and server-side rebuilds

## Project structure

- Site pages: `src/pages/*`
- Content collections: `src/content/*`
- Public assets: `public/*`
- Admin UI: `public/admin/index.html`
- Admin API: `scripts/admin-server.mjs`
- Deploy script: `deploy.ps1`

## Local development

Install and run:

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

Local admin development:

```bash
npm run admin
```

Local URLs:

- site: `http://127.0.0.1:4321/`
- admin UI: `http://127.0.0.1:4321/admin/index.html`
- admin API: `http://127.0.0.1:8787`

## Admin backend

The custom admin backend replaces the old CMS.

It:

- authenticates with `ADMIN_USER` and `ADMIN_PASSWORD`
- reads and writes markdown entries
- uploads images
- performs server-side crop, resize, and JPEG compression for admin photo uploads
- runs `npm run build` after content and media changes

Environment variables:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ADMIN_PORT`
- `ADMIN_BUILD_COMMAND`

These values are expected in the project root `.env` file. The file is already ignored by git and must not be committed.

Default local credentials:

- user: `admin`
- password: `change-me`

## Image handling

Admin uploads are intended for site photos, not archival originals.

Behavior:

- `Cover image` and `Gallery` uploads open a crop UI in admin
- crop is applied again on the server through `sharp`
- output is resized to fixed presets and compressed
- existing images can be re-cropped

Current presets:

- `events:coverImage` -> `1280x704`
- `projects:coverImage` -> `1280x768`
- `promos:coverImage` -> `1280x768`
- `events/projects/promos:gallery` -> `1120x720`

For existing entries, upload/recrop is expected to update the entry and rebuild the site. If a new file appears in uploads but the site still shows the old image, verify that the entry frontmatter `coverImage` or `gallery` path actually changed.

Optional one-off local optimization for existing JPEGs:

```powershell
Get-ChildItem .\public\uploads -Recurse -File -Include *.jpg,*.jpeg | ForEach-Object {
  $tmp = Join-Path $_.DirectoryName ($_.BaseName + ".opt.jpg")
  ffmpeg -y -i $_.FullName -vf "scale='if(gt(iw,1600),1600,iw)':-2" -q:v 4 $tmp
  Move-Item -Force $tmp $_.FullName
}
```

## Production data layout

Production uses `shared` as the persistent data source.

Expected locations on the server:

- content source: `/var/www/mspromotion/shared/src/content/*`
- uploaded files source: `/var/www/mspromotion/shared/public/uploads/*`
- active release: `/var/www/mspromotion/current`

The release checkout should use symlinks:

- `/var/www/mspromotion/current/src/content/events` -> `shared/src/content/events`
- `/var/www/mspromotion/current/src/content/pages` -> `shared/src/content/pages`
- `/var/www/mspromotion/current/src/content/projects` -> `shared/src/content/projects`
- `/var/www/mspromotion/current/src/content/promos` -> `shared/src/content/promos`
- `/var/www/mspromotion/current/public/uploads` -> `shared/public/uploads`

Static output is still built inside the current release:

- `/var/www/mspromotion/current/dist/*`

Important:

- `shared` is the source of truth for production content and uploaded media
- `dist` is only build output
- if `shared` is empty, the site will lose pages and images after rebuild

## Deployment

`deploy.ps1` uploads the application code, installs dependencies on the server, links shared data into the new release, creates a backup of `shared`, builds the static site on the server, and restarts the admin backend through `pm2` by default.

Production deploy model:

- code comes from the release archive
- content and uploads come from `shared`
- releases should be treated as stateless with respect to content data

Required before first production deploy:

- install `pm2` on the server
- run `pm2 startup` once under the deployment user and execute the command it prints
- initialize `/var/www/mspromotion/shared/src/content/*` and `/var/www/mspromotion/shared/public/uploads/*` from a known-good backup

Recommended deploy invocation:

```powershell
.\deploy.ps1
```

Notes:

- `deploy.ps1` reads admin auth settings from the project root `.env` file by default
- if `shared/src/content` or `shared/public/uploads` is empty, deploy fails before switching `current`
- each deploy writes a backup archive to `/var/www/mspromotion/backups/shared-<timestamp>.tar.gz`
- the remote release is rebuilt with `npm run build`; `dist` is no longer assumed to exist
- the admin backend is restarted as the `pm2` app `mspromotion-admin`; override with `-Pm2AppName`
- deploy runs `pm2 save` after restart so the process list survives reboot after `pm2 startup`
- use `-ProcessManager nohup` only as a fallback on hosts without `pm2`

After deploy, useful checks on the server:

```bash
ls -la /var/www/mspromotion/current/src/content
ls -la /var/www/mspromotion/current/public
ls -la /var/www/mspromotion/backups | tail
pm2 status mspromotion-admin
curl http://127.0.0.1:8787/health
```

If content pages disappear on prod, first verify that `shared/src/content/*` still contains markdown files and that `current/src/content/*` points to it by symlink.

## Troubleshooting

Check current image path stored in content:

```bash
grep -n "coverImage:" /var/www/mspromotion/shared/src/content/promos/<slug>.md
```

Check whether a new uploaded file exists:

```bash
find /var/www/mspromotion/shared/public/uploads/admin -type f | tail -20
```

Check what image path got baked into the static page:

```bash
grep -n "<slug>" /var/www/mspromotion/current/dist/promos/index.html
grep -n "<slug>" /var/www/mspromotion/current/dist/promos/<slug>/index.html
```

If `shared` was lost or emptied, restore it from a previous good release before rebuilding.

## Legacy

Old URLs are mapped by redirects in `astro.config.mjs` and `public/_redirects`.
