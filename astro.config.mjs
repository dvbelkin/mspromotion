import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://www.ms-promotion.ru",
  integrations: [tailwind()],
  redirects: {
    "/events.html": "/events",
    "/promos.html": "/promos",
    "/projects.html": "/projects",
    "/cases.html": "/projects",
    "/history.html": "/legacy",
    "/admin.html": "/admin",
    "/app/bussinessevent.html": "/events",
    "/app/eventmarketing.html": "/promos",
    "/app/check.html": "/contact"
  }
});
