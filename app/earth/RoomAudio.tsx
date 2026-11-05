'use client'
// Ton im Innenraum (Thomas, 03.11.2026): Sprachausgabe des Browsers (an/aus, Text steht immer
// dabei) und Lounge-Musik im Gastraum. Beides lässt sich ausschalten; die Wahl bleibt gemerkt.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMusicContext } from '../_components/MusicProvider'
import { loadSpeechEnabled, saveSpeechEnabled, speak as browserSpeak, speechSupported, stopSpeaking } from '@/lib/speech/browserSpeech'
import { LOUNGE_TRACKS, loungeUrl, nextLoungeIndex } from '@/lib/game/music/lounge'

export function useSpeech() {
  const [enabled, setEnabledState] = useState(false)
  const [supported, setSupported] = useState(false)
  const ref = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => { const on = loadSpeechEnabled(); ref.current = on; setEnabledState(on); setSupported(speechSupported()) }, 0)
    return () => { clearTimeout(timer); stopSpeaking() }
  }, [])
  const setEnabled = useCallback((on: boolean) => { ref.current = on; setEnabledState(on); saveSpeechEnabled(on); if (!on) stopSpeaking() }, [])
  const speak = useCallback((text: string, voiceKey: string, languageTag = 'de-DE') => { if (ref.current) browserSpeak(text, voiceKey, 0.95, languageTag) }, [])
  return { enabled, supported, setEnabled, speak, stop: stopSpeaking }
}

const MUSIC_KEY = 'noxia.lounge.enabled'

export function useLoungeMusic(active: boolean) {
  const available = LOUNGE_TRACKS.length > 0
  const [on, setOn] = useState(true)
  const { playing, volume, pause, play } = useMusicContext()
  const themeWasPlaying = useRef(false)
  const volumeRef = useRef(volume)
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => {
    const timer = setTimeout(() => { try { setOn(window.localStorage.getItem(MUSIC_KEY) !== '0') } catch { /* an */ } }, 0)
    return () => clearTimeout(timer)
  }, [])
  const toggle = useCallback(() => { setOn(current => { const next = !current; try { window.localStorage.setItem(MUSIC_KEY, next ? '1' : '0') } catch { /* nur bis zum Neuladen */ } return next }) }, [])

  const playingRef = useRef(playing)
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => {
    if (!active || !available || !on) return
    themeWasPlaying.current = playingRef.current
    if (playingRef.current) pause()
    let index: number | null = null
    let alive = true
    const audio = new Audio()
    audio.volume = Math.min(1, volumeRef.current * 0.8)
    const next = () => {
      if (!alive) return
      index = nextLoungeIndex(LOUNGE_TRACKS.length, index)
      audio.src = loungeUrl(LOUNGE_TRACKS[index])
      void audio.play().catch(() => { /* Browser erlaubt Ton erst nach einem Klick */ })
    }
    audio.addEventListener('ended', next)
    next()
    return () => {
      alive = false
      audio.removeEventListener('ended', next)
      audio.pause(); audio.src = ''
      if (themeWasPlaying.current) play()
    }
  // pause/play sind bei jedem Render neu; relevant ist nur, wann der Raum Musik braucht.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, available, on])
  return { available, on, toggle }
}

export function RoomAudioControls({ speech, music }: { speech: ReturnType<typeof useSpeech>; music?: ReturnType<typeof useLoungeMusic> }) {
  return <div className="room-audio" data-noxia-private>
    {speech.supported && <button type="button" aria-pressed={speech.enabled} title="Sprachausgabe des Browsers – der Text steht immer dabei" onClick={() => speech.setEnabled(!speech.enabled)}>{speech.enabled ? '🔊 Sprache an' : '🔈 Sprache aus'}</button>}
    {music?.available && <button type="button" aria-pressed={music.on} title="Musik im Raum" onClick={music.toggle}>{music.on ? '♪ Musik an' : '♪ Musik aus'}</button>}
    <style jsx>{`
      .room-audio{display:flex;gap:6px}
      button{padding:4px 8px;border:1px solid #45657c;border-radius:6px;background:#0b1820e0;color:#dce8ee;font:600 10px system-ui,sans-serif;cursor:pointer}
      button[aria-pressed=true]{border-color:#7fb59b;color:#e3f6ec}
    `}</style>
  </div>
}
