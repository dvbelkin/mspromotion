import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const writeDirectly = process.argv.includes("--write");

const sourcePaths = {
  events: path.join(root, "data", "events.json"),
  promos: path.join(root, "data", "promos.json"),
  projects: path.join(root, "data", "projects.json")
};

const targetBase = writeDirectly
  ? path.join(root, "src", "content")
  : path.join(root, "migrations", "generated");

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const escapeQuotes = (value) => String(value || "").replace(/"/g, "\\\"");

const toEventMarkdown = (event) => {
  const slug = event.slug || event.id || slugify(event.title);
  return `---
title: "${escapeQuotes(event.title)}"
dateStart: ${event.date || "2026-01-01"}
city: "${escapeQuotes(event.city || "")}" 
place: "${escapeQuotes(event.location || event.place || "")}"
descriptionShort: "${escapeQuotes(event.description || "")}" 
coverImage: "${escapeQuotes(event.image || "/uploads/event-pyaterochka.webp")}" 
slug: "${slug}"
ctaText: "${escapeQuotes(event.cta || "Подробнее")}" 
ctaUrl: "${escapeQuotes(event.link || "/contact")}" 
status: "published"
---

${event.description || "Описание будет добавлено при ручной миграции."}
`;
};

const toPromoMarkdown = (promo) => {
  const slug = promo.slug || promo.id || slugify(promo.title);
  return `---
title: "${escapeQuotes(promo.title)}"
dateTo: ${promo.dateTo || "2026-12-31"}
discountText: "${escapeQuotes(promo.badge || "")}" 
descriptionShort: "${escapeQuotes(promo.description || "")}" 
coverImage: "${escapeQuotes(promo.image || "/uploads/promo-domik.webp")}" 
slug: "${slug}"
ctaUrl: "${escapeQuotes(promo.link || "/contact")}" 
status: "published"
---

${promo.description || "Описание будет добавлено при ручной миграции."}
`;
};

const toProjectMarkdown = (project) => {
  const slug = project.slug || project.id || slugify(project.title);
  const tags = Array.isArray(project.tags) ? project.tags.map((tag) => `"${escapeQuotes(tag)}"`).join(", ") : "";
  return `---
title: "${escapeQuotes(project.title)}"
industry: "${escapeQuotes(project.industry || "")}" 
tags: [${tags}]
year: ${project.year || Number(String(project.date || "").slice(0, 4)) || 2026}
descriptionShort: "${escapeQuotes(project.summary || project.descriptionShort || "")}" 
coverImage: "${escapeQuotes(project.image || "/uploads/event-pyaterochka.webp")}" 
slug: "${slug}"
gallery: []
status: "published"
---

${project.summary || "Описание будет добавлено при ручной миграции."}
`;
};

const run = async () => {
  await fs.mkdir(targetBase, { recursive: true });

  const [eventsRaw, promosRaw, projectsRaw] = await Promise.all([
    fs.readFile(sourcePaths.events, "utf8"),
    fs.readFile(sourcePaths.promos, "utf8"),
    fs.readFile(sourcePaths.projects, "utf8")
  ]);

  const events = JSON.parse(eventsRaw);
  const promos = JSON.parse(promosRaw);
  const projects = JSON.parse(projectsRaw);

  const collections = [
    { name: "events", items: events, map: toEventMarkdown },
    { name: "promos", items: promos, map: toPromoMarkdown },
    { name: "projects", items: projects, map: toProjectMarkdown }
  ];

  for (const collection of collections) {
    const folder = path.join(targetBase, collection.name);
    await fs.mkdir(folder, { recursive: true });

    for (const item of collection.items) {
      const slug = item.slug || item.id || slugify(item.title || "item");
      const markdown = collection.map(item);
      await fs.writeFile(path.join(folder, `${slug}.md`), markdown, "utf8");
    }

    console.log(`${collection.name}: ${collection.items.length} files`);
  }

  console.log(writeDirectly ? "Written to src/content/*" : `Preview files written to ${targetBase}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
