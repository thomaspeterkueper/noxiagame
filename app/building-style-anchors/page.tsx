import { BUILDING_VISUALS } from '@/lib/game/buildings/visuals'

const anchors = [
  { id: 'habitat', name: 'Habitat / Wohnen', footprint: '28 × 22 m', role: 'Housing' },
  { id: 'laboratory', name: 'Labor', footprint: '32 × 24 m', role: 'Research' },
  { id: 'warehouse', name: 'Warenhaus / Logistikhalle', footprint: '36 × 28 m', role: 'Logistics' },
  { id: 'workshop', name: 'Werkstatt / Light Production', footprint: '24 × 24 m V0', role: 'Production' },
]

export default function BuildingStyleAnchorsPage() {
  return (
    <main className="anchor-shell">
      <header>
        <small>NOXIA · EARTH CORE V1</small>
        <h1>Gebäude-Stilanker</h1>
        <p>Erster verbindlicher visueller Baukasten für erdgebundene NOXIA-Standorte. Funktionale Lesbarkeit, reale Maßstäbe und technische Plausibilität haben Vorrang vor dekorativem Sci-Fi.</p>
      </header>

      <section className="anchor-grid">
        {anchors.map(anchor => {
          const visual = BUILDING_VISUALS[anchor.id]
          return (
            <article key={anchor.id}>
              <div className="image-wrap">
                {visual?.styleAnchorAsset ? <img src={visual.styleAnchorAsset} alt={anchor.name} /> : null}
              </div>
              <div className="meta">
                <small>{anchor.role}</small>
                <h2>{anchor.name}</h2>
                <p>{anchor.footprint}</p>
                <code>{anchor.id}</code>
              </div>
            </article>
          )
        })}
      </section>

      <footer>
        <b>Stilregel:</b> helle/neutrale modulare Hüllen, zurückhaltendes Oliv als technischer Akzent, sichtbare Dach- und Servicetechnik, klare Zufahrts-/Arbeitsseiten, keine generische Fantasy-Sci-Fi-Formensprache.
      </footer>

      <style>{`
        :root{color-scheme:dark}.anchor-shell{min-height:100vh;background:#07141d;color:#e8efec;padding:42px;font-family:system-ui,-apple-system,sans-serif}.anchor-shell header{max-width:980px;margin:0 auto 30px}.anchor-shell header small{color:#c8a448;font-weight:850;letter-spacing:.18em}.anchor-shell h1{font:400 38px/1.1 Georgia,serif;margin:8px 0 10px}.anchor-shell header p{color:#9eacaa;max-width:850px;line-height:1.55}.anchor-grid{max-width:1280px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.anchor-grid article{background:#0b1d28;border:1px solid #23404d;border-radius:14px;overflow:hidden}.image-wrap{aspect-ratio:1.35;background:radial-gradient(circle at 50% 40%,#19303a,#08151d 70%);display:grid;place-items:center}.image-wrap img{width:100%;height:100%;object-fit:contain;display:block}.meta{padding:15px 17px 18px}.meta small{color:#9bb09f;text-transform:uppercase;letter-spacing:.13em;font-size:10px}.meta h2{font-size:17px;margin:5px 0}.meta p{margin:0 0 8px;color:#b8c3bf;font-size:12px}.meta code{font-size:11px;color:#d6b755}.anchor-shell footer{max-width:1280px;margin:20px auto 0;padding:16px 18px;border:1px solid #2a424b;border-radius:10px;color:#9faeab;background:#0a1922;font-size:12px;line-height:1.55}.anchor-shell footer b{color:#d7bd70}@media(max-width:800px){.anchor-shell{padding:22px 14px}.anchor-grid{grid-template-columns:1fr}.anchor-shell h1{font-size:30px}}
      `}</style>
    </main>
  )
}
