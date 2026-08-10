/**
 * SkeletonLoader — Shimmer skeleton components for loading states.
 * Used everywhere a component has an isLoading / loading prop.
 * All styles come from App.css .dp-skeleton* classes.
 */

/** Single text line skeleton */
export function SkeletonText({ className = '' }) {
  return <div className={`dp-skeleton dp-skeleton-text ${className}`} aria-hidden="true" />
}

/** Avatar circle skeleton */
export function SkeletonAvatar() {
  return <div className="dp-skeleton dp-skeleton-avatar" aria-hidden="true" />
}

/** Full card skeleton — matches SummaryCard height */
export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="dp-skeleton-card" aria-busy="true" aria-label="Loading...">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div className="dp-skeleton" style={{ width: '2.4rem', height: '2.4rem', borderRadius: '10px' }} aria-hidden="true" />
        <div style={{ flex: 1, display: 'grid', gap: '0.45rem' }}>
          <SkeletonText />
          <SkeletonText className="sm" style={{ width: '60%' }} />
        </div>
      </div>
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <SkeletonText key={i} style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}

/** Table row skeleton — matches admin-table row layout */
export function SkeletonTableRows({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          <td style={{ padding: '0.65rem' }}>
            <div className="dp-skeleton dp-skeleton-avatar" style={{ width: '1.6rem', height: '1.6rem' }} />
          </td>
          <td style={{ padding: '0.65rem' }}>
            <SkeletonText />
          </td>
          <td style={{ padding: '0.65rem' }}>
            <SkeletonText style={{ width: '75%' }} />
          </td>
          <td style={{ padding: '0.65rem' }}>
            <SkeletonText style={{ width: '55%' }} />
          </td>
          <td style={{ padding: '0.65rem' }}>
            <div className="dp-skeleton" style={{ width: '4.5rem', height: '1.5rem', borderRadius: '999px' }} />
          </td>
        </tr>
      ))}
    </>
  )
}

/** Notification item skeleton */
export function SkeletonNotificationItem() {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem', padding: '0.85rem 0', borderBottom: '1px solid var(--line)' }}
      aria-hidden="true"
    >
      <div className="dp-skeleton dp-skeleton-avatar" style={{ width: '0.6rem', height: '0.6rem', borderRadius: '999px', marginTop: '0.35rem' }} />
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <SkeletonText className="sm" style={{ width: '40%' }} />
        <SkeletonText />
        <SkeletonText style={{ width: '72%' }} />
        <SkeletonText className="sm" style={{ width: '30%' }} />
      </div>
    </div>
  )
}

/** Generic list of notification skeletons */
export function SkeletonNotificationList({ count = 4 }) {
  return (
    <div aria-busy="true" aria-label="Loading notifications...">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonNotificationItem key={i} />
      ))}
    </div>
  )
}

/** Gatepass card skeleton */
export function SkeletonGatepassCard() {
  return (
    <div className="dp-skeleton-card" aria-busy="true" aria-label="Loading gatepass...">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
          <SkeletonText className="sm" style={{ width: '30%' }} />
          <SkeletonText className="lg" style={{ width: '80%' }} />
          <SkeletonText style={{ width: '55%' }} />
        </div>
        <div className="dp-skeleton" style={{ width: '4.5rem', height: '1.6rem', borderRadius: '999px' }} />
      </div>
      <div className="dp-skeleton" style={{ height: '6rem', borderRadius: '16px' }} />
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <SkeletonText className="sm" style={{ width: '45%' }} />
        <SkeletonText className="sm" style={{ width: '60%' }} />
      </div>
    </div>
  )
}
