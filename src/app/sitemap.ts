import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://chainshield.app', lastModified: new Date(), priority: 1.0 },
    { url: 'https://chainshield.app/about', lastModified: new Date(), priority: 0.5 },
    { url: 'https://chainshield.app/privacy', lastModified: new Date(), priority: 0.3 },
  ];
}
