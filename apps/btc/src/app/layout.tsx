import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Percolator',
  description: 'BTC-native perpetual futures trading',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} font-mono antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
