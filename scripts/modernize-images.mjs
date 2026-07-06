import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const uploadsRoot = path.join(repoRoot, "public", "uploads");
const variantWidths = [110, 175, 220, 350, 360, 440, 560, 640, 840, 960, 1120, 1280];
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const textExtensions = new Set([".astro", ".md", ".ts", ".mjs"]);

async function walk(dir, entries = []) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await walk(fullPath, entries);
      continue;
    }

    entries.push(fullPath);
  }

  return entries;
}

function isVariantWebp(filePath) {
  return /-\d+w\.webp$/i.test(filePath);
}

async function ensureResponsiveVariants(baseWebpPath, baseBuffer) {
  const metadata = await sharp(baseBuffer).metadata();
  const sourceWidth = Number(metadata.width || 0);
  if (!sourceWidth) {
    return;
  }

  const basePathWithoutExtension = baseWebpPath.replace(/\.webp$/i, "");
  for (const width of variantWidths) {
    if (width >= sourceWidth) {
      continue;
    }

    const targetPath = `${basePathWithoutExtension}-${width}w.webp`;
    const outputBuffer = await sharp(baseBuffer)
      .resize({
        width,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toBuffer();
    await fs.writeFile(targetPath, outputBuffer);
  }
}

async function removeLegacySource(filePath, outputPath) {
  if (path.resolve(outputPath) === path.resolve(filePath)) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EBUSY") {
      throw error;
    }
  }
}

async function convertUploads() {
  const files = await walk(uploadsRoot);
  for (const filePath of files) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExtensions.has(ext) || isVariantWebp(filePath)) {
        continue;
      }

      const outputPath = filePath.replace(/\.(?:jpe?g|png|gif|webp)$/i, ".webp");
      const outputBuffer = await sharp(filePath, { failOn: "none", animated: true })
        .rotate()
        .resize({
          width: 1600,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 82 })
        .toBuffer();

      await fs.writeFile(outputPath, outputBuffer);
      await ensureResponsiveVariants(outputPath, outputBuffer);

      await removeLegacySource(filePath, outputPath);
    } catch (error) {
      console.warn(`Skipped ${path.relative(repoRoot, filePath)}: ${error?.code || error?.message || error}`);
    }
  }
}

async function updateReferences() {
  const targets = [
    path.join(repoRoot, "src"),
    path.join(repoRoot, "scripts", "import-legacy-json.mjs")
  ];

  const files = [];
  for (const target of targets) {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      files.push(...(await walk(target)));
    } else {
      files.push(target);
    }
  }

  for (const filePath of files) {
    if (!textExtensions.has(path.extname(filePath).toLowerCase())) {
      continue;
    }

    const source = await fs.readFile(filePath, "utf8");
    const updated = source.replace(/(\/uploads\/[^"'`\s)]+?)\.(?:jpe?g|png|gif)\b/gi, "$1.webp");
    if (updated !== source) {
      await fs.writeFile(filePath, updated, "utf8");
    }
  }
}

await convertUploads();
await updateReferences();

console.log("Converted uploads to WebP and updated references.");
