'use client'

import { EARTH_LANDMARKS, type EarthLandmark } from '@/lib/world/spatial/earthLandmarks'

function relationLabel(relation: EarthLandmark['sourceProjects'][number]['relation']) {
  switch (relation) {
    case 'setting': return 'Schauplatz'
    case 'reference': return 'Referenz'
    case 'research-anchor': return 'Forschungsanker'
    case 'worldbuilding-anchor': return 'Worldbuilding-Anker'
  }
}

export default function EarthLandmarkExplorer() {
  const science = EARTH_LANDMARKS.filter(landmark => !landmark.tags.includes('cross-universe'))
  const crossUniverse = EARTH_LANDMARKS.filter(landmark => landmark.tags.includes('cross-universe'))

  const renderLandmark = (landmark: EarthLandmark) => <article className="landmark" key={landmark.id} id={landmark.id}>
    <header>
      <div>
        <small>{landmark.countryCode} · {landmark.locality}</small>
        <h3>{landmark.name}</h3>
      </div>
      <div className="tags">{landmark.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </header>

    <div className="layers">
      <section><b>HEUTE</b><p>{landmark.presentDayRole}</p></section>
      <section><b>NOXIA</b><p>{landmark.noxiaRole}</p></section>
      <section>
        <b>WERKBEZUG</b>
        <div className="projects">{landmark.sourceProjects.map(project => <p key={`${project.project}-${project.relation}`}>
          <strong>{project.project}</strong> · {relationLabel(project.relation)}{project.note ? ` — ${project.note}` : ''}
        </p>)}</div>
      </section>
    </div>

    <footer>
      <span className="locator">⌖ {landmark.locator.value}</span>
      {landmark.externalUrl && <a href={landmark.externalUrl} target="_blank" rel="noopener noreferrer">
        {landmark.externalLinkLabel ?? 'Externe Website öffnen'} ↗
      </a>}
    </footer>
    {landmark.externalUrl && <p className="external-note">Der Link öffnet eine externe Website außerhalb von NOXIA in einem neuen Browser-Tab/Fenster.</p>}
  </article>

  return <section className="earth-landmarks">
    <header className="intro">
      <div>
        <small>EARTH · CANONICAL LANDMARKS</small>
        <h2>Reale Weltanker</h2>
        <p>Persistente Orte der realen Erde. Sie sind keine baubaren Player-Gebäude. Reale Gegenwart, NOXIA-Zukunft und Werkbezüge bleiben bewusst getrennt.</p>
      </div>
      <div className="count"><b>{EARTH_LANDMARKS.length}</b><span>kanonische Orte</span></div>
    </header>

    <div className="group-title"><span>Wissenschaft & Raumfahrt</span><b>{science.length}</b></div>
    <div className="grid">{science.map(renderLandmark)}</div>

    <div className="group-title cross"><span>Cross-Universe · Orte aus anderen Werken</span><b>{crossUniverse.length}</b></div>
    <div className="grid">{crossUniverse.map(renderLandmark)}</div>

    <style jsx>{`
      .earth-landmarks{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#f2efe7;color:#25363b;border:1px solid #c9c3b5;border-radius:13px;font-family:system-ui,sans-serif}.intro{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:16px}.intro small{font-size:9px;letter-spacing:.16em;color:#8a6e2f;font-weight:900}.intro h2{font-family:Georgia,serif;font-size:26px;font-weight:400;margin:3px 0 5px}.intro p{max-width:760px;margin:0;color:#607076;font-size:11px;line-height:1.55}.count{text-align:right}.count b{display:block;font-size:28px;color:#876d33}.count span{font-size:8px;text-transform:uppercase;color:#748187}.group-title{display:flex;justify-content:space-between;align-items:center;margin:15px 0 8px;padding-bottom:6px;border-bottom:1px solid #c8c0ad;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.group-title.cross{margin-top:22px}.group-title b{color:#8a6e2f}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:10px}.landmark{background:#fffdf8;border:1px solid #d8d1c1;border-radius:9px;padding:12px;box-shadow:0 1px 5px rgba(26,45,50,.05)}.landmark header{display:flex;justify-content:space-between;gap:10px}.landmark small{font-size:8px;color:#7b8789;text-transform:uppercase;letter-spacing:.1em}.landmark h3{font-family:Georgia,serif;font-size:17px;margin:2px 0 8px;font-weight:400}.tags{display:flex;flex-wrap:wrap;justify-content:flex-end;align-content:start;gap:4px}.tags span{font-size:7px;padding:3px 5px;border:1px solid #d6cdb8;border-radius:999px;color:#77643c;background:#faf6eb}.layers{display:grid;gap:6px}.layers section{padding:7px 8px;background:#f7f5ef;border-radius:6px}.layers b{display:block;font-size:7px;letter-spacing:.12em;color:#8a6e2f;margin-bottom:2px}.layers p{font-size:9px;line-height:1.5;margin:0;color:#536368}.projects{display:grid;gap:3px}.projects strong{font-weight:750;color:#33474d}.landmark footer{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-top:9px}.locator{font-size:8px;line-height:1.45;color:#6c797b;max-width:60%}.landmark a{font-size:8px;font-weight:800;color:#315d67;text-decoration:none;text-align:right}.landmark a:hover{text-decoration:underline}.external-note{font-size:7px!important;color:#879293!important;margin-top:5px!important;text-align:right}@media(max-width:700px){.intro,.landmark header,.landmark footer{flex-direction:column}.count{text-align:left}.tags{justify-content:flex-start}.locator{max-width:none}.landmark a,.external-note{text-align:left!important}}
    `}</style>
  </section>
}
