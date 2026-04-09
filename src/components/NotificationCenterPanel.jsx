import { Bell, CheckCheck } from 'lucide-react'
import {
  formatNotificationTimestamp,
  getNotificationDisplayStatus,
  getNotificationKicker,
  getNotificationSurfaceTone,
} from '../lib/notificationPresentation'
import { StatusBadge } from './ui'

export default function NotificationCenterPanel({
  open,
  notifications,
  unreadCount,
  loading,
  socketConnected,
  onOpenNotification,
  onMarkNotificationRead,
  onMarkAllRead,
}) {
  const recentNotifications = notifications.slice(0, 6)

  return (
    <div className={`notification-panel ${open ? 'open' : ''}`} role="dialog" aria-label="Notification center">
      <div className="notification-panel-header">
        <div>
          <span className="eyebrow">Notifications</span>
          <h3>Realtime updates</h3>
          <p>{socketConnected ? 'Live sync connected' : 'Syncing from saved history'}</p>
        </div>
        {unreadCount ? (
          <button type="button" className="text-button" onClick={onMarkAllRead}>
            <CheckCheck size={16} />
            <span>Mark all read</span>
          </button>
        ) : null}
      </div>

      <div className="notification-panel-summary">
        <span className="notification-summary-chip">{`Unread ${unreadCount}`}</span>
        <span className={`notification-summary-chip ${unreadCount ? 'attention' : 'calm'}`}>
          {socketConnected ? 'Realtime on' : 'History only'}
        </span>
      </div>

      {loading && !recentNotifications.length ? (
        <p className="notification-empty">Loading your notification history...</p>
      ) : recentNotifications.length ? (
        <div className="notification-panel-list">
          {recentNotifications.map((notification) => {
            const displayStatus = getNotificationDisplayStatus(notification)

            return (
              <article
                key={notification.id}
                className={`notification-item notification-${getNotificationSurfaceTone(notification)}${
                  notification.isRead ? ' read' : ''
                }`}
              >
                <div className={`notification-ping${notification.isRead ? ' read' : ''}`} />
                <div className="notification-item-main">
                  <button
                    type="button"
                    className="notification-item-open"
                    onClick={() => onOpenNotification(notification)}
                  >
                    <div className="notification-page-item-copy">
                      <span className="eyebrow">{getNotificationKicker(notification)}</span>
                      <strong>{notification.title}</strong>
                    </div>
                    <p>{notification.message}</p>
                    <div className="notification-item-meta-row">
                      <span>{notification.referenceId}</span>
                      <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                    </div>
                  </button>
                  <div className="notification-item-actions">
                    <StatusBadge status={displayStatus} />
                    {!notification.isRead ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onMarkNotificationRead(notification.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="notification-empty-state">
          <Bell size={18} />
          <p>No notifications yet. New gatepass workflow updates will appear here automatically.</p>
        </div>
      )}
    </div>
  )
}
