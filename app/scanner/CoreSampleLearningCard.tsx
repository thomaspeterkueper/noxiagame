import Link from 'next/link'

export default function CoreSampleLearningCard() {
  return (
    <section style={{maxWidth:1180,margin:'0 auto 28px',padding:'0 18px',fontFamily:'system-ui'}}>
      <div style={{border:'1px solid #4a5f42',borderRadius:12,background:'#10180fcc',padding:14,color:'#e9f1e7',display:'flex',justifyContent:'space-between',gap:18,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{maxWidth:780}}>
          <div style={{fontSize:10,letterSpacing:'.16em',color:'#9fbd83'}}>NOXIA AKADEMIE · GEOLOGIE</div>
          <h2 style={{fontSize:17,margin:'4px 0 6px'}}>Bohrkern lesen: Schichten, Wasser und Evidenz</h2>
          <div style={{fontSize:11,lineHeight:1.55,color:'#aeb9ad'}}>
            Lerne direkt zur Prospektion, wie Schichtfolgen interpretiert werden, warum Porosität und Permeabilität nicht dasselbe sind,
            wie Aquifere und Deckschichten funktionieren und wie NOXIA Messung, Interpretation, GLiM-Makrokontext und Modellannahmen trennt.
          </div>
          <div style={{fontSize:10,color:'#81917f',marginTop:7}}>12 Minuten · 5 Fragen · 50 Wissenspunkte beim ersten erfolgreichen Abschluss</div>
        </div>
        <Link href="/academy/learn?path=kurs_geologie_bohrkern" style={{padding:'9px 13px',border:'1px solid #789462',borderRadius:8,background:'#29431f',color:'#eff7eb',textDecoration:'none',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
          Lernmodul öffnen →
        </Link>
      </div>
    </section>
  )
}
