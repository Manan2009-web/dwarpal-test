import { memo, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

// ---------------------------------------------------------------------------
// Framer Motion spring presets
// ---------------------------------------------------------------------------
const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 30 }
const SPRING_GENTLE = { type: 'spring', stiffness: 300, damping: 28 }

// ---------------------------------------------------------------------------
// DashboardHeaderBranding
// ---------------------------------------------------------------------------
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
        {roleName ? (
          <p className="dashboard-header-role" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-accent)' }}>
            {roleName}
          </p>
        ) : null}
        {dashboardTitle ? <h1 className="dashboard-header-title">{dashboardTitle}</h1> : null}
        {subtitle ? <p className="dashboard-header-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusBadge — dot prefix + improved spacing (CSS handles the ::before dot)
// ---------------------------------------------------------------------------
export function StatusBadge({ status }) {
  return <span className={`status-badge ${STATUS_COLORS[status] || 'pending'}`}>{status}</span>
}

// ---------------------------------------------------------------------------
// ActionButton — shimmer on primary hover (CSS handles ::before shimmer)
// ---------------------------------------------------------------------------
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
    <motion.button
      type={type}
      className={['action-button', tone, className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={SPRING_SNAPPY}
      {...props}
    >
      {Icon ? <Icon size={16} /> : null}
      <span>{children}</span>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// SummaryCard — hover lift + left-accent line + whileInView stagger (CSS hover)
// ---------------------------------------------------------------------------
export function SummaryCard({ label, value, trend, icon: Icon, tone = 'default' }) {
  return (
    <motion.article
      className={`summary-card ${tone}`}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="summary-icon">{Icon ? <Icon size={18} /> : <Sparkles size={18} />}</div>
      <div className="summary-copy">
        <p>{label}</p>
        <h3>{value}</h3>
        {trend ? <span>{trend}</span> : null}
      </div>
    </motion.article>
  )
}

// ---------------------------------------------------------------------------
// SearchBar — animated focus ring (CSS handles the :focus-within ring)
// ---------------------------------------------------------------------------
export function SearchBar({ value, onChange, placeholder = 'Search by name, ID, department, status' }) {
  return (
    <label className="search-bar">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

// ---------------------------------------------------------------------------
// SelectField — animated chevron rotate (CSS handles the :focus-within rotate)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FilterTabs — Framer Motion layoutId sliding pill indicator
// ---------------------------------------------------------------------------
export function FilterTabs({ value, onChange, options }) {
  return (
    <div className="filter-tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={`filter-tab ${value === option ? 'active' : ''}`}
          onClick={() => onChange(option)}
          style={{ position: 'relative' }}
        >
          {option}
          {value === option ? (
            <motion.span
              layoutId="filter-tab-indicator"
              className="filter-tab-indicator"
              style={{ position: 'absolute', bottom: '-1px', left: '20%', right: '20%', height: '2px' }}
              transition={SPRING_GENTLE}
            />
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState — floating icon + dashed border (CSS handles both)
// ---------------------------------------------------------------------------
export function EmptyState({ title, description, action }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="empty-icon">
        <QrCode size={22} />
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — layoutId nav indicator + icon scale (CSS handles icon hover)
// ---------------------------------------------------------------------------
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

  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }
    }
    return undefined
  }, [open])

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
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => handleNavigate(item.key)}
              aria-current={currentPage === item.key ? 'page' : undefined}
              style={{ position: 'relative' }}
            >
              <item.icon size={18} />
              <span className="nav-link-label">{item.label}</span>
              {item.badge ? <span className="nav-link-badge">{formatNavBadge(item.badge)}</span> : null}
              {currentPage === item.key ? (
                <motion.span
                  layoutId="sidebar-nav-indicator"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '15%',
                    bottom: '15%',
                    width: '3px',
                    background: 'rgba(255,255,255,0.5)',
                    borderRadius: '0 999px 999px 0',
                  }}
                  transition={SPRING_GENTLE}
                />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
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
          <button type="button" className="action-button danger sidebar-logout-button" onClick={handleLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Topbar — scroll shadow via .scrolled class
// ---------------------------------------------------------------------------
export function Topbar({
  currentUser,
  title,
  subtitle,
  onToggleNav,
  navOpen,
  actions = null,
}) {
  const showDashboardCopy = Boolean(title || subtitle)
  const headerRef = useRef(null)

  useEffect(() => {
    function onScroll() {
      if (!headerRef.current) return
      const scrolled = window.scrollY > 8
      headerRef.current.classList.toggle('scrolled', scrolled)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header ref={headerRef} className={`topbar ${showDashboardCopy ? '' : 'compact'}`}>
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

// ---------------------------------------------------------------------------
// IdentityField — label uppercase + row separator (CSS handles both)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// ProfileCard — avatar ring (CSS handles ::after ring) + stagger reveal
// ---------------------------------------------------------------------------
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
            {currentUser.isTemporaryEnrollment ? (
              <span className="profile-meta-pill" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b' }}>New Student</span>
            ) : null}
          </div>
        </div>
      </div>
      <motion.div
        className="profile-grid"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
        }}
      >
        <ProfileField label="Department" value={currentUser.department} />
        {currentUser.program ? <ProfileField label="Program" value={currentUser.program} /> : null}
        <ProfileField label="Mobile" value={currentUser.phone} />
        <ProfileField label="Email" value={currentUser.email} />
        {currentUser.role === 'student' ? (
          <ProfileField label="Semester" value={formatSemesterLabel(currentUser.semester) || 'Semester not assigned'} />
        ) : null}
        {primaryId ? <IdentityField className="profile-field profile-field-id" value={primaryId} valueOnly /> : null}
      </motion.div>
      {children}
      <ActionButton tone="danger" icon={LogOut} onClick={onLogout}>
        Logout
      </ActionButton>
    </section>
  )
}

function ProfileField({ label, value }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      <IdentityField className="profile-field" label={label} value={value} />
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// GatepassCard — hover lift + QR glow (CSS handles both)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// ModalForm — scale-from-center with AnimatePresence (canonical pattern)
// ---------------------------------------------------------------------------
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
  const titleId = `modal-title-${title?.replace(/\s+/g, '-').toLowerCase() || 'dialog'}`

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={['modal-backdrop', backdropClassName].filter(Boolean).join(' ')}
          role="presentation"
          onClick={closeOnBackdrop ? onClose : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            className={['modal-card', className].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING_SNAPPY}
          >
            <div className="modal-header">
              <div>
                <h3 id={titleId}>{title}</h3>
                {subtitle ? <span>{subtitle}</span> : null}
              </div>
              {showCloseButton ? (
                <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              ) : null}
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Utility formatters (unchanged — pure data logic, no visual changes)
// ---------------------------------------------------------------------------
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
