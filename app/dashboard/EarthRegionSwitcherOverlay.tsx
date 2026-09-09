'use client'

import { useEffect, useState, type FormEvent } from 'react'

const EARTH_REGION_COOKIE = 'noxia-earth-region'
const EARTH_VIEW_LAT_COOKIE = 'noxia-earth-view-lat'
const EARTH_VIEW_LON_COOKIE = 'noxia-earth-view-lon'
const EARTH_VIEW_LABEL_COOKIE = 'noxia-earth-view-label'
const SAUERLAND_REGION = 'earth-sauerland'
const NAMIBIA_REGION = 'earth-namibia-erongo'

type EarthRegionId = typeof SAUERLAND_REGION | typeof NAMIBIA_REGION
type SearchResult = { id:string; label:string; lat:number; lon:number; kind:string; source:'coordinates'|'nominatim' }
type SearchPayload = { ok?:boolean; error?:string; results?:SearchResult[]; attribution?:string }

function readCookie(name:string){
  if(typeof document==='undefined')return null
  const item=document.cookie.split('; ').find(row=>row.startsWith(`${name}=`))
  return item?decodeURIComponent(item.slice(name.length+1)):null
}

function readRegion():EarthRegionId{
  return readCookie(EARTH_REGION_COOKIE)===NAMIBIA_REGION?NAMIBIA_REGION:SAUERLAND_REGION
}

function setCookie(name:string,value:string){document.cookie=`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`}
function clearCookie(name:string){document.cookie=`${name}=; Path=/; Max-Age=0; SameSite=Lax`}
function clearCustomView(){clearCookie(EARTH_VIEW_LAT_COOKIE);clearCookie(EARTH_VIEW_LON_COOKIE);clearCookie(EARTH_VIEW_LABEL_COOKIE)}

function selectRegion(region:EarthRegionId){
  clearCustomView()
  setCookie(EARTH_REGION_COOKIE,region)
  window.location.reload()
}

function selectTarget(result:SearchResult){
  setCookie(EARTH_VIEW_LAT_COOKIE,String(result.lat))
  setCookie(EARTH_VIEW_LON_COOKIE,String(result.lon))
  setCookie(EARTH_VIEW_LABEL_COOKIE,result.label.slice(0,180))
  window.location.reload()
}

export default function EarthRegionSwitcherOverlay(){
  const[visible,setVisible]=useState(false)
  const[region,setRegion]=useState<EarthRegionId>(SAUERLAND_REGION)
  const[viewLabel,setViewLabel]=useState<string|null>(null)
  const[query,setQuery]=useState('')
  const[results,setResults]=useState<SearchResult[]>([])
  const[searching,setSearching]=useState(false)
  const[error,setError]=useState<string|null>(null)

  useEffect(()=>{
    const sync=()=>{setVisible(Boolean(document.querySelector('.earth-map')));setRegion(readRegion());setViewLabel(readCookie(EARTH_VIEW_LABEL_COOKIE))}
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])

  if(!visible)return null

  const buttonStyle=(id:EarthRegionId):React.CSSProperties=>({border:0,borderRadius:6,padding:'7px 10px',background:!viewLabel&&region===id?'#173f4d':'transparent',color:!viewLabel&&region===id?'#fffaf0':'#b7c9d0',font:'800 9px system-ui, sans-serif',letterSpacing:'.02em',cursor:'pointer',whiteSpace:'nowrap'})

  const runSearch=async(event:FormEvent)=>{
    event.preventDefault()
    const search=query.trim()
    if(search.length<2||searching)return
    setSearching(true);setError(null);setResults([])
    try{
      const response=await fetch(`/api/earth/geocode?q=${encodeURIComponent(search)}`,{cache:'no-store'})
      const payload=await response.json() as SearchPayload
      if(!response.ok||!payload.ok)throw new Error(payload.error??'Ortssuche fehlgeschlagen')
      const next=payload.results??[]
      if(next.length===1){selectTarget(next[0]);return}
      setResults(next)
      if(!next.length)setError('Kein passender Ort gefunden.')
    }catch(searchError){setError(searchError instanceof Error?searchError.message:String(searchError))}
    finally{setSearching(false)}
  }

  const searchDisabled=searching||query.trim().length<2

  return <div aria-label="Erdnavigation" style={{position:'fixed',zIndex:2260,top:51,left:'50%',transform:'translateX(-50%)',display:'grid',gap:4,width:'min(760px,calc(100vw - 24px))',pointerEvents:'auto'}}>
    <div style={{display:'flex',gap:3,alignItems:'center',padding:3,border:'1px solid rgba(104,131,138,.72)',borderRadius:9,background:'rgba(7,17,27,.92)',boxShadow:'0 8px 24px rgba(0,0,0,.22)',backdropFilter:'blur(12px)'}}>
      <button type="button" style={buttonStyle(SAUERLAND_REGION)} onClick={()=>selectRegion(SAUERLAND_REGION)}>Deutschland · Sauerland</button>
      <button type="button" style={buttonStyle(NAMIBIA_REGION)} onClick={()=>selectRegion(NAMIBIA_REGION)}>Namibia · Erongo</button>
      <form onSubmit={runSearch} style={{display:'flex',gap:4,flex:'1 1 280px',minWidth:0}}>
        <input value={query} onChange={event=>setQuery(event.currentTarget.value)} placeholder="Ort oder 51.33745, 7.97975" aria-label="Ort oder Koordinate auf der Erde suchen" autoComplete="off" style={{minWidth:0,flex:1,border:'1px solid rgba(112,143,151,.72)',borderRadius:6,padding:'7px 9px',background:'rgba(240,246,244,.96)',color:'#17313c',font:'700 10px system-ui,sans-serif',outline:'none'}}/>
        <button type="submit" disabled={searchDisabled} style={{border:'1px solid #9c7b2b',borderRadius:6,padding:'7px 10px',background:'#b88b27',color:'#fffdf2',font:'900 9px system-ui,sans-serif',cursor:searching?'wait':'pointer',opacity:searchDisabled ? .55 : 1,whiteSpace:'nowrap'}}>{searching?'Suche …':'Springen'}</button>
      </form>
    </div>
    {viewLabel&&<div style={{justifySelf:'center',maxWidth:'calc(100% - 24px)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'5px 9px',borderRadius:7,border:'1px solid rgba(104,131,138,.58)',background:'rgba(7,17,27,.84)',color:'#d5e5e7',font:'800 9px system-ui,sans-serif'}}>Aktueller Ausschnitt · {viewLabel}</div>}
    {(results.length>0||error)&&<div style={{justifySelf:'end',width:'min(520px,100%)',maxHeight:'42vh',overflow:'auto',border:'1px solid rgba(91,118,126,.82)',borderRadius:9,background:'rgba(8,21,31,.97)',boxShadow:'0 14px 34px rgba(0,0,0,.34)',padding:6}}>
      {error&&<div style={{padding:'8px 9px',color:'#efc8bd',font:'800 10px system-ui,sans-serif'}}>{error}</div>}
      {results.map(result=><button key={result.id} type="button" onClick={()=>selectTarget(result)} style={{width:'100%',display:'grid',gap:2,border:0,borderRadius:6,padding:'8px 9px',background:'transparent',color:'#e8efed',textAlign:'left',cursor:'pointer'}}><strong style={{font:'800 10px system-ui,sans-serif'}}>{result.label}</strong><span style={{font:'700 8px system-ui,sans-serif',color:'#8eaaaf'}}>{result.kind} · {result.lat.toFixed(5)}, {result.lon.toFixed(5)}</span></button>)}
    </div>}
  </div>
}
