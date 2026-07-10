// app/layout.tsx
// Aktualisiert: 2026-07-10 — globaler Legal-Footer ergänzt (NOX-0006)
// Version:      1.1.0

import type { Metadata } from 'next'
import { Geist, Geist_Mono, Courier_Prime, Playfair_Display } from 'next/font/google'
import './globals.css'
import MusicProvider from './_components/MusicProvider'
import MusicControls from './_components/MusicControls'
import SiteFooter from './_components/SiteFooter'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
  display: 'swap',
})

const playfair = Playfair_Display({
  weight: ['400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'noχ¹ᐃ – Sonnensystem-Handelssimulation',
  description: 'Versorge Kolonien auf Mond, Mars und Phobos. Alpha 0.1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${courierPrime.variable} ${playfair.variable} h-full antialiased`}
    >
      <head />
      <body className="min-h-full flex flex-col">
        <MusicProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>{children}</div>
            <SiteFooter />
          </div>
          <MusicControls />
        </MusicProvider>
      </body>
    </html>
  )
}
