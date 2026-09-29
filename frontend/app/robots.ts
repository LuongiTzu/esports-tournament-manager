import type { MetadataRoute } from "next";
import { absoluteSiteUrl, getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/profile",
        "/users/",
        "/tournaments/new",
        "/tournaments/*/manage",
        "/tournaments/*/register-team",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: getSiteUrl().origin,
  };
}
