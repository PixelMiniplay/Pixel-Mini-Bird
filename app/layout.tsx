import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Flappy Bird - Retro Canvas Arcade',
  description: 'A polished, feature-rich HTML5 Canvas Flappy Bird game with customizable skins, detailed stats, particle trails, and interactive arcade themes.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-slate-950 font-sans text-slate-100 antialiased selection:bg-rose-500 selection:text-white min-h-screen flex flex-col justify-between" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
