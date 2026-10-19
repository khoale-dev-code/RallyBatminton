import { type MetadataRoute } from 'next';

import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin-login',
        '/checkin',
        '/account',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/auth',
        '/booking/lookup',
      ],
    },
    host: publicEnv.siteUrl,
  };
}
