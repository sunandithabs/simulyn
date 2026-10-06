import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Syne } from 'next/font/google';
import { Toaster } from 'sonner';

import { ConsentGate } from '@/components/research/consent-gate';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} ${syne.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('simulyn.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AuthProvider>
            <div className="relative z-10">{children}</div>
            <ConsentGate />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--color-ink-raised)',
                  border: '1px solid var(--color-line-strong)',
                  color: 'var(--color-paper)',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
