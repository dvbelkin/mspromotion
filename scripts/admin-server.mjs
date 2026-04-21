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
      { name: "status", label: "Status", kind: "select", options: ["draft", "published"] }
    ]
  }
};

const uploadsRoot = path.join(repoRoot, "public", "uploads", "admin");

let buildChain = Promise.resolve();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  res.end(body);
}

function unauthorized(res) {
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="MS Promotion Admin", charset="UTF-8"',
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
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
    unauthorized(res);
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
  const markdown = serializeEntry(collectionName, safeNextSlug, data, body);

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

async function saveUpload({ filename, mimeType, base64 }) {
  if (typeof base64 !== "string" || !base64) {
    throw new Error("Upload payload is missing file data.");
  }

  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Upload payload must be a base64 data URL.");
  }

  const data = Buffer.from(match[2], "base64");
  const extension = inferUploadExtension(filename, mimeType || match[1]);
  const outputName = `${Date.now()}-${safeFilename(filename).replace(/\.[^.]+$/, "")}.${extension}`;
  const outputPath = path.join(uploadsRoot, outputName);

  await ensureDir(uploadsRoot);
  await fs.writeFile(outputPath, data);

  return {
    path: `/uploads/admin/${outputName}`,
    fileName: outputName
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

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (!requireAuthorized(req, res)) {
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/bootstrap") {
        json(res, 200, await bootstrap());
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/entry") {
        const collection = url.searchParams.get("collection");
        const slug = url.searchParams.get("slug");
        if (!collection || !slug) {
          json(res, 400, { error: "collection and slug are required" });
          return;
        }

        json(res, 200, await loadEntry(collection, slug));
        return;
      }

      if (req.method === "PUT" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const originalSlug = payload.originalSlug || payload.slug;
        const nextSlug = payload.slug || originalSlug;
        const result = await saveEntry(collection, originalSlug, nextSlug, payload.data || {}, payload.body || "");
        await enqueueBuild();
        json(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const nextSlug = payload.slug;
        const result = await saveEntry(collection, null, nextSlug, payload.data || {}, payload.body || "");
        await enqueueBuild();
        json(res, 201, { ok: true, ...result });
        return;
      }

      if (req.method === "DELETE" && url.pathname === "/api/entry") {
        const payload = await readJson(req);
        const collection = payload.collection;
        const slug = payload.slug;
        const result = await deleteEntry(collection, slug);
        await enqueueBuild();
        json(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/upload") {
        const payload = await readJson(req);
        const result = await saveUpload(payload);
        await enqueueBuild();
        json(res, 200, { ok: true, ...result });
        return;
      }

      notFound(res);
    } catch (error) {
      console.error("[admin] request failed:", error);
      json(res, 500, { error: error?.message || "Internal server error" });
    }

    return;
  }

  notFound(res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("[admin] fatal error:", error);
    text(res, 500, "Internal server error");
  });
});

server.listen(ADMIN_PORT, () => {
  console.log(`[admin] API listening on http://127.0.0.1:${ADMIN_PORT}`);
  console.log(`[admin] auth user: ${ADMIN_USER}`);
  console.log(`[admin] build command: ${BUILD_COMMAND}`);
});
