import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/student/", "/teacher/", "/admin/", "/change-password"] },
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
