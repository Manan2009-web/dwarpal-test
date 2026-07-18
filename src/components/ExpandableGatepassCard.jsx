import { memo } from 'react'
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
    return 'Faculty Leave'
  }

  if (gatepass?.requesterType === 'faculty') {
    return 'Faculty Gatepass'
  }

  return 'Student Gatepass'
}

function getRequesterRoleLabel(gatepass) {
  if (gatepass?.requestKind === 'faculty_leave') {
    return 'Faculty'
  }

  return gatepass?.requesterType === 'faculty' ? 'Faculty' : 'Student'
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
      value: `${gatepass?.name || 'Not provided'}${gatepass?.enrollment ? ` • ${gatepass.enrollment}` : ''}`,
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
    { label: 'Enrollment / Employee ID', value: gatepass?.enrollment || 'Not provided' },
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
}) {
  const summaryItems = buildSummaryItems(gatepass, currentUserRole)
  const detailItems = buildDetailItems(gatepass, currentUserRole)
  const displayGatepassId = getGatepassIdentifier(gatepass)
  const requestTypeLabel = getRequestTypeLabel(gatepass)
  const showQrPreview = Boolean(gatepass?.qr?.available && onOpenQrPreview)
  const showRequesterMeta = currentUserRole !== 'student' && currentUserRole !== 'faculty'
  const reviewerRole = ROLE_META[currentUserRole]?.title || humanizeLabel(currentUserRole, 'User')

  return (
    <article
      className={`expandable-gatepass-card${expanded ? ' expanded' : ''}${highlighted ? ' highlighted' : ''}`}
      data-reference-id={String(displayGatepassId || '').trim().toUpperCase()}
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
            <span className={`expandable-gatepass-chevron${expanded ? ' expanded' : ''}`} aria-hidden="true">
              <ChevronDown size={18} />
            </span>
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

      <div className={`expandable-gatepass-details-shell${expanded ? ' expanded' : ''}`}>
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
      </div>
    </article>
  )
})

ExpandableGatepassCard.displayName = 'ExpandableGatepassCard'

export default ExpandableGatepassCard
