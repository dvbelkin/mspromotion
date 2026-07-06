import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ADMIN_USER = process.env.ADMIN_USER?.trim() || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "change-me";
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 8787);
const BUILD_COMMAND = process.env.ADMIN_BUILD_COMMAND?.trim() || "npm run build";

const COLLECTIONS = {
  events: {
    label: "Events",
    folder: "src/content/events",
    fields: [
      { name: "title", label: "Title", kind: "string" },
      { name: "dateStart", label: "Start date", kind: "date" },
      { name: "dateEnd", label: "End date", kind: "date" },
      { name: "city", label: "City", kind: "string" },
      { name: "place", label: "Place", kind: "string" },
      { name: "descriptionShort", label: "Short description", kind: "text" },
      { name: "coverImage", label: "Cover image", kind: "image" },
      { name: "seoTitle", label: "SEO title", kind: "string" },
      { name: "seoDescription", label: "SEO description", kind: "text" },
      { name: "seoImage", label: "SEO image", kind: "image" },
      { name: "gallery", label: "Gallery", kind: "gallery" },
      { name: "slug", label: "Slug", kind: "slug" },
      { name: "ctaText", label: "CTA text", kind: "string" },
      { name: "ctaUrl", label: "CTA URL", kind: "string" },
      { name: "status", label: "Status", kind: "select", options: ["draft", "published"] }
    ]
  },
  promos: {
    label: "Promos",
    folder: "src/content/promos",
    fields: [
      { name: "title", label: "Title", kind: "string" },
      { name: "dateTo", label: "End date", kind: "date" },
      { name: "discountText", label: "Discount text", kind: "string" },
      { name: "descriptionShort", label: "Short description", kind: "text" },
      { name: "coverImage", label: "Cover image", kind: "image" },
      { name: "seoTitle", label: "SEO title", kind: "string" },
      { name: "seoDescription", label: "SEO description", kind: "text" },
      { name: "seoImage", label: "SEO image", kind: "image" },
      { name: "gallery", label: "Gallery", kind: "gallery" },
      { name: "slug", label: "Slug", kind: "slug" },
      { name: "ctaUrl", label: "CTA URL", kind: "string" },
      { name: "status", label: "Status", kind: "select", options: ["draft", "published"] }
    ]
  },
  projects: {
    label: "Projects",
    folder: "src/content/projects",
    fields: [
      { name: "title", label: "Title", kind: "string" },
      { name: "industry", label: "Industry", kind: "string" },
      { name: "tags", label: "Tags", kind: "tags" },
      { name: "year", label: "Year", kind: "number" },
      { name: "descriptionShort", label: "Short description", kind: "text" },
      { name: "coverImage", label: "Cover image", kind: "image" },
      { name: "seoTitle", label: "SEO title", kind: "string" },
      { name: "seoDescription", label: "SEO description", kind: "text" },
      { name: "seoImage", label: "SEO image", kind: "image" },
      { name: "slug", label: "Slug", kind: "slug" },
      { name: "gallery", label: "Gallery", kind: "gallery" },
      { name: "status", label: "Status", kind: "select", options: ["draft", "published"] }
    ]
  },
  pages: {
    label: "Pages",
    folder: "src/content/pages",
    fields: [
      { name: "title", label: "Title", kind: "string" },
      { name: "descriptionShort", label: "Short description", kind: "text" },
      { name: "seoTitle", label: "SEO title", kind: "string" },
      { name: "seoDescription", label: "SEO description", kind: "text" },
      { name: "seoImage", label: "SEO image", kind: "image" },
      { name: "status", label: "Status", kind: "select", options: ["draft", "published"] }
    ]
  }
};

const uploadsRoot = path.join(repoRoot, "public", "uploads", "admin");
const UPLOAD_PRESETS = {
  "events:coverImage": { width: 1280, height: 704, quality: 82, variantWidths: [360, 640, 960] },
  "projects:coverImage": { width: 1280, height: 768, quality: 82, variantWidths: [360, 640, 960] },
  "promos:coverImage": { width: 1280, height: 768, quality: 82, variantWidths: [360, 640, 960] },
  "events:gallery": { width: 1120, height: 720, quality: 82, variantWidths: [360, 560, 840] },
  "projects:gallery": { width: 1120, height: 720, quality: 82, variantWidths: [360, 560, 840] },
  "promos:gallery": { width: 1120, height: 720, quality: 82, variantWidths: [360, 560, 840] },
  "events:seoImage": { width: 1200, height: 630, quality: 82, variantWidths: [600] },
  "projects:seoImage": { width: 1200, height: 630, quality: 82, variantWidths: [600] },
  "promos:seoImage": { width: 1200, height: 630, quality: 82, variantWidths: [600] },
  "pages:seoImage": { width: 1200, height: 630, quality: 82, variantWidths: [600] }
};

let buildChain = Promise.resolve();
let sharpLoader = null;
let sharpUnavailableLogged = false;

function corsHeaders(req) {
  const origin = String(req?.headers?.origin || "");
  const isLocalAdminOrigin = origin === "http://127.0.0.1:4321" || origin === "http://localhost:4321";
  if (!isLocalAdminOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin"
  };
}

function json(req, res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...corsHeaders(req)
  });
  res.end(body);
}

function text(req, res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...corsHeaders(req),
    ...headers
  });
  res.end(body);
}

function unauthorized(req, res) {
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="MS Promotion Admin", charset="UTF-8"',
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(req)
  });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

function notFound(req, res) {
  json(req, res, 404, { error: "Not found" });
}

function parseBasicAuth(header) {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = raw.indexOf(":");
  if (separator < 0) {
    return null;
  }

  return {
    user: raw.slice(0, separator),
    password: raw.slice(separator + 1)
  };
}

function isAuthorized(req) {
  const credentials = parseBasicAuth(req.headers.authorization);
  return Boolean(credentials && credentials.user === ADMIN_USER && credentials.password === ADMIN_PASSWORD);
}

function requireAuthorized(req, res) {
  if (!isAuthorized(req)) {
    unauthorized(req, res);
    return false;
  }

  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureSlug(value) {
  const slug = normalizeSlug(value);
  if (!slug) {
    throw new Error("Slug is required and must contain latin letters, numbers, or dashes.");
  }

  return slug;
}

function toSerializable(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toSerializable(entry)]));
  }

  return value;
}

function entryTitle(data, slug) {
  return String(data.title || slug);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function collectionPath(name) {
  const collection = COLLECTIONS[name];
  if (!collection) {
    throw new Error(`Unknown collection: ${name}`);
  }

  return path.join(repoRoot, collection.folder);
}

async function listEntries(collectionName) {
  const dir = collectionPath(collectionName);
  const files = await fs.readdir(dir, { withFileTypes: true });
  const mdFiles = files.filter((file) => file.isFile() && file.name.endsWith(".md")).map((file) => file.name).sort();

  const items = [];
  for (const fileName of mdFiles) {
    const slug = path.basename(fileName, ".md");
    const fullPath = path.join(dir, fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = matter(raw);
    items.push({
      slug,
      fileName,
      title: parsed.data.title || slug,
      status: parsed.data.status || "draft",
      data: toSerializable(parsed.data),
      body: parsed.content.trim()
    });
  }

  return items;
}

async function loadEntry(collectionName, slug) {
  const dir = collectionPath(collectionName);
  const safeSlug = ensureSlug(slug);
  const filePath = path.join(dir, `${safeSlug}.md`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const data = toSerializable(parsed.data);
    if (COLLECTIONS[collectionName].fields.some((field) => field.name === "slug")) {
      data.slug = safeSlug;
    }

    return {
      exists: true,
      slug: safeSlug,
      filePath,
      data,
      body: parsed.content
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        slug: safeSlug,
        filePath,
        data: {},
        body: ""
      };
    }

    throw error;
  }
}

function serializeEntry(collectionName, slug, data, body) {
  const collection = COLLECTIONS[collectionName];
  const payload = { ...data };
  const hasSlugField = collection.fields.some((field) => field.name === "slug");

  if (hasSlugField) {
    payload.slug = slug;
  }

  return matter.stringify(body || "", payload);
}

async function saveEntry(collectionName, originalSlug, nextSlug, data, body) {
  const collection = COLLECTIONS[collectionName];
  const dir = collectionPath(collectionName);
  await ensureDir(dir);

  const safeNextSlug = ensureSlug(nextSlug || originalSlug);
  const safeOriginalSlug = originalSlug ? ensureSlug(originalSlug) : safeNextSlug;
  const currentPath = path.join(dir, `${safeOriginalSlug}.md`);
  const nextPath = path.join(dir, `${safeNextSlug}.md`);
  const nextData = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  const markdown = serializeEntry(collectionName, safeNextSlug, nextData, body);

  if (currentPath !== nextPath && originalSlug) {
    try {
      await fs.unlink(currentPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await fs.writeFile(nextPath, markdown.replace(/\n{3,}/g, "\n\n"), "utf8");

  return {
    collection: collectionName,
    slug: safeNextSlug,
    path: path.relative(repoRoot, nextPath)
  };
}

async function deleteEntry(collectionName, slug) {
  const dir = collectionPath(collectionName);
  const safeSlug = ensureSlug(slug);
  const filePath = path.join(dir, `${safeSlug}.md`);

  await fs.unlink(filePath);
  return { collection: collectionName, slug: safeSlug };
}

function inferUploadExtension(filename, mimeType) {
  const byMime = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg"
  };

  const ext = byMime[mimeType?.toLowerCase()];
  if (ext) {
    return ext;
  }

  const fromName = path.extname(filename || "").replace(".", "").toLowerCase();
  return fromName || "bin";
}

function safeFilename(filename) {
  const base = path.basename(filename || "upload");
  return base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "upload";
}

function isResizeableImage(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  return normalized === "image/jpeg" || normalized === "image/jpg" || normalized === "image/png" || normalized === "image/webp" || normalized === "image/gif";
}

function resolveUploadPreset(context) {
  const collection = String(context?.collection || "").trim();
  const field = String(context?.field || "").trim();
  const preset = UPLOAD_PRESETS[`${collection}:${field}`];
  if (!preset) {
    return null;
  }

  return preset;
}

function clampCropRect(cropRect, metadata) {
  const imageWidth = Number(metadata?.width || 0);
  const imageHeight = Number(metadata?.height || 0);
  if (!imageWidth || !imageHeight || !cropRect || typeof cropRect !== "object") {
    return null;
  }

  const x = Number(cropRect.x);
  const y = Number(cropRect.y);
  const width = Number(cropRect.width);
  const height = Number(cropRect.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  const left = Math.max(0, Math.min(imageWidth - 1, Math.round(x)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round(y)));
  const maxWidth = imageWidth - left;
  const maxHeight = imageHeight - top;

  return {
    left,
    top,
    width: Math.max(1, Math.min(maxWidth, Math.round(width))),
    height: Math.max(1, Math.min(maxHeight, Math.round(height)))
  };
}

async function getSharp() {
  if (!sharpLoader) {
    sharpLoader = import("sharp")
      .then((module) => module.default || module)
      .catch((error) => {
        if (!sharpUnavailableLogged) {
          sharpUnavailableLogged = true;
          console.warn("[admin] sharp is unavailable, uploads will be saved without optimization:", error?.message || error);
        }
        return null;
      });
  }

  return sharpLoader;
}

async function optimizeImageBuffer(buffer, mimeType) {
  const sharp = await getSharp();
  if (!sharp) {
    return null;
  }

  const image = sharp(buffer, { failOn: "none", animated: true }).rotate().resize({
    width: 1600,
    withoutEnlargement: true,
    fit: "inside"
  });

  if (!isResizeableImage(mimeType)) {
    return null;
  }

  const optimizedBuffer = await image.webp({ quality: 82 }).toBuffer();
  const metadata = await sharp(optimizedBuffer).metadata();
  return {
    buffer: optimizedBuffer,
    extension: "webp",
    mimeType: "image/webp",
    width: Number(metadata.width || 0) || null,
    height: Number(metadata.height || 0) || null
  };
}

async function processPhotoUpload(buffer, preset, cropRect) {
  const sharp = await getSharp();
  if (!sharp) {
    throw new Error("Image processing is unavailable on the server.");
  }

  const normalizedBuffer = await sharp(buffer, { failOn: "none", animated: true }).rotate().toBuffer();
  let image = sharp(normalizedBuffer, { failOn: "none" });
  const metadata = await image.metadata();
  const extract = clampCropRect(cropRect, metadata);

  if (extract) {
    image = image.extract(extract);
  }

  const outputBuffer = await image
    .resize({
      width: preset.width,
      height: preset.height,
      fit: "cover",
      position: "centre",
      withoutEnlargement: false
    })
    .webp({ quality: preset.quality })
    .toBuffer();

  const optimizedMetadata = await sharp(outputBuffer).metadata();
  return {
    buffer: outputBuffer,
    extension: "webp",
    mimeType: "image/webp",
    width: Number(optimizedMetadata.width || preset.width),
    height: Number(optimizedMetadata.height || preset.height),
    sizeBytes: outputBuffer.byteLength,
    variantWidths: Array.isArray(preset.variantWidths) ? preset.variantWidths : []
  };
}

async function writeImageVariants(basePath, baseBuffer, variantWidths = []) {
  const sharp = await getSharp();
  if (!sharp || !variantWidths.length) {
    return;
  }

  const metadata = await sharp(baseBuffer).metadata();
  const sourceWidth = Number(metadata.width || 0);
  if (!sourceWidth) {
    return;
  }

  const basePathWithoutExtension = basePath.replace(/\.webp$/i, "");
  const widths = [...new Set(variantWidths.map((width) => Number(width)).filter((width) => Number.isFinite(width) && width > 0 && width < sourceWidth))];
  for (const width of widths) {
    const variantPath = `${basePathWithoutExtension}-${width}w.webp`;
    const variantBuffer = await sharp(baseBuffer)
      .resize({
        width,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toBuffer();
    await fs.writeFile(variantPath, variantBuffer);
  }
}

async function saveUpload({ filename, mimeType, base64, context }) {
  if (typeof base64 !== "string" || !base64) {
    throw new Error("Upload payload is missing file data.");
  }

  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Upload payload must be a base64 data URL.");
  }

  const data = Buffer.from(match[2], "base64");
  const detectedMimeType = (mimeType || match[1] || "").toLowerCase();
  const originalName = safeFilename(filename).replace(/\.[^.]+$/, "");
  let outputBuffer = data;
  let extension = inferUploadExtension(filename, detectedMimeType);
  let outputMimeType = detectedMimeType || match[1] || "application/octet-stream";
  let width = null;
  let height = null;
  let sizeBytes = data.byteLength;
  const preset = resolveUploadPreset(context);

  if (preset) {
    if (!isResizeableImage(detectedMimeType)) {
      throw new Error("Only JPEG, PNG, GIF, and WebP photos can be uploaded here.");
    }

    const processed = await processPhotoUpload(data, preset, context?.cropRect);
    outputBuffer = processed.buffer;
    extension = processed.extension;
    outputMimeType = processed.mimeType;
    width = processed.width;
    height = processed.height;
    sizeBytes = processed.sizeBytes;
  }

  if (!preset && isResizeableImage(detectedMimeType)) {
    const optimized = await optimizeImageBuffer(data, detectedMimeType);
    if (optimized) {
      outputBuffer = optimized.buffer;
      extension = optimized.extension;
      outputMimeType = optimized.mimeType;
      width = optimized.width;
      height = optimized.height;
      sizeBytes = optimized.buffer.byteLength;
    }
  }

  const outputName = `${Date.now()}-${originalName}.${extension}`;
  const outputPath = path.join(uploadsRoot, outputName);

  await ensureDir(uploadsRoot);
  await fs.writeFile(outputPath, outputBuffer);
  await writeImageVariants(outputPath, outputBuffer, preset?.variantWidths || []);

  return {
    path: `/uploads/admin/${outputName}`,
    fileName: outputName,
    mimeType: outputMimeType,
    width,
    height,
    sizeBytes
  };
}

function normalizeGalleryValue(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim() ? item : null;
      }

      if (item && typeof item === "object" && typeof item.image === "string" && item.image.trim()) {
        return item.caption ? { image: item.image.trim(), caption: String(item.caption).trim() } : item.image.trim();
      }

      return null;
    })
    .filter(Boolean);
}

async function attachUploadToEntry(result, context) {
  const collectionName = String(context?.collection || "").trim();
  const fieldName = String(context?.field || "").trim();
  const entrySlug = String(context?.entrySlug || "").trim();
  const persistMode = String(context?.persistMode || "").trim();

  if (!collectionName || !fieldName || !entrySlug || !persistMode) {
    return null;
  }

  const entry = await loadEntry(collectionName, entrySlug);
  if (!entry.exists) {
    throw new Error(`Entry not found for upload attach: ${collectionName}/${entrySlug}`);
  }

  const nextData = { ...(entry.data || {}) };

  if (persistMode === "replaceField") {
    nextData[fieldName] = result.path;
  } else if (persistMode === "appendGallery") {
    const currentItems = normalizeGalleryValue(nextData[fieldName]);
    currentItems.push(result.path);
    nextData[fieldName] = currentItems;
  } else if (persistMode === "replaceGalleryItem") {
    const currentItems = normalizeGalleryValue(nextData[fieldName]);
    const index = Number(context?.galleryIndex);
    if (!Number.isInteger(index) || index < 0 || index >= currentItems.length) {
      throw new Error("Gallery item index is invalid.");
    }

    const existing = currentItems[index];
    if (existing && typeof existing === "object" && typeof existing.caption === "string" && existing.caption.trim()) {
      currentItems[index] = { image: result.path, caption: existing.caption.trim() };
    } else {
      currentItems[index] = result.path;
    }
    nextData[fieldName] = currentItems;
  } else {
    return null;
  }

  const saved = await saveEntry(collectionName, entrySlug, entrySlug, nextData, entry.body || "");
  return {
    ...saved,
    data: nextData
  };
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(BUILD_COMMAND, {
      cwd: repoRoot,
      shell: true,
      stdio: "inherit",
      env: process.env
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Build failed with exit code ${code}`));
    });
  });
}

function enqueueBuild() {
  const job = buildChain.then(() => runBuild());
  buildChain = job.catch((error) => {
    console.error("[admin] build failed:", error);
  });
  return job;
}

async function bootstrap() {
  const collections = await Promise.all(
    Object.entries(COLLECTIONS).map(async ([name, collection]) => {
      const entries = await listEntries(name);
      return {
        name,
        label: collection.label,
        folder: collection.folder,
        fields: collection.fields,
        entries
      };
    })
  );

  return { collections };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    res.writeHead(204, {
      ...corsHeaders(req),
      "Content-Length": "0"
    });
    res.end();
    return;
  }

  if (url.pathname === "/health") {
    json(req, res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (!requireAuthorized(req, res)) {
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/bootstrap") {
        json(req, res, 200, await bootstrap());
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/entry") {
        const collection = url.searchParams.get("collection");
        const slug = url.searchParams.get("slug");
        if (!collection || !slug) {
          json(req, res, 400, { error: "collection and slug are required" });
          return;
        }

        json(req, res, 200, await loadEntry(collection, slug));
        return;
      }

      if (req.method === "PUT" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const originalSlug = payload.originalSlug || payload.slug;
        const nextSlug = payload.slug || originalSlug;
        const result = await saveEntry(collection, originalSlug, nextSlug, payload.data || {}, payload.body || "");
        await enqueueBuild();
        json(req, res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const nextSlug = payload.slug;
        const result = await saveEntry(collection, null, nextSlug, payload.data || {}, payload.body || "");
        await enqueueBuild();
        json(req, res, 201, { ok: true, ...result });
        return;
      }

      if (req.method === "DELETE" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const slug = payload.slug;
        const result = await deleteEntry(collection, slug);
        await enqueueBuild();
        json(req, res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/upload") {
        const payload = await readJson(req);
        const result = await saveUpload(payload);
        const attached = await attachUploadToEntry(result, payload.context);
        await enqueueBuild();
        json(req, res, 200, {
          ok: true,
          ...result,
          entryUpdated: Boolean(attached),
          entryPath: attached?.path || null,
          entryData: attached?.data || null
        });
        return;
      }

      notFound(req, res);
    } catch (error) {
      console.error("[admin] request failed:", error);
      json(req, res, 500, { error: error?.message || "Internal server error" });
    }

    return;
  }

  notFound(req, res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("[admin] fatal error:", error);
    text(req, res, 500, "Internal server error");
  });
});

server.listen(ADMIN_PORT, () => {
  console.log(`[admin] API listening on http://127.0.0.1:${ADMIN_PORT}`);
  console.log(`[admin] auth user: ${ADMIN_USER}`);
  console.log(`[admin] build command: ${BUILD_COMMAND}`);
});
