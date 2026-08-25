import { memo, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  Clock3,
  QrCode,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ROLE_META } from '../mockData'
import { ActionButton, StatusBadge, formatDateTime } from './ui'

function humanizeLabel(value, fallback = 'Not available') {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return fallback
  }

  return normalizedValue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatOptionalDateTime(value, fallback = 'Not scheduled') {
  return value ? formatDateTime(value) : fallback
}

function truncateText(value, limit = 90) {
  const normalizedValue = String(value || '').trim()

  if (normalizedValue.length <= limit) {
    return normalizedValue || 'No reason provided'
  }

  return `${normalizedValue.slice(0, limit).trimEnd()}...`
}

function getGatepassIdentifier(gatepass) {
  return gatepass?.gatepassId || gatepass?.requestNumber || gatepass?.id || 'Not available'
}

function getRequestTypeLabel(gatepass) {
  if (gatepass?.requestKind === 'faculty_leave') {
    return 'Professor Leave'
  }

  if (gatepass?.requesterType === 'faculty') {
    return 'Professor Gatepass'
  }

  return 'Student Gatepass'
}

function getRequesterRoleLabel(gatepass) {
  if (gatepass?.requestKind === 'faculty_leave') {
    return 'Professor'
  }

  return gatepass?.requesterType === 'faculty' ? 'Professor' : 'Student'
}

function getWorkflowSummary(gatepass) {
  if (!gatepass) {
    return 'Workflow not available'
  }

  if (gatepass.requestKind === 'faculty_leave') {
    return [gatepass.leaveType || 'Leave', gatepass.workloadStage, gatepass.shortLeaveStage]
      .filter(Boolean)
      .join(' | ')
  }

  return [humanizeLabel(gatepass.stage, ''), humanizeLabel(gatepass.rawApprovalLevel, '')]
    .filter(Boolean)
    .join(' | ') || `${getRequesterRoleLabel(gatepass)} workflow`
}

function getMovementSummary(gatepass) {
  if (gatepass?.security?.checkedInAt) {
    return `Returned at ${formatDateTime(gatepass.security.checkedInAt)}`
  }

  if (gatepass?.security?.checkedOutAt) {
    return `Out since ${formatDateTime(gatepass.security.checkedOutAt)}`
  }

  if (gatepass?.expectedReturnTime) {
    return `Back by ${formatDateTime(gatepass.expectedReturnTime)}`
  }

  if (gatepass?.outTime) {
    return `Out at ${formatDateTime(gatepass.outTime)}`
  }

  return 'One way / pending return'
}

function buildSummaryItems(gatepass, currentUserRole) {
  const isRequesterView = currentUserRole === 'student' || currentUserRole === 'faculty'

  const items = [
    { label: 'Gatepass ID', value: getGatepassIdentifier(gatepass) },
    { label: 'Date', value: formatOptionalDateTime(gatepass?.submittedAt, 'Not created yet') },
    { label: 'Movement', value: getMovementSummary(gatepass) },
    { label: 'Workflow', value: getWorkflowSummary(gatepass) },
  ]

  if (!isRequesterView) {
    items.splice(1, 0, {
      label: 'Requester',
      value: `${gatepass?.name || 'Not provided'}${gatepass?.enrollment ? ` • ${gatepass.enrollment}` : ''}${gatepass?.isTemporaryEnrollment ? ' (New Student)' : ''}`,
    })
  }

  return items
}

function buildDetailItems(gatepass, currentUserRole) {
  const isRequesterView = currentUserRole === 'student' || currentUserRole === 'faculty'

  return [
    { label: 'Gatepass ID', value: getGatepassIdentifier(gatepass) },
    { label: 'Request type', value: getRequestTypeLabel(gatepass) },
    { label: 'Status', value: gatepass?.status || 'Pending' },
    { label: 'Workflow stage', value: getWorkflowSummary(gatepass) },
    { label: isRequesterView ? 'Name' : 'Requester name', value: gatepass?.name || 'Not provided' },
    { label: 'Role', value: getRequesterRoleLabel(gatepass) },
    { label: 'Enrollment / Employee ID', value: `${gatepass?.enrollment || 'Not provided'}${gatepass?.isTemporaryEnrollment ? ' (Temporary / New Student)' : ''}` },
    { label: 'Department', value: gatepass?.department || 'Not provided' },
    {
      label: gatepass?.requestKind === 'faculty_leave' ? 'Designation / Program' : 'Program',
      value: gatepass?.program || gatepass?.designation || 'Not provided',
    },
    { label: 'Created', value: formatOptionalDateTime(gatepass?.submittedAt) },
    { label: 'Updated', value: formatOptionalDateTime(gatepass?.updatedAt) },
    { label: 'Out time', value: formatOptionalDateTime(gatepass?.outTime) },
    {
      label: 'Return time',
      value: gatepass?.expectedReturnTime ? formatDateTime(gatepass.expectedReturnTime) : 'One way',
    },
    { label: 'Vehicle number', value: gatepass?.vehicleNumber || 'Not provided' },
    { label: 'Destination', value: gatepass?.destination || gatepass?.instituteName || 'Not provided' },
    { label: 'Approval handled by', value: gatepass?.approvedBy || 'Awaiting approval' },
    { label: 'Marked OUT', value: formatOptionalDateTime(gatepass?.security?.checkedOutAt) },
    { label: 'Marked Returned', value: formatOptionalDateTime(gatepass?.security?.checkedInAt) },
    { label: 'Rejection reason', value: gatepass?.rejectionReason || 'Not applicable' },
  ]
}

function DetailItem({ label, value }) {
  return (
    <div className="gatepass-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const ExpandableGatepassCard = memo(function ExpandableGatepassCard({
  gatepass,
  currentUserRole,
  actions = [],
  expanded = false,
  highlighted = false,
  onOpenQrPreview,
  onToggle,
  style,
}) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const raw = gatepass.rawStatus || gatepass.status
    const isEscalatable = [
      'pending_principal',
      'forwarded_to_hod',
      'forwarded_to_coordinator',
      'forwarded_to_campus_security'
    ].includes(raw)

    if (!isEscalatable || !gatepass.updatedAt) {
      setTimeLeft('')
      return
    }

    const interval = setInterval(() => {
      const updatedAtTime = new Date(gatepass.updatedAt).getTime()
      const limitMs = raw === 'forwarded_to_campus_security' ? 5 * 60 * 1000 : 2 * 60 * 1000
      const elapsed = Date.now() - updatedAtTime
      const remaining = limitMs - elapsed

      if (remaining <= 0) {
        setTimeLeft('Forwarded')
        clearInterval(interval)
      } else {
        const secs = Math.floor(remaining / 1000)
        const mins = Math.floor(secs / 60)
        const displaySecs = String(secs % 60).padStart(2, '0')
        const nextVal = `${mins}:${displaySecs}`
        setTimeLeft((prev) => (prev === nextVal ? prev : nextVal))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gatepass.rawStatus, gatepass.status, gatepass.updatedAt])

  const summaryItems = buildSummaryItems(gatepass, currentUserRole)
  const detailItems = buildDetailItems(gatepass, currentUserRole)
  const displayGatepassId = getGatepassIdentifier(gatepass)
  const requestTypeLabel = getRequestTypeLabel(gatepass)
  const showQrPreview = Boolean(gatepass?.qr?.available && onOpenQrPreview)
  const showRequesterMeta = currentUserRole !== 'student' && currentUserRole !== 'faculty'
  const reviewerRole = ROLE_META[currentUserRole]?.title || humanizeLabel(currentUserRole, 'User')

  return (
    <motion.article
      className={`expandable-gatepass-card${expanded ? ' expanded' : ''}${highlighted ? ' highlighted' : ''}`}
      data-reference-id={String(displayGatepassId || '').trim().toUpperCase()}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      <button
        type="button"
        className="expandable-gatepass-summary"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="expandable-gatepass-summary-head">
          <div className="expandable-gatepass-copy">
            <div className="expandable-gatepass-badges">
              <span className="gatepass-request-chip">{requestTypeLabel}</span>
              <span className="gatepass-request-chip subtle">{reviewerRole} view</span>
              {gatepass?.isTemporaryEnrollment && (
                <span className="gatepass-request-chip" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b' }}>New Student</span>
              )}
              {timeLeft && (
                <span className="gatepass-request-chip timer-chip">
                  ⌛ {timeLeft}
                </span>
              )}
            </div>
            <h3>{truncateText(gatepass?.reason, 96)}</h3>
            <p className="expandable-gatepass-subtitle">
              {showRequesterMeta
                ? `${gatepass?.name || 'Unknown requester'}${gatepass?.department ? ` • ${gatepass.department}` : ''}${gatepass?.program ? ` • ${gatepass.program}` : ''}`
                : `${displayGatepassId}${gatepass?.department ? ` • ${gatepass.department}` : ''}`}
            </p>
          </div>

          <div className="expandable-gatepass-status">
            {currentUserRole === 'student' && gatepass.status === 'Approved' && gatepass.qr?.available ? (
              <button
                type="button"
                className="header-show-qr-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenQrPreview?.(gatepass)
                }}
              >
                <QrCode size={13} />
                <span>Show QR</span>
              </button>
            ) : null}
            <StatusBadge status={gatepass?.status} />
            {/* Animated chevron — rotates 180deg on expand */}
            <motion.span
              className={`expandable-gatepass-chevron${expanded ? ' expanded' : ''}`}
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            >
              <ChevronDown size={18} />
            </motion.span>
          </div>
        </div>

        <div className="expandable-gatepass-summary-grid">
          {summaryItems.map((item) => (
            <div key={`${displayGatepassId}-${item.label}`} className="gatepass-summary-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </button>

      {/* AnimatePresence height animation for the expandable details panel */}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expandable-details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="expandable-gatepass-details">
              <div className="expandable-gatepass-section">
                <div className="expandable-gatepass-section-head">
                  <div>
                    <span className="eyebrow">Full details</span>
                    <h4>{displayGatepassId}</h4>
                  </div>
                  <div className="expandable-gatepass-quick-facts">
                    <span>
                      <Clock3 size={14} />
                      {formatOptionalDateTime(gatepass?.submittedAt, 'Not created yet')}
                    </span>
                    <span>
                      <ShieldCheck size={14} />
                      {getWorkflowSummary(gatepass)}
                    </span>
                    <span>
                      <UserRound size={14} />
                      {getRequesterRoleLabel(gatepass)}
                    </span>
                  </div>
                </div>

                <div className="expandable-gatepass-reason">
                  <span>Reason</span>
                  <p>{gatepass?.reason || 'No reason provided.'}</p>
                </div>

                <div className="expandable-gatepass-detail-grid">
                  {detailItems.map((item) => (
                    <DetailItem key={`${displayGatepassId}-${item.label}`} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>

              {Array.isArray(gatepass?.timeline) && gatepass.timeline.length ? (
                <div className="expandable-gatepass-section">
                  <div className="expandable-gatepass-section-head compact">
                    <div>
                      <span className="eyebrow">Timeline</span>
                      <h4>Approval and movement history</h4>
                    </div>
                  </div>

                  <div className="expandable-gatepass-timeline">
                    {gatepass.timeline.map((item, index) => (
                      <div key={`${displayGatepassId}-timeline-${index}`} className={`timeline-item ${item.tone || 'upcoming'}`}>
                        <div className="timeline-dot">{item.tone === 'done' ? <Check size={11} /> : null}</div>
                        <div className="timeline-copy">
                          <strong>{item.label}</strong>
                          <p>{item.note}</p>
                          {item.at ? <span>{formatDateTime(item.at)}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {showQrPreview || actions.length ? (
                <div className="expandable-gatepass-actions">
                  {showQrPreview ? (
                    <ActionButton type="button" tone="secondary" icon={QrCode} onClick={() => onOpenQrPreview?.(gatepass)}>
                      View QR
                    </ActionButton>
                  ) : null}
                  {actions.map((action) => (
                    <ActionButton key={`${displayGatepassId}-${action.label}`} tone={action.tone} onClick={action.onClick}>
                      {action.label}
                    </ActionButton>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  )
})

ExpandableGatepassCard.displayName = 'ExpandableGatepassCard'

export default ExpandableGatepassCard
