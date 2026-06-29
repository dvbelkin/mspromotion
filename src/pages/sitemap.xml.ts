import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { contentSlug } from "@/lib/content-slug";
import { SITE_URL } from "@/lib/site";

const staticRoutes = ["/", "/projects", "/events", "/promos", "/services", "/contact", "/legacy"];

const toXmlUrl = (path: string, lastmod?: string) => {
  const loc = `${SITE_URL}${path === "/" ? "/" : path}`;
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    "  </url>"
  ]
    .filter(Boolean)
    .join("\n");
};

export const GET: APIRoute = async () => {
  const events = await getCollection("events", ({ data }) => data.status === "published");
  const promos = await getCollection("promos", ({ data }) => data.status === "published");
  const projects = await getCollection("projects", ({ data }) => data.status === "published");

  const urls: string[] = [];

  staticRoutes.forEach((route) => {
    urls.push(toXmlUrl(route));
  });

  for (const entry of projects) {
    const lastmod = entry.data.updatedAt?.toISOString() || (entry.data.year ? new Date(`${entry.data.year}-12-31T00:00:00.000Z`).toISOString() : undefined);
    urls.push(toXmlUrl(`/projects/${contentSlug(entry)}`, lastmod));
  }

  for (const entry of events) {
    urls.push(toXmlUrl(`/events/${contentSlug(entry)}`, entry.data.updatedAt?.toISOString() || entry.data.dateStart.toISOString()));
  }

  for (const entry of promos) {
    const lastmod = entry.data.updatedAt?.toISOString() || entry.data.dateTo?.toISOString();
    urls.push(toXmlUrl(`/promos/${contentSlug(entry)}`, lastmod));
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join("\n"),
    "</urlset>",
    ""
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
