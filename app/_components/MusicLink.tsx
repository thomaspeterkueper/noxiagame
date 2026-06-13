// app/_components/MusicLink.tsx
'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function MusicLink() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    // Musik starten
    if (!audioRef.current) {
      const audio = new Audio('/audio/noxia_theme.mp3')
      audio.loop = true
      audio.volume = 0.4
      audio.play().catch(() => {}) // Browser blockiert manchmal – kein Fehler
      audioRef.current = audio
    }
    // Zum Dashboard navigieren
    router.push('/dashboard')
  }

  return (
    <a
      href="/dashboard"
      onClick={handleClick}
      style={{
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
        transition: 'opacity 0.3s',
        marginTop: '1rem',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      Ins Universum
    </a>
  )
}
