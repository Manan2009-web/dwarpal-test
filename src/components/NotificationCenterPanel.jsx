/**
 * NotificationCenterPanel — Redesigned with AnimatePresence slide-in,
 * staggered notification items, ping dot animation, and skeleton loading state.
 * Prop signature unchanged.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck } from 'lucide-react'
import {
  formatNotificationTimestamp,
  getNotificationDisplayStatus,
  getNotificationKicker,
  getNotificationSurfaceTone,
} from '../lib/notificationPresentation'
import { StatusBadge } from './ui'
import { SkeletonNotificationList } from './ui/SkeletonLoader'

const PANEL_SPRING = { type: 'spring', stiffness: 340, damping: 30 }
const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.055, duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  }),
}

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
          <motion.button
            type="button"
            className="text-button"
            onClick={onMarkAllRead}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <CheckCheck size={16} />
            <span>Mark all read</span>
          </motion.button>
        ) : null}
      </div>

      <div className="notification-panel-summary">
        <span className="notification-summary-chip">{`Unread ${unreadCount}`}</span>
        <span className={`notification-summary-chip ${unreadCount ? 'attention' : 'calm'}`}>
          {socketConnected ? 'Realtime on' : 'History only'}
        </span>
      </div>

      {loading && !recentNotifications.length ? (
        <div className="notification-panel-list">
          <SkeletonNotificationList count={4} />
        </div>
      ) : recentNotifications.length ? (
        <div className="notification-panel-list">
          <AnimatePresence initial={false}>
            {recentNotifications.map((notification, i) => {
              const displayStatus = getNotificationDisplayStatus(notification)

              return (
                <motion.article
                  key={notification.id}
                  custom={i}
                  variants={ITEM_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
                  className={`notification-item notification-${getNotificationSurfaceTone(notification)}${
                    notification.isRead ? ' read' : ''
                  }`}
                >
                  {/* Ping dot — CSS handles animation and .read state */}
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
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          className="notification-empty-state"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Bell size={18} />
          <p>No notifications yet. New gatepass workflow updates will appear here automatically.</p>
        </motion.div>
      )}
    </div>
  )
}
