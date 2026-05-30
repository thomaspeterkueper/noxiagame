import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#040910] text-[#b8d4e8] flex flex-col items-center justify-center">
      <div className="text-center space-y-8">
        <h1 className="font-mono text-6xl font-black tracking-[0.3em] text-[#00c8ff]">
          NOX<span className="text-[#ff6b2b]">IA</span>
        </h1>
        <p className="text-[#3a6080] text-sm tracking-widest uppercase">
          Sonnensystem-Handelssimulation · Alpha 0.1
        </p>
        <div className="flex flex-col gap-3 mt-12">
          <Link
            href="/dashboard"
            className="px-8 py-3 border border-[#00c8ff] text-[#00c8ff] hover:bg-[#00c8ff] hover:text-[#040910] transition-colors tracking-widest text-sm uppercase"
          >
            Ins Universum
          </Link>
        </div>
      </div>
    </main>
  )
}