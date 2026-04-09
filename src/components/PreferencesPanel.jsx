import { BellRing, Cookie } from 'lucide-react'
import { ActionButton } from './ui'
import { getNotificationPermissionMeta } from './NotificationPermissionPrompt'

function getCookiePreferenceMeta(cookieConsent) {
  if (cookieConsent === 'accepted') {
    return {
      tone: 'success',
      badge: 'Accepted',
      title: 'Cookie consent accepted',
      description: 'Your current device is set to allow DwarPal cookies for a smoother experience.',
      actionLabel: 'Manage cookies',
    }
  }

  if (cookieConsent === 'rejected') {
    return {
      tone: 'warning',
      badge: 'Rejected',
      title: 'Cookie consent rejected',
      description: 'You can reopen cookie preferences anytime and change this device preference later.',
      actionLabel: 'Manage cookies',
    }
  }

  return {
    tone: 'info',
    badge: 'Pending',
    title: 'Cookie preference not set',
    description: 'Choose whether DwarPal can use cookies to improve your experience on this device.',
    actionLabel: 'Choose cookies',
  }
}

function PreferenceRow({ icon: Icon, eyebrow, meta, onManage }) {
  return (
    <article className={`preference-row preference-row-${meta.tone}`}>
      <div className="preference-row-copy">
        <div className="preference-row-icon" aria-hidden="true">
          <Icon size={18} />
        </div>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h4>{meta.title}</h4>
          <p>{meta.description}</p>
        </div>
      </div>
      <div className="preference-row-actions">
        <span className={`notification-summary-chip notification-summary-chip-${meta.tone}`}>{meta.badge}</span>
        <ActionButton type="button" tone="secondary" onClick={onManage}>
          {meta.actionLabel}
        </ActionButton>
      </div>
    </article>
  )
}

export default function PreferencesPanel({
  cookieConsent,
  notificationPermissionState,
  notificationsSupported = true,
  onManageCookies,
  onManageNotifications,
}) {
  const cookieMeta = getCookiePreferenceMeta(cookieConsent)
  const notificationMeta = getNotificationPermissionMeta(notificationPermissionState, notificationsSupported)

  return (
    <section className="profile-subcard preferences-card">
      <div className="biometric-card-header">
        <div>
          <h3>Preferences</h3>
          <p>Review browser-level choices for cookies and future DwarPal notifications.</p>
        </div>
      </div>

      <div className="preference-grid">
        <PreferenceRow
          icon={Cookie}
          eyebrow="Cookies"
          meta={cookieMeta}
          onManage={onManageCookies}
        />
        <PreferenceRow
          icon={BellRing}
          eyebrow="Notifications"
          meta={notificationMeta}
          onManage={onManageNotifications}
        />
      </div>
    </section>
  )
}
