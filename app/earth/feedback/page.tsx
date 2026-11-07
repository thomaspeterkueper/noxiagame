import PlayerFeedbackDraftForm from './PlayerFeedbackDraftForm'
import PlayerFeedbackReceipts from './PlayerFeedbackReceipts'

export const metadata = { title: 'NOXIA · Feedback und meine Vorschläge' }

export default function EarthFeedbackPage() {
  return <>
    <PlayerFeedbackDraftForm />
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 32px', fontFamily: 'system-ui, sans-serif' }}>
      <PlayerFeedbackReceipts />
    </div>
  </>
}
