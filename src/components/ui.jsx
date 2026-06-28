import { memo } from 'react'
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  LogOut,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react'
import { ROLE_META, STATUS_COLORS, formatSemesterLabel } from '../mockData'
import AppBrand from './AppBrand'

export function DashboardHeaderBranding({
  logo,
  appName = 'DwarPal',
  roleName,
  dashboardTitle,
  subtitle,
}) {
  return (
    <div className="dashboard-header-branding">
      <div className="dashboard-header-brand">
        <AppBrand size="lg" logo={logo} appName={appName} align="start" />
      </div>
      <div className="dashboard-header-branding-meta dashboard-header-context">
        {roleName ? <p className="dashboard-header-role">{roleName}</p> : null}
        {dashboardTitle ? <h1 className="dashboard-header-title">{dashboardTitle}</h1> : null}
        {subtitle ? <p className="dashboard-header-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`status-badge ${STATUS_COLORS[status] || 'pending'}`}>{status}</span>
}

export function ActionButton({
  children,
  tone = 'primary',
  icon: Icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={['action-button', tone, className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {Icon ? <Icon size={16} /> : null}
      <span>{children}</span>
    </button>
  )
}

export function SummaryCard({ label, value, trend, icon: Icon, tone = 'default' }) {
  return (
    <article className={`summary-card ${tone}`}>
      <div className="summary-icon">{Icon ? <Icon size={18} /> : <Sparkles size={18} />}</div>
      <div className="summary-copy">
        <p>{label}</p>
        <h3>{value}</h3>
        {trend ? <span>{trend}</span> : null}
      </div>
    </article>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search by name, ID, department, status' }) {
  return (
    <label className="search-bar">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

export function SelectField({
  children,
  className = '',
  containerClassName = '',
  iconClassName = '',
  ...props
}) {
  return (
    <div className={['select-field', containerClassName].filter(Boolean).join(' ')}>
      <select className={['select-input', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
      <div className={['select-field-icon', iconClassName].filter(Boolean).join(' ')} aria-hidden="true">
        <ChevronDown size={18} strokeWidth={2} />
      </div>
    </div>
  )
}

export function FilterTabs({ value, onChange, options }) {
  return (
    <div className="filter-tabs">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`filter-tab ${value === option ? 'active' : ''}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <QrCode size={22} />
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

export function Sidebar({
  currentUser,
  currentPage,
  onNavigate,
  onLogout,
  open,
  onClose,
  notificationCount = 0,
  onOpenSupport = null,
}) {
  const navItems = getNavItems(currentUser, notificationCount)

  function handleNavigate(page) {
    onNavigate(page)
    onClose()
  }

  function handleLogout() {
    onClose()
    onLogout()
  }

  return (
    <>
      <button
        type="button"
        className={`drawer-overlay ${open ? 'open' : ''}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`sidebar drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <AppBrand size="md" align="start" />
          <button type="button" className="icon-button drawer-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-role" style={{ '--role-accent': ROLE_META[currentUser.role].accent }}>
          <span>{ROLE_META[currentUser.role].shortTitle}</span>
          <p>{[currentUser.program, currentUser.department].filter(Boolean).join(' | ') || 'Not assigned'}</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => handleNavigate(item.key)}
            >
              <item.icon size={18} />
              <span className="nav-link-label">{item.label}</span>
              {item.badge ? <span className="nav-link-badge">{formatNavBadge(item.badge)}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button type="button" className="action-button secondary sidebar-support-button" style={{ flex: 1 }} onClick={() => handleNavigate('support')}>
              <CircleHelp size={17} />
              <span>Help</span>
            </button>
            <button type="button" className="action-button secondary sidebar-support-button" style={{ flex: 1 }} onClick={() => handleNavigate('privacy')}>
              <ShieldCheck size={17} />
              <span>Privacy</span>
            </button>
          </div>
          <button type="button" className="action-button danger sidebar-logout-button" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export function Topbar({
  currentUser,
  title,
  subtitle,
  onToggleNav,
  navOpen,
  actions = null,
}) {
  const showDashboardCopy = Boolean(title || subtitle)

  return (
    <header className={`topbar ${showDashboardCopy ? '' : 'compact'}`}>
      <div className="topbar-copy">
        <div className="topbar-leading">
          <button
            type="button"
            className={`icon-button hamburger-button ${navOpen ? 'active' : ''}`}
            onClick={onToggleNav}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
          {showDashboardCopy ? (
            <DashboardHeaderBranding
              roleName={ROLE_META[currentUser.role].title}
              dashboardTitle={title}
              subtitle={subtitle}
            />
          ) : (
            <div className="topbar-brand-wrap">
              <AppBrand size="md" align="start" />
            </div>
          )}
        </div>
      </div>
      {actions ? <div className="topbar-actions">{actions}</div> : null}
    </header>
  )
}

export function IdentityField({ label, value, className = '', valueOnly = false }) {
  const resolvedValue =
    typeof value === 'string' ? (value.trim() ? value.trim() : 'Not provided') : value ?? 'Not provided'

  return (
    <div className={['identity-field', valueOnly ? 'value-only' : '', className].filter(Boolean).join(' ')}>
      {valueOnly ? null : <span className="identity-label">{label}</span>}
      {valueOnly ? null : <span className="identity-separator">:</span>}
      <strong className={`identity-value ${valueOnly ? 'standalone' : ''}`.trim()}>{resolvedValue}</strong>
    </div>
  )
}

export function ProfileCard({ currentUser, onLogout, children = null }) {
  const primaryId = currentUser.enrollment || currentUser.employeeId
  return (
    <section className="profile-card">
      <div className="profile-banner">
        <div className="profile-avatar">
          <UserCircle2 size={48} />
        </div>
        <div className="profile-banner-copy">
          <h2>{currentUser.name}</h2>
          <div className="profile-meta-pills">
            <span className="profile-meta-pill">{ROLE_META[currentUser.role].title}</span>
            {primaryId ? <span className="profile-meta-pill accent">{primaryId}</span> : null}
          </div>
        </div>
      </div>
      <div className="profile-grid">
        <ProfileField label="Department" value={currentUser.department} />
        {currentUser.program ? <ProfileField label="Program" value={currentUser.program} /> : null}
        <ProfileField label="Mobile" value={currentUser.phone} />
        <ProfileField label="Email" value={currentUser.email} />
        {currentUser.role === 'student' ? (
          <ProfileField label="Semester" value={formatSemesterLabel(currentUser.semester) || 'Semester not assigned'} />
        ) : null}
        {primaryId ? <IdentityField className="profile-field profile-field-id" value={primaryId} valueOnly /> : null}
      </div>
      {children}
      <ActionButton tone="danger" icon={LogOut} onClick={onLogout}>
        Logout
      </ActionButton>
    </section>
  )
}

function ProfileField({ label, value }) {
  return <IdentityField className="profile-field" label={label} value={value} />
}

export const GatepassCard = memo(function GatepassCard({
  gatepass,
  currentUserRole,
  actions,
  compact = false,
  highlighted = false,
  onOpenQrPreview,
}) {
  const isUserPanel = currentUserRole === 'student' || currentUserRole === 'faculty'
  const isFacultyLeave = gatepass.requestKind === 'faculty_leave'
  const displayGatepassId = gatepass.gatepassId || gatepass.requestNumber || gatepass.id
  const showQrPreview =
    gatepass.qr?.available &&
    gatepass.qr?.imageDataUrl &&
    (isUserPanel || compact)
  const dateRange = isFacultyLeave
    ? [formatDateOnly(gatepass.leaveFrom), formatDateOnly(gatepass.leaveTo)].filter(Boolean).join(' to ')
    : ''
  const shortLeaveWindow =
    isFacultyLeave && gatepass.shortLeaveDate
      ? `${formatDateOnly(gatepass.shortLeaveDate)} - ${gatepass.shortLeaveStartTime} to ${gatepass.shortLeaveEndTime}`
      : ''
  const cardEyebrow = gatepass.requesterType === 'student' ? 'Student Gatepass' : 'Faculty Gatepass'

  function handleOpenQrPreview() {
    if (!showQrPreview || !onOpenQrPreview) return
    onOpenQrPreview(gatepass)
  }

  return (
    <article
      className={`gatepass-card ${compact ? 'compact' : ''}${highlighted ? ' highlighted' : ''}`}
      data-reference-id={String(displayGatepassId || '').trim().toUpperCase()}
    >
      <div className="gatepass-brand">
        <AppBrand size="md" align="start" />
      </div>
      <div className="gatepass-card-header">
        <div>
          <p className="eyebrow">{cardEyebrow}</p>
          <h3>{gatepass.reason}</h3>
          <p className="gatepass-identifier">
            <span>Gatepass ID:</span>
            <strong>{displayGatepassId}</strong>
          </p>
          <span>
            {isFacultyLeave
              ? `${gatepass.name} | ${gatepass.enrollment} | ${gatepass.leaveType || 'Leave'}`
              : `${gatepass.name} | ${gatepass.enrollment}`}
          </span>
        </div>
        <StatusBadge status={gatepass.status} />
      </div>

      <div className="qr-pass">
        {showQrPreview ? (
          <button
            type="button"
            className="qr-image-button"
            onClick={handleOpenQrPreview}
            aria-label={`Open QR code for ${displayGatepassId}`}
          >
            <div className="qr-image-shell">
              <img
                src={gatepass.qr.imageDataUrl}
                alt={`QR code for ${displayGatepassId}`}
                className="qr-image"
                decoding="async"
              />
            </div>
          </button>
        ) : (
          <div className="qr-pattern" />
        )}
        <div className="qr-copy">
          {isFacultyLeave ? (
            <>
              <p>{`${gatepass.leaveType || 'Leave'} - ${gatepass.totalDays || 0} day(s)`}</p>
              <strong>{dateRange || 'Dates pending'}</strong>
              <span>
                {shortLeaveWindow
                  ? `${shortLeaveWindow}${gatepass.shortLeaveDurationLabel ? ` - ${gatepass.shortLeaveDurationLabel}` : ''}`
                  : gatepass.shortLeaveStage}
              </span>
              {showQrPreview ? <span>Tap to open secure QR</span> : null}
            </>
          ) : (
            <>
              <p>{gatepass.department}</p>
              <strong>{formatDateTime(gatepass.outTime)}</strong>
              <span>{gatepass.expectedReturnTime ? `Back by ${formatDateTime(gatepass.expectedReturnTime)}` : 'One way'}</span>
              {showQrPreview ? <span>Tap to open secure QR</span> : null}
            </>
          )}
        </div>
      </div>

      <div className="gatepass-meta">
        <span>
          <Clock3 size={14} />
          Submitted {formatDateTime(gatepass.submittedAt)}
        </span>
        {isFacultyLeave ? (
          <>
            <span>
              <ShieldCheck size={14} />
              {gatepass.workloadStage}
            </span>
            <span>
              <ShieldCheck size={14} />
              {gatepass.shortLeaveStage}
            </span>
          </>
        ) : (
          <span>
            <ShieldCheck size={14} />
            {gatepass.requesterType === 'student' ? 'Student workflow' : 'Faculty workflow'}
          </span>
        )}
      </div>

      <div className="timeline">
        {gatepass.timeline.map((item, index) => (
          <div key={`${displayGatepassId}-${index}`} className={`timeline-item ${item.tone}`}>
            <div className="timeline-dot">{item.tone === 'done' ? <Check size={11} /> : null}</div>
            <div>
              <strong>{item.label}</strong>
              <p>{item.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="gatepass-footer">
        <div className="gatepass-tags">
          {!isUserPanel && <span className="tag">{gatepass.requesterType}</span>}
          {gatepass.program ? <span className="tag">{gatepass.program}</span> : null}
          <span className="tag">{gatepass.department}</span>
          {isFacultyLeave ? (
            <>
              {gatepass.designation ? <span className="tag">{gatepass.designation}</span> : null}
              {gatepass.shortLeaveDurationLabel ? <span className="tag">{gatepass.shortLeaveDurationLabel}</span> : null}
            </>
          ) : gatepass.vehicleNumber ? (
            <span className="tag">{`Vehicle ${gatepass.vehicleNumber}`}</span>
          ) : null}
        </div>
        {actions?.length ? (
          <div className="card-actions">
            {actions.map((action) => (
              <ActionButton key={action.label} tone={action.tone} onClick={action.onClick}>
                {action.label}
              </ActionButton>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
})

GatepassCard.displayName = 'GatepassCard'

export function ModalForm({
  open,
  title,
  subtitle,
  children,
  onClose,
  className = '',
  backdropClassName = '',
  closeOnBackdrop = true,
  showCloseButton = true,
}) {
  if (!open) return null
  return (
    <div
      className={['modal-backdrop', backdropClassName].filter(Boolean).join(' ')}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={['modal-card', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          {showCloseButton ? (
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}

export function formatDateTime(value) {
  if (!value) return 'Awaiting action'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDateOnly(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function formatNavBadge(value) {
  if (!value) return ''
  return value > 99 ? '99+' : String(value)
}

function hasAdminPortalAccess(currentUser) {
  const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : []
  return (
    ['principal', 'hod', 'cao', 'security'].includes(currentUser?.role) ||
    Boolean(currentUser?.isCoordinator || currentUser?.coordinatorAssignment?.isCoordinator || currentUser?.coordinatorScope?.isCoordinator) ||
    permissions.includes('admin:access') ||
    permissions.includes('admin:*')
  )
}

function getNavItems(currentUser, notificationCount = 0) {
  const role = typeof currentUser === 'string' ? currentUser : currentUser?.role
  const base = [
    { key: 'dashboard', label: 'Dashboard', icon: Sparkles },
    { key: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
    { key: 'profile', label: 'Profile', icon: UserCircle2 },
  ]

  if (typeof currentUser === 'object' && hasAdminPortalAccess(currentUser)) {
    base.push({ key: 'admin-portal', label: 'Admin Portal', icon: ShieldCheck })
  }

  if (role === 'student' || role === 'faculty') {
    return base
  }

  return base
}
