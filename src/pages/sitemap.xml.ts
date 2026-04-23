import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://www.ms-promotion.ru";

const staticRoutes = ["/", "/projects", "/services", "/contact", "/legacy"];

const toXmlUrl = (path: string, lastmod?: string) => {
  const loc = `${SITE}${path === "/" ? "/" : path}`;
  return [
    "<url>",
    `<loc>${loc}</loc>`,
    lastmod ? `<lastmod>${lastmod}</lastmod>` : "",
    "</url>"
  ].join("");
};

export const GET: APIRoute = async () => {
  const events = await getCollection("events", ({ data }) => data.status === "published");
  const promos = await getCollection("promos", ({ data }) => data.status === "published");
  const projects = await getCollection("projects", ({ data }) => data.status === "published");

  const urls: string[] = [];

  staticRoutes.forEach((route) => {
    urls.push(toXmlUrl(route));
  });

  projects.forEach((entry) => {
    const lastmod = entry.data.year ? new Date(`${entry.data.year}-12-31T00:00:00.000Z`).toISOString() : undefined;
    urls.push(toXmlUrl(`/projects/${entry.slug}`, lastmod));
  });

  events.forEach((entry) => {
    urls.push(toXmlUrl(`/events/${entry.slug}`, entry.data.dateStart.toISOString()));
  });

  promos.forEach((entry) => {
    const lastmod = entry.data.dateTo ? entry.data.dateTo.toISOString() : undefined;
    urls.push(toXmlUrl(`/promos/${entry.slug}`, lastmod));
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
