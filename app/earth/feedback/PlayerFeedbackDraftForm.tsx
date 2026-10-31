'use client'

import { useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { validateFeedback } from '@/lib/game/evolution/playerFeedback'
import { readPlayerFeedbackSubmissionResponse } from '@/lib/game/evolution/feedbackSubmitResponse'
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/lib/game/evolution/playerFeedback'
import { prepareLocalFeedbackCopy } from '@/lib/game/evolution/playerFeedbackLocalCopy'
import { selectFeedbackAttempt } from '@/lib/game/evolution/feedbackSubmissionAttempt'

const categoryLabels: Record<FeedbackCategory, string> = {
  idea: 'Idee', problem: 'Problem', building: 'Gebäude / Nutzung',
  profession: 'Beruf', technology: 'Technologie', gameplay: 'Spielmechanik', other: 'Sonstiges',
}

/** Draft remains local until the authenticated server returns a validated receipt. */
export default function PlayerFeedbackDraftForm() {
  const [destination, setDestination] = useState<'development' | 'world_initiative'>('development')
  const [category, setCategory] = useState<FeedbackCategory>('idea')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationRef, setLocationRef] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [consentToPublish, setConsentToPublish] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'sending' | 'submitted' | 'signed_out' | 'unavailable' | 'rate_limited' | 'invalid'>('idle')
  const [submittedTitle, setSubmittedTitle] = useState('')
  const lastAttempt = useRef<{ body: string; key: string } | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  const result = prepareLocalFeedbackCopy({ category, destination, title, description, locationRef, visibility, consentToPublish })

  async function submitDraft() {
    if (submitPhase === 'sending') return
    const checked = validateFeedback({ category, destination, title, description, locationRef, visibility, consentToPublish })
    if (!checked.valid || !checked.normalized) { setSubmitPhase('invalid'); return }
    const body = JSON.stringify({ feedback: checked.normalized, source: { kind: 'direct' } })
    const attempt = selectFeedbackAttempt(lastAttempt.current, body, crypto.randomUUID())
    if (!attempt) { setSubmitPhase('invalid'); return }
    lastAttempt.current = attempt // Same normalized payload retains its key across network retries.
    const key = attempt.key
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setSubmitPhase('sending')
    try {
      const token = await getToken()
      if (controller.signal.aborted) return
      if (!token) { setSubmitPhase('signed_out'); return }
      const response = await fetch('/api/game/feedback', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body,
      })
      if (controller.signal.aborted) return
      if (response.status === 401) { setSubmitPhase('signed_out'); return }
      if (response.status === 429) { setSubmitPhase('rate_limited'); return }
      if (!response.ok) { setSubmitPhase(response.status === 400 || response.status === 422 ? 'invalid' : 'unavailable'); return }
      const payload: unknown = await response.json()
      if (controller.signal.aborted) return
      const parsed = readPlayerFeedbackSubmissionResponse(payload)
      if (!parsed || parsed.receipt.title !== checked.normalized.title) { setSubmitPhase('unavailable'); return }
      setSubmittedTitle(parsed.receipt.title)
      setSubmitPhase('submitted')
    } catch {
      if (!controller.signal.aborted) setSubmitPhase('unavailable')
    }
  }

  async function copyDraft() {
    if (!result.ok) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return <section aria-label="Feedback-Entwurf" style={{ maxWidth: 780, margin: '24px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
    <h1>Idee oder Problem für NOXIA vorbereiten</h1>
    <p>Dein Text bleibt ein <strong>lokaler Entwurf</strong>, bis der Server die Einreichung mit einem Beleg bestätigt.
      Eine Einreichung ist keine Veröffentlichung, Abstimmung, Genehmigung oder Veränderung der Spielwelt.
      Ohne freigegebene Datenbankanbindung ist die Einreichung nicht verfügbar.</p>
    <form onSubmit={event => { event.preventDefault(); void submitDraft() }}>
      <fieldset disabled={submitPhase === 'sending'} style={{ border: 0, padding: 0, margin: 0 }}>
      <fieldset style={{ marginBottom: 12 }}><legend>Art des Anliegens</legend>
        <label><input type="radio" name="destination" checked={destination === 'development'} onChange={() => { setDestination('development'); setCopyStatus('idle'); setSubmitPhase('idle') }} /> Feedback zur Software</label>{' '}
        <label><input type="radio" name="destination" checked={destination === 'world_initiative'} onChange={() => { setDestination('world_initiative'); setCopyStatus('idle'); setSubmitPhase('idle') }} /> Initiative in der Spielwelt</label>
      </fieldset>
      <label style={{ display: 'block', marginBottom: 12 }}>Kategorie<br />
        <select value={category} onChange={event => { setCategory(event.target.value as FeedbackCategory); setCopyStatus('idle'); setSubmitPhase('idle') }}>
          {FEEDBACK_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Titel<br />
        <input required minLength={5} maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setCopyStatus('idle'); setSubmitPhase('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Beschreibung<br />
        <textarea required minLength={20} maxLength={5000} rows={6} value={description}
          onChange={event => { setDescription(event.target.value); setCopyStatus('idle'); setSubmitPhase('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Ort (optional, ungeprüft)<br />
        <input maxLength={200} value={locationRef} onChange={event => { setLocationRef(event.target.value); setCopyStatus('idle'); setSubmitPhase('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <fieldset style={{ marginBottom: 12 }}>
        <legend>Gewünschte spätere Sichtbarkeit – derzeit keine Veröffentlichung</legend>
        <label><input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => { setVisibility('private'); setConsentToPublish(false); setCopyStatus('idle'); setSubmitPhase('idle') }} /> Privat</label>{' '}
        <label><input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => { setVisibility('public'); setCopyStatus('idle'); setSubmitPhase('idle') }} /> Öffentlich (erst nach späterer Prüfung)</label>
        {visibility === 'public' && <label style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={consentToPublish} onChange={event => { setConsentToPublish(event.target.checked); setCopyStatus('idle'); setSubmitPhase('idle') }} />
          Ich stimme einer möglichen späteren Veröffentlichung ausdrücklich zu. Dieses Formular veröffentlicht nichts.
        </label>}
      </fieldset>
      {!result.ok && <p role="status">Bitte vervollständige Titel und Beschreibung und prüfe die Sichtbarkeit.
        {result.errors.includes('publication_consent_required') ? ' Für „öffentlich“ ist die ausdrückliche Einwilligung erforderlich.' : ''}</p>}
      <button type="button" disabled={!result.ok} onClick={() => { void copyDraft() }}>Gültigen Entwurf kopieren</button>{' '}
      <button type="submit" disabled={!result.ok || submitPhase === 'sending'}>Vorschlag verbindlich einreichen</button>
      </fieldset>
      {submitPhase === 'sending' && <p role="status">Einreichung wird geprüft und gespeichert …</p>}
      {submitPhase === 'submitted' && <p role="status">„{submittedTitle}“ wurde gespeichert und zur Prüfung eingereicht. Keine Weltänderung.</p>}
      {submitPhase === 'signed_out' && <p role="alert">Bitte melde dich an, um deinen Vorschlag einzureichen.</p>}
      {submitPhase === 'rate_limited' && <p role="alert">Zu viele Einreichungen. Bitte versuche es später erneut.</p>}
      {submitPhase === 'invalid' && <p role="alert">Die Einreichung wurde abgelehnt. Bitte prüfe die Eingaben.</p>}
      {submitPhase === 'unavailable' && <p role="alert">Keine bestätigte Einreichung. Der Dienst ist nicht verfügbar oder die Antwort konnte nicht geprüft werden. Ein erneuter Versuch mit unverändertem Text verwendet denselben Schlüssel.</p>}
      {copyStatus === 'copied' && <p role="status">Entwurf kopiert, nicht eingereicht.</p>}
      {copyStatus === 'error' && <p role="alert">Kopieren nicht möglich. Bitte Zwischenablage-Berechtigung prüfen.</p>}
    </form>
  </section>
}
