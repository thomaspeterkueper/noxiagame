// app/page.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 31.05.2026 – Hero-Bild + Sterne-Animation + Musik bei Klick

import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#040910',
    }}>

      {/* Hintergrundbild */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/images/hero.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Leichter Overlay – nur in der Mitte aufhellen wo Text ist */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 55% 45%, rgba(4,9,16,0.2) 0%, rgba(4,9,16,0.5) 60%, rgba(4,9,16,0.7) 100%)',
      }} />

      {/* CSS Sterne-Animation */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-8px) translateX(4px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
        .star {
          position: absolute;
          border-radius: 50%;
          background: white;
          animation: twinkle linear infinite;
        }
        @keyframes subtleZoom {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .hero-bg {
          animation: subtleZoom 20s ease-in-out infinite;
        }
      `}</style>

      {/* Animierte Zusatz-Sterne (über das Foto) */}
      {[
        [52,18,1.5,3.2],[58,42,1,4.8],[63,28,1,3.9],[48,55,1.5,5.1],
        [55,65,1,4.2],[61,15,1,3.5],[49,35,1.5,6.0],[57,72,1,4.5],
        [53,48,1,3.8],[60,58,1.5,5.3],[56,22,1,4.1],[51,78,1,3.6],
      ].map(([left, top, size, duration], i) => (
        <div
          key={i}
          className="star"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            animationDuration: `${duration}s`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      {/* Inhalt – mittig zwischen Station und Mars */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
      }}>

        {/* Logo */}
        <h1 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 'clamp(3rem, 10vw, 5.5rem)',
          fontWeight: 300,
          letterSpacing: '0.15em',
          color: '#2a4e7a',
          textShadow: '0 0 40px rgba(42,78,122,0.4), 0 2px 20px rgba(0,0,0,0.8)',
          margin: 0,
        }}>
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
        </h1>

        {/* Tagline */}
        <p style={{
          color: '#8a6d2b',
          fontSize: '0.85rem',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, serif',
          textShadow: '0 1px 8px rgba(0,0,0,0.9)',
          margin: 0,
        }}>
          Sonnensystem-Handelssimulation · Alpha 0.1
        </p>

        {/* CTA – startet Musik */}
        <MusicLink />
      </div>

      {/* Dezente Linie unten */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(201,169,97,0.3), transparent)',
      }} />
    </main>
  )
}

// Client-Komponente für Musik + Navigation
// Ausgelagert weil 'use client' nötig
import MusicLink from './_components/MusicLink'
