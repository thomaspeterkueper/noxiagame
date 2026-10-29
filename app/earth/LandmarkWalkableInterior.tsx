'use client'

// app/earth/LandmarkWalkableInterior.tsx
// Aktualisiert: 28.10.2026 — Gesprächsende sperrt das Eingabefeld (useConversationEnd); Laufweg der Spielfigur für die Verhaltensaufzeichnung; 26.10.2026: ArtLounge-Raum (Flügel, Sitzreihen, Büro); Betriebe: Laden und Werkstatt als Raum, Leistungen mit ehrlichem Status, Personal kennt seinen Betrieb (knowledge), eigener Begrüßungstext und Rollenname; Porträt der Ansprechperson oben in der Seitenleiste (NpcPortrait); „Gehe zu …“ mit Wegsuche; Bibliothekar(in) bringt das versprochene Buch wirklich an den Platz, sortiert zwischendurch Regale ein und geht auf Gesprächsziele; Lesegast in der Leseecke; an jedem Regal stöbern: Liste öffnet sich beim Herantreten, hohe Regale Romane, niedrige Sachbücher; Buchtipp springt zum passenden Regal; Bewohnter Raum: Bodenzonen, Lichtkegel, Schatten, Pflanzen, Sessel, Globus, Pinnwand; Bibliothekarin am Ausleihtresen mit Buchtipp und Gespräch über /api/game/npc-conversation
// Version:      2.7.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { reportPlayerPosition } from '@/lib/telemetry/playerActivity'
import { NpcFigure, NpcPortrait, NpcVisualStyles } from '@/lib/grid/NpcVisual'
import {
  LANDMARK_LEVELS,
  LANDMARK_ROOM,
  crowdSpots,
  isLandmarkRoomBlocked,
  landmarkPath,
  landmarkRoomLayout,
  landmarkWaypoints,
  landmarkStaffName,
  nearestLandmarkSpot,
  shelfAt,
  type LandmarkFurniture,
  type LandmarkPoint,
  type LandmarkRoomKind,
  type LandmarkSpot,
} from '@/lib/game/landmarks/interiors'
import { LIBRARY_BOOKS, LIBRARY_SHELVES, RESONANCE_READING_IDS, type LibraryBook } from '@/lib/game/landmarks/libraryCatalogue'
import { READING_TEXTS } from '@/lib/game/landmarks/readingTexts'
import { THEOLOGICAL_ESSAYS } from '@/lib/game/landmarks/theologicalEssays'
import { IDENTITY_BOOK } from '@/lib/game/landmarks/identityBook'
import { useConversationEnd, CONVERSATION_ENDED_PLACEHOLDER } from '@/app/components/useConversationEnd'
import { liturgyFor, phaseAt, speechNoun, type ActivityKind, type Tradition } from '@/lib/game/population/worship'

// Aufbau und Begehbarkeit kommen aus lib/game/landmarks/interiors.ts; diese
// Datei zeichnet und führt das Gespräch mit der angestellten Person. Der Raum
// ist ein typischer Grundriss für die Ortsart, nicht der vermessene Innenraum
// des realen Gebäudes.
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
type ChatEntry = { role: 'user' | 'assistant'; content: string }

const SPEED = 12
const STAFF_REACH = 64
const WALK_STEP = 6
const STAFF_STEP = 5
/** Sekunden zwischen zwei Einsortier-Runden der angestellten Person, wenn nichts anstand. */
const RESHELVE_EVERY_S = 45
const READER_NAMES = ['Paul Siebert', 'Nele Arndt', 'Jakob Heine', 'Ida Kraus']

type Walker = { path: LandmarkPoint[]; index: number; onArrive?: () => void }
type StaffTask = { kind: 'bring'; book: LibraryBook } | { kind: 'reshelve' } | { kind: 'visit'; label: string } | { kind: 'return' }

/** Ein Schritt entlang eines Weges; liefert die neue Position und ob das Ziel erreicht ist. */
function advance(walker: Walker, here: LandmarkPoint, step: number): { pos: LandmarkPoint; done: boolean } {
  const goal = walker.path[walker.index]
  if (!goal) return { pos: here, done: true }
  const dx = goal.x - here.x, dy = goal.y - here.y, d = Math.hypot(dx, dy)
  if (d <= step) { walker.index++; return { pos: { x: goal.x, y: goal.y }, done: walker.index >= walker.path.length } }
  return { pos: { x: here.x + dx / d * step, y: here.y + dy / d * step }, done: false }
}

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

/** Ein wechselnder Tipp: jeder Besuch und jede Nachfrage ein anderer Band. */
function pickTip(seed: number) {
  return LIBRARY_BOOKS[Math.abs(seed) % LIBRARY_BOOKS.length]
}

/** Mehrgeschossige Häuser: jedes Geschoss ist eine eigene Instanz, der Wechsel setzt Figur und Personal zurück. */
export default function LandmarkWalkableInterior(props: Props) {
  const [floor, setFloor] = useState({ level: 0, byStairs: false })
  return <LandmarkRoom key={floor.level} {...props} level={floor.level} byStairs={floor.byStairs} onLevel={level => setFloor({ level, byStairs: true })}/>
}

function LandmarkRoom({ kind, name, typeLabel, facts, onClose, knowledge = [], services = [], staffRole, realName, people = [], occasion, placeRef, level, byStairs, onLevel }: Props & { level: number; byStairs: boolean; onLevel: (level: number) => void }) {
  const layout = useMemo(() => { const base = landmarkRoomLayout(kind, level, byStairs); return staffRole && base.staff ? { ...base, staff: { ...base.staff, role: staffRole } } : base }, [kind, staffRole])
  const isLibrary = kind === 'library'
  const staffName = useMemo(() => landmarkStaffName(name), [name])
  const [pos, setPos] = useState<LandmarkPoint>(layout.start)
  useEffect(() => { reportPlayerPosition('landmark:' + kind, pos.x / 10, pos.y / 10) }, [pos, kind])
  const [active, setActive] = useState<LandmarkSpot | null>(null)
  const [candles, setCandles] = useState(3)
  const [seated, setSeated] = useState(false)
  const [bookId, setBookId] = useState('')
  const [readingPart, setReadingPart] = useState<number | null>(null)
  const [talking, setTalking] = useState(false)
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const conversationEnd = useConversationEnd()
  // Ablauf des laufenden Termins nach echter Uhr (Beginn und Ende kommen vom Server).
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => { if (!occasion) return; const timer = setInterval(() => setNowMs(Date.now()), 15000); return () => clearInterval(timer) }, [occasion])
  const phases = useMemo(() => occasion ? liturgyFor(occasion.kind, occasion.tradition, occasion.label) : [], [occasion])
  const minute = occasion ? Math.floor((nowMs - Date.parse(occasion.startedAt)) / 60000) : -1
  const phase = occasion ? phaseAt(phases, minute) : null
  const [sermon, setSermon] = useState<{ text: string; by: string } | null>(null)
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
        body: JSON.stringify({ text, channel: kind === 'resonance_place' ? 'resonanz' : 'fuerbitte', placeRef: placeRef ?? null, placeName: name, tradition: kind, location: 'earth' }),
      })
      const data = await response.json().catch(() => ({}))
      // Die Welt erklärt nichts: kein „wird erfüllt“, nur dass es angekommen ist.
      setPleaNote(response.ok ? { text: data.message ?? 'Aufgeschrieben. Es bleibt hier.', help: data.help } : { text: data.error ?? 'Gerade nicht möglich.' })
      if (response.ok) setPleaText('')
    } finally { setPleaBusy(false) }
  }
  const [hearing, setHearing] = useState(false)
  const [tip, setTip] = useState<LibraryBook | null>(null)
  const tipSeed = useRef(0)
  const waypoints = useMemo(() => landmarkWaypoints(layout), [layout])
  const posRef = useRef(pos)
  const playerWalk = useRef<Walker | null>(null)
  // Angestellte Person: Position, aktuelle Aufgabe, Weg.
  const [staffPos, setStaffPos] = useState<LandmarkPoint>(layout.staff ?? layout.start)
  const staffPosRef = useRef(staffPos)
  const [staffTask, setStaffTask] = useState<StaffTask | null>(null)
  const staffTaskRef = useRef<StaffTask | null>(null)
  const staffWalk = useRef<Walker | null>(null)
  const staffIdleSince = useRef(0)
  const [playerMoving, setPlayerMoving] = useState(false)
  useEffect(() => { tipSeed.current = Math.floor(Date.now() / 86_400_000); staffIdleSince.current = Date.now() }, [])
  const [staffMoving, setStaffMoving] = useState(false)
  // Buch in der Hand des Spielers (gebracht oder aus dem Regal genommen).
  const [held, setHeld] = useState<LibraryBook | null>(null)
  const [status, setStatus] = useState('')
  // Lesegast: sitzt in der Leseecke, wechselt ab und zu den Platz.
  const readerName = useMemo(() => READER_NAMES[(landmarkStaffName(name).length + name.length) % READER_NAMES.length], [name])
  const readerSeats = useMemo(() => layout.spots.filter(spot => spot.action === 'sit'), [layout])
  const [readerPos, setReaderPos] = useState<LandmarkPoint>(() => readerSeats[readerSeats.length - 1] ? { x: readerSeats[readerSeats.length - 1].x + 30, y: readerSeats[readerSeats.length - 1].y } : layout.start)
  const readerPosRef = useRef(readerPos)
  const readerWalk = useRef<Walker | null>(null)
  const [readerMoving, setReaderMoving] = useState(false)
  useEffect(() => { posRef.current = pos }, [pos])
  useEffect(() => { staffPosRef.current = staffPos }, [staffPos])
  useEffect(() => { readerPosRef.current = readerPos }, [readerPos])
  useEffect(() => { staffTaskRef.current = staffTask }, [staffTask])
  const isResonanceReading = kind === 'resonance_place'
  const resonanceBooks = [...LIBRARY_BOOKS.filter(entry => (RESONANCE_READING_IDS as readonly string[]).includes(entry.id)), IDENTITY_BOOK, ...THEOLOGICAL_ESSAYS]
  const book = [...LIBRARY_BOOKS, IDENTITY_BOOK, ...THEOLOGICAL_ESSAYS].find(entry => entry.id === bookId && (!isResonanceReading || resonanceBooks.some(item => item.id === entry.id))) ?? null
  const readingText = isResonanceReading && book ? READING_TEXTS[book.id] : undefined
  const staff = layout.staff
  // Personen der Simulation: Träger(in) des Ortes vorne, die anderen auf freien Plätzen.
  const placed = useMemo(() => {
    const hosts = people.filter(person => person.host).slice(0, 1)
    const rest = people.filter(person => !hosts.includes(person)).slice(0, 14)
    // Größere Gemeinde: feste Plätze zuerst, dann freie Plätze daneben.
    const spots = crowdSpots(layout, rest.length)
    const hostSpot = layout.hostAt ?? spots[0] ?? layout.start
    const others = rest.slice(0, spots.length)
    return [
      ...hosts.map(person => ({ person, at: hostSpot })),
      ...others.map((person, index) => ({ person, at: spots[index] })),
    ]
  }, [people, layout])
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const partner = partnerId ? placed.find(item => item.person.id === partnerId) ?? null : null
  const nearPerson = useMemo(() => {
    let best: (typeof placed)[number] | null = null, bestD = STAFF_REACH
    for (const item of placed) { const d = Math.hypot(item.at.x - pos.x, item.at.y - pos.y); if (d <= bestD) { best = item; bestD = d } }
    return best
  }, [placed, pos])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input,textarea')) return
      if (event.key === 'Escape') { event.preventDefault(); if (talking) setTalking(false); else onClose(); return }
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd'].includes(key)) return
      event.preventDefault()
      event.stopPropagation()
      playerWalk.current = null
      setPlayerMoving(false)
      setSeated(false)
      setPos(current => {
        const step = event.shiftKey ? SPEED * 1.6 : SPEED
        const next = { x: current.x + (key === 'd' ? step : key === 'a' ? -step : 0), y: current.y + (key === 's' ? step : key === 'w' ? -step : 0) }
        if (!isLandmarkRoomBlocked(layout, next)) return next
        const slideX = { x: next.x, y: current.y }
        if (!isLandmarkRoomBlocked(layout, slideX)) return slideX
        const slideY = { x: current.x, y: next.y }
        return isLandmarkRoomBlocked(layout, slideY) ? current : slideY
      })
    }
    // Capture phase: the surface below must not move the outdoor figure as well.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [layout, onClose, talking])

  const walkTo = useCallback((target: LandmarkPoint, onArrive?: () => void) => {
    setSeated(false)
    playerWalk.current = { path: landmarkPath(layout, posRef.current, target), index: 1, onArrive }
    setPlayerMoving(true)
  }, [layout])

  const staffGo = useCallback((target: LandmarkPoint, onArrive?: () => void) => {
    staffWalk.current = { path: landmarkPath(layout, staffPosRef.current, target), index: 1, onArrive }
    setStaffMoving(true)
  }, [layout])

  /** Die angestellte Person bringt ein Buch an den Platz des Spielers und kehrt zum Tresen zurück. */
  const bringBook = useCallback((book: LibraryBook) => {
    if (!staff || staffTaskRef.current?.kind === 'bring') return
    setStaffTask({ kind: 'bring', book })
    const beside = { x: posRef.current.x + 26, y: posRef.current.y + 4 }
    staffGo(isLandmarkRoomBlocked(layout, beside) ? posRef.current : beside, () => {
      setHeld(book)
      setStatus(`${staffName} legt dir „${book.title}“ hin.`)
      setHistory(current => [...current, { role: 'assistant' as const, content: `Hier, „${book.title}“. Lass dir Zeit damit.` }].slice(-12))
      setStaffTask({ kind: 'return' })
      staffGo(staff, () => { setStaffTask(null); staffIdleSince.current = Date.now() })
    })
  }, [layout, staff, staffGo, staffName])

  // Bewegung aller Figuren: 25 Schritte je Sekunde.
  useEffect(() => {
    const timer = setInterval(() => {
      const pw = playerWalk.current
      if (pw) {
        const { pos: next, done } = advance(pw, posRef.current, WALK_STEP)
        posRef.current = next; setPos(next)
        if (done) { playerWalk.current = null; setPlayerMoving(false); pw.onArrive?.() }
      }
      const sw = staffWalk.current
      if (sw) {
        const { pos: next, done } = advance(sw, staffPosRef.current, STAFF_STEP)
        staffPosRef.current = next; setStaffPos(next)
        if (done) { staffWalk.current = null; setStaffMoving(false); sw.onArrive?.() }
      } else if (staff && !staffTaskRef.current && !talking && Date.now() - staffIdleSince.current > RESHELVE_EVERY_S * 1000) {
        // Nichts zu tun: ein Stapel Rückgaben wird einsortiert.
        const shelves = waypoints.filter(point => point.kind === 'Regal')
        const target = shelves[Math.floor(Math.random() * shelves.length)]
        if (target) {
          setStaffTask({ kind: 'reshelve' })
          staffGo(target, () => setTimeout(() => staffGo(staff, () => { setStaffTask(null); staffIdleSince.current = Date.now() }), 2500))
        } else staffIdleSince.current = Date.now()
      }
      const rw = readerWalk.current
      if (rw) {
        const { pos: next, done } = advance(rw, readerPosRef.current, STAFF_STEP)
        readerPosRef.current = next; setReaderPos(next)
        if (done) { readerWalk.current = null; setReaderMoving(false) }
      }
    }, 40)
    return () => clearInterval(timer)
  }, [staff, staffGo, talking, waypoints])

  // Der Lesegast wechselt gelegentlich den Platz oder holt sich etwas aus dem Regal.
  useEffect(() => {
    if (readerSeats.length < 2) return
    const timer = setInterval(() => {
      if (readerWalk.current || Math.random() < .4) return
      const shelf = waypoints.find(point => point.id === 'shelf:romane')
      const seat = readerSeats[Math.floor(Math.random() * readerSeats.length)]
      const seatPos = { x: seat.x + 30, y: seat.y }
      const target = Math.random() < .3 && shelf ? shelf : (isLandmarkRoomBlocked(layout, seatPos) ? seat : seatPos)
      readerWalk.current = { path: landmarkPath(layout, readerPosRef.current, target), index: 1 }
      setReaderMoving(true)
      if (target === shelf) setTimeout(() => { readerWalk.current = { path: landmarkPath(layout, readerPosRef.current, seatPos), index: 1 }; setReaderMoving(true) }, 7000)
    }, 25_000)
    return () => clearInterval(timer)
  }, [layout, readerSeats, waypoints])

  const near = nearestLandmarkSpot(layout, pos)
  const shelf = isLibrary ? shelfAt(layout, pos) : null
  const shelfBooks = shelf ? LIBRARY_BOOKS.filter(entry => entry.shelf === shelf.shelf) : []
  const shelfLabel = shelf ? LIBRARY_SHELVES.find(entry => entry.id === shelf.shelf)?.label ?? 'Regal' : ''
  const nearExit = Math.hypot(pos.x - layout.exit.x, pos.y - layout.exit.y) < 46
  const nearStaff = Boolean(staff && Math.hypot(pos.x - staffPos.x, pos.y - staffPos.y) <= STAFF_REACH)
  const atCounter = Boolean(staff && Math.hypot(pos.x - staff.x, pos.y - staff.y) <= STAFF_REACH)
  const shown = !shelf && active && near?.id === active.id ? active : null
  const resonanceShelfOpen = isResonanceReading && shown?.action === 'books'
  // Zu weit weg: das Gespräch endet, die Person bleibt am Tresen.
  const nearPartner = Boolean(partner && Math.hypot(pos.x - partner.at.x, pos.y - partner.at.y) <= STAFF_REACH * 1.4)
  const talkingNow = partner ? talking && nearPartner : talking && (nearStaff || staffTask?.kind === 'bring')
  const talkName = partner ? partner.person.name : staffName
  const talkRole = partner ? partner.person.role : staff?.role ?? ''
  const talkFigureId = partner ? partner.person.id : `landmark-staff:${name}`
  const talkEnded = conversationEnd.isEnded(talkFigureId)

  function startTalk() {
    if (!staff) return
    if (partnerId) { setPartnerId(null); setHistory([]) }
    setTalking(true)
    setActive(null)
    if (!history.length || partnerId) setHistory([{ role: 'assistant', content: staff.greeting }])
  }

  /** Was die Person über diesen Ort und den Moment weiß (für das Gespräch). */
  function personFacts(person: RoomPerson) {
    return [
      `Du bist gerade in ${name} (${typeLabel}).`,
      person.host ? `Das ist dein Ort: Hier arbeitest du.` : `Du bist hier zu Besuch.`,
      person.doing ? `Gerade ist hier: ${person.doing}.` : '',
      occasion && phase ? `Ablauf gerade: ${phase.title}. ${person.host ? 'Du leitest den Termin.' : 'Du nimmst teil; das sagt nichts darüber, was du glaubst.'}` : '',
      `Der Spieler steht bei dir im Raum.`,
    ].filter(Boolean)
  }

  /** Eine Person der Simulation ansprechen: Sie begrüßt von sich aus, als sie selbst. */
  async function startTalkWith(person: RoomPerson) {
    setPartnerId(person.id)
    setTalking(true)
    setActive(null)
    setHistory([])
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening: true, npcId: person.id, npcName: person.name, npcRole: person.role, locationName: name, headline: `Begegnung in ${name}`, source: 'NOXIA place interior', localFacts: personFacts(person), history: [] }),
      })
      const data = await response.json().catch(() => ({}))
      setHistory([{ role: 'assistant', content: response.ok && data.reply ? String(data.reply) : 'Hallo.' }])
    } finally { setSending(false) }
  }

  /** Predigt oder Ansprache hören: die Gastgeberin oder der Gastgeber spricht zur Gemeinde. */
  async function hearSermon() {
    if (!occasion || hearing) return
    const host = placed.find(item => item.person.host)?.person
    if (!host) { setStatus(`${occasion.host.name} ist gerade nicht im Raum.`); return }
    setHearing(true)
    setSermon(null)
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
      setSermon({ text: response.ok && data.reply ? String(data.reply) : `${host.name} spricht leise; du verstehst heute nur Bruchstücke.`, by: host.name })
    } finally { setHearing(false) }
  }

  function giveTip() {
    tipSeed.current += 7
    const next = pickTip(tipSeed.current)
    setTip(next)
    if (seated && staffTaskRef.current === null) {
      setHistory(current => [...current, { role: 'assistant' as const, content: `Bleib sitzen – ich bringe dir „${next.title}“, ${next.genre.split('/')[0].trim()}.` }].slice(-12))
      bringBook(next)
      return
    }
    setHistory(current => [...current, { role: 'assistant' as const, content: `Schau dir mal „${next.title}“ an – ${next.genre.split('/')[0].trim()}. ${next.teaser}` }].slice(-12))
  }

  async function talk() {
    if (talkEnded) return
    if (partner) { await talkWithPerson(partner.person); return }
    if (!staff || !message.trim() || sending) return
    const text = message.trim().slice(0, 160)
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const fiction = LIBRARY_BOOKS.filter(entry => entry.shelf === 'romane')
      const nonfiction = LIBRARY_BOOKS.filter(entry => entry.shelf === 'sachbuecher')
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: text,
          npcId: `landmark-staff:${name}`,
          npcName: staffName,
          npcRole: staff?.role ?? 'Personal',
          headline: isLibrary ? `Gespräch am Ausleihtresen der ${name}` : `Gespräch bei ${name}`,
          source: isLibrary ? 'NOXIA library interior' : 'NOXIA establishment interior',
          locationName: name,
          localFacts: isLibrary ? [
            `Du arbeitest an der Ausleihe der ${name} und kennst den Bestand genau.`,
            `Alle Bücher hier sind von Thomas Peter Küper. Du empfiehlst auf Nachfrage passende Titel aus dem Bestand und erfindest keine anderen.`,
            seated ? 'Der Spieler sitzt gerade an einem Leseplatz. Wenn du ihm ein Buch anbietest oder er eins möchte, sag „ich bringe dir …“ und nenne den genauen Titel – du bringst es dann wirklich.' : 'Der Spieler steht. Ein Buch bringst du nur an einen Leseplatz; sonst zeigst du ihm das Regal.',
            held ? `Der Spieler hat gerade „${held.title}“ in der Hand.` : '',
            ...catalogueLines(fiction).map(line => `Romane und Erzählungen: ${line}`),
          ].slice(0, 16) : knowledge.slice(0, 16),
          placeKnowledge: isLibrary ? catalogueLines(nonfiction).map(line => `Sachbücher: ${line}`) : [],
          nearbyPlaces: waypoints.filter(point => point.id !== 'exit' && point.kind !== 'Tresen').slice(0, 9).map((point, index) => ({ key: `p${index}`, targetRef: point.id, name: point.label, kind: point.kind, distanceM: Math.round(Math.hypot(point.x - staffPos.x, point.y - staffPos.y) / 16) })),
          history: history.slice(-10),
        }),
      })
      const data = await response.json().catch(() => ({}))
      const reply = response.ok && data.reply ? String(data.reply) : 'Entschuldige, ich bin gerade beschäftigt – frag mich gleich noch einmal.'
      setHistory(current => [...current, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: reply }].slice(-12))
      setMessage('')
      if (conversationEnd.noteReply(`landmark-staff:${name}`, data)) return
      // Versprochen ist versprochen: „ich bringe …“ löst den Gang aus, ein genannter Titel wird erkannt.
      if (isLibrary && /\b(bring|hole?|bringe)\b/i.test(reply) && seated) {
        const named = LIBRARY_BOOKS.find(entry => reply.toLowerCase().includes(entry.title.toLowerCase()))
        bringBook(named ?? tip ?? pickTip(tipSeed.current += 3))
      } else if (data.worldAction?.type === 'visit_place') {
        const target = waypoints.find(point => point.id === data.worldAction.targetRef)
        if (target && staff) {
          setStaffTask({ kind: 'visit', label: target.label })
          staffGo(target, () => setTimeout(() => staffGo(staff, () => { setStaffTask(null); staffIdleSince.current = Date.now() }), 6000))
          if (data.worldAction.playerFollows) walkTo({ x: target.x - 24, y: target.y })
        }
      } else if (data.worldAction?.type === 'lead_walk' && staff) {
        const shelf = waypoints.find(point => point.id === 'shelf:romane') ?? waypoints[0]
        setStaffTask({ kind: 'visit', label: shelf.label })
        staffGo(shelf, () => setTimeout(() => staffGo(staff, () => { setStaffTask(null); staffIdleSince.current = Date.now() }), 6000))
        walkTo({ x: shelf.x - 24, y: shelf.y })
      }
    } finally { setSending(false) }
  }

  async function talkWithPerson(person: RoomPerson) {
    if (!message.trim() || sending) return
    const text = message.trim().slice(0, 160)
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: text, npcId: person.id, npcName: person.name, npcRole: person.role, locationName: name, headline: `Begegnung in ${name}`, source: 'NOXIA place interior', localFacts: personFacts(person), history: history.slice(-10) }),
      })
      const data = await response.json().catch(() => ({}))
      const reply = response.ok && data.reply ? String(data.reply) : 'Entschuldige, gerade nicht – gleich wieder.'
      setHistory(current => [...current, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: reply }].slice(-12))
      setMessage('')
      conversationEnd.noteReply(person.id, data)
    } finally { setSending(false) }
  }

  const furnitureLabel = (item: LandmarkFurniture) => item.kind === 'counter' ? (kind === 'library' ? 'AUSLEIHE' : kind === 'workshop' ? 'ANNAHME' : kind === 'artlounge' ? 'THEKE' : 'KASSE') : null

  return <div className="landmark-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · {typeLabel.toUpperCase()}</small><b>{name}</b><span>WASD bewegen · Person anklicken · ESC verlassen</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className={'room ' + layout.kind} style={{ width: LANDMARK_ROOM.width, height: LANDMARK_ROOM.height }}>
        {layout.zones.map(zone => <div key={zone.id} className={'zone ' + zone.kind} style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}/>)}
        {layout.floorName && (LANDMARK_LEVELS[layout.kind] ?? 1) > 1 && <span className="floor-tag">{layout.floorName.toUpperCase()}</span>}
        {layout.lamps.map((lamp, index) => <div key={index} className={'lamp' + (lamp.warm ? ' warm' : '')} style={{ left: lamp.x - lamp.r, top: lamp.y - lamp.r, width: lamp.r * 2, height: lamp.r * 2 }}/>)}
        <div className="door"><span>AUSGANG</span></div>
        {layout.furniture.map(item => <div key={item.id} className={'f ' + item.kind} style={{ left: item.x, top: item.y, width: item.w, height: item.h }}>
          {item.kind === 'shelf' && <i className="spines"/>}
          {item.kind === 'shelf-low' && <i className="spines low"/>}
          {item.kind === 'table' && <><i className="book-open"/><i className="lamp-small"/></>}
          {item.kind === 'pinboard' && <><i className="note n1"/><i className="note n2"/><i className="note n3"/></>}
          {furnitureLabel(item) && <span className="label">{furnitureLabel(item)}</span>}
        </div>)}
        {layout.kind === 'worship' && Array.from({ length: Math.min(9, candles) }, (_, index) => <i key={index} className="flame" style={{ left: 654 + (index % 5) * 8, top: 88 + Math.floor(index / 5) * 9 }}/>)}
        {staff && <div className="npc" style={{ left: staffPos.x - 12, top: staffPos.y - 34 }}>
          <NpcFigure id={`landmark-staff:${name}`} name={staffName} role={staffTask?.kind === 'bring' ? 'bringt ein Buch' : staffTask?.kind === 'reshelve' ? 'sortiert ein' : staff.role} moving={staffMoving} showLabel={nearStaff || talkingNow || Boolean(staffTask)} showRoleLabel selected={talkingNow} onClick={() => { if (nearStaff) startTalk() }}/>
          {staffTask?.kind === 'bring' && <i className="carry"/>}
        </div>}
        {placed.map(item => <div key={item.person.id} className="npc" style={{ left: item.at.x - 12, top: item.at.y - 34 }}>
          <NpcFigure id={item.person.id} name={item.person.name} role={item.person.doing ?? item.person.role} moving={false} showLabel={nearPerson?.person.id === item.person.id || partnerId === item.person.id || item.person.host} showRoleLabel selected={talkingNow && partnerId === item.person.id} onClick={() => { if (nearPerson?.person.id === item.person.id) void startTalkWith(item.person) }}/>
        </div>)}
        {layout.kind === 'library' && readerSeats.length > 0 && <div className="npc" style={{ left: readerPos.x - 12, top: readerPos.y - 34 }}>
          <NpcFigure id={`landmark-reader:${name}`} name={readerName} role={readerMoving ? 'unterwegs' : 'liest'} moving={readerMoving} showLabel={Math.hypot(readerPos.x - pos.x, readerPos.y - pos.y) < 70} showRoleLabel onClick={() => setStatus(`${readerName} schaut kurz auf, nickt dir zu und liest weiter.`)}/>
        </div>}
        <div className={'player' + (seated ? ' seated' : '') + (playerMoving ? ' moving' : '')} style={{ left: pos.x - 10, top: pos.y - 24 }}><i/><span>Du</span>{held && <b className="held" title={held.title}/>}</div>
        {shelf && <button className="context" style={{ left: pos.x - 40, top: pos.y + 14 }} onClick={() => setTalking(false)}>STÖBERN</button>}
        {!shelf && near && near.action !== 'staff' && <button className="context" style={{ left: near.x - 40, top: near.y + 12 }} onClick={() => { setActive(near); setTalking(false) }}>{near.label}</button>}
        {staff && nearStaff && !talkingNow && <button className="context" style={{ left: staff.x - 40, top: staff.y + 14 }} onClick={startTalk}>ANSPRECHEN</button>}
        {nearPerson && !(talkingNow && partnerId === nearPerson.person.id) && <button className="context" style={{ left: nearPerson.at.x - 40, top: nearPerson.at.y + 14 }} onClick={() => void startTalkWith(nearPerson.person)}>ANSPRECHEN</button>}
        {nearExit && <button className="context exit" style={{ left: layout.exit.x - 60, top: layout.exit.y - 56 }} onClick={onClose}>{layout.noun.toUpperCase()} VERLASSEN</button>}
      </div>
      <aside>
        <small>{typeLabel.toUpperCase()} · REALER ORT</small>
        {talkingNow && (staff || partner)
          ? <div className="portrait"><NpcPortrait id={talkFigureId} name={talkName} role={talkRole}/></div>
          : <h3>{shelf ? 'Regal' : shown ? shown.label.charAt(0) + shown.label.slice(1).toLowerCase() : name}</h3>}
        {!talkingNow && plea && <div className="plea">
          <small>{plea.title.toUpperCase()}</small>
          <span>{plea.hint}</span>
          <textarea value={pleaText} maxLength={280} rows={3} data-noxia-private onChange={event => setPleaText(event.target.value)} placeholder="In eigenen Worten …"/>
          <div className="row"><button className="act" disabled={pleaBusy || pleaText.trim().length < 3} onClick={() => void sendPlea()}>{pleaBusy ? '…' : plea.button}</button></div>
          {pleaNote && <p>{pleaNote.text}</p>}
          {pleaNote?.help && <p className="help">{pleaNote.help}</p>}
        </div>}
        {!talkingNow && occasion && phase && <div className="occasion">
          <small>JETZT · {occasion.group.toUpperCase()}</small>
          <b>{occasion.label}</b>
          <span>mit {occasion.host.name}{placed.length > 1 ? ` · ${placed.length - 1} weitere hier` : ''}</span>
          <ol>{phases.filter(item => item.from < 120).map(item => <li key={item.title} className={item === phase ? 'now' : item.to <= minute ? 'done' : ''}>{item.title}</li>)}</ol>
          <p>{phase.text}</p>
          <div className="row">
            {phases.some(item => item.speak) && (phase.speak
              ? <button className="act" disabled={hearing} onClick={() => void hearSermon()}>{hearing ? 'Hört zu …' : `${speechNoun(occasion.kind)} hören`}</button>
              : <button className="act quiet" disabled>{(() => { const next = phases.find(item => item.speak); return next && minute < next.from ? `${speechNoun(occasion.kind)} in ~${next.from - minute} min` : `${speechNoun(occasion.kind)} vorbei` })()}</button>)}
            <button className="act quiet" onClick={() => { const seat = layout.spots.find(spot => spot.action === 'sit'); if (seat) walkTo({ x: seat.x, y: seat.y + 14 }, () => setSeated(true)); else setSeated(true) }}>{seated ? 'Du sitzt' : 'Platz nehmen'}</button>
          </div>
          {sermon && <blockquote><b>{sermon.by}:</b> „{sermon.text}“</blockquote>}
          <em>Gäste sind willkommen. Mitsingen, mitbeten oder einfach still dabeisitzen – alles ist in Ordnung.</em>
        </div>}
        {talkingNow && (staff || partner) && <>
          <p className="muted">{talkRole}{isLibrary && !partner ? ' · an der Ausleihe' : ` · ${name}`}</p>
          <div className="history">{history.map((entry, index) => <p key={index}><b>{entry.role === 'user' ? 'Du' : talkName}:</b> „{entry.content}“</p>)}{sending && !history.length && <p className="muted">…</p>}</div>
          {tip && <button className="tipcard" onClick={() => { setBookId(tip.id); setTalking(false) }}>
            <span>{tip.author}</span><b>{tip.title}</b><i>{tip.genre}</i><small>Klappentext lesen →</small>
          </button>}
          {!partner && services.length > 0 && <div className="services">{services.map(service => <button key={service.id} className={'act' + (service.available ? '' : ' quiet')} onClick={() => setStatus(service.available ? `${service.label}: ${service.note}.` : `${staffName}: „${service.label} – das geht hier noch nicht. ${service.note}.“`)}>{service.label}{!service.available && <small> · bald</small>}</button>)}</div>}
          <div className="row">{isLibrary && !partner && <button className="act" onClick={giveTip}>Buchtipp erbitten</button>}<button className="act quiet" onClick={() => setTalking(false)}>Gespräch beenden</button></div>
          <div className="chat"><textarea value={message} rows={3} maxLength={160} disabled={talkEnded} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void talk() } }} placeholder={talkEnded ? CONVERSATION_ENDED_PLACEHOLDER : 'Deine Nachricht …'}/><button disabled={sending || talkEnded || !message.trim()} onClick={() => void talk()}>{sending ? '…' : 'Sprechen'}</button></div>
        </>}
        {!talkingNow && resonanceShelfOpen && !book && <div className="book">
          <b>Philosophie · Lesen & denken</b>
          <p>Alle philosophischen Werke sind frei lesbar. Volltexte sind dort verfügbar, wo eine überprüfte Manuskriptfassung hinterlegt ist.</p>
          <div className="books"><section>{resonanceBooks.map((entry, index) => <div key={entry.id}>{index === 0 && <p><strong>Philosophie und Bewusstsein</strong></p>}{index === resonanceBooks.length - THEOLOGICAL_ESSAYS.length && <p><strong>Theologie und Bibelauslegung</strong></p>}<button onClick={() => { setBookId(entry.id); setReadingPart(null) }}><b>{entry.title}</b><span>{entry.genre}{READING_TEXTS[entry.id] ? ' · Volltext frei lesbar' : ' · Einführung'}</span></button></div>)}</section></div>
        </div>}
        {!talkingNow && shelf && !book && <><p>{shelfLabel}. Zieh einen Band heraus, um Titel und Klappentext zu lesen.</p><div className="books"><section>
          {shelfBooks.map(entry => <button key={entry.id} onClick={() => setBookId(entry.id)}><b>{entry.title}</b><span>{entry.genre}</span></button>)}
        </section></div></>}
        {!talkingNow && book && (shelf || !shown || resonanceShelfOpen) && <div className="book">
          <span>{book.author}</span>
          <b>{book.title}</b>
          <i>{book.genre}</i>
          <p>{book.teaser}</p>
          {isResonanceReading && (readingText ? <>
            <p className="muted">Freie Lesefassung · {readingText.version} · ohne Credits oder Kauf</p>
            {readingPart === null ? <div className="books"><section>{readingText.sections.map((part, index) => <button key={index} onClick={() => setReadingPart(index)}>{part.heading}</button>)}</section></div> : <>
              <div className="row"><button className="act quiet" onClick={() => setReadingPart(null)}>← Inhaltsverzeichnis</button><span>{readingPart + 1} / {readingText.sections.length}</span></div>
              <article style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.65,maxHeight:'55vh',overflowY:'auto',padding:'12px 0'}}>{readingText.sections[readingPart]?.text}</article>
              <div className="row"><button className="act quiet" disabled={readingPart === 0} onClick={() => setReadingPart(n => Math.max(0, (n ?? 0)-1))}>← Vorheriger Teil</button><button className="act" disabled={readingPart + 1 >= readingText.sections.length} onClick={() => setReadingPart(n => Math.min(readingText.sections.length-1,(n ?? 0)+1))}>Nächster Teil →</button></div>
            </>}
            {readingText.source && <a href={readingText.source} target="_blank" rel="noopener noreferrer">Originalquelle ansehen</a>}
          </> : <p className="muted">Einführungstext · vollständige Manuskriptfassung noch nicht zugeordnet</p>)}
          <button className="act" onClick={() => { setBookId(''); setReadingPart(null) }}>← Zurück zum Regal</button>
        </div>}
        {status && <div className="status">{status}</div>}
        {!talkingNow && held && !book && <div className="book held-card">
          <span>IN DEINER HAND</span>
          <b>{held.title}</b>
          <i>{held.genre}</i>
          {seated ? <p>{held.teaser}</p> : <p>Setz dich an einen Leseplatz, um darin zu lesen.</p>}
          {atCounter ? <button className="act" onClick={() => { setHeld(null); setStatus(`Du gibst „${held.title}“ an der Ausleihe zurück.`) }}>Zurückgeben</button> : <button className="act quiet" onClick={() => setHeld(null)}>Weglegen</button>}
        </div>}
        {!talkingNow && !shown && !shelf && !book && !held && !staff && placed.length > 0 && <p>{placed.map(item => item.person.name).join(', ')} {placed.length === 1 ? 'ist' : 'sind'} gerade hier. Geh hin und sprich {placed.length === 1 ? 'sie oder ihn' : 'jemanden'} an.</p>}
        {!talkingNow && !shown && !shelf && !book && !held && !staff && placed.length === 0 && !isLibrary && kind !== 'artlounge' && <p className="muted">Gerade ist niemand hier, mit dem du sprechen kannst. Zu den Gottesdiensten, Gebeten und Runden ist meist jemand da.</p>}
        {!talkingNow && !shown && !shelf && !book && !held && <p>{isLibrary ? `Du kannst dich frei im Raum bewegen. Geh an ein Regal, um in den Büchern zu stöbern${staff ? `, oder sprich ${staffName} an der Ausleihe an` : ''}.` : `Du kannst dich frei umsehen${staff ? `; ${staffName} hilft dir am Tresen weiter` : ''}.`}</p>}
        {!talkingNow && !shown && !shelf && realName && <p className="muted">Heute steht hier laut OpenStreetMap „{realName}“. Im Spiel (2086) ist der Betrieb eine erfundene Nachfolgerin.</p>}
        {!talkingNow && shown && <p>{shown.text}</p>}
        {!talkingNow && shown?.action === 'learn' && <button className="act" onClick={() => window.location.assign('/ssf')}>Lernmodule der SSF öffnen</button>}
        {!talkingNow && shown?.action === 'candle' && <button className="act" onClick={() => setCandles(count => Math.min(9, count + 1))}>Kerze anzünden</button>}
        {!talkingNow && shown?.action === 'stairs' && shown.toLevel !== undefined && <button className="act" onClick={() => onLevel(shown.toLevel as number)}>{shown.toLevel === 0 ? 'Ins Erdgeschoss' : shown.toLevel > level ? `Ins ${shown.toLevel}. Obergeschoss` : `Ins ${shown.toLevel}. Obergeschoss hinunter`}</button>}
        {!talkingNow && shown?.action === 'sit' && <button className="act" onClick={() => setSeated(value => !value)}>{seated ? 'Aufstehen' : 'Hinsetzen'}</button>}
        {!talkingNow && <div className="moves"><small>GEHE ZU …</small><div>
          {waypoints.map(point => <button key={point.id} onClick={() => walkTo(point, () => { if (point.id === 'exit') onClose(); else if (point.kind === 'Sitzplatz') setSeated(true) })}>{point.label}</button>)}
        </div></div>}
        {!talkingNow && facts.length > 0 && <dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
        <div className="note">Typischer Grundriss für diese Ortsart – nicht der vermessene Innenraum des realen Gebäudes. Ortsdaten: OpenStreetMap.</div>
      </aside>
    </main>
    <style jsx>{`
      .landmark-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui;display:flex;flex-direction:column}
      .landmark-interior header{height:54px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}
      .landmark-interior header small,.landmark-interior header b,.landmark-interior header span{display:block}
      .landmark-interior header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}
      .landmark-interior header b{font-size:14px}
      .landmark-interior header span{font-size:9px;color:#8ea4a6}
      .landmark-interior header button{border:1px solid #52706f;border-radius:6px;background:#173638;color:#e6efec;padding:7px 11px;cursor:pointer}
      .landmark-interior main{flex:1;min-height:0;display:flex;gap:16px;padding:16px;overflow:auto;align-items:flex-start;justify-content:center}
      .room{position:relative;flex:none;overflow:hidden;border:6px solid #3a2f25;border-radius:6px;box-shadow:0 18px 40px #0009}
      .room.library{background:repeating-linear-gradient(90deg,#b99d76 0 38px,#b2956d 38px 40px)}
      .room.worship{background:repeating-conic-gradient(#cfc8b9 0 25%,#c4bcab 0 50%) 0 0/44px 44px}
      .room.mosque{background:#e6dfcf}
      .room.synagogue{background:repeating-linear-gradient(90deg,#c9b48f 0 30px,#c1ab85 30px 32px)}
      .room.hindu_temple{background:#e9dcc2}
      .room.buddhist_temple{background:#d9cbb0}
      .room.community_hall{background:#cdbf9f}
      .room.resonance_place{background:#d3cdb8}
      .zone{position:absolute}
      .zone.tiles{background:repeating-conic-gradient(#d8d0c0 0 25%,#cbc2b1 0 50%) 0 0/32px 32px;box-shadow:inset 0 2px 0 #0002}
      .zone.carpet{background:#8d3a36;background-image:radial-gradient(#a24a44 1.2px,transparent 1.3px);background-size:9px 9px;border:3px solid #6e2a28;border-radius:4px;box-shadow:inset 0 0 0 6px #7a3230}
      .zone.rug{background:#4e6a8a;background-image:repeating-linear-gradient(45deg,#5a789a 0 6px,#4e6a8a 6px 12px);border:2px solid #3b526c;border-radius:3px}
      .zone.chancel{background:#d9d1bf;border-bottom:4px solid #b7ad97}
      .zone.concrete{background:#9a9b96;background-image:linear-gradient(#90918c 1px,transparent 1px),linear-gradient(90deg,#90918c 1px,transparent 1px);background-size:120px 120px}
      .floor-tag{position:absolute;left:50%;top:6px;transform:translateX(-50%);font:800 8px monospace;letter-spacing:.14em;color:#f3ead6;background:#17313ccc;padding:3px 8px;border-radius:3px;z-index:3;pointer-events:none}
      .f.stairs{background:repeating-linear-gradient(180deg,#c9b48f 0 8px,#a8916a 8px 10px);border:2px solid #6b5230;box-shadow:3px 4px 0 #0003}
      .zone.parquet{background:repeating-linear-gradient(90deg,#b98a57 0 38px,#a97a4a 38px 40px);box-shadow:inset 0 2px 0 #0002}
      .f.piano{background:#15151a;border:2px solid #000;border-radius:10px 46px 10px 10px;box-shadow:inset 0 -14px 0 #2a2a33,3px 4px 0 #0004}
      .f.piano::after{content:'';position:absolute;left:6px;right:46px;bottom:3px;height:9px;background:repeating-linear-gradient(90deg,#f4f0e6 0 5px,#222 5px 6px)}
      .f.chair{background:#7a2f3a;border:2px solid #4a1a22;border-radius:6px;box-shadow:inset 0 5px 0 #6a2530,2px 3px 0 #0003}
      .f.wall{background:#d9d2c3;border:1px solid #a89f8c;border-radius:1px}
      .f.artwork{background:linear-gradient(135deg,#d8b24f,#c24a3d 50%,#5f8ea6);border:2px solid #3b2518;box-shadow:none;border-radius:1px}
      .zone.oilstain{background:radial-gradient(ellipse,#3a3a36aa,transparent 70%)}
      .room.shop{background:#c9c2b2}
      .room.workshop{background:#9a9b96}
      .f.goods{background:#6b4a33;border:2px solid #3b2518}
      .f.goods::after{content:'';position:absolute;inset:3px;background:repeating-linear-gradient(90deg,#d8b24f 0 6px,#5f8ea6 6px 10px,#c24a3d 10px 15px,#6fae5a 15px 18px,#efe6d2 18px 22px)}
      .f.lift{background:#5a5f66;border:2px solid #2f3338;border-radius:3px;box-shadow:inset 0 0 0 6px #4a4f55,3px 4px 0 #0003}
      .f.vehicle{background:linear-gradient(180deg,#8fb3c9,#4f7f9c);border:2px solid #1f3f52;border-radius:12px 12px 8px 8px;box-shadow:inset 0 -6px 0 #2b5368,3px 4px 0 #0004}
      .f.vehicle::before,.f.vehicle::after{content:'';position:absolute;top:-4px;width:14px;height:8px;border-radius:3px;background:#222}
      .f.vehicle::before{left:16px}.f.vehicle::after{right:16px}
      .f.bench{background:#8c6b47;border:2px solid #5d4428}
      .f.bench::after{content:'';position:absolute;left:8px;top:6px;width:60%;height:8px;background:repeating-linear-gradient(90deg,#c9c9c9 0 4px,transparent 4px 9px)}
      .f.gate{background:repeating-linear-gradient(90deg,#4c5a66 0 10px,#5f6d79 10px 20px);border:2px solid #2f3b45;box-shadow:none}
      .f.crate{background:#a8864f;border:2px solid #6b5230;box-shadow:inset 0 0 0 3px #b99766,3px 4px 0 #0003}
      .services{display:flex;flex-wrap:wrap;gap:4px}
      .services small{font-size:8px;opacity:.8}
      .lamp{position:absolute;border-radius:50%;background:radial-gradient(circle,#ffffff66 0%,#ffffff22 40%,transparent 70%);pointer-events:none;mix-blend-mode:screen}
      .lamp.warm{background:radial-gradient(circle,#ffd98a77 0%,#ffcc6e2a 40%,transparent 70%)}
      .door{position:absolute;left:330px;bottom:-6px;width:100px;height:8px;background:#e8dfc8;border-radius:2px}
      .door span{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font:800 7px monospace;letter-spacing:.12em;color:#3a2f25}
      .f{position:absolute;border-radius:3px;box-shadow:3px 4px 0 #0003}
      .f .label{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:800 7px monospace;letter-spacing:.12em;color:#f3ead6;text-shadow:0 1px 0 #0006;pointer-events:none}
      .f.shelf{background:#4a2c1c;border:2px solid #2d1a10}
      .f.shelf-low{background:#6b4a33;border:2px solid #3b2518;box-shadow:2px 2px 0 #0003}
      .spines{position:absolute;inset:3px;background:repeating-linear-gradient(90deg,#8a3a2e 0 4px,#2f5d6b 4px 7px,#c9a24a 7px 9px,#3f6b3a 9px 13px,#6a3d7a 13px 15px,#b7532f 15px 19px,#2a4a7a 19px 22px)}
      .spines.low{background:repeating-linear-gradient(90deg,#d8b24f 0 5px,#2f5d6b 5px 8px,#b24a3d 8px 12px,#3f6b3a 12px 14px)}
      .f.table{background:#8c6b47;border:2px solid #5d4428;border-radius:5px}
      .book-open{position:absolute;left:14px;top:14px;width:22px;height:14px;background:linear-gradient(90deg,#f5efe0 0 48%,#d9cfb8 48% 52%,#f5efe0 52%);border:1px solid #6b5438;border-radius:1px}
      .lamp-small{position:absolute;right:10px;top:8px;width:14px;height:10px;background:#2f6a4a;border-radius:7px 7px 2px 2px;box-shadow:0 0 10px 3px #ffe9a080}
      .f.desk{background:#5f4630;border:2px solid #3b2a1a}
      .f.counter{background:#6b4a33;border:2px solid #3b2518;border-top:5px solid #8a6648}
      .f.pew{background:#6d4c33;border:2px solid #42291a}
      .f.altar{background:#ece6d6;border:2px solid #9c9482}
      .f.lectern{background:#7b5a3c;border:2px solid #4a3320}
      .f.font{background:#b9c3c6;border:3px solid #7d8a8e;border-radius:50%}
      .f.candles{background:#4b4034;border:2px solid #2c251d}
      .f.armchair{background:#2f5f7a;border:2px solid #1e3f52;border-radius:9px 9px 5px 5px;box-shadow:inset 0 6px 0 #27506a,3px 4px 0 #0003}
      .f.sofa{background:#2f5f7a;border:2px solid #1e3f52;border-radius:8px;box-shadow:inset 0 8px 0 #27506a,inset 0 -5px 0 #27506a,3px 4px 0 #0003}
      .f.plant{background:radial-gradient(circle at 40% 40%,#6fae5a,#3f7a3a 60%,#2b5a2a);border:2px solid #243f22;border-radius:50%;box-shadow:2px 3px 0 #0003}
      .f.plant::after{content:'';position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#8fcc74;opacity:.7}
      .f.globe{background:radial-gradient(circle at 35% 35%,#9ccbe6,#2f6e9c 55%,#1c4466);border:2px solid #5a3b22;border-radius:50%;box-shadow:0 0 0 3px #8a5a3a,3px 4px 0 #0003}
      .f.pinboard{background:#b58a5a;border:2px solid #6b4a2b;box-shadow:none;border-radius:2px}
      .f.mihrab{background:linear-gradient(180deg,#1f5f6b,#2f7f8c);border:3px solid #c9a24a;border-radius:30px 30px 4px 4px;box-shadow:inset 0 -8px 0 #17474f}
      .f.minbar{background:repeating-linear-gradient(180deg,#8a6648 0 10px,#6b4a33 10px 12px);border:2px solid #3b2518;border-radius:3px 3px 1px 1px}
      .f.ablution{background:#b9c3c6;border:2px solid #7d8a8e;box-shadow:none}
      .f.ablution::after{content:'';position:absolute;left:8px;right:8px;top:4px;height:6px;background:repeating-linear-gradient(90deg,#5f6d79 0 4px,transparent 4px 24px)}
      .f.shoerack{background:repeating-linear-gradient(90deg,#6b4a33 0 18px,#4a2c1c 18px 20px);border:2px solid #3b2518;box-shadow:none}
      .f.ark{background:linear-gradient(180deg,#5a3a7a,#3e2558);border:3px solid #c9a24a;border-radius:4px}
      .f.ark::after{content:'';position:absolute;left:46%;top:4px;bottom:4px;width:2px;background:#c9a24a}
      .f.eternal-light{background:radial-gradient(circle,#ffe08a,#e2a33a 60%,#8a5a1a);border-radius:50%;box-shadow:0 0 12px #ffcf6a}
      .f.bimah{background:#8c6b47;border:3px solid #5d4428;border-radius:4px;box-shadow:inset 0 0 0 5px #a07c55,3px 4px 0 #0003}
      .f.shrine{background:linear-gradient(180deg,#c24a3d,#8f2e26);border:3px solid #d8b24f;border-radius:40px 40px 4px 4px}
      .f.shrine::after{content:'';position:absolute;left:40%;right:40%;top:14px;bottom:6px;background:#1c1a24;border-radius:10px 10px 2px 2px;box-shadow:0 0 0 3px #d8b24f}
      .f.diya{background:radial-gradient(circle,#ffd36a,#d07a2a 55%,#7a3a1a);border-radius:50%;box-shadow:0 0 10px #ffb84a}
      .f.bell{background:radial-gradient(circle at 50% 35%,#f2d27a,#b8862e 65%,#6b4a12);border-radius:40% 40% 50% 50%;border:2px solid #5a3b0a}
      .f.buddha{background:radial-gradient(ellipse at 50% 70%,#e0b84a,#b8862e 60%,#7a5a1a);border:3px solid #6b4a12;border-radius:50px 50px 8px 8px}
      .f.cushion{background:radial-gradient(circle,#a83a2a,#7a2a1e);border:2px solid #5a1e14;border-radius:50%;box-shadow:2px 2px 0 #0003}
      .f.incense{background:#5a4a3a;border:2px solid #2c251d;border-radius:4px}
      .f.incense::after{content:'';position:absolute;left:30%;right:30%;top:-10px;height:10px;background:linear-gradient(0deg,#d9d9d966,transparent);border-radius:50%}
      .f.gong{background:radial-gradient(circle,#e6c25a,#a87a1e 70%,#5a3b0a);border:3px solid #3b2518;border-radius:50%}
      .f.stage{background:#6b4a33;border:2px solid #3b2518;box-shadow:inset 0 -8px 0 #4a2c1c,3px 4px 0 #0003}
      .note{position:absolute;top:2px;width:10px;height:7px;border:1px solid #0003}
      .note.n1{left:6px;background:#f7e9a8}.note.n2{left:30px;background:#dfe9f5;top:1px}.note.n3{left:56px;background:#f4cfc9}
      .flame{position:absolute;width:4px;height:7px;border-radius:50% 50% 45% 45%;background:#ffd76a;box-shadow:0 0 6px 2px #ffb84a99}
      .npc{position:absolute;z-index:2}
      .npc .carry{position:absolute;left:18px;top:14px;width:9px;height:12px;background:#b24a3d;border:1px solid #3b1a14;border-radius:1px;box-shadow:inset 2px 0 0 #e8d9b5}
      .player .held{position:absolute;left:16px;top:10px;width:8px;height:11px;background:#2f5d6b;border:1px solid #1a3038;border-radius:1px;box-shadow:inset 2px 0 0 #e8d9b5}
      .plea{display:grid;gap:5px;padding:9px 10px;border:1px solid #6b8793;border-radius:7px;background:#0f2230;color:#dfe9ee}
      .plea small{font:800 8px monospace;letter-spacing:.12em;color:#9fd3c0}
      .plea span{font-size:10px;color:#a9bfc6}
      .plea textarea{resize:vertical;min-height:52px;font:inherit;font-size:11px;padding:6px;border-radius:5px;border:1px solid #40595a;background:#0b1a24;color:#eef2ed}
      .plea p{margin:0;font-size:11px}
      .plea .help{padding:6px 8px;border-left:3px solid #e9c46a;background:#1d160b;color:#fff3d6}
      .occasion{display:grid;gap:5px;padding:9px 10px;border:1px solid #c9a447;border-radius:7px;background:#2a2010;color:#f6ead0}
      .occasion small{font:800 8px monospace;letter-spacing:.12em;color:#e9c46a}
      .occasion b{font-size:13px}
      .occasion span,.occasion em{font-size:10px;color:#d8c9a6}
      .occasion ol{margin:2px 0;padding-left:16px;display:grid;gap:1px;font-size:10px;color:#bfae88}
      .occasion li.done{opacity:.55;text-decoration:line-through}
      .occasion li.now{color:#fff3d6;font-weight:700}
      .occasion p{margin:0;font-size:11px;line-height:1.4}
      .occasion blockquote{margin:2px 0;padding:6px 8px;border-left:3px solid #e9c46a;background:#1d160b;font-size:11px;line-height:1.45}
      .status{padding:7px 9px;border:1px solid #6b8793;border-radius:6px;background:#0b1a24;color:#dfe9ee;font-size:10px}
      .moves{display:grid;gap:4px;border-top:1px solid #2f4a4b;padding-top:8px}
      .moves div{display:flex;flex-wrap:wrap;gap:4px}
      .moves button{border:1px solid #476476;border-radius:5px;background:#102b3c;color:#dce9ee;padding:4px 7px;font:700 9px system-ui;cursor:pointer}
      .moves button:hover{background:#173b50}
      .held-card{border-color:#2f5d6b}
      .player{position:absolute;width:20px;height:28px;pointer-events:none;z-index:3}
      .player i{position:absolute;left:3px;top:8px;width:14px;height:18px;border-radius:7px 7px 3px 3px;background:#d4ad43;border:1.5px solid #594717}
      .player i::before{content:'';position:absolute;left:1.5px;top:-9px;width:8px;height:8px;border-radius:50%;background:#f0c49c;border:1.5px solid #493c18}
      .player.seated i{height:12px;top:14px}
      .player span{position:absolute;left:50%;top:-16px;transform:translateX(-50%);padding:1px 5px;border-radius:4px;background:#173845ee;border:1px solid #e4bd4b;font:800 8px system-ui;color:#fff7d8}
      .context{position:absolute;width:80px;padding:4px 0;border:1px solid #8a6a20;border-radius:5px;background:#2a220ef2;color:#f1dfa6;font:800 8px monospace;letter-spacing:.06em;cursor:pointer;z-index:4}
      .context.exit{width:120px;border-color:#52706f;background:#173638f2;color:#e6efec}
      aside{flex:none;width:300px;display:grid;gap:9px;padding:14px;border:1px solid #476263;border-radius:9px;background:#10272acc;font-size:11px;line-height:1.45}
      aside small{font:800 8px monospace;letter-spacing:.12em;color:#d7b96e}
      aside h3{margin:0;font-size:15px}
      aside .portrait{margin:0}
      aside p{margin:0;color:#d5e0dd}
      aside p.muted{color:#8ea4a6;font-size:10px}
      .history{display:grid;gap:6px;max-height:220px;overflow:auto}
      .history p{padding-top:6px;border-top:1px solid #314753}
      .history p:first-child{border-top:0;padding-top:0}
      .row{display:flex;gap:6px}
      .act{border:1px solid #6e7d55;border-radius:5px;background:#273d24;color:#edf3dd;padding:7px 9px;font:800 9px monospace;cursor:pointer}
      .act.quiet{border-color:#476476;background:#102b3c;color:#dce9ee}
      .chat{display:flex;gap:6px}
      .chat textarea{flex:1;min-width:0;min-height:72px;resize:vertical;font:inherit;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}
      .chat button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}
      .tipcard{display:grid;gap:2px;text-align:left;border:1px solid #c9a24a;border-radius:6px;background:#efe6d2;color:#2b2118;padding:8px 10px;cursor:pointer}
      .tipcard span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
      .tipcard b{font-size:12px}.tipcard i{font-size:9px;color:#6b5a48}.tipcard small{color:#7a5a36;font-weight:800}
      .books{display:grid;gap:10px;max-height:300px;overflow:auto;padding-right:4px}
      .books section{display:grid;gap:3px}
      .books h4{margin:0 0 2px;font:800 8px monospace;letter-spacing:.1em;color:#d7b96e}
      .books button{display:grid;gap:1px;text-align:left;border:0;border-left:3px solid #8a5a3a;border-radius:2px;background:#16302f;color:#eef2ed;padding:5px 8px;cursor:pointer}
      .books button:hover{background:#1d3d3c}
      .books button b{font-size:11px}
      .books button span{font-size:9px;color:#8ea4a6}
      .book{display:grid;gap:5px;padding:10px;border:1px solid #5d4428;border-radius:6px;background:#efe6d2;color:#2b2118}
      .book span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
      .book b{font-size:14px;line-height:1.2}
      .book i{font-size:10px;color:#6b5a48}
      .book p{margin:2px 0 4px;color:#2b2118;line-height:1.5}
      aside dl{margin:0;display:grid;gap:4px}
      aside dl div{display:grid;grid-template-columns:86px 1fr;gap:6px}
      aside dt{color:#7e9896}
      aside dd{margin:0}
      aside .note{position:static;width:auto;height:auto;border:0;color:#7e9896;font-size:9px;border-top:1px solid #2f4a4b;padding-top:8px}
      @media(max-width:1120px){.landmark-interior main{flex-direction:column;align-items:center}aside{width:min(760px,100%)}}
    `}</style>
  </div>
}
