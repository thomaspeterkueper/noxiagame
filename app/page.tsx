import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#040910] flex flex-col items-center justify-center">
      <div className="text-center space-y-8">
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(3rem, 10vw, 5.5rem)',
            fontWeight: 300,
            letterSpacing: '0.15em',
            color: '#2a4e7a',
          }}
        >
          noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
        </h1>
        <p style={{
          color: '#8a6d2b',
          fontSize: '0.85rem',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, serif',
        }}>
          Sonnensystem-Handelssimulation · Alpha 0.1
        </p>
        <div className="mt-12">
          <Link
            href="/dashboard"
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
            }}
          >
            Ins Universum
          </Link>
        </div>
      </div>
    </main>
  )
}