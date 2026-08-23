import { BellRing } from 'lucide-react'
import { ActionButton } from './ui'

export function getNotificationPermissionMeta(status, supported = true) {
  if (!supported || status === 'unsupported') {
    return {
      tone: 'warning',
      badge: 'Not supported',
      title: 'Device notifications unavailable',
      description: 'This browser or connection cannot show system push notifications. Real-time in-app updates will continue to work.',
      actionLabel: 'View details',
    }
  }

  if (status === 'granted') {
    return {
      tone: 'success',
      badge: 'Enabled',
      title: 'Phone & desktop notifications active',
      description: 'DwarPal is configured to send real-time gatepass approvals, rejections, and security alerts to this device.',
      actionLabel: 'Review status',
    }
  }

  if (status === 'denied') {
    return {
      tone: 'danger',
      badge: 'Blocked',
      title: 'Notifications are blocked',
      description: 'Notifications were denied. You can re-enable them anytime from your browser or device site permissions.',
      actionLabel: 'How to enable',
    }
  }

  if (status === 'dismissed') {
    return {
      tone: 'info',
      badge: 'Later',
      title: 'Notifications not enabled yet',
      description: 'Enable them to receive app-like updates for approvals, rejections, and gate activity on phone and desktop.',
      actionLabel: 'Enable notifications',
    }
  }

  return {
    tone: 'info',
    badge: 'Available',
    title: 'Phone & desktop notifications available',
    description: 'Enable push alerts for instant gatepass status updates even when DwarPal is closed or running in background.',
    actionLabel: 'Enable notifications',
  }
}

export function NotificationPermissionCard({
  status,
  supported = true,
  onManage,
  onTestNotification,
  testingNotification = false,
}) {
  const meta = getNotificationPermissionMeta(status, supported)

  return (
    <div className={`notification-permission-card notification-permission-card-${meta.tone}`}>
      <div className="notification-permission-card-copy">
        <span className="eyebrow">Device Notifications</span>
        <h4>{meta.title}</h4>
        <p>{meta.description}</p>
      </div>
      <div className="notification-permission-card-actions">
        <span className={`notification-summary-chip notification-summary-chip-${meta.tone}`}>{meta.badge}</span>
        {status === 'granted' && onTestNotification ? (
          <ActionButton
            type="button"
            tone="secondary"
            onClick={onTestNotification}
            disabled={testingNotification}
          >
            {testingNotification ? 'Sending test…' : 'Send Test Notification'}
          </ActionButton>
        ) : null}
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
          <h3>Allow DwarPal push notifications?</h3>
          <p>Get app-like alerts for approvals, rejections, forwarded requests, and important gate verification activity.</p>
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
