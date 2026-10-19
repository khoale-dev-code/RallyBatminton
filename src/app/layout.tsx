import '@fontsource-variable/oswald';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import './globals.css';

import { type Metadata, type Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';

import { NavProgress } from '@/components/layout/nav-progress';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'Rally Badminton — Đặt sân cầu lông', template: '%s | Rally Badminton' },
  description: 'Xem giờ trống và giữ sân cầu lông Rally trong một phút, không cần tài khoản.',
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Rally Badminton' },
};

export const viewport: Viewport = {
  themeColor: '#62BB46',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
