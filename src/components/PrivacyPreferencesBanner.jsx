import { Cookie } from 'lucide-react'
import { ActionButton } from './ui'

export default function PrivacyPreferencesBanner({ open, onAccept, onReject }) {
  if (!open) {
    return null
  }

  return (
    <aside className="cookie-consent-banner" role="dialog" aria-modal="false" aria-label="Cookie preferences">
      <div className="cookie-consent-copy">
        <div className="cookie-consent-icon" aria-hidden="true">
          <Cookie size={18} />
        </div>
        <div>
          <strong>Cookie preferences</strong>
          <p>We use cookies to improve your experience.</p>
        </div>
      </div>
      <div className="cookie-consent-actions">
        <ActionButton type="button" tone="secondary" onClick={onReject}>
          Reject
        </ActionButton>
        <ActionButton type="button" onClick={onAccept}>
          Accept
        </ActionButton>
      </div>
    </aside>
  )
}
