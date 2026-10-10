'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { SELMECKE_REFERENCE_SITE } from '@/lib/world/spatial/earthReferenceSites'
import { HERCEG_NOVI_EARTH_PLACE } from '@/lib/world/spatial/hercegNoviPlace'
import { DAVARU_TAUNUS_HOME_REGION } from '@/lib/game/temple/davaruTaunusRegion'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'

const EARTH_REGION_COOKIE = 'noxia-earth-region'
const EARTH_VIEW_LAT_COOKIE = 'noxia-earth-view-lat'
const EARTH_VIEW_LON_COOKIE = 'noxia-earth-view-lon'
const EARTH_VIEW_LABEL_COOKIE = 'noxia-earth-view-label'
const EARTH_VIEW_PLACE_COOKIE = 'noxia-earth-view-place-slug'
const SAUERLAND_REGION = 'earth-sauerland'
const SELMECKE = { ...SELMECKE_REFERENCE_SITE.point, label: SELMECKE_REFERENCE_SITE.label }

type EarthRegionId = typeof SAUERLAND_REGION
type SearchResult = { id:string; label:string; lat:number; lon:number; kind:string; source:'coordinates'|'nominatim' }
type SearchPayload = { ok?:boolean; error?:string; results?:SearchResult[]; attribution?:string }

function readCookie(name:string){
  if(typeof document==='undefined')return null
  const item=document.cookie.split('; ').find(row=>row.startsWith(`${name}=`))
  return item?decodeURIComponent(item.slice(name.length+1)):null
}

function setCookie(name:string,value:string){document.cookie=`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`}

function clearCookie(name:string){document.cookie=`${name}=; Path=/; Max-Age=0; SameSite=Lax`}

function selectPoint(lat:number,lon:number,label:string,region?:EarthRegionId){
  const placeSlug=earthPlaceSlug({lat,lon})
  const targetRegion=region??placeSlug
  setCookie(EARTH_REGION_COOKIE,targetRegion)
  setCookie(EARTH_VIEW_LAT_COOKIE,String(lat))
  setCookie(EARTH_VIEW_LON_COOKIE,String(lon))
  setCookie(EARTH_VIEW_LABEL_COOKIE,label.slice(0,180))
  if(region)clearCookie(EARTH_VIEW_PLACE_COOKIE)
  else setCookie(EARTH_VIEW_PLACE_COOKIE,placeSlug)

  // Travel is a world-state change, not just a camera change. Move the player
  // to the destination immediately so reloads can never leave map and player
  // on different Earth locations. The arrival resolver refines this to the
  // best transport hub after the destination has loaded.
  useEarthPlayerPositionStore.getState().setPosition(targetRegion,{xM:0,yM:0},{lat,lon})
  try{localStorage.setItem('noxia-earth-arrival-request-v1',JSON.stringify({lat,lon,label,placeSlug,targetRegion}))}catch{}
  window.location.reload()
}

function selectTarget(result:SearchResult){selectPoint(result.lat,result.lon,result.label)}

export default function EarthRegionSwitcherOverlay(){
  // DashboardGate mounts this component only while the player is on Earth.
  // Therefore the navigation must not depend on .earth-map being present:
  // failed geodata/Overpass responses deliberately render an error state
  // without that element, and the player still needs a way out of that view.
  const[viewLabel,setViewLabel]=useState<string|null>(null)
  const[query,setQuery]=useState('')
  const[results,setResults]=useState<SearchResult[]>([])
  const[searching,setSearching]=useState(false)
  const[error,setError]=useState<string|null>(null)
  const[placesOpen,setPlacesOpen]=useState(false)

  useEffect(()=>{
    setViewLabel(readCookie(EARTH_VIEW_LABEL_COOKIE))
  },[])

  const navButton:React.CSSProperties={border:'1px solid rgba(104,131,138,.45)',borderRadius:6,padding:'7px 9px',background:'rgba(20,48,61,.55)',color:'#dce9e9',font:'800 9px system-ui,sans-serif',letterSpacing:'.02em',cursor:'pointer',whiteSpace:'nowrap',maxWidth:210,overflow:'hidden',textOverflow:'ellipsis'}

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

  return <div aria-label="Erdnavigation" style={{position:'fixed',zIndex:2260,top:51,left:'50%',transform:'translateX(-50%)',display:'grid',gap:4,width:'min(860px,calc(100vw - 24px))',pointerEvents:'auto'}}>
    <div style={{display:'flex',gap:4,alignItems:'center',padding:3,border:'1px solid rgba(104,131,138,.72)',borderRadius:9,background:'rgba(7,17,27,.92)',boxShadow:'0 8px 24px rgba(0,0,0,.22)',backdropFilter:'blur(12px)'}}>
      <button type="button" title="Aktuellen Ort neu zentrieren" style={{...navButton,background:'rgba(31,79,95,.72)',cursor:'default'}} onClick={()=>window.location.reload()}>Aktuell · {viewLabel?.split(',')[0]??'Erde'}</button>
      <button type="button" title="Zum Home-Ort zurückkehren" style={{...navButton,color:'#e6d29a',borderColor:'rgba(168,137,61,.55)'}} onClick={()=>selectPoint(SELMECKE.lat,SELMECKE.lon,SELMECKE.label,SAUERLAND_REGION)}>⌂ Home</button>
      <button type="button" aria-expanded={placesOpen} aria-controls="noxia-earth-place-menu" title="Vorgemerkte Orte öffnen" style={navButton} onClick={()=>setPlacesOpen(open=>!open)}>Orte ▾</button>
      <form onSubmit={runSearch} style={{display:'flex',gap:4,flex:'1 1 320px',minWidth:0}}>
        <input value={query} onChange={event=>setQuery(event.currentTarget.value)} placeholder="Ort oder 51.33745, 7.97975" aria-label="Ort oder Koordinate auf der Erde suchen" autoComplete="off" style={{minWidth:0,flex:1,border:'1px solid rgba(112,143,151,.72)',borderRadius:6,padding:'7px 9px',background:'rgba(240,246,244,.96)',color:'#17313c',font:'700 10px system-ui,sans-serif',outline:'none'}}/>
        <button type="submit" disabled={searchDisabled} style={{border:'1px solid #9c7b2b',borderRadius:6,padding:'7px 10px',background:'#b88b27',color:'#fffdf2',font:'900 9px system-ui,sans-serif',cursor:searching?'wait':'pointer',opacity:searchDisabled ? .55 : 1,whiteSpace:'nowrap'}}>{searching?'Suche …':'Springen'}</button>
      </form>
    </div>
    {placesOpen&&<div id="noxia-earth-place-menu" aria-label="Vorgemerkte Erdorte" style={{justifySelf:'end',width:'min(520px,100%)',border:'1px solid rgba(91,118,126,.82)',borderRadius:9,background:'rgba(8,21,31,.97)',boxShadow:'0 14px 34px rgba(0,0,0,.34)',padding:7,display:'grid',gap:5}}>
      <div style={{font:'800 10px system-ui,sans-serif',color:'#b8ccd0',padding:'4px 6px'}}>Orte · Vorgemerkte Ziele</div>
      {[
        {id:'schmitten',label:'Schmitten im Taunus',detail:'DaVaRus Heimatregion · Großer Feldberg',point:DAVARU_TAUNUS_HOME_REGION.placeCenter},
        {id:'herceg-novi',label:'Herceg Novi, Montenegro',detail:'Möglicher Romanschauplatz · Bucht von Kotor',point:HERCEG_NOVI_EARTH_PLACE.center},
      ].map(place=><button key={place.id} type="button" onClick={()=>selectPoint(place.point.lat,place.point.lon,place.label)} style={{border:'1px solid rgba(104,131,138,.35)',borderRadius:6,background:'rgba(26,55,68,.75)',color:'#e8efed',padding:'9px',textAlign:'left',cursor:'pointer',display:'grid',gap:3}}>
        <strong style={{fontSize:11}}>{place.label}</strong><span style={{fontSize:9,color:'#97adb2'}}>{place.detail}</span>
      </button>)}
      <small style={{padding:5,color:'#97adb2'}}>Weitere Orte über die Suche finden. Dieser Katalog verleiht weder Eigentum noch Reiserechte.</small>
    </div>}
    {(results.length>0||error)&&<div style={{justifySelf:'end',width:'min(520px,100%)',maxHeight:'42vh',overflow:'auto',border:'1px solid rgba(91,118,126,.82)',borderRadius:9,background:'rgba(8,21,31,.97)',boxShadow:'0 14px 34px rgba(0,0,0,.34)',padding:6}}>
      {error&&<div style={{padding:'8px 9px',color:'#efc8bd',font:'800 10px system-ui,sans-serif'}}>{error}</div>}
      {results.map(result=><button key={result.id} type="button" onClick={()=>selectTarget(result)} style={{width:'100%',display:'grid',gap:2,border:0,borderRadius:6,padding:'8px 9px',background:'transparent',color:'#e8efed',textAlign:'left',cursor:'pointer'}}><strong style={{font:'800 10px system-ui,sans-serif'}}>{result.label}</strong><span style={{font:'700 8px system-ui,sans-serif',color:'#8eaaaf'}}>{result.kind} · {result.lat.toFixed(5)}, {result.lon.toFixed(5)}</span></button>)}
    </div>}
  </div>
}
