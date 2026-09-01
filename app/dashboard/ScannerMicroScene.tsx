'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SCANNER_BASE_RADIUS } from '@/lib/game/scanning'

interface ResourceRow {
  resource: string
  stock: number
  production?: number
  consumption: number
}

interface DiscoveryDto {
  id: string
  groundTruthKey: string
  row: number
  col: number
  kind: string
  sourceType: string
  interpretation: {
    groundTruthKey: string
    label: string
    confidence: 'low' | 'medium'
    evidence: string
  }
}

interface ScannerResponse {
  scanner?: { id: string; row: number; col: number } | null
  measurement?: {
    radius: number
    coveredCells: Array<{ row: number; col: number }>
    signals: Array<{ row: number; col: number; strength: number }>
  }
  newDiscoveries?: DiscoveryDto[]
  discoveries?: DiscoveryDto[]
  error?: string
}

interface Props {
  locationSlug: string
  scannerEntityId: string
  scannerRow: number
  scannerCol: number
  resources: ResourceRow[]
  population: number
  ownerLabel: string
  onClose: () => void
}

async function scannerRequest(locationSlug: string, method: 'GET' | 'POST', scannerEntityId?: string): Promise<ScannerResponse> {
  const sb = (await import('@/lib/supabase/client')).createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('Keine aktive Sitzung')
  const url = method === 'GET'
    ? `/api/game/scanner?location=${encodeURIComponent(locationSlug)}`
    : '/api/game/scanner'
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ location: locationSlug, scannerEntityId }) : undefined,
  })
  const data = await response.json() as ScannerResponse
  if (!response.ok) throw new Error(data.error ?? 'Scanner-Anfrage fehlgeschlagen')
  return data
}

export default function ScannerMicroScene(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(props.onClose)
  const [near, setNear] = useState<'scanner' | 'analysis' | 'airlock' | null>(null)
  const nearRef = useRef<typeof near>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [discoveries, setDiscoveries] = useState<DiscoveryDto[]>([])
  const [lastScan, setLastScan] = useState<ScannerResponse | null>(null)

  useEffect(() => { closeRef.current = props.onClose }, [props.onClose])
  useEffect(() => { nearRef.current = near }, [near])
  useEffect(() => { busyRef.current = busy }, [busy])

  const stockText = useMemo(() => {
    const byResource = Object.fromEntries(props.resources.map(item => [item.resource, item.stock]))
    return `H₂O ${Math.round(byResource.water ?? 0)} · ENERGIE ${Math.round(byResource.energy ?? 0)} · METALL ${Math.round(byResource.metal ?? 0)}`
  }, [props.resources])

  useEffect(() => {
    let cancelled = false
    scannerRequest(props.locationSlug, 'GET')
      .then(data => { if (!cancelled) setDiscoveries(data.discoveries ?? []) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Scannerstatus nicht verfügbar') })
    return () => { cancelled = true }
  }, [props.locationSlug])

  async function executeScan() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await scannerRequest(props.locationSlug, 'POST', props.scannerEntityId)
      setLastScan(result)
      setDiscoveries(result.discoveries ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan fehlgeschlagen')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let cleanup: (() => void) | undefined

    function start() {
      const mount = mountRef.current
      if (!mount) return
      try {
        if (disposed) return

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x05090d)
        scene.fog = new THREE.Fog(0x05090d, 7, 18)
        const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 50)
        camera.position.set(0, 1.68, 3.1)
        camera.rotation.order = 'YXZ'
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.shadowMap.enabled = true
        mount.appendChild(renderer.domElement)

        scene.add(new THREE.HemisphereLight(0x9bc7d5, 0x20252b, 1.35))
        const cold = new THREE.PointLight(0x78d8df, 18, 10, 2)
        cold.position.set(0, 2.5, -1.2)
        scene.add(cold)
        const warm = new THREE.PointLight(0xd89054, 8, 7, 2)
        warm.position.set(-2.5, 1.8, 2.4)
        scene.add(warm)

        const wall = new THREE.MeshStandardMaterial({ color: 0x26343b, roughness: 0.74, metalness: 0.18 })
        const dark = new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.58, metalness: 0.46 })
        const floor = new THREE.MeshStandardMaterial({ color: 0x30383a, roughness: 0.86, metalness: 0.18 })
        const accent = new THREE.MeshStandardMaterial({ color: 0x3d9ea4, emissive: 0x163f42, emissiveIntensity: 1.2 })
        const box = (x:number,y:number,z:number,sx:number,sy:number,sz:number,mat=wall) => {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
          mesh.position.set(x,y,z)
          mesh.castShadow = true
          mesh.receiveShadow = true
          scene.add(mesh)
          return mesh
        }

        box(0,-0.08,0,6,0.16,8,floor)
        box(0,3.05,0,6,0.12,8,dark)
        box(-3,1.5,0,0.12,3,8)
        box(3,1.5,0,0.12,3,8)
        box(0,1.5,-4,6,3,0.12)
        box(0,1.5,4,6,3,0.12)
        for (const z of [-2.6,0,2.6]) box(0,2.94,z,3.6,0.04,0.1,accent)
        box(0,0.78,-3.45,2.5,0.95,0.65,dark)
        box(-2.4,0.72,-0.4,0.7,1.2,2.7,dark)
        box(2.35,0.9,-1.1,0.9,1.8,0.9,dark)
        box(0,1.35,3.9,1.55,2.65,0.08,dark)

        const rings:any[] = []
        for (const radius of [0.45,0.75,1.05]) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius,0.018,8,64),
            new THREE.MeshBasicMaterial({ color:0x6fe7e7, transparent:true, opacity:0.4 }),
          )
          ring.rotation.x = Math.PI/2
          ring.position.set(0.55,1.45,-0.9)
          scene.add(ring)
          rings.push(ring)
        }

        const interactions = [
          { id:'scanner' as const, pos:new THREE.Vector3(0,1.4,-3.1) },
          { id:'analysis' as const, pos:new THREE.Vector3(-2.1,1.3,-0.4) },
          { id:'airlock' as const, pos:new THREE.Vector3(0,1.3,3.55) },
        ]
        const keys = new Set<string>()
        let yaw = 0
        let pitch = 0
        let last = performance.now()
        let raf = 0

        const resize = () => {
          const rect = mount.getBoundingClientRect()
          const width = Math.max(320, rect.width)
          const height = Math.max(260, rect.height)
          renderer.setSize(width,height,false)
          camera.aspect = width/height
          camera.updateProjectionMatrix()
        }
        const pointer = () => setLocked(document.pointerLockElement === renderer.domElement)
        const mouse = (event:MouseEvent) => {
          if (document.pointerLockElement !== renderer.domElement) return
          yaw -= event.movementX * 0.0022
          pitch = Math.max(-1.2, Math.min(1.2, pitch - event.movementY * 0.0019))
          camera.rotation.set(pitch,yaw,0)
        }
        const keydown = (event:KeyboardEvent) => {
          keys.add(event.key.toLowerCase())
          if (event.key.toLowerCase() === 'e') {
            if (nearRef.current === 'scanner') void executeScan()
            if (nearRef.current === 'airlock') closeRef.current()
          }
        }
        const keyup = (event:KeyboardEvent) => keys.delete(event.key.toLowerCase())
        const click = () => renderer.domElement.requestPointerLock()
        renderer.domElement.addEventListener('click', click)
        document.addEventListener('pointerlockchange', pointer)
        document.addEventListener('mousemove', mouse)
        window.addEventListener('keydown', keydown)
        window.addEventListener('keyup', keyup)
        window.addEventListener('resize', resize)
        resize()

        const forward = new THREE.Vector3()
        const right = new THREE.Vector3()
        const animate = (now:number) => {
          const dt = Math.min(0.05, (now-last)/1000)
          last = now
          camera.getWorldDirection(forward)
          forward.y = 0
          forward.normalize()
          right.crossVectors(forward,camera.up).normalize()
          const next = camera.position.clone()
          const speed = 2.6*dt
          if (keys.has('w')) next.addScaledVector(forward,speed)
          if (keys.has('s')) next.addScaledVector(forward,-speed)
          if (keys.has('a')) next.addScaledVector(right,-speed)
          if (keys.has('d')) next.addScaledVector(right,speed)
          next.x = Math.max(-2.7,Math.min(2.7,next.x))
          next.z = Math.max(-3.65,Math.min(3.65,next.z))
          camera.position.copy(next)
          const candidate = interactions
            .map(item => ({ ...item, distance:item.pos.distanceTo(camera.position) }))
            .sort((a,b) => a.distance-b.distance)[0]
          setNear(candidate && candidate.distance < 1.65 ? candidate.id : null)
          rings.forEach((ring,index) => { ring.rotation.z = now*0.00015*(index+1) })
          renderer.render(scene,camera)
          raf = requestAnimationFrame(animate)
        }
        raf = requestAnimationFrame(animate)

        cleanup = () => {
          cancelAnimationFrame(raf)
          renderer.domElement.removeEventListener('click',click)
          document.removeEventListener('pointerlockchange',pointer)
          document.removeEventListener('mousemove',mouse)
          window.removeEventListener('keydown',keydown)
          window.removeEventListener('keyup',keyup)
          window.removeEventListener('resize',resize)
          if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
          renderer.dispose()
          renderer.domElement.remove()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '3D-Szene konnte nicht geladen werden')
      }
    }
    start()
    return () => { disposed = true; cleanup?.() }
  }, [props.locationSlug, props.scannerEntityId])

  const prompt = near === 'scanner' ? 'E · Scan starten' : near === 'airlock' ? 'E · Scanner verlassen' : near === 'analysis' ? 'Analysekonsole' : null
  const newCount = lastScan?.newDiscoveries?.length ?? 0

  return (
    <div style={{ width:'min(1040px,96vw)', height:'min(720px,88vh)', position:'relative', background:'#05090d', border:'1px solid #2d5961', borderRadius:12, overflow:'hidden' }}>
      <div ref={mountRef} style={{ position:'absolute', inset:0 }} />
      <div style={{ position:'absolute', top:14, left:16, color:'#d7f6f6', fontFamily:'monospace', textShadow:'0 1px 4px #000' }}>
        <div style={{ fontWeight:700 }}>SCANNER · {props.locationSlug.toUpperCase()}</div>
        <div style={{ fontSize:12, opacity:.8 }}>{props.ownerLabel} · Feld ({props.scannerRow},{props.scannerCol}) · techn. Referenz OTA-TEC-0111</div>
      </div>
      <div style={{ position:'absolute', top:14, right:16, color:'#b9dfe3', fontFamily:'monospace', fontSize:12, textAlign:'right' }}>
        <div>Radius {SCANNER_BASE_RADIUS} · Discovery persistent</div>
        <div>{stockText} · POP {props.population}</div>
      </div>
      <div style={{ position:'absolute', left:16, bottom:16, color:'#d8eeee', fontFamily:'monospace', fontSize:12, background:'rgba(4,12,16,.78)', padding:'8px 10px', borderRadius:6 }}>
        WASD · Maus · {locked ? 'Pointer Lock aktiv' : 'Klicken zum Umsehen'}
        {prompt && <div style={{ marginTop:4, color:'#7ef0e9' }}>{prompt}</div>}
      </div>
      <div style={{ position:'absolute', right:16, bottom:16, width:300, color:'#d8eeee', fontFamily:'monospace', fontSize:12, background:'rgba(4,12,16,.82)', padding:10, borderRadius:6 }}>
        <div>Bekannte Discoveries: {discoveries.length}</div>
        {busy && <div style={{ color:'#7ef0e9', marginTop:4 }}>Messung läuft …</div>}
        {!busy && lastScan && <div style={{ marginTop:4 }}>Letzter Scan: {lastScan.measurement?.signals.length ?? 0} Signale · {newCount} neu</div>}
        {discoveries.slice(-3).map(item => <div key={item.groundTruthKey} style={{ marginTop:5, opacity:.9 }}>• {item.interpretation.label} [{item.interpretation.confidence}] @ {item.row},{item.col}</div>)}
        {error && <div style={{ marginTop:6, color:'#ff9b8c' }}>{error}</div>}
      </div>
      <button onClick={props.onClose} style={{ position:'absolute', top:48, right:16, border:'1px solid #476c72', background:'rgba(4,12,16,.78)', color:'#d8eeee', borderRadius:5, padding:'5px 8px', cursor:'pointer' }}>Schließen</button>
    </div>
  )
}
