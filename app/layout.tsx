// app/layout.tsx
// Aktualisiert: 31.05.2026 – MusicProvider + MusicControls global

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import MusicProvider from './_components/MusicProvider'
import MusicControls from './_components/MusicControls'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'noχ¹ᐃ – Sonnensystem-Handelssimulation',
  description: 'Versorge Kolonien auf Mond, Mars und Phobos. Alpha 0.1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <MusicProvider>
          {children}
          <MusicControls />
        </MusicProvider>
      </body>
    </html>
  )
}
