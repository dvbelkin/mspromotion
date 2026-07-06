import { z, defineCollection } from "astro:content";

const eventCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    dateStart: z.coerce.date(),
    dateEnd: z.coerce.date().optional(),
    city: z.string().optional(),
    place: z.string().optional(),
    descriptionShort: z.string(),
    coverImage: z.string(),
    slug: z.string().optional(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().optional(),
    status: z.enum(["draft", "published"]).default("draft")
  })
});

const promoCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    dateTo: z.coerce.date().optional(),
    discountText: z.string().optional(),
    descriptionShort: z.string(),
    coverImage: z.string(),
    slug: z.string().optional(),
    ctaUrl: z.string().default("/contact"),
    status: z.enum(["draft", "published"]).default("draft")
  })
});

const projectCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    industry: z.string().optional(),
    tags: z.array(z.string()).default([]),
    year: z.number().optional(),
    descriptionShort: z.string(),
    coverImage: z.string(),
    slug: z.string().optional(),
    gallery: z
      .array(
        z.union([
          z.string(),
          z.object({
            image: z.string(),
            caption: z.string().optional()
          })
        ])
      )
      .default([]),
    status: z.enum(["draft", "published"]).default("draft")
  })
});

const pageCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    descriptionShort: z.string(),
    status: z.enum(["draft", "published"]).default("draft")
  })
});

export const collections = {
  events: eventCollection,
  promos: promoCollection,
  projects: projectCollection,
  pages: pageCollection
};
