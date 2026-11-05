'use client'
// Geschichte eines realen Ortes im Infofenster (lib/worldlab/placeStories.ts).
// Klappt auf; Quelle steht darunter.

import { placeStory } from '@/lib/worldlab/placeStories'

export default function PlaceStory({ source }: { source?: string | null }) {
  const story = placeStory(source)
  if (!story) return null
  return <details className="story">
    <summary>Geschichte</summary>
    <p className="tag">{story.tagline}</p>
    {story.paragraphs.map((paragraph, index) => <div key={index}>
      {paragraph.heading && <h4>{paragraph.heading}</h4>}
      <p>{paragraph.text}</p>
    </div>)}
    {story.facts.length > 0 && <dl>{story.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    <p className="credit"><a href={story.credit.url} target="_blank" rel="noopener noreferrer">{story.credit.label}</a></p>
    <style jsx>{`
      .story{margin:6px 0;font-size:11px;color:#c9d8d3}
      .story summary{cursor:pointer;color:#d9bb6a;font-weight:700}
      .story .tag{margin:4px 0;color:#9fb5b0;font-style:italic}
      .story h4{margin:6px 0 0;font-size:11px;color:#e6d9b0}
      .story p{margin:2px 0 4px;line-height:1.4}
      .story dl{margin:6px 0;display:grid;gap:3px}
      .story dl div{display:grid;grid-template-columns:70px 1fr;gap:6px}
      .story dt{color:#9fb5b0}
      .story dd{margin:0}
      .story .credit{margin-top:6px}
      .story a{color:#8fc1d9}
    `}</style>
  </details>
}
