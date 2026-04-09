import { BellRing } from 'lucide-react'
import { ActionButton } from './ui'

export function getNotificationPermissionMeta(status, supported = true) {
  if (!supported || status === 'unsupported') {
    return {
      tone: 'warning',
      badge: 'Not supported',
      title: 'Browser notifications are unavailable',
      description: 'This browser or connection cannot show DwarPal notifications. You can still use in-app updates normally.',
      actionLabel: 'View details',
    }
  }

  if (status === 'granted') {
    return {
      tone: 'success',
      badge: 'Enabled',
      title: 'Browser notifications are enabled',
      description: 'DwarPal is ready for future approval, rejection, and security workflow notifications on this device.',
      actionLabel: 'Review status',
    }
  }

  if (status === 'denied') {
    return {
      tone: 'danger',
      badge: 'Blocked',
      title: 'Browser notifications are blocked',
      description: 'Notifications were denied in the browser. You can re-enable them later from your browser site settings.',
      actionLabel: 'How to enable',
    }
  }

  if (status === 'dismissed') {
    return {
      tone: 'info',
      badge: 'Later',
      title: 'Browser notifications are not enabled yet',
      description: 'Turn them on when you want quicker updates for approvals, rejections, and gate verification activity.',
      actionLabel: 'Enable notifications',
    }
  }

  return {
    tone: 'info',
    badge: 'Available',
    title: 'Browser notifications are available',
    description: 'Enable them for smoother approval, rejection, and gate verification updates from DwarPal.',
    actionLabel: 'Enable notifications',
  }
}

export function NotificationPermissionCard({
  status,
  supported = true,
  onManage,
}) {
  const meta = getNotificationPermissionMeta(status, supported)

  return (
    <div className={`notification-permission-card notification-permission-card-${meta.tone}`}>
      <div className="notification-permission-card-copy">
        <span className="eyebrow">Browser Notifications</span>
        <h4>{meta.title}</h4>
        <p>{meta.description}</p>
      </div>
      <div className="notification-permission-card-actions">
        <span className={`notification-summary-chip notification-summary-chip-${meta.tone}`}>{meta.badge}</span>
        <ActionButton type="button" tone="secondary" onClick={onManage}>
          {meta.actionLabel}
        </ActionButton>
      </div>
    </div>
  )
}

export default function NotificationPermissionPrompt({
  open,
  onAllow,
  onMaybeLater,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="permission-prompt-backdrop" role="presentation" onClick={onMaybeLater}>
      <div
        className="permission-prompt-card"
        role="dialog"
        aria-modal="true"
        aria-label="Enable browser notifications"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="permission-prompt-icon" aria-hidden="true">
          <BellRing size={22} />
        </div>
        <div className="permission-prompt-copy">
          <span className="eyebrow">Stay updated</span>
          <h3>Allow DwarPal notifications?</h3>
          <p>Get future browser alerts for approvals, rejections, forwarded requests, and important gate verification activity.</p>
        </div>
        <div className="permission-prompt-actions">
          <ActionButton type="button" tone="secondary" onClick={onMaybeLater}>
            Maybe Later
          </ActionButton>
          <ActionButton type="button" onClick={onAllow}>
            Allow Notifications
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
