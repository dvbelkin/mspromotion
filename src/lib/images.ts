declare const process: { cwd(): string };
// @ts-ignore
import fs from "node:fs";
// @ts-ignore
import path from "node:path";

const LEGACY_IMAGE_EXTENSION = /\.(?:jpe?g|png|gif)$/i;
const publicRoot = path.join(process.cwd(), "public");
const existingImageCache = new Map<string, boolean>();

function splitImagePath(source: string) {
  const [pathWithQuery, hash = ""] = source.split("#");
  const [pathname, query = ""] = pathWithQuery.split("?");

  return {
    pathname,
    query: query ? `?${query}` : "",
    hash: hash ? `#${hash}` : ""
  };
}

export function toModernImagePath(source: string) {
  if (!source) {
    return source;
  }

  const { pathname, query, hash } = splitImagePath(source);
  const modernPath = LEGACY_IMAGE_EXTENSION.test(pathname) ? pathname.replace(LEGACY_IMAGE_EXTENSION, ".webp") : pathname;
  return `${modernPath}${query}${hash}`;
}

export function toWidthVariantPath(source: string, width: number) {
  const normalized = toModernImagePath(source);
  const { pathname, query, hash } = splitImagePath(normalized);
  if (!pathname.toLowerCase().endsWith(".webp")) {
    return normalized;
  }

  const variantPath = pathname.replace(/\.webp$/i, `-${width}w.webp`);
  return `${variantPath}${query}${hash}`;
}

function imageExists(source: string) {
  const { pathname } = splitImagePath(source);
  if (!pathname.startsWith("/")) {
    return false;
  }

  if (!existingImageCache.has(pathname)) {
    existingImageCache.set(pathname, fs.existsSync(path.join(publicRoot, pathname.slice(1))));
  }

  return existingImageCache.get(pathname) === true;
}

export function buildResponsiveImage(source: string, widths: number[] = [], baseWidth?: number) {
  const src = toModernImagePath(source);
  const normalizedWidths = [...new Set(widths.map((width) => Number(width)).filter((width) => Number.isFinite(width) && width > 0))].sort((a, b) => a - b);
  const largestWidth = Number.isFinite(Number(baseWidth)) && Number(baseWidth) > 0 ? Number(baseWidth) : normalizedWidths[normalizedWidths.length - 1];

  if (!normalizedWidths.length || !largestWidth) {
    return { src };
  }

  const candidates = normalizedWidths
    .filter((width) => width < largestWidth)
    .map((width) => ({ width, path: toWidthVariantPath(src, width) }))
    .filter((entry) => imageExists(entry.path))
    .map((entry) => `${entry.path} ${entry.width}w`);
  candidates.push(`${src} ${largestWidth}w`);

  return {
    src,
    srcset: candidates.join(", ")
  };
}
