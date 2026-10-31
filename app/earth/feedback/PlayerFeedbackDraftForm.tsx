'use client'

import { useState } from 'react'
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/lib/game/evolution/playerFeedback'
import { prepareLocalFeedbackCopy } from '@/lib/game/evolution/playerFeedbackLocalCopy'

const categoryLabels: Record<FeedbackCategory, string> = {
  idea: 'Idee', problem: 'Problem', building: 'Gebäude / Nutzung',
  profession: 'Beruf', technology: 'Technologie', gameplay: 'Spielmechanik', other: 'Sonstiges',
}

/** Deliberately local-only until authenticated, moderated and rate-limited intake exists. */
export default function PlayerFeedbackDraftForm() {
  const [category, setCategory] = useState<FeedbackCategory>('idea')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationRef, setLocationRef] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [consentToPublish, setConsentToPublish] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const result = prepareLocalFeedbackCopy({ category, title, description, locationRef, visibility, consentToPublish })

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
    <p>Dies ist ein <strong>lokaler Entwurf</strong>. Es gibt hier noch keine Einreichung, Speicherung,
      Veröffentlichung, Abstimmung oder Veränderung der Spielwelt. Kopiere den Text nur bewusst.</p>
    <form onSubmit={event => event.preventDefault()}>
      <label style={{ display: 'block', marginBottom: 12 }}>Kategorie<br />
        <select value={category} onChange={event => { setCategory(event.target.value as FeedbackCategory); setCopyStatus('idle') }}>
          {FEEDBACK_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Titel<br />
        <input required minLength={5} maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setCopyStatus('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Beschreibung<br />
        <textarea required minLength={20} maxLength={5000} rows={6} value={description}
          onChange={event => { setDescription(event.target.value); setCopyStatus('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>Ort (optional, ungeprüft)<br />
        <input maxLength={200} value={locationRef} onChange={event => { setLocationRef(event.target.value); setCopyStatus('idle') }}
          style={{ width: '100%', boxSizing: 'border-box' }} />
      </label>
      <fieldset style={{ marginBottom: 12 }}>
        <legend>Gewünschte spätere Sichtbarkeit – derzeit keine Veröffentlichung</legend>
        <label><input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => { setVisibility('private'); setConsentToPublish(false); setCopyStatus('idle') }} /> Privat</label>{' '}
        <label><input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => { setVisibility('public'); setCopyStatus('idle') }} /> Öffentlich (erst nach späterer Prüfung)</label>
        {visibility === 'public' && <label style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={consentToPublish} onChange={event => { setConsentToPublish(event.target.checked); setCopyStatus('idle') }} />
          Ich stimme einer möglichen späteren Veröffentlichung ausdrücklich zu. Dieses Formular veröffentlicht nichts.
        </label>}
      </fieldset>
      {!result.ok && <p role="status">Bitte vervollständige Titel und Beschreibung und prüfe die Sichtbarkeit.
        {result.errors.includes('publication_consent_required') ? ' Für „öffentlich“ ist die ausdrückliche Einwilligung erforderlich.' : ''}</p>}
      <button type="button" disabled={!result.ok} onClick={() => { void copyDraft() }}>Gültigen Entwurf kopieren</button>
      {copyStatus === 'copied' && <p role="status">Entwurf kopiert, nicht eingereicht.</p>}
      {copyStatus === 'error' && <p role="alert">Kopieren nicht möglich. Bitte Zwischenablage-Berechtigung prüfen.</p>}
    </form>
  </section>
}
