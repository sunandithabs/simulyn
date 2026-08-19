import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Syne } from 'next/font/google';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { ConsentGate } from '@/components/research/consent-gate';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SIMULYN — Virtual Engineering Labs',
  description:
    'Programming and electronics labs for engineering students: write code, simulate circuits, sit proctored exams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${syne.variable}`}>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
        <AuthProvider>
          <ConsentGate />
          <div className="relative z-10">{children}</div>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#11111f',
                border: '1px solid #ffffff1f',
                color: '#e9e9f2',
              },
            }}
          />
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
