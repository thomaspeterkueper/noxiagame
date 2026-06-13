// app/_components/MusicLink.tsx
// Aktualisiert: 31.05.2026 – nutzt globalen MusicContext

'use client'

import { useRouter } from 'next/navigation'
import { useMusicContext } from './MusicProvider'

export default function MusicLink() {
  const { play } = useMusicContext()
  const router   = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    play()
    router.push('/dashboard')
  }

  return (
    <a href="/dashboard" onClick={handleClick} style={{
      display: 'inline-block',
      color: '#c9a961',
      fontSize: '0.8rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '3px',
      borderBottom: '1px solid #c9a961',
      paddingBottom: '8px',
      textDecoration: 'none',
      fontFamily: 'sans-serif',
      textShadow: '0 1px 8px rgba(0,0,0,0.9)',
      marginTop: '1rem',
    }}>
      Ins Universum
    </a>
  )
}
