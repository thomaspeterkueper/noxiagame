// app/_components/MusicProvider.tsx
// Erstellt: 31.05.2026
// Globaler Audio-Context – Musik läuft persistent über alle Seiten

'use client'

import React from 'react'

import { createContext, useContext, useRef, useState, useEffect } from 'react'

interface MusicContextType {
  playing:    boolean
  volume:     number
  play:       () => void
  pause:      () => void
  toggle:     () => void
  setVolume:  (v: number) => void
}

const MusicContext = createContext<MusicContextType>({
  playing: false, volume: 0.4,
  play: () => {}, pause: () => {}, toggle: () => {}, setVolume: () => {},
})

export function useMusicContext() { return useContext(MusicContext) }

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef          = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.4)

  useEffect(() => {
    const audio = new Audio('/audio/noxia_theme.mp3')
    audio.loop   = true
    audio.volume = 0.4
    audioRef.current = audio
    // Globales Objekt damit MusicLink.tsx es starten kann
    ;(window as any).__noxiaAudio = audio
    return () => { audio.pause(); audio.src = '' }
  }, [])

  function play() {
    audioRef.current?.play().catch(() => {})
    setPlaying(true)
  }
  function pause() {
    audioRef.current?.pause()
    setPlaying(false)
  }
  function toggle() { playing ? pause() : play() }
  function setVolume(v: number) {
    if (audioRef.current) audioRef.current.volume = v
    setVolumeState(v)
  }

  return (
    <MusicContext.Provider value={{ playing, volume, play, pause, toggle, setVolume }}>
      {children}
    </MusicContext.Provider>
  )
}
