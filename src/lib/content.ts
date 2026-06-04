import { getCollection, getEntry } from "astro:content";

export async function getPublishedEvents() {
  const events = await getCollection("events", ({ data }) => data.status === "published");
  return events.sort((a, b) => b.data.dateStart.getTime() - a.data.dateStart.getTime());
}

export async function getPublishedPromos() {
  const promos = await getCollection("promos", ({ data }) => data.status === "published");
  return promos.sort((a, b) => {
    const aDate = a.data.dateTo ? a.data.dateTo.getTime() : Number.MIN_SAFE_INTEGER;
    const bDate = b.data.dateTo ? b.data.dateTo.getTime() : Number.MIN_SAFE_INTEGER;
    return bDate - aDate;
  });
}

export async function getPublishedProjects() {
  const projects = await getCollection("projects", ({ data }) => data.status === "published");
  return projects.sort((a, b) => (b.data.year || 0) - (a.data.year || 0));
}

export async function getPublishedPage(slug: string) {
  const page = await getEntry("pages", slug);
  if (!page || page.data.status !== "published") {
    return null;
  }

  return page;
}

export function formatDateRange(start: Date, end?: Date) {
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  if (!end) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
