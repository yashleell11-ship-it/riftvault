import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/explore`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/earn`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${APP_URL}/reserve`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${APP_URL}/airdrop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${APP_URL}/developers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
