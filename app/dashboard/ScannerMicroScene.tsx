'use client'

// app/dashboard/ScannerMicroScene.tsx
// Erstellt:     24.07.2026
// Version:      0.1.0
//
// Kleiner First-Person-Vertical-Slice fuer NOXIA.
// Die Szene besitzt keine eigenen Simulationsdaten; sie visualisiert nur den
// uebergebenen Koloniekontext. Three.js ist hier ausschliesslich Renderer.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

export interface ScannerResource {
  resource: string
  stock: number
  production?: number
  consumption: number
}

interface Props {
  resources: ScannerResource[]
  population: number
  ownerLabel: string
  onClose: () => void
}

type InteractionId = 'scanner' | 'analysis' | 'airlock'

const RESOURCE_LABEL: Record<string, string> = {
  water: 'Wasser',
  energy: 'Energie',
  metal: 'Metall',
}

function makeCanvasTexture(lines: string[], accent = '#6fe7e7') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#071216'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  ctx.font = '28px monospace'
  ctx.fillStyle = accent
  lines.forEach((line, i) => ctx.fillText(line, 28, 52 + i * 42))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export default function ScannerMicroScene({ resources, population, ownerLabel, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const interactRef = useRef<InteractionId | null>(null)
  const [locked, setLocked] = useState(false)
  const [near, setNear] = useState<InteractionId | null>(null)
  const [panel, setPanel] = useState<InteractionId | null>(null)
  const [scanPulse, setScanPulse] = useState(false)

  const stocks = useMemo(() => Object.fromEntries(resources.map(r => [r.resource, r.stock])), [resources])
  const lowResources = useMemo(
    () => resources.filter(r => r.stock < 30).map(r => RESOURCE_LABEL[r.resource] ?? r.resource),
    [resources],
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x05090d)
    scene.fog = new THREE.Fog(0x05090d, 8, 18)

    const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 50)
    camera.position.set(0, 1.68, 3.8)
    camera.rotation.order = 'YXZ'

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.HemisphereLight(0x8fb7c8, 0x20252b, 1.3)
    scene.add(ambient)
    const key = new THREE.PointLight(0x78d8df, 18, 9, 2)
    key.position.set(0, 2.5, -1)
    key.castShadow = true
    scene.add(key)
    const warm = new THREE.PointLight(0xd89054, 8, 7, 2)
    warm.position.set(-2.8, 1.8, 2.8)
    scene.add(warm)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x26343b, roughness: 0.72, metalness: 0.18 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.62, metalness: 0.42 })
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x30383a, roughness: 0.85, metalness: 0.2 })
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x3d9ea4, emissive: 0x163f42, emissiveIntensity: 1.3, roughness: 0.35 })

    const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat = wallMat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
      mesh.position.set(x, y, z)
      mesh.receiveShadow = true
      mesh.castShadow = true
      scene.add(mesh)
      return mesh
    }

    // Raum 6 x 8 m, bewusst klein und glaubwuerdig.
    box(0, -0.08, 0, 6, 0.16, 8, floorMat)
    box(0, 3.05, 0, 6, 0.12, 8, darkMat)
    box(-3.0, 1.5, 0, 0.12, 3, 8)
    box(3.0, 1.5, 0, 0.12, 3, 8)
    box(0, 1.5, -4.0, 6, 3, 0.12)
    box(0, 1.5, 4.0, 6, 3, 0.12)

    // Deckenlichtlinien.
    for (const z of [-2.6, 0, 2.6]) box(0, 2.94, z, 3.6, 0.04, 0.10, accentMat)

    // Haupt-Scan-Konsole an der Stirnwand.
    box(0, 0.78, -3.45, 2.5, 0.95, 0.65, darkMat)
    box(0, 1.48, -3.76, 2.25, 1.05, 0.08, accentMat)
    const scanTexture = makeCanvasTexture([
      'NOXIA // FIELD SCANNER',
      `H2O  ${Math.round(stocks.water ?? 0)} t`,
      `ENERG ${Math.round(stocks.energy ?? 0)} t`,
      `METAL ${Math.round(stocks.metal ?? 0)} t`,
    ])
    const scanScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.95),
      new THREE.MeshBasicMaterial({ map: scanTexture }),
    )
    scanScreen.position.set(0, 1.52, -3.805)
    scene.add(scanScreen)

    // Linke Analysekonsole.
    box(-2.45, 0.72, -0.45, 0.7, 1.2, 2.7, darkMat)
    const analysisTexture = makeCanvasTexture([
      'COLONY ANALYSIS',
      `POP ${population.toLocaleString('de-DE')}`,
      lowResources.length ? `LOW ${lowResources.join(', ')}` : 'STATUS NOMINAL',
    ], '#f0c879')
    const analysisScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.78),
      new THREE.MeshBasicMaterial({ map: analysisTexture }),
    )
    analysisScreen.position.set(-2.085, 1.32, -0.5)
    analysisScreen.rotation.y = Math.PI / 2
    scene.add(analysisScreen)

    // Rechte Sensoreinheit und zentrale Projektion.
    box(2.35, 0.9, -1.1, 0.9, 1.8, 0.9, darkMat)
    const rings: THREE.Mesh[] = []
    for (const r of [0.45, 0.75, 1.05]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.018, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0x6fe7e7, transparent: true, opacity: 0.42 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(0.55, 1.45, -0.9)
      scene.add(ring)
      rings.push(ring)
    }
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x79dfe2, wireframe: true, transparent: true, opacity: 0.75 }),
    )
    globe.position.set(0.55, 1.45, -0.9)
    scene.add(globe)

    // Schleusentuer hinter dem Spieler.
    box(0, 1.35, 3.90, 1.55, 2.65, 0.08, darkMat)
    box(0, 2.64, 3.84, 1.65, 0.06, 0.12, accentMat)

    const interactions: Array<{ id: InteractionId; pos: THREE.Vector3 }> = [
      { id: 'scanner', pos: new THREE.Vector3(0, 1.4, -3.2) },
      { id: 'analysis', pos: new THREE.Vector3(-2.1, 1.3, -0.5) },
      { id: 'airlock', pos: new THREE.Vector3(0, 1.3, 3.55) },
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
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const onPointerLock = () => setLocked(document.pointerLockElement === renderer.domElement)
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return
      yaw -= event.movementX * 0.0022
      pitch -= event.movementY * 0.0019
      pitch = Math.max(-1.2, Math.min(1.2, pitch))
      camera.rotation.set(pitch, yaw, 0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.key.toLowerCase())
      if (event.key.toLowerCase() === 'e' && interactRef.current) {
        const id = interactRef.current
        if (id === 'airlock') onClose()
        else {
          setPanel(id)
          if (id === 'scanner') {
            setScanPulse(true)
            window.setTimeout(() => setScanPulse(false), 1800)
          }
        }
      }
      if (event.key === 'Escape' && document.pointerLockElement !== renderer.domElement) onClose()
    }
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase())
    const onClick = () => renderer.domElement.requestPointerLock()

    renderer.domElement.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onPointerLock)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('resize', resize)
    resize()

    const clockDir = new THREE.Vector3()
    const right = new THREE.Vector3()

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const speed = 2.6 * dt
      camera.getWorldDirection(clockDir)
      clockDir.y = 0
      clockDir.normalize()
      right.crossVectors(clockDir, camera.up).normalize()

      const next = camera.position.clone()
      if (keys.has('w') || keys.has('arrowup')) next.addScaledVector(clockDir, speed)
      if (keys.has('s') || keys.has('arrowdown')) next.addScaledVector(clockDir, -speed)
      if (keys.has('a') || keys.has('arrowleft')) next.addScaledVector(right, -speed)
      if (keys.has('d') || keys.has('arrowright')) next.addScaledVector(right, speed)
      next.x = THREE.MathUtils.clamp(next.x, -2.62, 2.62)
      next.z = THREE.MathUtils.clamp(next.z, -3.58, 3.58)
      next.y = 1.68
      camera.position.copy(next)

      let closest: InteractionId | null = null
      let best = 1.45
      for (const target of interactions) {
        const distance = camera.position.distanceTo(target.pos)
        if (distance < best) { best = distance; closest = target.id }
      }
      if (interactRef.current !== closest) {
        interactRef.current = closest
        setNear(closest)
      }

      const t = now * 0.00045
      rings.forEach((ring, i) => { ring.rotation.z = t * (i % 2 ? -1 : 1) * (1 + i * 0.18) })
      globe.rotation.y = t * 2.4

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onPointerLock)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', resize)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose?.()
        const material = mesh.material
        if (Array.isArray(material)) material.forEach(m => m.dispose())
        else material?.dispose?.()
      })
      scanTexture.dispose()
      analysisTexture.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [stocks.water, stocks.energy, stocks.metal, population, lowResources.join('|'), onClose])

  const prompt = near === 'scanner' ? 'E  Scan-Konsole bedienen'
    : near === 'analysis' ? 'E  Kolonieanalyse ansehen'
    : near === 'airlock' ? 'E  Forschungsstation verlassen'
    : locked ? 'WASD bewegen · Maus umsehen' : 'Klicken, um die Steuerung zu aktivieren'

  return (
    <div style={{ position: 'relative', width: '100%', height: 'min(68vh, 620px)', minHeight: 380, background: '#05090d', overflow: 'hidden', borderRadius: 8 }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: 'monospace', color: '#d8efef' }}>
        <div style={{ position: 'absolute', top: 12, left: 14, background: 'rgba(2,8,10,.72)', border: '1px solid rgba(111,231,231,.35)', borderRadius: 6, padding: '7px 9px', fontSize: '0.66rem' }}>
          <div style={{ color: '#6fe7e7', fontWeight: 700 }}>SCANNER // MICRO VIEW</div>
          <div style={{ color: '#8aa4a8', marginTop: 3 }}>{ownerLabel}</div>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, marginLeft: -6, marginTop: -6 }}>
          <span style={{ position: 'absolute', left: 5, top: 0, width: 1, height: 12, background: 'rgba(220,245,245,.65)' }} />
          <span style={{ position: 'absolute', left: 0, top: 5, width: 12, height: 1, background: 'rgba(220,245,245,.65)' }} />
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', background: near ? 'rgba(8,35,37,.9)' : 'rgba(2,8,10,.66)', border: `1px solid ${near ? 'rgba(111,231,231,.7)' : 'rgba(255,255,255,.12)'}`, borderRadius: 5, padding: '6px 10px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{prompt}</div>
        {scanPulse && <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(111,231,231,.65)', boxShadow: 'inset 0 0 80px rgba(111,231,231,.18)' }} />}
      </div>

      {panel && (
        <div style={{ position: 'absolute', right: 12, top: 12, width: 'min(330px, calc(100% - 24px))', background: 'rgba(3,12,15,.95)', border: '1px solid rgba(111,231,231,.55)', borderRadius: 8, padding: 12, color: '#d8efef', fontFamily: 'monospace' }}>
          <button onClick={() => setPanel(null)} style={{ float: 'right', background: 'none', color: '#8fb0b4', border: 0, cursor: 'pointer', fontSize: '1rem' }}>×</button>
          {panel === 'scanner' ? (
            <>
              <div style={{ color: '#6fe7e7', fontSize: '0.72rem', fontWeight: 700, marginBottom: 8 }}>FELDSCAN ABGESCHLOSSEN</div>
              {resources.map(r => <div key={r.resource} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}><span>{RESOURCE_LABEL[r.resource] ?? r.resource}</span><span>{Math.round(r.stock)} t</span></div>)}
              <div style={{ fontSize: '0.64rem', color: lowResources.length ? '#efb36b' : '#79d89b', marginTop: 9 }}>{lowResources.length ? `Versorgungswarnung: ${lowResources.join(', ')}` : 'Keine kritischen Versorgungswerte erkannt.'}</div>
            </>
          ) : (
            <>
              <div style={{ color: '#f0c879', fontSize: '0.72rem', fontWeight: 700, marginBottom: 8 }}>KOLONIEANALYSE</div>
              <div style={{ fontSize: '0.68rem' }}>Bevölkerung: {population.toLocaleString('de-DE')}</div>
              {resources.map(r => <div key={r.resource} style={{ fontSize: '0.64rem', marginTop: 5, color: '#9eb4b7' }}>{RESOURCE_LABEL[r.resource] ?? r.resource}: Verbrauch {Math.round(r.consumption)} / Tick</div>)}
            </>
          )}
        </div>
      )}

      <button onClick={onClose} style={{ position: 'absolute', top: 12, right: panel ? 356 : 12, zIndex: 3, background: 'rgba(3,12,15,.82)', color: '#a6babc', border: '1px solid rgba(255,255,255,.18)', borderRadius: 5, padding: '5px 8px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.62rem' }}>ESC Verlassen</button>
    </div>
  )
}
