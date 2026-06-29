export function contentSlug(entry: { id: string; data?: { slug?: string } }) {
  const explicitSlug = entry?.data?.slug?.trim();
  if (explicitSlug) {
    return explicitSlug;
  }

  return String(entry.id || "").replace(/\.(md|mdx)$/i, "");
}
