'use client'

// app/earth/LandmarkWalkableInterior.tsx
// Aktualisiert: 06.11.2026 — Ein Motor für alle Räume (Thomas: „wir sollten … unterschiedliche
// Raum-Motoren vermeiden und nur auf einer Version aufbauen, d. h. alles Alte umziehen“).
// Bibliothek, Gotteshäuser, Gemeindesaal, Begegnungsstätte, Laden, Werkstatt, ArtLounge,
// Gastraum und Friedhof laufen jetzt über den allgemeinen Innenraum-Motor
// (app/interiors/WalkableInterior.tsx) – mit 2,5D, Kiesel-Figuren, Mitspielern, Gesten und Chat.
// Diese Datei ist nur noch die Einrichtung: Grundriss aus lib/game/landmarks/interiors.ts,
// Personal und Personen der Simulation, Bücher, Fürbitte, Gottesdienst, Runde, Kerzen,
// Gedenkort, Stockwerke, Leistungen. Der Raum ist ein typischer Grundriss für die Ortsart,
// nicht der vermessene Innenraum des realen Gebäudes.
// Version:      3.0.0

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { getSessionInfo } from '@/lib/supabase/auth'
import {
  LANDMARK_LEVELS,
  STANCE_LABEL,
  hospitalityPlacement,
  type Stance,
  crowdSpots,
  landmarkRoomLayout,
  landmarkWaypoints,
  landmarkStaffName,
  nearestLandmarkSpot,
  shelfAt,
  type LandmarkPoint,
  type LandmarkRoomKind,
  type LandmarkRoomLayout,
} from '@/lib/game/landmarks/interiors'
import { VENUE_WIDTH, isVenueBlocked, venuePath } from '@/lib/game/hospitality/venues'
import { SEAT_KINDS, rectV, toL, toV, toVenueLayout } from '@/lib/game/landmarks/venueLayout'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { LIBRARY_BOOKS, LIBRARY_SHELVES, type LibraryBook } from '@/lib/game/landmarks/libraryCatalogue'
import type { ReadingDocument } from '@/lib/game/readings/types'
import ResonanceShelf from './ResonanceShelf'
import { liturgyFor, phaseAt, speechNoun, type ActivityKind, type Tradition } from '@/lib/game/population/worship'
import { isRoundKind, roundKeyOf } from '@/lib/game/rounds/roundTalk'
import RoundTalk from './RoundTalk'
import RoundBubbles from './RoundBubbles'
import { RoomAudioControls, useLoungeMusic, useSpeech } from './RoomAudio'
import { nextReadingChunk, readingSource } from '@/lib/game/landmarks/readAloud'
import { useRoundTalk } from './useRoundTalk'

/** Gäste wechseln ihren Platz etwa alle vier Minuten. */
const STANCE_WINDOW_MS = 4 * 60 * 1000
const STAFF_STEP = 5
/** Sekunden zwischen zwei Einsortier-Runden der angestellten Person, wenn nichts anstand. */
const RESHELVE_EVERY_S = 45
const READER_NAMES = ['Paul Siebert', 'Nele Arndt', 'Jakob Heine', 'Ida Kraus']

type Props = {
  kind: LandmarkRoomKind
  name: string
  typeLabel: string
  facts: Array<{ label: string; value: string }>
  onClose: () => void
  /** Betrieb: was die angestellte Person über ihr Haus weiß (für das Gespräch). */
  knowledge?: string[]
  /** Betrieb: Leistungen, mit ehrlichem Status. */
  services?: Array<{ id: string; label: string; note: string; available: boolean }>
  staffRole?: string
  /** Betrieb: eigener Tresen (z. B. Fahrzeuge) – wird im Gespräch mit dem Personal gezeigt. */
  desk?: ReactNode
  /** Realer Name laut OSM – nur zur Einordnung in der Seitenleiste. */
  realName?: string
  /** Personen der Simulation, die gerade an diesem Ort sind (Arbeit, Termin, Besuch). */
  people?: RoomPerson[]
  /** Laufender Gottesdienst, Gebet oder Runde (aus /api/world-lab/worship). */
  occasion?: RoomOccasion
  /** OSM-Kennung oder Spielgebäude des Ortes (für Wünsche und Gebete). */
  placeRef?: string
}

/** Wie das Anliegen hier heißt (29.10.2026: Wünsche und Gebete, die die Welt erhört). */
const PLEA: Partial<Record<LandmarkRoomKind, { title: string; hint: string; button: string }>> = {
  worship: { title: 'Fürbitte', hint: 'Am Eingang liegt ein Buch für Fürbitten. Was möchtest du hineinschreiben?', button: 'Ins Buch schreiben' },
  mosque: { title: 'Bittgebet (Dua)', hint: 'Ein persönliches Bittgebet, in eigenen Worten.', button: 'Bitten' },
  synagogue: { title: 'Gebet', hint: 'Ein Gebet oder ein Anliegen, in eigenen Worten.', button: 'Beten' },
  hindu_temple: { title: 'Gebet', hint: 'Ein Gebet oder ein Anliegen vor dem Schrein.', button: 'Beten' },
  buddhist_temple: { title: 'Wunsch für alle Wesen', hint: 'Ein guter Wunsch – für dich, für andere, für die Welt.', button: 'Widmen' },
  resonance_place: { title: 'Anliegen an die Runde', hint: 'Was soll werden? Ein Wunsch, eine Frage, eine Hoffnung.', button: 'An die Pinnwand' },
  community_hall: { title: 'Anliegen', hint: 'Was fehlt im Ort, was wäre schön?', button: 'An die Pinnwand' },
}
/** Ein laufender Termin am Ort: Art, Titel, echte Zeiten und wer ihn trägt. */
export type RoomOccasion = { kind: ActivityKind; label: string; group: string; startedAt: string; endsAt: string; attendees: number; tradition: Tradition; host: { id: string; name: string; role: string } }
/** Eine Person der Simulation im Raum: wer den Ort trägt (host) steht vorne, Besucher auf den Plätzen. */
export type RoomPerson = { id: string; name: string; role: string; host: boolean; /** Was gerade los ist, z. B. „Freitagsgebet“. */ doing?: string }

type StaffTask = { kind: 'bring'; book: LibraryBook } | { kind: 'reshelve' } | { kind: 'visit'; label: string } | { kind: 'return' }
type Walker = { path: LandmarkPoint[]; index: number; onArrive?: () => void }

function stableHash(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** Was die Bibliothekarin über den Bestand weiß – kompakt genug für das Gesprächs-API. */
function catalogueLines(books: readonly LibraryBook[], maxChars = 136) {
  const lines: string[] = []
  let line = ''
  for (const book of books) {
    const genre = book.genre.split('/')[0].trim()
    const entry = `${book.title} (${genre})`
    if (line && line.length + entry.length + 2 > maxChars) { lines.push(line); line = '' }
    line = line ? `${line}; ${entry}` : entry
  }
  if (line) lines.push(line)
  return lines
}
const pickTip = (seed: number) => LIBRARY_BOOKS[Math.abs(seed) % LIBRARY_BOOKS.length]

/** Eine Figur für den Motor: Personal, Lesegast oder eine Person der Simulation. */
function figure(id: string, displayName: string, role: string, works: boolean, entityId: string, known = true): ColonyResident {
  const h = stableHash(id)
  return {
    id, displayName,
    identityState: known ? 'known' : 'unknown',
    observableDescription: role,
    appearance: { genderPresentation: h % 2 ? 'feminine' : 'masculine', bodyFrame: ['slender', 'average', 'broad'][h % 3], skinToneCode: `skin_${1 + (h >> 3) % 6}`, hairStyleCode: ['short', 'bun', 'curly', 'long'][(h >> 5) % 4], hairColorCode: ['dark', 'brown', 'light', 'grey', 'red'][(h >> 7) % 5], facialHairCode: 'none', visibleAgeBand: 'adult' },
    birthYear: null,
    activityState: works ? 'working' : 'idle',
    lastAction: null,
    assignments: works ? [{ type: 'work', roleCode: role, tileEntityId: entityId }] : [],
    needs: [],
    skills: [],
  } as unknown as ColonyResident
}

/** Mehrgeschossige Häuser: jedes Geschoss ist eine eigene Instanz, der Wechsel setzt Figur und Personal zurück. */
export default function LandmarkWalkableInterior(props: Props) {
  const [floor, setFloor] = useState({ level: 0, byStairs: false })
  return <LandmarkRoom key={floor.level} {...props} level={floor.level} byStairs={floor.byStairs} onLevel={level => setFloor({ level, byStairs: true })}/>
}

function LandmarkRoom({ kind, name, typeLabel, facts, onClose, knowledge = [], services = [], staffRole, desk, realName, people = [], occasion, placeRef, level, byStairs, onLevel }: Props & { level: number; byStairs: boolean; onLevel: (level: number) => void }) {
  const layout = useMemo(() => { const base = landmarkRoomLayout(kind, level, byStairs); return staffRole && base.staff ? { ...base, staff: { ...base.staff, role: staffRole } } : base }, [kind, staffRole, level, byStairs])
  const vlayout = useMemo(() => toVenueLayout(layout), [layout])
  // Raumkennung für Mitspieler und Raum-Chat: nur Buchstaben, Ziffern, : _ - (sonst lehnt der Raum-Chat ab).
  const entityId = ('landmark:' + (placeRef ?? name).normalize('NFKD').replace(/[^A-Za-z0-9:_-]+/g, '-') + (level ? ':' + level : '')).slice(0, 80)
  const isLibrary = kind === 'library'
  const isCemetery = kind === 'cemetery'
  const isResonance = kind === 'resonance_place'
  const staffName = useMemo(() => landmarkStaffName(name), [name])
  const staffId = `landmark-staff:${name}`
  const readerId = `landmark-reader:${name}`
  const staff = layout.staff
  const speech = useSpeech()
  const lounge = useLoungeMusic(kind === 'hospitality')
  const ctxRef = useRef<InteriorContext | null>(null)
  const setStatus = (text: string) => ctxRef.current?.setStatus(text)

  // ── Kerzen (Gotteshaus) und Gedenkort (Friedhof, W-13) ──
  const [candles, setCandles] = useState(3)
  const [memorials, setMemorials] = useState<Array<{ id: string; placeRef: string; name: string | null; at: string }>>([])
  const [memorialName, setMemorialName] = useState('')
  const [memorialNote, setMemorialNote] = useState('')
  const [memorialBusy, setMemorialBusy] = useState(false)
  useEffect(() => {
    if (!isCemetery) return
    let live = true
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/memorial', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (live && response.ok && Array.isArray(json?.candles)) setMemorials(json.candles)
      } catch { /* ohne Kerzen */ }
    })()
    return () => { live = false }
  }, [isCemetery])
  async function lightMemorial() {
    if (memorialBusy) return
    setMemorialBusy(true); setMemorialNote('')
    try {
      const { token } = await getSessionInfo()
      if (!token) { setMemorialNote('Zum Anzünden bitte anmelden.'); return }
      const response = await fetch('/api/game/memorial', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ placeRef: placeRef ?? name, placeName: name, name: memorialName }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setMemorialNote(String(json.error ?? 'Die Kerze ließ sich nicht anzünden.')); return }
      setMemorials(current => [json.candle, ...current])
      setMemorialNote(memorialName.trim() ? `Die Kerze für ${memorialName.trim()} brennt.` : 'Die Kerze brennt.')
      setMemorialName('')
    } catch { setMemorialNote('Die Kerze ließ sich gerade nicht anzünden.') } finally { setMemorialBusy(false) }
  }

  // ── Fürbitte, Wunsch, Anliegen ──
  const plea = PLEA[kind] ?? null
  const [pleaText, setPleaText] = useState('')
  const [pleaNote, setPleaNote] = useState<{ text: string; help?: string } | null>(null)
  const [pleaBusy, setPleaBusy] = useState(false)
  async function sendPlea() {
    const text = pleaText.trim()
    if (!plea || text.length < 3 || pleaBusy) return
    setPleaBusy(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/wishes', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, channel: isResonance ? 'resonanz' : 'fuerbitte', placeRef: placeRef ?? null, placeName: name, tradition: kind, location: 'earth' }),
      })
      const data = await response.json().catch(() => ({}))
      // Die Welt erklärt nichts: kein „wird erfüllt“, nur dass es angekommen ist.
      setPleaNote(response.ok ? { text: data.message ?? 'Aufgeschrieben. Es bleibt hier.', help: data.help } : { text: data.error ?? 'Gerade nicht möglich.' })
      if (response.ok) setPleaText('')
    } finally { setPleaBusy(false) }
  }

  // ── Termin: Ablauf nach echter Uhr, Predigt, offene Runde ──
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => { if (!occasion) return; const timer = setInterval(() => setNowMs(Date.now()), 15000); return () => clearInterval(timer) }, [occasion])
  const phases = useMemo(() => occasion ? liturgyFor(occasion.kind, occasion.tradition, occasion.label) : [], [occasion])
  const minute = occasion ? Math.floor((nowMs - Date.parse(occasion.startedAt)) / 60000) : -1
  const phase = occasion ? phaseAt(phases, minute) : null
  const [sermon, setSermon] = useState<{ text: string; by: string } | null>(null)
  const [hearing, setHearing] = useState(false)

  // ── Personen: Träger(in) vorn, Besucher auf den Plätzen; im Gastraum wählen die Gäste selbst ──
  const [stanceBucket, setStanceBucket] = useState(() => Math.floor(Date.now() / STANCE_WINDOW_MS))
  useEffect(() => {
    if (kind !== 'hospitality') return
    const timer = setInterval(() => setStanceBucket(Math.floor(Date.now() / STANCE_WINDOW_MS)), 30000)
    return () => clearInterval(timer)
  }, [kind])
  const placed = useMemo((): Array<{ person: RoomPerson; at: LandmarkPoint; stance?: Stance; spotId?: string; sitting: boolean }> => {
    const onSeat = (p: LandmarkPoint) => layout.furniture.some(item => SEAT_KINDS.has(item.kind) && p.x >= item.x - 2 && p.x <= item.x + item.w + 2 && p.y >= item.y - 2 && p.y <= item.y + item.h + 2)
    if (kind === 'hospitality') {
      const crowd = people.slice(0, 20)
      const spots = new Map(hospitalityPlacement(layout, crowd.map(person => ({ id: person.id, host: Boolean(person.host) })), stanceBucket).map(item => [item.id, item]))
      return crowd.flatMap(person => { const spot = spots.get(person.id); return spot ? [{ person, at: spot.at, stance: spot.stance, sitting: spot.stance === 'sit' || spot.stance === 'stool' }] : [] })
    }
    const hosts = people.filter(person => person.host).slice(0, 1)
    const rest = people.filter(person => !hosts.includes(person)).slice(0, 14)
    const spots = crowdSpots(layout, 24)
    const hostSpot = layout.hostAt ?? spots[0] ?? layout.start
    return [
      ...hosts.map(person => ({ person, at: hostSpot, sitting: false })),
      ...rest.slice(0, spots.length).map((person, index) => ({ person, at: spots[index], spotId: 'crowd-' + index, sitting: onSeat(spots[index]) })),
    ]
  }, [people, layout, kind, stanceBucket])

  // ── Personal und Lesegast gehen wirklich (Wege um die Möbel des Motors) ──
  const staffHome = useMemo(() => staff ? toV(staff) : null, [staff])
  const [staffPos, setStaffPos] = useState<LandmarkPoint | null>(staffHome)
  const staffPosRef = useRef(staffPos)
  const staffWalk = useRef<Walker | null>(null)
  const [staffTask, setStaffTask] = useState<StaffTask | null>(null)
  const staffTaskRef = useRef<StaffTask | null>(null)
  useEffect(() => { staffTaskRef.current = staffTask }, [staffTask])
  const staffIdleSince = useRef(Date.now())
  const tipSeed = useRef(Math.floor(Date.now() / 86_400_000))
  const [tip, setTip] = useState<LibraryBook | null>(null)
  const [held, setHeld] = useState<LibraryBook | null>(null)
  const [bookId, setBookId] = useState('')
  const [reading, setReading] = useState<{ bookId: string; offset: number; text: string; done: boolean } | null>(null)
  const [resonanceActive, setResonanceActive] = useState(false)
  const readerName = useMemo(() => READER_NAMES[(staffName.length + name.length) % READER_NAMES.length], [name, staffName])
  const readerSeats = useMemo(() => layout.spots.filter(spot => spot.action === 'sit'), [layout])
  const [readerPos, setReaderPos] = useState<LandmarkPoint>(() => { const s = readerSeats[readerSeats.length - 1]; return s ? toV({ x: s.x + 30, y: s.y }) : toV(layout.start) })
  const readerPosRef = useRef(readerPos)
  const readerWalk = useRef<Walker | null>(null)
  const waypoints = useMemo(() => landmarkWaypoints(layout), [layout])

  const go = useCallback((ref: MutableRefObject<Walker | null>, from: LandmarkPoint, target: LandmarkPoint, onArrive?: () => void) => {
    ref.current = { path: venuePath(vlayout, from, target), index: 1, onArrive }
  }, [vlayout])
  const staffGo = useCallback((targetL: LandmarkPoint, onArrive?: () => void) => {
    if (staffPosRef.current) go(staffWalk, staffPosRef.current, toV(targetL), onArrive)
  }, [go])
  const backHome = useCallback(() => { if (staff) staffGo(staff, () => { setStaffTask(null); staffIdleSince.current = Date.now() }) }, [staff, staffGo])

  useEffect(() => {
    const step = (w: Walker | null, here: LandmarkPoint): { pos: LandmarkPoint; done: boolean } | null => {
      if (!w) return null
      const goal = w.path[w.index]
      if (!goal) return { pos: here, done: true }
      const dx = goal.x - here.x, dy = goal.y - here.y, d = Math.hypot(dx, dy)
      if (d <= STAFF_STEP) { w.index++; return { pos: goal, done: w.index >= w.path.length } }
      return { pos: { x: here.x + dx / d * STAFF_STEP, y: here.y + dy / d * STAFF_STEP }, done: false }
    }
    const timer = setInterval(() => {
      const sw = staffWalk.current, sp = staffPosRef.current
      if (sw && sp) {
        const r = step(sw, sp)!
        staffPosRef.current = r.pos; setStaffPos(r.pos)
        if (r.done) { staffWalk.current = null; sw.onArrive?.() }
      } else if (isLibrary && staff && !staffTaskRef.current && !ctxRef.current?.selected && Date.now() - staffIdleSince.current > RESHELVE_EVERY_S * 1000) {
        // Nichts zu tun: ein Stapel Rückgaben wird einsortiert.
        const shelves = waypoints.filter(point => point.kind === 'Regal')
        const target = shelves[Math.floor(Math.random() * shelves.length)]
        if (target) { setStaffTask({ kind: 'reshelve' }); staffGo(target, () => setTimeout(backHome, 2500)) } else staffIdleSince.current = Date.now()
      }
      const rw = readerWalk.current
      if (rw) {
        const r = step(rw, readerPosRef.current)!
        readerPosRef.current = r.pos; setReaderPos(r.pos)
        if (r.done) readerWalk.current = null
      }
    }, 40)
    return () => clearInterval(timer)
  }, [isLibrary, staff, staffGo, backHome, waypoints])

  // Der Lesegast wechselt gelegentlich den Platz oder holt sich etwas aus dem Regal.
  useEffect(() => {
    if (!isLibrary || readerSeats.length < 2) return
    const timer = setInterval(() => {
      if (readerWalk.current || Math.random() < .4) return
      const shelf = waypoints.find(point => point.id === 'shelf:romane')
      const seat = readerSeats[Math.floor(Math.random() * readerSeats.length)]
      const seatPos = toV({ x: seat.x + 30, y: seat.y })
      const target = Math.random() < .3 && shelf ? toV(shelf) : (isVenueBlocked(vlayout, seatPos) ? toV(seat) : seatPos)
      go(readerWalk, readerPosRef.current, target)
      if (shelf && target.x === toV(shelf).x) setTimeout(() => go(readerWalk, readerPosRef.current, seatPos), 7000)
    }, 25_000)
    return () => clearInterval(timer)
  }, [isLibrary, readerSeats, waypoints, vlayout, go])

  /** Die angestellte Person bringt ein Buch an den Platz des Spielers und kehrt zum Tresen zurück. */
  const bringBook = useCallback((book: LibraryBook) => {
    const ctx = ctxRef.current
    if (!staff || !ctx || staffTaskRef.current?.kind === 'bring') return
    setStaffTask({ kind: 'bring', book })
    const beside = { x: ctx.pos.x + 24, y: ctx.pos.y + 4 }
    go(staffWalk, staffPosRef.current ?? beside, isVenueBlocked(vlayout, beside) ? ctx.pos : beside, () => {
      setHeld(book)
      setStatus(`${staffName} legt dir „${book.title}“ hin: „Lass dir Zeit damit.“`)
      setStaffTask({ kind: 'return' })
      backHome()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, staffName, vlayout, go, backHome])

  /** „Ich hole es, und wir setzen uns an die Leseecke“: holen, hinsetzen, mitlesen, zurückgehen. */
  const readTogether = useCallback((book: LibraryBook) => {
    const ctx = ctxRef.current
    if (!staff || !ctx || staffTaskRef.current) return
    const seat = layout.spots.find(spot => spot.action === 'sit')
    const shelf = waypoints.find(point => point.id === 'shelf:' + book.shelf) ?? waypoints.find(point => point.kind === 'Regal')
    if (!seat || !shelf) { bringBook(book); return }
    setStaffTask({ kind: 'visit', label: 'holt ein Buch' })
    ctx.sit('lm-' + seat.id)
    staffGo(shelf, () => {
      setStaffTask({ kind: 'bring', book })
      const beside = toV({ x: seat.x + 34, y: seat.y + 4 })
      go(staffWalk, staffPosRef.current ?? beside, isVenueBlocked(vlayout, beside) ? toV(seat) : beside, () => {
        setHeld(book)
        setStatus(`${staffName} setzt sich zu dir und legt „${book.title}“ auf den Tisch: „Schlag auf, wo du magst – ich lese gern mit.“`)
        setStaffTask({ kind: 'visit', label: 'liest mit dir' })
        setTimeout(() => { setStaffTask({ kind: 'return' }); backHome() }, 90000)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, staffName, layout, waypoints, vlayout, go, staffGo, backHome, bringBook])

  // Vorlesen in der Bibliothek: freigegebener Wortlaut aus buecherwelten, sonst der Klappentext.
  const [heldDoc, setHeldDoc] = useState<ReadingDocument | null>(null)
  useEffect(() => {
    if (!isLibrary || !held) return
    const slug = held.id.split(':')[1]
    if (!slug) return
    let live = true
    void (async () => {
      const { token } = await getSessionInfo()
      for (const k of ['work', 'text']) {
        const response = await fetch(`/api/game/readings?book=${k}:${slug}`, { headers: { Authorization: 'Bearer ' + token } })
        if (!response.ok) continue
        const json = await response.json().catch(() => null) as { document?: ReadingDocument } | null
        if (live && json?.document) setHeldDoc(json.document)
        return
      }
    })().catch(() => { /* dann liest die Person den Klappentext */ })
    return () => { live = false }
  }, [isLibrary, held])
  function readAloud() {
    if (!held) return
    const source = readingSource(held, heldDoc && heldDoc.slug === held.id.split(':')[1] ? heldDoc : null)
    const offset = reading?.bookId === held.id && !reading.done ? reading.offset : 0
    const part = nextReadingChunk(source.text, offset)
    setReading({ bookId: held.id, offset: part.next, text: part.chunk, done: part.done })
    speech.speak(part.chunk, staffId)
  }
  function giveTip(ctx: InteriorContext) {
    tipSeed.current += 7
    const next = pickTip(tipSeed.current)
    setTip(next)
    if (ctx.seat && staffTaskRef.current === null) { setStatus(`${staffName}: „Bleib sitzen – ich bringe dir „${next.title}“.“`); bringBook(next); return }
    setStatus(`${staffName}: „Schau dir mal „${next.title}“ an – ${next.genre.split('/')[0].trim()}.“`)
  }

  // Offene Runde: Beiträge laufen, solange jemand im Raum ist und du nicht gerade mit jemandem sprichst.
  const roundOn = Boolean(occasion && isRoundKind(occasion.kind) && placed.length >= 2)
  const [talking, setTalking] = useState(false)
  const round = useRoundTalk({
    enabled: roundOn && !talking,
    roundKey: occasion ? roundKeyOf(placeRef ?? name, occasion.startedAt) : '',
    placeName: name,
    label: occasion?.label ?? '',
    people: placed.slice(0, 8).map(item => ({ id: item.person.id, name: item.person.name })),
  })

  /** Predigt oder Ansprache hören: die Gastgeberin oder der Gastgeber spricht zur Gemeinde. */
  async function hearSermon() {
    if (!occasion || hearing) return
    const host = placed.find(item => item.person.host)?.person
    if (!host) { setStatus(`${occasion.host.name} ist gerade nicht im Raum.`); return }
    setHearing(true); setSermon(null)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sermon: { occasion: occasion.label, part: phase?.title ?? '', noun: speechNoun(occasion.kind) },
          npcId: host.id, npcName: host.name, npcRole: host.role || occasion.host.role, locationName: name,
          headline: `${occasion.label} in ${name}`, source: 'NOXIA place interior',
          localFacts: [`Du bist in ${name} (${typeLabel}).`, `Gerade: ${occasion.label}.`, `Anwesend sind etwa ${placed.length} Menschen; nicht alle teilen deinen Glauben.`],
          history: [],
        }),
      })
      const data = await response.json().catch(() => ({}))
      const text = response.ok && data.reply ? String(data.reply) : `${host.name} spricht leise; du verstehst heute nur Bruchstücke.`
      setSermon({ text, by: host.name })
      speech.speak(text, host.id)
    } finally { setHearing(false) }
  }

  // ── Figuren für den Motor ──
  const extraResidents = useMemo(() => {
    const out: ColonyResident[] = []
    if (staff) out.push(figure(staffId, staffName, staff.role, true, entityId))
    if (isLibrary && readerSeats.length) out.push(figure(readerId, readerName, 'Lesegast', false, entityId))
    for (const item of placed) out.push(figure(item.person.id, item.person.name, item.person.role, item.person.host, entityId))
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, staffId, staffName, isLibrary, readerSeats.length, readerId, readerName, placed.map(p => p.person.id).join(), entityId])
  const personById = useMemo(() => new Map(placed.map(item => [item.person.id, item])), [placed])

  /** Was die Person über diesen Ort und den Moment weiß (für das Gespräch). */
  function personFacts(person: RoomPerson) {
    return [
      `Du bist gerade in ${name} (${typeLabel}).`,
      person.host ? 'Das ist dein Ort: Hier arbeitest du.' : 'Du bist hier zu Besuch.',
      person.doing ? `Gerade ist hier: ${person.doing}.` : '',
      occasion && phase ? `Ablauf gerade: ${phase.title}. ${person.host ? 'Du leitest den Termin.' : 'Du nimmst teil; das sagt nichts darüber, was du glaubst.'}` : '',
      'Der Spieler steht bei dir im Raum.',
      // W-13: Friedhof – ruhig und ernst; bei Verzweiflung auf die Telefonseelsorge hinweisen
      isCemetery ? 'Du bist auf einem Friedhof. Sprich leise, ruhig und ernsthaft. Wenn jemand über einen echten Verlust spricht, hör zu und nimm es ernst; erfinde keine Verstorbenen.' : '',
      isCemetery ? 'Wirkt jemand verzweifelt oder spricht davon, nicht mehr leben zu wollen, nenne freundlich die Telefonseelsorge: kostenlos, rund um die Uhr, 0800 111 0 111 oder 0800 111 0 222, online telefonseelsorge.de.' : '',
    ].filter(Boolean)
  }
  function staffFacts(ctx: InteriorContext) {
    if (!isLibrary) return (knowledge.length ? knowledge : layout.staffFacts ?? []).slice(0, 16)
    const fiction = LIBRARY_BOOKS.filter(entry => entry.shelf === 'romane')
    return [
      `Du arbeitest an der Ausleihe der ${name} und kennst den Bestand genau.`,
      'Alle Bücher hier sind von Thomas Peter Küper. Du empfiehlst auf Nachfrage passende Titel aus dem Bestand und erfindest keine anderen.',
      ctx.seat ? 'Der Spieler sitzt gerade an einem Leseplatz. Wenn du ihm ein Buch anbietest oder er eins möchte, sag „ich bringe dir …“ und nenne den genauen Titel – du bringst es dann wirklich.' : 'Der Spieler steht. Ein Buch bringst du nur an einen Leseplatz; sonst zeigst du ihm das Regal.',
      held ? `Der Spieler hat gerade „${held.title}“ in der Hand.` : '',
      ...catalogueLines(fiction).map(line => `Romane und Erzählungen: ${line}`),
    ].filter(Boolean).slice(0, 16)
  }

  /** Versprochen ist versprochen: „ich bringe …“ löst den Gang aus; Ziele im Raum werden angesteuert. */
  function onReply(resident: ColonyResident, reply: string, data: Record<string, any>, ctx: InteriorContext) {
    speech.speak(reply, resident.id)
    if (resident.id !== staffId || !staff) return
    if (isLibrary) {
      const lower = (value: string) => value.toLowerCase()
      const mentioned = (value: string) => LIBRARY_BOOKS.find(entry => lower(value).includes(lower(entry.title)))
      if (!ctx.seat && /\b(hol|hole|holen|bring|bringe)\b/i.test(reply) && /(leseecke|leseplatz|lesen|setz|sitz)/i.test(reply)) {
        const earlier = [...ctx.history].reverse().map(entry => mentioned(entry.content)).find(Boolean)
        readTogether(mentioned(reply) ?? earlier ?? tip ?? pickTip(tipSeed.current += 3))
        return
      }
      if (ctx.seat && /\b(bring|hole?|bringe)\b/i.test(reply)) { bringBook(mentioned(reply) ?? tip ?? pickTip(tipSeed.current += 3)); return }
    }
    const action = data.worldAction as { type?: string; targetRef?: string; playerFollows?: boolean } | undefined
    if (action?.type === 'visit_place') {
      const target = waypoints.find(point => point.id === action.targetRef)
      if (target) {
        setStaffTask({ kind: 'visit', label: target.label })
        staffGo(target, () => setTimeout(backHome, 6000))
        if (action.playerFollows) ctx.walkTo(toV({ x: target.x - 24, y: target.y }))
      }
    } else if (action?.type === 'lead_walk') {
      const shelf = waypoints.find(point => point.id === 'shelf:romane') ?? waypoints[0]
      setStaffTask({ kind: 'visit', label: shelf.label })
      staffGo(shelf, () => setTimeout(backHome, 6000))
      ctx.walkTo(toV({ x: shelf.x - 24, y: shelf.y }))
    }
  }

  const furnitureLabel = (k: string) => k === 'counter' ? (isLibrary ? 'AUSLEIHE' : kind === 'workshop' ? 'ANNAHME' : kind === 'artlounge' ? 'THEKE' : kind === 'hospitality' ? 'THEKE' : 'KASSE') : null
  const staffRoleText = staffTask?.kind === 'bring' ? 'bringt ein Buch' : staffTask?.kind === 'reshelve' ? 'sortiert ein' : staffTask?.kind === 'visit' ? staffTask.label : null

  // ── Seitenleiste: was hier zu tun ist ──
  function renderOffer(ctx: InteriorContext) {
    ctxRef.current = ctx
    const here = toL(ctx.pos)
    const near = nearestLandmarkSpot(layout, here)
    const shelf = isLibrary ? shelfAt(layout, here) : null
    const shelfBooks = shelf ? LIBRARY_BOOKS.filter(entry => entry.shelf === shelf.shelf) : []
    const shelfLabel = shelf ? LIBRARY_SHELVES.find(entry => entry.id === shelf.shelf)?.label ?? 'Regal' : ''
    const book = isResonance ? null : LIBRARY_BOOKS.find(entry => entry.id === bookId) ?? null
    const resonanceShelf = isResonance ? shelfAt(layout, here) : null
    const resonanceOpen = isResonance && (near?.action === 'books' || Boolean(resonanceShelf))
    const atCounter = Boolean(staff && staffHome && Math.hypot(ctx.pos.x - staffHome.x, ctx.pos.y - staffHome.y) <= 70)
    if (ctx.selected) return null
    return <div className="menu lm-menu">
      {layout.floorName && (LANDMARK_LEVELS[layout.kind] ?? 1) > 1 && <small>{layout.floorName.toUpperCase()}</small>}
      {plea && <div className="plea">
        <small>{plea.title.toUpperCase()}</small>
        <span>{plea.hint}</span>
        <textarea value={pleaText} maxLength={280} rows={3} data-noxia-private onChange={event => setPleaText(event.target.value)} placeholder="In eigenen Worten …"/>
        <div className="moves"><button disabled={pleaBusy || pleaText.trim().length < 3} onClick={() => void sendPlea()}>{pleaBusy ? '…' : plea.button}</button></div>
        {pleaNote && <p>{pleaNote.text}</p>}
        {pleaNote?.help && <p className="help">{pleaNote.help}</p>}
      </div>}
      {occasion && phase && <div className="occasion">
        <small>JETZT · {occasion.group.toUpperCase()}</small>
        <b>{occasion.label}</b>
        <span>mit {occasion.host.name}{placed.length > 1 ? ` · ${placed.length - 1} weitere hier` : ''}</span>
        <ol>{phases.filter(item => item.from < 120).map(item => <li key={item.title} className={item === phase ? 'now' : item.to <= minute ? 'done' : ''}>{item.title}</li>)}</ol>
        <p>{phase.text}</p>
        {roundOn && <RoundTalk lines={round.lines} sending={round.sending} note={round.note} say={round.say}/>}
        <div className="moves">
          {phases.some(item => item.speak) && (phase.speak
            ? <button disabled={hearing} onClick={() => void hearSermon()}>{hearing ? 'Hört zu …' : `${speechNoun(occasion.kind)} hören`}</button>
            : <button disabled>{(() => { const next = phases.find(item => item.speak); return next && minute < next.from ? `${speechNoun(occasion.kind)} in ~${next.from - minute} min` : `${speechNoun(occasion.kind)} vorbei` })()}</button>)}
          {!ctx.seat && <button onClick={() => ctx.sit()}>Platz nehmen</button>}
        </div>
        {sermon && <blockquote><b>{sermon.by}:</b> „{sermon.text}“</blockquote>}
        <em>Gäste sind willkommen. Mitsingen, mitbeten oder einfach still dabeisitzen – alles ist in Ordnung.</em>
      </div>}
      {isResonance && <ResonanceShelf atShelf={resonanceOpen} onActiveChange={setResonanceActive}/>}
      {shelf && !book && <><small>{shelfLabel.toUpperCase()}</small><p className="hint">Zieh einen Band heraus, um Titel und Klappentext zu lesen.</p><div className="books">
        {shelfBooks.map(entry => <button key={entry.id} onClick={() => setBookId(entry.id)}><b>{entry.title}</b><span>{entry.genre}</span></button>)}
      </div></>}
      {book && <div className="book">
        <span>{book.author}</span><b>{book.title}</b><i>{book.genre}</i><p>{book.teaser}</p>
        <div className="moves"><button onClick={() => setBookId('')}>← Zurück zum Regal</button><button onClick={() => { setHeld(book); setBookId(''); setStatus(`Du nimmst „${book.title}“ aus dem Regal.`) }}>Mitnehmen</button></div>
      </div>}
      {held && !book && <div className="book held-card">
        <span>IN DEINER HAND</span><b>{held.title}</b><i>{held.genre}</i>
        {ctx.seat ? <p>{held.teaser}</p> : <p>Setz dich an einen Leseplatz, um darin zu lesen.</p>}
        {ctx.seat && staff && isLibrary && <>
          {reading?.bookId === held.id && <blockquote className="reading">{reading.text}</blockquote>}
          <div className="moves"><button onClick={readAloud}>{reading?.bookId === held.id && !reading.done ? `Weiterlesen (${staffName})` : reading?.bookId === held.id ? `Noch einmal von vorn (${staffName})` : `${staffName} liest vor`}</button></div>
        </>}
        <div className="moves">{atCounter ? <button onClick={() => { setHeld(null); setStatus(`Du gibst „${held.title}“ an der Ausleihe zurück.`) }}>Zurückgeben</button> : <button onClick={() => setHeld(null)}>Weglegen</button>}</div>
      </div>}
      {!shelf && !book && near && near.action !== 'staff' && <div className="spot">
        <small>{near.label}</small>
        <p className="hint">{near.text}</p>
        {near.action === 'learn' && <div className="moves"><button onClick={() => window.location.assign('/ssf')}>Lernmodule der SSF öffnen</button></div>}
        {near.action === 'candle' && <div className="moves"><button onClick={() => { setCandles(count => Math.min(9, count + 1)); setStatus('Du zündest eine Kerze an.') }}>Kerze anzünden</button></div>}
        {near.action === 'sit' && !ctx.seat && <div className="moves"><button onClick={() => ctx.sit('lm-' + near.id)}>Hinsetzen</button></div>}
        {near.action === 'stairs' && near.toLevel !== undefined && <div className="moves"><button onClick={() => onLevel(near.toLevel as number)}>{near.toName ?? (near.toLevel === 0 ? 'Ins Erdgeschoss' : near.toLevel > level ? `Ins ${near.toLevel}. Obergeschoss` : `Ins ${near.toLevel}. Obergeschoss hinunter`)}</button></div>}
        {near.action === 'memorial' && <div className="plea">
          <small>GEDENKEN · NUR FÜR DICH</small>
          <span>Wenn du magst, mit einem Namen. Niemand sonst sieht, was du hier hinterlässt.</span>
          <input value={memorialName} maxLength={80} data-noxia-private onChange={event => setMemorialName(event.target.value)} placeholder="Name (freiwillig)"/>
          <div className="moves"><button disabled={memorialBusy} onClick={() => void lightMemorial()}>{memorialBusy ? '…' : 'Kerze anzünden'}</button></div>
          {memorialNote && <p>{memorialNote}</p>}
          {memorials.length > 0 && <p className="hint">Deine Kerzen: {memorials.slice(0, 8).map(item => item.name ?? 'ohne Namen').join(', ')}{memorials.length > 8 ? ' …' : ''}</p>}
        </div>}
      </div>}
      {!staff && placed.length > 0 && !resonanceActive && <p className="hint">{placed.map(item => item.person.name).join(', ')} {placed.length === 1 ? 'ist' : 'sind'} gerade hier. Geh hin und sprich {placed.length === 1 ? 'sie oder ihn' : 'jemanden'} an.</p>}
      {!staff && placed.length === 0 && !isLibrary && kind !== 'artlounge' && !isCemetery && <p className="hint">Gerade ist niemand hier, mit dem du sprechen kannst. Zu den Gottesdiensten, Gebeten und Runden ist meist jemand da.</p>}
      {realName && <p className="hint">Heute steht hier laut OpenStreetMap „{realName}“. Im Spiel (2086) ist der Betrieb eine erfundene Nachfolgerin.</p>}
      <small>GEHE ZU …</small>
      <div className="moves wrap">
        {waypoints.map(point => <button key={point.id} onClick={() => {
          if (point.id === 'exit') { ctx.walkTo(vlayout.exit, onClose); return }
          const spot = layout.spots.find(item => 'spot:' + item.id === point.id)
          if (spot?.action === 'sit') { ctx.sit('lm-' + spot.id); return }
          ctx.walkTo(toV(point))
        }}>{point.label}</button>)}
      </div>
      {facts.length > 0 && <dl className="notice">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      <p className="hint real">Typischer Grundriss für diese Ortsart – nicht der vermessene Innenraum des realen Gebäudes. Ortsdaten: OpenStreetMap.</p>
    </div>
  }

  function talkPanel(ctx: InteriorContext) {
    if (ctx.selected?.id !== staffId) return null
    return <div className="lm-talk">
      {tip && <button className="tipcard" onClick={() => { setBookId(tip.id); ctx.setSelected(null) }}><span>{tip.author}</span><b>{tip.title}</b><i>{tip.genre}</i><small>Klappentext lesen →</small></button>}
      {desk}
      {services.length > 0 && <div className="moves wrap">{services.map(service => <button key={service.id} className={service.available ? '' : 'quiet'} onClick={() => setStatus(service.available ? `${service.label}: ${service.note}.` : `${staffName}: „${service.label} – das geht hier noch nicht. ${service.note}.“`)}>{service.label}{!service.available && <small> · bald</small>}</button>)}</div>}
      <div className="moves">{isLibrary && <button onClick={() => giveTip(ctx)}>Buchtipp erbitten</button>}<button onClick={() => ctx.setSelected(null)}>Gespräch beenden</button></div>
    </div>
  }

  const flames = isCemetery
    ? memorials.slice(0, 12).map((_, i) => toV({ x: 628 + (i % 6) * 13, y: 44 + Math.floor(i / 6) * 8 }))
    : kind === 'worship' ? Array.from({ length: Math.min(9, candles) }, (_, i) => toV({ x: 654 + (i % 5) * 8, y: 88 + Math.floor(i / 5) * 9 })) : []

  const fitting: InteriorFitting = {
    kind: layout.kind,
    roomClass: 'lm',
    layout: vlayout,
    noun: typeLabel,
    locative: 'in ' + name,
    sectionLabel: 'REALER ORT',
    headerNote: layout.floorName && (LANDMARK_LEVELS[layout.kind] ?? 1) > 1 ? layout.floorName : undefined,
    roomName: name,
    outdoor: isCemetery,
    service: () => 'staffed',
    closedText: () => null,
    furnitureLabel,
    visits: [],
    extraResidents,
    facts: self => {
      if (self.id === staffId) return staffFacts(ctxRef.current!)
      if (self.id === readerId) return [`Du bist in ${name} und liest in Ruhe.`, 'Du kennst den Spieler nicht; du nickst freundlich und liest weiter.']
      const item = personById.get(self.id)
      return item ? personFacts(item.person) : [`Du bist in ${name}.`]
    },
    placeKnowledge: isLibrary ? catalogueLines(LIBRARY_BOOKS.filter(entry => entry.shelf === 'sachbuecher')).map(line => `Sachbücher: ${line}`) : [],
    hearsay: () => [],
    introduction: () => undefined,
    nearbyPlaces: self => self.id !== staffId ? [] : waypoints.filter(point => point.id !== 'exit' && point.kind !== 'Tresen').slice(0, 9).map((point, index) => ({ key: `p${index}`, targetRef: point.id, name: point.label, kind: point.kind, distanceM: Math.round(Math.hypot(toV(point).x - self.spot.x, toV(point).y - self.spot.y) / 16) })),
    greeting: resident => resident.id === staffId && staff ? staff.greeting : null,
    onReply,
    things: held ? [{ key: 'held:' + held.id, icon: <span className="lm-book" title={held.title}/>, title: held.title, forId: null, at: 0, broughtToTable: false }] : [],
    renderOffer,
    talkPanel,
    idleText: isLibrary ? `Geh an ein Regal, um in den Büchern zu stöbern${staff ? `, oder sprich ${staffName} an der Ausleihe an` : ''}.` : staff ? `${staffName} hilft dir am Tresen weiter.` : undefined,
    greetsAtService: Boolean(staff),
    goToServiceLabel: () => staff ? (isLibrary ? 'Zur Ausleihe gehen' : 'Zum Tresen gehen') : '',
    tableService: false,
    loaded: true,
    headerTools: <RoomAudioControls speech={speech} music={lounge}/>,
    figureAt: id => {
      if (id === staffId && staffPos) return { x: staffPos.x, y: staffPos.y, posture: 'standing', label: staffRoleText ?? 'am Tresen' }
      if (id === readerId) return { x: readerPos.x, y: readerPos.y, posture: readerWalk.current ? 'standing' : 'sitting', label: readerWalk.current ? 'unterwegs' : 'liest' }
      const item = personById.get(id)
      if (!item) return null
      const v = toV(item.at)
      return { x: v.x, y: v.y, posture: item.sitting ? 'sitting' : 'standing', spotId: item.spotId, label: item.person.doing ?? (item.stance ? STANCE_LABEL[item.stance] : item.person.host ? 'vorn' : 'im Raum') }
    },
    floorLayer: <>
      {layout.zones.map(zone => { const r = rectV(zone); return <div key={zone.id} className={'zone ' + zone.kind} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}/> })}
      {layout.lamps.map((lamp, index) => { const c = toV(lamp); return <div key={index} className={'lm-lamp' + (lamp.warm ? ' warm' : '')} style={{ left: c.x - lamp.r, top: c.y - lamp.r, width: lamp.r * 2, height: lamp.r * 2 }}/> })}
    </>,
    furnitureDressing: item => item.kind === 'shelf' ? <i className="spines"/> : item.kind === 'shelf-low' ? <i className="spines low"/> : item.kind === 'table' && isLibrary ? <><i className="book-open"/><i className="lamp-small"/></> : item.kind === 'pinboard' ? <><i className="note n1"/><i className="note n2"/><i className="note n3"/></> : null,
    overlay: ctx => <>
      {flames.map((p, i) => <i key={'flame' + i} className="flame" style={{ left: p.x, top: p.y }}/>)}
      {staffTask?.kind === 'bring' && staffPos && <i className="carry" style={{ left: staffPos.x + 6, top: staffPos.y - 30 }}/>}
      {roundOn && !ctx.selected && <RoundBubbles lines={round.lines} width={VENUE_WIDTH} figures={placed.map(item => ({ id: item.person.id, ...toV(item.at) }))}/>}
    </>,
  }

  return <>
    <WalkableInterior entityId={entityId} buildingName={name} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx; if (Boolean(ctx.selected) !== talking) setTalking(Boolean(ctx.selected)) }}/>
    <style jsx global>{LM_CSS}</style>
  </>
}

// Möbel und Böden der Orte (aus dem früheren Landmark-Raum übernommen), in 2,5D mit Höhe.
const LM_CSS = `
.walkable-interior .room.lm.cave{--floor:#6e6458;--plank:#6e6458}.walkable-interior .room.iso.lm.cave{--accent:#ffb36a}
.walkable-interior .room.iso.cave .wall3d{background:radial-gradient(ellipse at 30% 40%,#8a7f70,#5d5449 60%,#3f3830)!important;box-shadow:inset 0 -30px 60px #0007}
.walkable-interior .room.iso.cave .wall3d *{display:none}
.walkable-interior .zone.cave{background:#6e6458;background-image:radial-gradient(#7d7366 1.2px,transparent 1.6px),radial-gradient(#5f564b 1px,transparent 1.4px);background-size:11px 11px,17px 17px}
.walkable-interior .zone.step{background:linear-gradient(#8a7f70,#7a6f62);border-bottom:3px solid #4f463c;box-shadow:0 2px 0 #0003}
.walkable-interior .zone.dig{background:repeating-linear-gradient(0deg,#9b7a55 0 10px,#8a6a48 10px 20px);border:2px dashed #e9c46a;opacity:.9}
.walkable-interior .room.lm .f.rock{background:radial-gradient(ellipse at 35% 30%,#8f8476,#625a4e 55%,#433c34);border:0;border-radius:14px}
.walkable-interior .room.iso.lm .f.rock{--h:120px}
.walkable-interior .room.iso.lm .f.rock>.fs,.walkable-interior .room.iso.lm .f.rock>.fw{background:linear-gradient(#5b5247,#3f3830);filter:none;border-radius:6px}
.walkable-interior .room.lm{--wall:#e8e2d4;--panel:#b7a98f;--rail:#6b5a43;--floor:#cdbf9f;--plank:#bfb08f;--top:#efe6d2}
.walkable-interior .room.iso.lm{--accent:#e9c46a;--wallTop:#efe7d6;--wallBase:#d9ccb3}
.walkable-interior .room.library{--floor:#b99d76;--plank:#b2956d}
.walkable-interior .room.worship{--floor:#cfc8b9;--plank:#c4bcab}
.walkable-interior .room.mosque{--floor:#e6dfcf;--plank:#d9d1bf}.walkable-interior .room.iso.mosque{--accent:#5fd0c0}
.walkable-interior .room.synagogue{--floor:#c9b48f;--plank:#c1ab85}.walkable-interior .room.iso.synagogue{--accent:#7fa8ff}
.walkable-interior .room.hindu_temple{--floor:#e9dcc2;--plank:#dccdb0}.walkable-interior .room.iso.hindu_temple{--accent:#ff9a4a}
.walkable-interior .room.buddhist_temple{--floor:#d9cbb0;--plank:#cbbd9f}.walkable-interior .room.iso.buddhist_temple{--accent:#f1c24a}
.walkable-interior .room.community_hall{--floor:#cdbf9f}
.walkable-interior .room.resonance_place{--floor:#d3cdb8}.walkable-interior .room.iso.resonance_place{--accent:#9fd3c0}
.walkable-interior .room.shop{--floor:#c9c2b2}.walkable-interior .room.workshop{--floor:#9a9b96;--plank:#8f908b}
.walkable-interior .room.iso.workshop,.walkable-interior .room.iso.shop{--accent:#4fd8ff}
.walkable-interior .room.artlounge{--floor:#b98a57}.walkable-interior .room.iso.artlounge{--accent:#ff6f9a}
.walkable-interior .room.cemetery{--floor:#7e9a62;--plank:#7e9a62;border-color:#4e6a3a}.walkable-interior .room.cemetery:before,.walkable-interior .room.cemetery:after{display:none}
.walkable-interior .room.iso.lm{background:var(--floor)}
.walkable-interior .room.iso.cemetery{background:#7e9a62;background-image:radial-gradient(#8faa6e 1px,transparent 1.2px);background-size:7px 7px}
.walkable-interior .room.lm .zone{position:absolute;z-index:1;pointer-events:none}
.walkable-interior .zone.tiles{background:repeating-conic-gradient(#d8d0c0 0 25%,#cbc2b1 0 50%) 0 0/32px 32px}
.walkable-interior .zone.carpet{background:#8d3a36;background-image:radial-gradient(#a24a44 1.2px,transparent 1.3px);background-size:9px 9px;border:3px solid #6e2a28;border-radius:4px;box-shadow:inset 0 0 0 6px #7a3230}
.walkable-interior .zone.rug{background:#4e6a8a;background-image:repeating-linear-gradient(45deg,#5a789a 0 6px,#4e6a8a 6px 12px);border:2px solid #3b526c;border-radius:3px}
.walkable-interior .zone.chancel{background:#d9d1bf;border-bottom:4px solid #b7ad97}
.walkable-interior .zone.concrete{background:#9a9b96;background-image:linear-gradient(#90918c 1px,transparent 1px),linear-gradient(90deg,#90918c 1px,transparent 1px);background-size:120px 120px}
.walkable-interior .zone.grass{background:#8faa6e;background-image:radial-gradient(#9ab878 1px,transparent 1.2px);background-size:7px 7px}
.walkable-interior .zone.gravel{background:#cfc6b2;background-image:radial-gradient(#b7ad97 1px,transparent 1.3px);background-size:5px 5px;box-shadow:inset 0 0 0 2px #b9af9a}
.walkable-interior .zone.parquet{background:repeating-linear-gradient(90deg,#b98a57 0 38px,#a97a4a 38px 40px)}
.walkable-interior .zone.oilstain{background:radial-gradient(ellipse,#3a3a36aa,transparent 70%)}
.walkable-interior .lm-lamp{position:absolute;z-index:1;border-radius:50%;background:radial-gradient(circle,#ffffff55 0%,#ffffff1c 40%,transparent 70%);pointer-events:none}
.walkable-interior .lm-lamp.warm{background:radial-gradient(circle,#ffd98a66 0%,#ffcc6e22 40%,transparent 70%)}
.walkable-interior .room.lm .f{border-radius:3px}
.walkable-interior .room.lm .f.bed{background:linear-gradient(90deg,#f4efe6 0 22%,#9fb6c9 22%);border:2px solid #6b7f91;border-radius:4px}
.walkable-interior .room.lm .f.wardrobe{background:#8a6a4a;border:2px solid #5a4430}
.walkable-interior .room.lm .f.bathtub{background:#f6fafb;border:3px solid #b9c9cf;border-radius:10px}
.walkable-interior .room.lm .f.shower{background:repeating-linear-gradient(45deg,#e4eef1 0 4px,#cfdde2 4px 8px);border:2px solid #9fb3ba}
.walkable-interior .room.lm .f.sink,.walkable-interior .room.lm .f.toilet{background:#fbfdfd;border:2px solid #b9c9cf;border-radius:40%}
.walkable-interior .room.lm .f.stove{background:radial-gradient(circle at 30% 35%,#333 0 18%,transparent 19%),radial-gradient(circle at 70% 65%,#333 0 18%,transparent 19%),#d9d9d9;border:2px solid #888}
.walkable-interior .room.lm .f.fridge,.walkable-interior .room.lm .f.washer{background:#eef2f3;border:2px solid #9aa7ab;border-radius:3px}
.walkable-interior .room.lm .f.boiler{background:#c9504a;border:2px solid #8a2f2a;border-radius:6px}
.walkable-interior .room.lm .f.pillar{background:#a7a39b;border:2px solid #6f6b64}
.walkable-interior .room.lm .f.railing{background:repeating-linear-gradient(0deg,#555 0 2px,transparent 2px 6px),repeating-linear-gradient(90deg,#555 0 2px,transparent 2px 6px);opacity:.8}
.walkable-interior .room.lm .f.table{background:#8c6b47;border:2px solid #5d4428;border-radius:5px;box-shadow:none}
.walkable-interior .room.lm .f.table:after{display:none}
.walkable-interior .room.lm .f.shelf{background:#4a2c1c;border:2px solid #2d1a10}
.walkable-interior .room.lm .f.shelf-low{background:#6b4a33;border:2px solid #3b2518}
.walkable-interior .room.lm .spines{position:absolute;inset:3px;background:repeating-linear-gradient(90deg,#8a3a2e 0 4px,#2f5d6b 4px 7px,#c9a24a 7px 9px,#3f6b3a 9px 13px,#6a3d7a 13px 15px,#b7532f 15px 19px,#2a4a7a 19px 22px)}
.walkable-interior .room.lm .spines.low{background:repeating-linear-gradient(90deg,#d8b24f 0 5px,#2f5d6b 5px 8px,#b24a3d 8px 12px,#3f6b3a 12px 14px)}
.walkable-interior .room.lm .book-open{position:absolute;left:14px;top:12px;width:22px;height:14px;background:linear-gradient(90deg,#f5efe0 0 48%,#d9cfb8 48% 52%,#f5efe0 52%);border:1px solid #6b5438}
.walkable-interior .room.lm .lamp-small{position:absolute;right:10px;top:8px;width:14px;height:10px;background:#2f6a4a;border-radius:7px 7px 2px 2px;box-shadow:0 0 10px 3px #ffe9a080}
.walkable-interior .room.lm .f.desk{background:#5f4630;border:2px solid #3b2a1a}
.walkable-interior .room.lm .f.counter{background:#6b4a33;border:2px solid #3b2518;border-top:5px solid #8a6648}
.walkable-interior .room.lm .f.pew{background:#6d4c33;border:2px solid #42291a}
.walkable-interior .room.lm .f.altar{background:#ece6d6;border:2px solid #9c9482}
.walkable-interior .room.lm .f.lectern{background:#7b5a3c;border:2px solid #4a3320}
.walkable-interior .room.lm .f.font{background:#b9c3c6;border:3px solid #7d8a8e;border-radius:50%}
.walkable-interior .room.lm .f.candles{background:#4b4034;border:2px solid #2c251d}
.walkable-interior .room.lm .f.armchair{background:#2f5f7a;border:2px solid #1e3f52;border-radius:9px 9px 5px 5px}
.walkable-interior .room.lm .f.sofa{background:#2f5f7a;border:2px solid #1e3f52;border-radius:8px}
.walkable-interior .room.lm .f.plant{background:radial-gradient(circle at 40% 40%,#6fae5a,#3f7a3a 60%,#2b5a2a);border:2px solid #243f22;border-radius:50%}
.walkable-interior .room.lm .f.globe{background:radial-gradient(circle at 35% 35%,#9ccbe6,#2f6e9c 55%,#1c4466);border:2px solid #5a3b22;border-radius:50%}
.walkable-interior .room.lm .f.pinboard{background:#b58a5a;border:2px solid #6b4a2b;border-radius:2px}
.walkable-interior .room.lm .note{position:absolute;top:2px;width:10px;height:7px;border:1px solid #0003}
.walkable-interior .room.lm .note.n1{left:6px;background:#f7e9a8}.walkable-interior .room.lm .note.n2{left:30px;background:#dfe9f5;top:1px}.walkable-interior .room.lm .note.n3{left:56px;background:#f4cfc9}
.walkable-interior .room.lm .f.stairs{background:repeating-linear-gradient(180deg,#c9b48f 0 8px,#a8916a 8px 10px);border:2px solid #6b5230}
.walkable-interior .room.lm .f.grave{background:#8f8f8a;border:2px solid #5e5e59;border-radius:9px 9px 2px 2px}
.walkable-interior .room.lm .f.tap{background:#6c7a84;border:2px solid #3d474e;border-radius:50%}
.walkable-interior .room.lm .f.tree{background:radial-gradient(circle at 40% 35%,#6f9a52,#3f6a33);border-radius:50%;border:2px solid #2f5228}
.walkable-interior .room.lm .f.memorial{background:#cfc8b8;border:2px solid #8c8471;border-radius:2px}
.walkable-interior .room.lm .f.piano{background:#15151a;border:2px solid #000;border-radius:10px 46px 10px 10px}
.walkable-interior .room.lm .f.piano:after{content:'';position:absolute;left:6px;right:46px;bottom:3px;height:9px;background:repeating-linear-gradient(90deg,#f4f0e6 0 5px,#222 5px 6px)}
.walkable-interior .room.lm .f.chair{background:#7a2f3a;border:2px solid #4a1a22;border-radius:6px}
.walkable-interior .room.lm .f.wall{background:#d9d2c3;border:1px solid #a89f8c}
.walkable-interior .room.lm .f.artwork{background:linear-gradient(135deg,#d8b24f,#c24a3d 50%,#5f8ea6);border:2px solid #3b2518}
.walkable-interior .room.lm .f.goods{background:#6b4a33;border:2px solid #3b2518}
.walkable-interior .room.lm .f.goods:after{content:'';position:absolute;inset:3px;background:repeating-linear-gradient(90deg,#d8b24f 0 6px,#5f8ea6 6px 10px,#c24a3d 10px 15px,#6fae5a 15px 18px,#efe6d2 18px 22px)}
.walkable-interior .room.lm .f.lift{background:#5a5f66;border:2px solid #2f3338;border-radius:3px}
.walkable-interior .room.lm .f.vehicle{background:linear-gradient(180deg,#8fb3c9,#4f7f9c);border:2px solid #1f3f52;border-radius:12px 12px 8px 8px}
.walkable-interior .room.lm .f.bench{background:#8c6b47;border:2px solid #5d4428}
.walkable-interior .room.lm .f.gate{background:repeating-linear-gradient(90deg,#4c5a66 0 10px,#5f6d79 10px 20px);border:2px solid #2f3b45}
.walkable-interior .room.lm .f.crate{background:#a8864f;border:2px solid #6b5230}
.walkable-interior .room.lm .f.mihrab{background:linear-gradient(180deg,#1f5f6b,#2f7f8c);border:3px solid #c9a24a;border-radius:30px 30px 4px 4px}
.walkable-interior .room.lm .f.minbar{background:repeating-linear-gradient(180deg,#8a6648 0 10px,#6b4a33 10px 12px);border:2px solid #3b2518}
.walkable-interior .room.lm .f.ablution{background:#b9c3c6;border:2px solid #7d8a8e}
.walkable-interior .room.lm .f.shoerack{background:repeating-linear-gradient(90deg,#6b4a33 0 18px,#4a2c1c 18px 20px);border:2px solid #3b2518}
.walkable-interior .room.lm .f.ark{background:linear-gradient(180deg,#5a3a7a,#3e2558);border:3px solid #c9a24a;border-radius:4px}
.walkable-interior .room.lm .f.eternal-light{background:radial-gradient(circle,#ffe08a,#e2a33a 60%,#8a5a1a);border-radius:50%;box-shadow:0 0 12px #ffcf6a}
.walkable-interior .room.lm .f.bimah{background:#8c6b47;border:3px solid #5d4428;border-radius:4px}
.walkable-interior .room.lm .f.shrine{background:linear-gradient(180deg,#c24a3d,#8f2e26);border:3px solid #d8b24f;border-radius:40px 40px 4px 4px}
.walkable-interior .room.lm .f.diya{background:radial-gradient(circle,#ffd36a,#d07a2a 55%,#7a3a1a);border-radius:50%;box-shadow:0 0 10px #ffb84a}
.walkable-interior .room.lm .f.bell{background:radial-gradient(circle at 50% 35%,#f2d27a,#b8862e 65%,#6b4a12);border-radius:40% 40% 50% 50%;border:2px solid #5a3b0a}
.walkable-interior .room.lm .f.buddha{background:radial-gradient(ellipse at 50% 70%,#e0b84a,#b8862e 60%,#7a5a1a);border:3px solid #6b4a12;border-radius:50px 50px 8px 8px}
.walkable-interior .room.lm .f.cushion{background:radial-gradient(circle,#a83a2a,#7a2a1e);border:2px solid #5a1e14;border-radius:50%}
.walkable-interior .room.lm .f.incense{background:#5a4a3a;border:2px solid #2c251d;border-radius:4px}
.walkable-interior .room.lm .f.gong{background:radial-gradient(circle,#e6c25a,#a87a1e 70%,#5a3b0a);border:3px solid #3b2518;border-radius:50%}
.walkable-interior .room.lm .f.stage{background:#6b4a33;border:2px solid #3b2518}
/* Höhen in 2,5D */
.walkable-interior .room.iso.lm .f.shelf{--h:78px}.walkable-interior .room.iso.lm .f.shelf-low{--h:34px}
.walkable-interior .room.iso.lm .f.pew,.walkable-interior .room.iso.lm .f.bench{--h:14px}
.walkable-interior .room.iso.lm .f.altar{--h:30px}.walkable-interior .room.iso.lm .f.font{--h:24px}.walkable-interior .room.iso.lm .f.candles{--h:26px}
.walkable-interior .room.iso.lm .f.armchair{--h:16px}.walkable-interior .room.iso.lm .f.plant{--h:34px}.walkable-interior .room.iso.lm .f.globe{--h:30px}
.walkable-interior .room.iso.lm .f.pinboard{--h:56px}.walkable-interior .room.iso.lm .f.goods{--h:52px}.walkable-interior .room.iso.lm .f.lift{--h:8px}
.walkable-interior .room.iso.lm .f.gate{--h:60px}.walkable-interior .room.iso.lm .f.crate{--h:26px}.walkable-interior .room.iso.lm .f.piano{--h:30px}
.walkable-interior .room.iso.lm .f.artwork{--h:60px}.walkable-interior .room.iso.lm .f.stage{--h:16px}
.walkable-interior .room.iso.lm .f.grave{--h:30px}.walkable-interior .room.iso.lm .f.tap{--h:20px}.walkable-interior .room.iso.lm .f.tree{--h:90px}.walkable-interior .room.iso.lm .f.memorial{--h:36px}
.walkable-interior .room.iso.lm .f.mihrab{--h:90px}.walkable-interior .room.iso.lm .f.minbar{--h:46px}.walkable-interior .room.iso.lm .f.ablution{--h:20px}.walkable-interior .room.iso.lm .f.shoerack{--h:28px}
.walkable-interior .room.iso.lm .f.ark{--h:80px}.walkable-interior .room.iso.lm .f.eternal-light{--h:70px}.walkable-interior .room.iso.lm .f.bimah{--h:26px}
.walkable-interior .room.iso.lm .f.shrine{--h:70px}.walkable-interior .room.iso.lm .f.diya{--h:10px}.walkable-interior .room.iso.lm .f.bell{--h:60px}
.walkable-interior .room.iso.lm .f.buddha{--h:56px}.walkable-interior .room.iso.lm .f.cushion{--h:6px}.walkable-interior .room.iso.lm .f.incense{--h:14px}.walkable-interior .room.iso.lm .f.gong{--h:56px}
.walkable-interior .room.iso.lm .f.plant>.fs,.walkable-interior .room.iso.lm .f.plant>.fw,.walkable-interior .room.iso.lm .f.globe>.fs,.walkable-interior .room.iso.lm .f.globe>.fw,.walkable-interior .room.iso.lm .f.tree>.fs,.walkable-interior .room.iso.lm .f.tree>.fw,.walkable-interior .room.iso.lm .f.font>.fs,.walkable-interior .room.iso.lm .f.font>.fw,.walkable-interior .room.iso.lm .f.cushion>.fs,.walkable-interior .room.iso.lm .f.cushion>.fw,.walkable-interior .room.iso.lm .f.diya>.fs,.walkable-interior .room.iso.lm .f.diya>.fw,.walkable-interior .room.iso.lm .f.gong>.fs,.walkable-interior .room.iso.lm .f.gong>.fw,.walkable-interior .room.iso.lm .f.eternal-light>.fs,.walkable-interior .room.iso.lm .f.eternal-light>.fw{background:#3a3a30;filter:none;width:4px;left:calc(50% - 2px)}
.walkable-interior .room.iso.lm .f.plant>.fw,.walkable-interior .room.iso.lm .f.globe>.fw,.walkable-interior .room.iso.lm .f.tree>.fw,.walkable-interior .room.iso.lm .f.font>.fw,.walkable-interior .room.iso.lm .f.cushion>.fw,.walkable-interior .room.iso.lm .f.diya>.fw,.walkable-interior .room.iso.lm .f.gong>.fw,.walkable-interior .room.iso.lm .f.eternal-light>.fw{display:none}
.walkable-interior .room.lm .flame{position:absolute;z-index:9;width:4px;height:7px;margin:-7px 0 0 -2px;border-radius:50% 50% 45% 45%;background:#ffd76a;box-shadow:0 0 6px 2px #ffb84a99;pointer-events:none}
.walkable-interior .room.iso.lm .flame{transform-origin:50% 100%;transform:translateZ(28px) rotateZ(45deg) rotateX(-90deg)}
.walkable-interior .room.lm .carry{position:absolute;z-index:11;width:9px;height:12px;background:#b24a3d;border:1px solid #3b1a14;border-radius:1px;box-shadow:inset 2px 0 0 #e8d9b5;pointer-events:none}
.walkable-interior .room.iso.lm .carry{transform-origin:50% 100%;transform:translateZ(30px) rotateZ(45deg) rotateX(-90deg)}
.walkable-interior .room.iso.lm .bubble{transform-origin:50% 100%;transform:rotateZ(45deg) rotateX(-90deg) translate(-50%,-180%)!important;animation:none!important}
.walkable-interior .lm-book{display:block;width:9px;height:12px;background:#2f5d6b;border:1px solid #1a3038;border-radius:1px;box-shadow:inset 2px 0 0 #e8d9b5}
.walkable-interior .lm-menu small{display:block;margin-top:10px}
.walkable-interior .lm-menu .moves.wrap,.walkable-interior .lm-talk .moves.wrap{flex-wrap:wrap;gap:4px}
.walkable-interior .lm-menu .moves.wrap button,.walkable-interior .lm-talk .moves.wrap button{flex:0 0 auto;font-size:10px;padding:4px 7px}
.walkable-interior .lm-menu .moves button,.walkable-interior .lm-talk .moves button{display:block;width:auto;margin:0;text-align:center}
.walkable-interior .lm-talk button.quiet{opacity:.75}
.walkable-interior .plea{display:grid;gap:5px;margin-top:8px;padding:9px 10px;border:1px solid #6b8793;border-radius:7px;background:#0f2230;color:#dfe9ee}
.walkable-interior .plea small{margin:0;color:#9fd3c0}
.walkable-interior .plea span{font-size:10px;color:#a9bfc6}
.walkable-interior .plea textarea,.walkable-interior .plea input{resize:vertical;font:inherit;font-size:11px;padding:6px;border-radius:5px;border:1px solid #40595a;background:#0b1a24;color:#eef2ed}
.walkable-interior .plea p{margin:0;font-size:11px}
.walkable-interior .plea .help{padding:6px 8px;border-left:3px solid #e9c46a;background:#1d160b;color:#fff3d6}
.walkable-interior .occasion{display:grid;gap:5px;margin-top:8px;padding:9px 10px;border:1px solid #c9a447;border-radius:7px;background:#2a2010;color:#f6ead0}
.walkable-interior .occasion small{margin:0;color:#e9c46a}
.walkable-interior .occasion b{font-size:13px}
.walkable-interior .occasion span,.walkable-interior .occasion em{font-size:10px;color:#d8c9a6}
.walkable-interior .occasion ol{margin:2px 0;padding-left:16px;display:grid;gap:1px;font-size:10px;color:#bfae88}
.walkable-interior .occasion li.done{opacity:.55;text-decoration:line-through}
.walkable-interior .occasion li.now{color:#fff3d6;font-weight:700}
.walkable-interior .occasion p{margin:0;font-size:11px;line-height:1.4;color:#f6ead0}
.walkable-interior .occasion blockquote{margin:2px 0;padding:6px 8px;border-left:3px solid #e9c46a;background:#1d160b;font-size:11px;line-height:1.45}
.walkable-interior .lm-menu .books{display:grid;gap:3px;max-height:300px;overflow:auto;margin-top:6px}
.walkable-interior .lm-menu .books button{display:grid;grid-template-columns:1fr;gap:1px;margin:0;text-align:left;border:0;border-left:3px solid #8a5a3a;border-radius:2px;background:#16302f;color:#eef2ed;padding:5px 8px}
.walkable-interior .lm-menu .books button b{font-size:11px;color:#eef2ed}
.walkable-interior .lm-menu .books button span{font-size:9px;color:#8ea4a6}
.walkable-interior .book{display:grid;gap:5px;margin-top:8px;padding:10px;border:1px solid #5d4428;border-radius:6px;background:#efe6d2;color:#2b2118}
.walkable-interior .book span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
.walkable-interior .book b{font-size:14px;line-height:1.2}
.walkable-interior .book i{font-size:10px;color:#6b5a48}
.walkable-interior .book p{margin:2px 0 4px;color:#2b2118;line-height:1.5}
.walkable-interior .book .moves button{background:#2b2118;border-color:#5d4428}
.walkable-interior .reading{margin:6px 0;padding:6px 10px;border-left:3px solid #7fb59b;background:#0c1d1a;font-size:12px;line-height:1.55;color:#dcebe3;font-style:italic;max-height:30vh;overflow:auto}
.walkable-interior .tipcard{display:grid;gap:2px;width:100%;margin-top:8px;text-align:left;border:1px solid #c9a24a;border-radius:6px;background:#efe6d2;color:#2b2118;padding:8px 10px;cursor:pointer}
.walkable-interior .tipcard span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
.walkable-interior .tipcard b{font-size:12px}.walkable-interior .tipcard i{font-size:9px;color:#6b5a48}.walkable-interior .tipcard small{color:#7a5a36;font-weight:800}
.walkable-interior .lm-menu .spot{margin-top:6px}
.walkable-interior .room-audio{display:flex;gap:6px}
`
