/**
 * ChairmanPortal — Institutional Reporting & Export Governance
 *
 * Built with the exact DwarPal system design:
 *   - admin-shell two-column layout (sidebar + main)
 *   - System CSS custom properties (--app-accent, --app-surface, etc.)
 *   - Exact admin-* CSS class names used across the platform
 *   - Same API functions as AdminPortal (fetchAdminExportOptions, fetchAdminExportPreview,
 *     fetchAdminExportRecords, fetchAdminExportHistory, downloadAdminExport)
 *
 * Sections:
 *   1. Dashboard  — institution-wide stat cards + weekly trend chart + active status pie
 *   2. Export     — full filter controls + preview panel + Excel/PDF download buttons
 *   3. History    — export audit log table with pagination
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BookUser,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  ClipboardList,
  CornerDownLeft,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderDown,
  GraduationCap,
  History,
  Hourglass,
  LayoutDashboard,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SquareCheck,
  XCircle,
} from 'lucide-react'
import AppBrand from './AppBrand'
import ExpandableGatepassCard from './ExpandableGatepassCard'
import { useToast } from './ToastProvider'
import { SkeletonTableRows, SkeletonGatepassCard } from './ui/SkeletonLoader'
import {
  downloadAdminExport,
  fetchAdminExportHistory,
  fetchAdminExportOptions,
  fetchAdminExportPreview,
  fetchAdminExportRecords,
  getApiErrorMessage,
  fetchWorkspace,
  updateRequestStatus
} from '../lib/dwarpalApi'

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const DEFAULT_FILTERS = {
  reportType: 'all_gatepasses',
  recordPartition: 'mixed',
  detailLevel: 'summary_detailed',
  datePreset: '',
  from: '',
  to: '',
  department: '',
  program: '',
  semester: '',
  status: '',
  gatepassType: '',
  personSearch: '',
  includeFacultyLeave: true,
}

const CHAIRMAN_NAV = [
  { key: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard, to: '/chairman' },
  { key: 'gatepasses', label: 'Approvals Queue', icon: ClipboardList,   to: '/chairman/gatepasses' },
  { key: 'export',    label: 'Export Centre',   icon: FolderDown,      to: '/chairman/export' },
  { key: 'history',   label: 'Export History',  icon: History,         to: '/chairman/history' },
]

const FORMAT_TABS = [
  { value: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'pdf',   label: 'PDF Report',    icon: FileText },
]

/* ─────────────────────────────────────────────
   Utilities
───────────────────────────────────────────── */

function formatMetric(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function buildFiltersForRequest(filters) {
  const result = { ...filters }
  Object.keys(result).forEach((key) => {
    const val = result[key]
    if (val === '' || val === null || val === undefined) delete result[key]
  })
  if (!result.datePreset) delete result.datePreset
  if (result.includeFacultyLeave === true) delete result.includeFacultyLeave // keep only when false
  return result
}

function getSection(pathname) {
  if (pathname.startsWith('/chairman/export')) return 'export'
  if (pathname.startsWith('/chairman/history')) return 'history'
  if (pathname.startsWith('/chairman/gatepasses')) return 'gatepasses'
  return 'dashboard'
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

/** Stat card — identical to AdminPortal StatCard */
function StatCard({ label, value, icon: Icon, tone = '' }) {
  return (
    <article className={`admin-stat-card ${tone}`}>
      <div className="admin-stat-icon">
        {Icon ? <Icon size={22} strokeWidth={1.5} /> : null}
      </div>
      <div>
        <p>{label}</p>
        <strong>{formatMetric(value)}</strong>
      </div>
    </article>
  )
}

/** Label + input/select field */
function FilterSelect({ label, value, onChange, disabled = false, children }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function FilterInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

/** Toggle pill group — identical to admin-section-tabs / admin-segment-group */
function SectionTabs({ title, value, options, onChange }) {
  return (
    <div className="admin-section-tabs">
      <span>{title}</span>
      <div className="admin-segment-group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={value === opt.value ? 'active' : ''}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sidebar ─────────────────────────────────── */
function ChairmanSidebar({ currentUser, activeSection, isOpen, onLinkClick }) {
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen])

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand">
        <AppBrand size="md" align="start" />
      </div>

      <div className="admin-user-chip">
        <div className="admin-user-chip-avatar">
          <CircleUserRound size={18} strokeWidth={1.5} />
        </div>
        <div className="admin-user-chip-info">
          <strong>{currentUser.fullName || currentUser.name || 'Chairman'}</strong>
          <span>
            {[currentUser.role?.toUpperCase(), currentUser.department]
              .filter(Boolean)
              .join(' | ')}
          </span>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Chairman portal navigation">
        {CHAIRMAN_NAV.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`admin-nav-link ${activeSection === item.key ? 'active' : ''}`}
            onClick={onLinkClick}
          >
            <item.icon size={20} strokeWidth={1.5} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div
        className="admin-sidebar-footer"
        style={{ padding: '0.5rem 0.2rem', textAlign: 'center' }}
      >
        <span style={{ fontSize: '0.72rem', color: 'var(--app-shell-muted)', opacity: 0.8 }}>
          DwarPal v1.0 · Chairman
        </span>
      </div>
    </aside>
  )
}

/** Top header bar — mirrors AdminHeader exactly */
function ChairmanHeader({
  currentUser,
  title,
  subtitle,
  onRefresh,
  refreshing,
  onToggleSidebar,
  isSidebarOpen,
  onOpenSupport,
  onLogout,
}) {
  return (
    <header className="admin-header">
      <div
        className="admin-header-title-section"
        style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}
      >
        <button
          type="button"
          className="admin-hamburger-button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar menu"
        >
          {isSidebarOpen
            ? <PanelLeftClose size={20} strokeWidth={1.5} />
            : <PanelLeftOpen  size={20} strokeWidth={1.5} />
          }
        </button>
        <div>
          <p className="admin-eyebrow">DwarPal Chairman Portal</p>
          <h1>{title}</h1>
          <span className="subtitle-text">{subtitle}</span>
        </div>
      </div>

      <div className="admin-header-actions">
        {onOpenSupport ? (
          <button
            type="button"
            className="admin-icon-button"
            onClick={onOpenSupport}
            title="Help & Support"
            aria-label="Open support"
          >
            <CircleHelp size={18} strokeWidth={1.5} />
          </button>
        ) : null}

        <button
          type="button"
          className="admin-icon-button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh data"
          title="Refresh"
        >
          <RefreshCw size={18} strokeWidth={1.5} className={refreshing ? 'spin' : ''} />
        </button>

        <div
          className="admin-header-divider"
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--app-surface-border)',
            margin: '0 4px',
          }}
        />

        <button
          type="button"
          className="admin-icon-button admin-logout-button"
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={18} strokeWidth={1.5} />
        </button>

        <div className="admin-header-user">
          <div className="header-avatar">
            <CircleUserRound size={16} strokeWidth={1.5} />
          </div>
          <div className="user-details">
            <strong>{currentUser.fullName || currentUser.name}</strong>
            <span>{currentUser.employeeId || currentUser.role?.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────────
   SVG Charts (identical to AdminPortal)
───────────────────────────────────────────── */

function SvgPieChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: 'auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={size / 2.5} fill="var(--app-surface-border, #E5E7EB)" />
        </svg>
        <span style={{ fontSize: '0.85rem', color: 'var(--app-shell-muted)' }}>No data</span>
      </div>
    )
  }

  let acc = -90
  const r = size / 3
  const cx = size / 2
  const cy = size / 2

  const slices = data.map((item) => {
    if (item.value === 0) return null
    const pct = item.value / total
    const angle = pct * 360
    const s = (acc * Math.PI) / 180
    const e = ((acc + angle) * Math.PI) / 180
    const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e)
    const d = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`, 'Z'].join(' ')
    acc += angle
    return { d, color: item.color, label: item.label, value: item.value, pct: (pct * 100).toFixed(0) }
  }).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', width: '100%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={r * 0.5} fill="var(--app-surface, #ffffff)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '110px' }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', backgroundColor: item.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--app-shell-text)' }}>{item.label}</span>
            <strong style={{ marginLeft: 'auto', color: 'var(--app-shell-muted)' }}>
              {item.value} ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function SvgLineChart({ data, width = 360, height = 160 }) {
  if (!data || data.length === 0) {
    return <span style={{ fontSize: '0.85rem', color: 'var(--app-shell-muted)', margin: 'auto' }}>No trend data</span>
  }
  const counts = data.map((d) => d.count)
  const maxCount = Math.max(...counts, 5)
  const pL = 35, pR = 15, pT = 15, pB = 25
  const cW = width - pL - pR, cH = height - pT - pB
  const stepX = data.length > 1 ? cW / (data.length - 1) : cW

  const points = data.map((d, i) => ({
    x: pL + i * stepX,
    y: pT + cH - (d.count / maxCount) * cH,
    label: d.week,
    count: d.count,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${pT + cH} L ${points[0].x} ${pT + cH} Z`

  const gridLines = Array.from({ length: 5 }).map((_, i) => ({
    y: pT + (i / 4) * cH,
    value: Math.round(maxCount - (i / 4) * maxCount),
  }))

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--app-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--app-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pL} y1={g.y} x2={width - pR} y2={g.y} stroke="var(--app-surface-border)" strokeWidth={1} strokeDasharray="3,3" />
          <text x={pL - 6} y={g.y + 3} textAnchor="end" fontSize="8" fill="var(--app-shell-muted)">{g.value}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#cGrad)" />
      <path d={linePath} fill="none" stroke="var(--app-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke="var(--app-accent)" strokeWidth={2} />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--app-accent)">{p.count}</text>
          <text x={p.x} y={height - 7} textAnchor="middle" fontSize="8" fill="var(--app-shell-muted)">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Page: Dashboard
───────────────────────────────────────────── */

function DashboardPage({ preview, previewLoading }) {
  const summary  = preview?.summary || {}
  const weekly   = preview?.weeklyTrend || []
  const ratio    = preview?.activeInactiveRatio || { active: 0, inactive: 0 }
  const total    = preview?.recordCount || summary.totalGatepasses || 0
  const approved = summary.totalApproved || 0
  const pending  = summary.totalPending  || 0
  const faculty  = summary.totalFacultyRequests || 0
  const rejected = summary.totalRejected || 0
  const outCount = summary.totalOut      || 0
  const returned = summary.totalReturned || 0

  const pieData = [
    { label: 'Active / Out',  value: ratio.active   || 0, color: 'var(--info)'    },
    { label: 'Completed',     value: ratio.inactive  || 0, color: 'var(--muted, #9CA3AF)' },
  ]

  return (
    <div className="admin-page-stack">
      {/* Welcome banner */}
      <div className="admin-wide-panel" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)', color: '#fff', border: 'none' }}>
        <p className="admin-eyebrow" style={{ color: 'rgba(255,255,255,0.78)', marginBottom: '0.3rem' }}>
          DwarPal · Chairman Reporting Panel
        </p>
        <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
          Institutional Governance Overview
        </h2>
        <span style={{ fontSize: '0.82rem', opacity: 0.82, display: 'block', marginTop: '0.3rem' }}>
          Full-scope visibility into campus gatepass movement, faculty leave, and export history across all departments.
        </span>
      </div>

      {/* Stat grid */}
      <div className="admin-stat-grid">
        <StatCard label="Total Gatepasses"  value={total}    icon={ClipboardList}  />
        <StatCard label="Approved Passes"   value={approved} icon={ShieldCheck}    tone="success" />
        <StatCard label="Pending Review"    value={pending}  icon={Hourglass}      tone="warning" />
        <StatCard label="Faculty Requests"  value={faculty}  icon={CalendarClock}  tone="info" />
        <StatCard label="Rejected Passes"   value={rejected} icon={XCircle}        tone="danger" />
        <StatCard label="Currently Outside" value={outCount} icon={MapPin}         />
        <StatCard label="Returned"          value={returned} icon={CornerDownLeft} tone="success" />
        <StatCard label="Departments"       value="All"      icon={Building2}      />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
        <section className="admin-wide-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Trends</p>
              <h2>Weekly Gatepass Volume</h2>
              <span>Gatepass activity over the past 8 weeks across all departments.</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
            {previewLoading
              ? <span style={{ color: 'var(--app-shell-muted)', fontSize: '0.85rem' }}>Loading chart…</span>
              : <SvgLineChart data={weekly} height={160} />
            }
          </div>
        </section>

        <section className="admin-wide-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Distribution</p>
              <h2>Active vs Completed</h2>
              <span>Ratio of currently-outside students vs returned / completed cycles.</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem', minHeight: '180px' }}>
            {previewLoading
              ? <span style={{ color: 'var(--app-shell-muted)', fontSize: '0.85rem' }}>Loading chart…</span>
              : <SvgPieChart data={pieData} size={150} />
            }
          </div>
        </section>
      </div>

      {/* Department breakdown if available */}
      {preview?.busiestDepartment ? (
        <div className="admin-insight-strip">
          <Building2 size={18} strokeWidth={1.5} />
          <span>
            Highest activity: <strong>{preview.busiestDepartment.department}</strong> with{' '}
            {formatMetric(preview.busiestDepartment.totalGatepasses)} gatepasses.
          </span>
        </div>
      ) : null}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Page: Export Centre
───────────────────────────────────────────── */

function ExportPage({
  filters,
  options,
  preview,
  previewLoading,
  previewError,
  records,
  recordsMeta,
  recordsLoading,
  exportFormat,
  exportBusy,
  selectedRows,
  onFilterChange,
  onResetFilters,
  onFormatChange,
  onDownload,
  onToggleRow,
  onToggleAllVisible,
  onClearSelection,
  onPageChange,
}) {
  const filterOptions = options?.filters || {}
  const allowedReports = Array.isArray(options?.reportTypes)
    ? options.reportTypes.filter((r) => r.allowed !== false)
    : []

  const summary      = preview?.summary    || {}
  const userCounts   = preview?.userCounts || {}
  const selectedCount = Object.keys(selectedRows).length
  const formatLabel   = exportFormat === 'pdf' ? 'PDF' : 'Excel'

  const selectableRows    = records.filter((r) => r.id)
  const visibleKeys       = selectableRows.map((r) => r.rowKey)
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => Boolean(selectedRows[k]))

  return (
    <div className="admin-export-page">

      {/* ── Toolbar: partition / format / detail ── */}
      <section className="admin-wide-panel admin-toolbar-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Export Data</p>
            <h2>Institution-Wide Report Export</h2>
          </div>
        </div>
        <div className="admin-toolbar-grid">
          <SectionTabs
            title="Partition"
            value={filters.recordPartition}
            onChange={(v) => onFilterChange('recordPartition', v)}
            options={[
              { value: 'students', label: 'Students' },
              { value: 'faculty',  label: 'Faculty'  },
              { value: 'mixed',    label: 'Mixed'    },
            ]}
          />
          <SectionTabs
            title="Format"
            value={exportFormat}
            onChange={onFormatChange}
            options={FORMAT_TABS}
          />
          <SectionTabs
            title="Detail level"
            value={filters.detailLevel}
            onChange={(v) => onFilterChange('detailLevel', v)}
            options={[
              { value: 'summary_detailed', label: 'Summary + Detail' },
              { value: 'detailed_only',    label: 'Detailed Only'    },
              { value: 'summary_only',     label: 'Summary Only'     },
            ]}
          />
        </div>
      </section>

      {/* ── Filters + Preview (two-column) ── */}
      <div className="admin-export-grid">

        {/* Left: filters */}
        <section className="admin-filter-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Filters</p>
              <h2>Data Scope &amp; Search</h2>
              <span>Leave fields blank to include all records.</span>
            </div>
            <button type="button" className="admin-text-button" onClick={onResetFilters}>
              Clear filters
            </button>
          </div>

          {/* Basic filters grid */}
          <div className="admin-filter-grid">
            {allowedReports.length > 0 && (
              <FilterSelect label="Report type" value={filters.reportType} onChange={(v) => onFilterChange('reportType', v)}>
                {allowedReports.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect label="Date preset" value={filters.datePreset} onChange={(v) => onFilterChange('datePreset', v)}>
              <option value="">All dates</option>
              <option value="custom">Custom range</option>
              {(filterOptions.datePresets || []).map((p) => (
                <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
              ))}
            </FilterSelect>
            {filters.datePreset === 'custom' && (
              <>
                <FilterInput label="Date from" type="date" value={filters.from || ''} onChange={(v) => onFilterChange('from', v)} />
                <FilterInput label="Date to"   type="date" value={filters.to   || ''} onChange={(v) => onFilterChange('to', v)} />
              </>
            )}
            <FilterSelect label="Status" value={filters.status} onChange={(v) => onFilterChange('status', v)}>
              <option value="">All statuses</option>
              {(filterOptions.statuses || []).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </FilterSelect>
          </div>

          {/* Search fields */}
          <details className="admin-filter-section" open>
            <summary><Search size={16} strokeWidth={1.5} /> Search fields</summary>
            <div className="admin-filter-grid">
              <FilterInput
                label="Global search"
                value={filters.personSearch}
                onChange={(v) => onFilterChange('personSearch', v)}
                placeholder="Name, enrollment, employee ID, email"
              />
            </div>
          </details>

          {/* Academic scope */}
          <details className="admin-filter-section" open>
            <summary><SlidersHorizontal size={16} strokeWidth={1.5} /> Academic &amp; user scope</summary>
            <div className="admin-filter-grid">
              <FilterSelect label="Department" value={filters.department} onChange={(v) => onFilterChange('department', v)}>
                <option value="">All departments</option>
                {(filterOptions.departments || []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Program" value={filters.program} onChange={(v) => onFilterChange('program', v)}>
                <option value="">All programs</option>
                {(filterOptions.programs || []).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Semester" value={filters.semester} onChange={(v) => onFilterChange('semester', v)}>
                <option value="">All semesters</option>
                {(filterOptions.semesters || []).map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Gatepass type" value={filters.gatepassType} onChange={(v) => onFilterChange('gatepassType', v)}>
                <option value="">All gatepasses</option>
                <option value="student">Student gatepasses</option>
                <option value="faculty">Faculty gatepasses</option>
              </FilterSelect>
            </div>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={Boolean(filters.includeFacultyLeave)}
                onChange={(e) => onFilterChange('includeFacultyLeave', e.target.checked)}
              />
              <span>Include faculty leave records in export</span>
            </label>
          </details>
        </section>

        {/* Right: preview panel */}
        <section className={`admin-preview-panel ${previewError ? 'error' : ''}`}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Preview</p>
              <h2>
                {previewLoading
                  ? 'Generating preview…'
                  : previewError
                    ? 'Preview error'
                    : preview?.empty
                      ? 'No records found'
                      : `${formatMetric(preview?.recordCount)} rows ready`
                }
              </h2>
              <span>
                {selectedCount
                  ? `${formatMetric(selectedCount)} record(s) selected.`
                  : 'Select rows below or export filtered / full dataset.'
                }
              </span>
            </div>
          </div>

          {!previewLoading && !previewError && (
            <>
              <div className="admin-stat-grid compact">
                <StatCard label="Students" value={userCounts.students} icon={GraduationCap} />
                <StatCard label="Faculty"  value={userCounts.faculty}  icon={BookUser} />
                <StatCard label="Selected" value={selectedCount}       icon={SquareCheck} tone="info" />
                <StatCard label="Pending"  value={summary.totalPending} icon={Hourglass} tone="warning" />
              </div>

              {preview?.busiestDepartment ? (
                <div className="admin-insight-strip">
                  <Building2 size={18} strokeWidth={1.5} />
                  <span>
                    Highest activity: <strong>{preview.busiestDepartment.department}</strong> with{' '}
                    {formatMetric(preview.busiestDepartment.totalGatepasses)} gatepasses.
                  </span>
                </div>
              ) : null}

              {/* Download buttons */}
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={() => onDownload('bulk')}
                  disabled={exportBusy}
                >
                  {exportBusy ? <RefreshCw size={16} strokeWidth={1.5} className="spin" /> : <FileDown size={16} strokeWidth={1.5} />}
                  <span>{exportBusy ? 'Generating…' : `Export Full Dataset (${formatLabel})`}</span>
                </button>
                <button
                  type="button"
                  className="admin-secondary-link"
                  style={{ justifyContent: 'center' }}
                  onClick={() => onDownload('filtered')}
                  disabled={exportBusy}
                >
                  Export Filtered View
                </button>
                <button
                  type="button"
                  className="admin-secondary-link"
                  style={{ justifyContent: 'center' }}
                  onClick={() => onDownload('selected')}
                  disabled={!selectedCount || exportBusy}
                >
                  Export Selected ({formatMetric(selectedCount)}) Rows
                </button>
              </div>
            </>
          )}

          {previewError && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--danger)' }}>
              {previewError}
            </div>
          )}
        </section>
      </div>

      {/* ── Records table ── */}
      <section className="admin-records-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Admin Data Table</p>
            <h2>Filtered Records</h2>
            <span>Select rows for targeted export or use the buttons above for bulk download.</span>
          </div>
        </div>

        <div className="admin-table-toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="admin-table-selection" style={{ marginLeft: 'auto' }}>
            <span className="admin-selection-count">{formatMetric(selectedCount)} selected</span>
            {selectedCount ? (
              <button type="button" className="admin-text-button" onClick={onClearSelection}>
                Clear selection
              </button>
            ) : null}
          </div>
          <div className="admin-inline-actions">
            <button
              type="button"
              className="admin-primary-button inline"
              onClick={() => onDownload('selected')}
              disabled={!selectedCount || exportBusy}
            >
              <FileDown size={16} strokeWidth={1.5} />
              <span>{exportBusy ? 'Generating…' : `Export Selected ${formatLabel}`}</span>
            </button>
            <button type="button" className="admin-secondary-link" onClick={() => onDownload('filtered')} disabled={exportBusy}>
              Export Filtered
            </button>
            <button type="button" className="admin-secondary-link" onClick={() => onDownload('bulk')} disabled={exportBusy}>
              Export Full Data
            </button>
            <button type="button" className="admin-text-button" onClick={onResetFilters}>
              Clear filters
            </button>
          </div>
        </div>

        {recordsLoading ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-record-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" disabled />
                  </th>
                  <th>Name</th>
                  <th>ID</th>
                  <th className="col-user-type">User Type</th>
                  <th className="col-dept">Department</th>
                  <th className="col-prog-sem">Program / Semester</th>
                  <th>Total</th>
                  <th>Approved</th>
                  <th className="col-rejected">Rejected</th>
                  <th className="col-pending">Pending</th>
                  <th className="col-last-act">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                <SkeletonTableRows count={6} />
              </tbody>
            </table>
          </div>
        ) : records.length ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-record-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => onToggleAllVisible(e.target.checked)}
                      />
                    </th>
                    <th>Name</th>
                    <th>ID</th>
                    <th className="col-user-type">User Type</th>
                    <th className="col-dept">Department</th>
                    <th className="col-prog-sem">Program / Semester</th>
                    <th>Total</th>
                    <th>Approved</th>
                    <th className="col-rejected">Rejected</th>
                    <th className="col-pending">Pending</th>
                    <th className="col-last-act">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row.rowKey}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRows[row.rowKey])}
                          disabled={!row.id}
                          onChange={() => onToggleRow(row)}
                        />
                      </td>
                      <td>
                        <div className="admin-record-primary">
                          <strong>{row.name}</strong>
                          <span>{row.email || row.phone || 'No contact'}</span>
                        </div>
                      </td>
                      <td><span className="admin-record-badge">{row.primaryId || '—'}</span></td>
                      <td className="col-user-type">
                        <span className="admin-record-type">{[row.userType, row.roleType].filter(Boolean).join(' / ')}</span>
                      </td>
                      <td className="col-dept">{row.department || 'All departments'}</td>
                      <td className="col-prog-sem">
                        {[row.program, row.semester ? `Sem ${row.semester}` : ''].filter(Boolean).join(' | ') || '—'}
                      </td>
                      <td>{formatMetric(row.totalRequests)}</td>
                      <td>{formatMetric(row.approvedCount)}</td>
                      <td className="col-rejected">{formatMetric(row.rejectedCount)}</td>
                      <td className="col-pending">{formatMetric(row.pendingCount)}</td>
                      <td className="col-last-act">{formatDateTime(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pager">
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => onPageChange(recordsMeta.page - 1)}
                disabled={!recordsMeta.hasPrevPage}
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              <span>Page {recordsMeta.page || 1} of {recordsMeta.totalPages || 1}</span>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => onPageChange(recordsMeta.page + 1)}
                disabled={!recordsMeta.hasNextPage}
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </>
        ) : (
          <div className="admin-empty-state">No records match the current filters.</div>
        )}
      </section>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Page: Export History
───────────────────────────────────────────── */

function HistoryPage({ history, loading, onRefresh }) {
  return (
    <section className="admin-history-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Audit Log</p>
          <h2>Export History</h2>
        </div>
        <button type="button" className="admin-text-button" onClick={onRefresh} disabled={loading}>
          {loading ? <RefreshCw size={14} className="spin" style={{ display: 'inline' }} /> : null}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Format</th>
                <th>Generated By</th>
                <th>Generated At</th>
                <th>Status</th>
                <th>Records</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRows count={5} />
            </tbody>
          </table>
        </div>
      ) : history.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Format</th>
                <th>Generated By</th>
                <th>Generated At</th>
                <th>Status</th>
                <th>Records</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item._id || item.id}>
                  <td>{String(item.reportType || '').replace(/_/g, ' ')}</td>
                  <td>
                    <span className="admin-chip-list">
                      <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>
                        {item.exportFormat || '—'}
                      </span>
                    </span>
                  </td>
                  <td>{item.generatedBySnapshot?.name || item.generatedBy?.fullName || 'Chairman'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {formatDateTime(item.generatedAt)}
                  </td>
                  <td>
                    <span className={`admin-status ${item.status === 'success' ? 'success' : item.status === 'failed' ? 'failed' : 'generating'}`}>
                      {item.status || 'success'}
                    </span>
                  </td>
                  <td>{formatMetric(item.recordCount)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--app-shell-muted)', wordBreak: 'break-word' }}>
                    {item.fileName || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty-state">No export history recorded yet.</div>
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────
   Page: Approvals Queue
   ───────────────────────────────────────────── */

function ApprovalsPage({
  gatepasses,
  meta,
  loading,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchTermChange,
  page,
  onPageChange,
  onGatepassAction,
  onRejectClick,
  expandedId,
  onToggleExpand
}) {
  const statusOptions = ['All', 'Pending', 'Approved', 'Rejected']

  const cards = useMemo(() => {
    return gatepasses.map((gp) => {
      let actions = []
      if (gp.rawStatus === 'forwarded_to_chairman') {
        actions = [
          { label: 'Approve', tone: 'success', onClick: () => onGatepassAction(gp, 'approve') },
          { label: 'Reject', tone: 'danger', onClick: () => onRejectClick(gp) }
        ]
      }
      return { gatepass: gp, actions }
    })
  }, [gatepasses, onGatepassAction, onRejectClick])

  return (
    <div className="admin-page-stack">
      <section className="admin-wide-panel" style={{ padding: '24px', background: 'var(--app-surface)', borderRadius: '12px', border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="admin-panel-heading" style={{ borderBottom: '1px solid var(--app-border)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p className="admin-eyebrow">Institutional Reviews</p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Approvals Queue</h2>
          </div>
        </div>

        <div className="workspace-top" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div className="admin-field" style={{ flex: '1', minWidth: '240px', margin: 0 }}>
            <div className="admin-filter-search-wrap" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by ID or student name..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="admin-filter-search-input"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-surface-subtle)',
                  color: 'var(--app-text)',
                  outline: 'none'
                }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--app-shell-muted)' }} />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {statusOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onStatusFilterChange(opt)}
                className={`admin-text-button ${statusFilter === opt ? 'active' : ''}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: statusFilter === opt ? 'var(--app-accent)' : 'var(--app-border)',
                  background: statusFilter === opt ? 'var(--app-accent-transparent)' : 'var(--app-surface-subtle)',
                  color: statusFilter === opt ? 'var(--app-accent-strong)' : 'var(--app-text-muted)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonGatepassCard />
            <SkeletonGatepassCard />
            <SkeletonGatepassCard />
          </div>
        ) : cards.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cards.map(({ gatepass, actions }) => (
              <ExpandableGatepassCard
                key={gatepass.id}
                gatepass={gatepass}
                currentUserRole="chairman"
                actions={actions}
                expanded={expandedId === gatepass.id}
                onToggle={() => onToggleExpand(expandedId === gatepass.id ? '' : gatepass.id)}
              />
            ))}

            {meta.totalPages > 1 && (
              <div className="admin-pager" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  className="admin-icon-button"
                  style={{ cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--app-text-muted)' }}>
                  Page {page} of {meta.totalPages}
                </span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className="admin-icon-button"
                  style={{ cursor: page >= meta.totalPages ? 'not-allowed' : 'pointer', opacity: page >= meta.totalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="admin-empty-state" style={{ minHeight: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--app-text-muted)', fontSize: '1rem' }}>
            No gatepasses found in this queue.
          </div>
        )}
      </section>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */

export default function ChairmanPortal({ currentUser, onLogout, onOpenSupport }) {
  const location = useLocation()
  const toast    = useToast()
  const activeSection = getSection(location.pathname)

  /* ── UI state ── */
  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  /* ── Data state ── */
  const [filters,        setFilters]        = useState(DEFAULT_FILTERS)
  const [options,        setOptions]        = useState(null)
  const [preview,        setPreview]        = useState(null)
  const [records,        setRecords]        = useState([])
  const [recordsMeta,    setRecordsMeta]    = useState({})
  const [history,        setHistory]        = useState([])
  const [recordsPage,    setRecordsPage]    = useState(1)
  const [exportFormat,   setExportFormat]   = useState('excel')
  const [selectedRows,   setSelectedRows]   = useState({})
  
  /* ── Approvals Queue state ── */
  const [gatepasses, setGatepasses] = useState([])
  const [gatepassMeta, setGatepassMeta] = useState({})
  const [gatepassPage, setGatepassPage] = useState(1)
  const [gatepassLoading, setGatepassLoading] = useState(false)
  const [gatepassStatusFilter, setGatepassStatusFilter] = useState('Pending')
  const [gatepassSearch, setGatepassSearch] = useState('')
  const [rejectRequest, setRejectRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [expandedGatepassId, setExpandedGatepassId] = useState('')

  /* ── Loading state ── */
  const [optionsLoading,  setOptionsLoading]  = useState(true)
  const [previewLoading,  setPreviewLoading]  = useState(true)
  const [recordsLoading,  setRecordsLoading]  = useState(false)
  const [historyLoading,  setHistoryLoading]  = useState(false)
  const [previewError,    setPreviewError]    = useState('')
  const [exportBusy,      setExportBusy]      = useState(false)

  const requestFilters = useMemo(() => buildFiltersForRequest(filters), [filters])
  const refreshBusy    = optionsLoading || previewLoading || recordsLoading

  /* ── Reset page when section changes ── */
  useEffect(() => { setRecordsPage(1) }, [activeSection])

  /* ── Load export options (department/program/status lists) ── */
  useEffect(() => {
    const ctrl = new AbortController()
    setOptionsLoading(true)
    fetchAdminExportOptions(
      {
        q:               filters.personSearch,
        department:      filters.department,
        semester:        filters.semester,
        recordPartition: filters.recordPartition,
      },
      ctrl.signal,
    )
      .then((result) => {
        setOptions(result)
        const allowed = Array.isArray(result?.reportTypes)
          ? result.reportTypes.filter((r) => r.allowed !== false)
          : []
        if (allowed.length && !allowed.some((r) => r.value === filters.reportType)) {
          setFilters((prev) => ({ ...prev, reportType: allowed[0].value }))
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        toast.error({ title: 'Options failed', message: getApiErrorMessage(err, 'Unable to load filter options.') })
      })
      .finally(() => setOptionsLoading(false))

    return () => ctrl.abort()
  }, [
    filters.department, filters.semester,
    filters.recordPartition, filters.personSearch,
    filters.reportType, toast,
  ])

  /* ── Load preview (debounced 250 ms) ── */
  useEffect(() => {
    const ctrl = new AbortController()
    const tid  = window.setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError('')
      fetchAdminExportPreview(requestFilters, ctrl.signal)
        .then((r) => setPreview(r))
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setPreviewError(getApiErrorMessage(err, 'Unable to generate preview.'))
        })
        .finally(() => setPreviewLoading(false))
    }, 250)

    return () => { window.clearTimeout(tid); ctrl.abort() }
  }, [requestFilters])

  /* ── Load records (export section only, debounced) ── */
  const isExportSection = activeSection === 'export'
  useEffect(() => {
    if (!isExportSection) {
      setRecords([]); setRecordsMeta({}); return
    }
    const ctrl = new AbortController()
    const tid  = window.setTimeout(() => {
      setRecordsLoading(true)
      fetchAdminExportRecords({ ...requestFilters, page: recordsPage, limit: 12 }, ctrl.signal)
        .then((r) => { setRecords(r.rows); setRecordsMeta(r.meta || {}) })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          toast.error({ title: 'Records failed', message: getApiErrorMessage(err, 'Unable to load records.') })
        })
        .finally(() => setRecordsLoading(false))
    }, 250)

    return () => { window.clearTimeout(tid); ctrl.abort() }
  }, [isExportSection, requestFilters, recordsPage, toast])

  /* ── Load history when on history tab ── */
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const result = await fetchAdminExportHistory()
      setHistory(result.history)
    } catch (err) {
      toast.error({ title: 'History failed', message: getApiErrorMessage(err, 'Unable to load export history.') })
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeSection === 'history') loadHistory()
  }, [activeSection, loadHistory])

  /* ── Load approvals queue ── */
  const loadGatepasses = useCallback((signal) => {
    setGatepassLoading(true)
    fetchWorkspace(
      'chairman',
      signal,
      {
        page: gatepassPage,
        limit: 10,
        statusFilter: gatepassStatusFilter,
        searchTerm: gatepassSearch
      }
    )
      .then((res) => {
        setGatepasses(res.gatepasses || [])
        setGatepassMeta(res.gatepassesMeta || {})
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        toast.error({ title: 'Fetch failed', message: getApiErrorMessage(err, 'Unable to load approvals queue.') })
      })
      .finally(() => setGatepassLoading(false))
  }, [gatepassPage, gatepassStatusFilter, gatepassSearch, toast])

  useEffect(() => {
    if (activeSection !== 'gatepasses') return
    const ctrl = new AbortController()
    loadGatepasses(ctrl.signal)
    return () => ctrl.abort()
  }, [activeSection, loadGatepasses])

  const handleGatepassAction = async (gatepass, action, extraBody = null) => {
    try {
      await updateRequestStatus(gatepass, action, extraBody)
      toast.success({
        title: action === 'approve' ? 'Approved' : 'Rejected',
        message: `Gatepass was successfully ${action === 'approve' ? 'approved' : 'rejected'}.`
      })
      loadGatepasses()
      return { ok: true }
    } catch (err) {
      toast.error({
        title: 'Action failed',
        message: getApiErrorMessage(err, 'Unable to update gatepass status.')
      })
      return { ok: false, error: err.message }
    }
  }

  const handleRejectClick = (gatepass) => {
    setRejectRequest(gatepass)
    setRejectionReason('')
  }

  const handleRejectSubmit = async () => {
    if (!rejectRequest) return
    const res = await handleGatepassAction(rejectRequest, 'reject', { rejectionReason })
    if (res.ok) {
      setRejectRequest(null)
    }
  }

  /* ── Filter handlers ── */
  function handleFilterChange(key, value) {
    setRecordsPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleResetFilters() {
    setRecordsPage(1)
    setFilters(DEFAULT_FILTERS)
  }

  /* ── Row selection ── */
  function handleToggleRow(row) {
    if (!row?.id) return
    setSelectedRows((prev) => {
      const next = { ...prev }
      if (next[row.rowKey]) delete next[row.rowKey]
      else next[row.rowKey] = row
      return next
    })
  }

  function handleToggleAllVisible(checked) {
    setSelectedRows((prev) => {
      const next = { ...prev }
      records.forEach((row) => {
        if (!row.id) return
        if (checked) next[row.rowKey] = row
        else delete next[row.rowKey]
      })
      return next
    })
  }

  /* ── Download handler ── */
  async function handleDownload(exportScope) {
    if (exportBusy) return
    if (exportScope === 'selected' && !Object.keys(selectedRows).length) {
      toast.warning({ title: 'No rows selected', message: 'Select one or more records first.' })
      return
    }

    const format  = exportFormat === 'pdf' ? 'pdf' : 'excel'
    const payload = { ...requestFilters }

    if (exportScope === 'selected') {
      const studentIds = [], facultyIds = []
      Object.values(selectedRows).forEach((r) => {
        if (r.userType === 'student') studentIds.push(r.id)
        else facultyIds.push(r.id)
      })
      payload.selectedStudentIds = studentIds
      payload.selectedFacultyIds = facultyIds
    }

    payload.exportScope = exportScope

    setExportBusy(true)
    try {
      const result = await downloadAdminExport(format, payload)
      const url  = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = result.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success({ title: 'Export ready', message: `${result.fileName} downloaded.` })
      if (activeSection === 'history') loadHistory()
    } catch (err) {
      toast.error({ title: 'Export failed', message: getApiErrorMessage(err, 'Unable to generate export.') })
    } finally {
      setExportBusy(false)
    }
  }

  /* ── Title map ── */
  const titleMap = {
    dashboard:  'Institutional Overview',
    gatepasses: 'Approvals Queue',
    export:     'Export Centre',
    history:    'Export History',
  }

  const subtitleMap = {
    dashboard:  'Full-scope view of campus gatepass activity and faculty leave across all departments.',
    gatepasses: 'Review, approve, or reject escalated student gatepass requests.',
    export:     'Filter records, preview datasets, and download board-ready Excel or PDF reports.',
    history:    'Audit log of all exported reports generated through this portal.',
  }

  /* ─── Render ─────────────────────────────── */
  return (
    <div className={`admin-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen ? (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <ChairmanSidebar
        currentUser={currentUser}
        activeSection={activeSection}
        isOpen={sidebarOpen}
        onLinkClick={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        <ChairmanHeader
          currentUser={currentUser}
          title={titleMap[activeSection] || 'Chairman Portal'}
          subtitle={subtitleMap[activeSection] || ''}
          refreshing={refreshBusy}
          isSidebarOpen={sidebarOpen || !sidebarCollapsed}
          onToggleSidebar={() => {
            if (window.innerWidth > 1100) setSidebarCollapsed((p) => !p)
            else setSidebarOpen((p) => !p)
          }}
          onOpenSupport={onOpenSupport}
          onLogout={onLogout}
          onRefresh={() => {
            setRecordsPage(1)
            setFilters((p) => ({ ...p }))
            if (activeSection === 'history') loadHistory()
          }}
        />

        {activeSection === 'dashboard' && (
          <DashboardPage preview={preview} previewLoading={previewLoading} />
        )}

        {activeSection === 'export' && (
          <ExportPage
            filters={filters}
            options={options}
            preview={preview}
            previewLoading={previewLoading}
            previewError={previewError}
            records={records}
            recordsMeta={recordsMeta}
            recordsLoading={recordsLoading}
            exportFormat={exportFormat}
            exportBusy={exportBusy}
            selectedRows={selectedRows}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            onFormatChange={setExportFormat}
            onDownload={handleDownload}
            onToggleRow={handleToggleRow}
            onToggleAllVisible={handleToggleAllVisible}
            onClearSelection={() => setSelectedRows({})}
            onPageChange={setRecordsPage}
          />
        )}

        {activeSection === 'history' && (
          <HistoryPage
            history={history}
            loading={historyLoading}
            onRefresh={loadHistory}
          />
        )}

        {activeSection === 'gatepasses' && (
          <ApprovalsPage
            gatepasses={gatepasses}
            meta={gatepassMeta}
            loading={gatepassLoading}
            statusFilter={gatepassStatusFilter}
            onStatusFilterChange={setGatepassStatusFilter}
            searchTerm={gatepassSearch}
            onSearchTermChange={setGatepassSearch}
            page={gatepassPage}
            onPageChange={setGatepassPage}
            onGatepassAction={handleGatepassAction}
            onRejectClick={handleRejectClick}
            expandedId={expandedGatepassId}
            onToggleExpand={setExpandedGatepassId}
          />
        )}
      </main>

      {rejectRequest ? (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--app-surface)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '480px', border: '1px solid var(--app-border)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>Reject Gatepass Request</h3>
            <p style={{ color: 'var(--app-text-muted)', marginBottom: '16px' }}>Please specify a reason for rejecting the student's gatepass request:</p>
            <textarea
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--app-border)', background: 'var(--app-surface-subtle)', color: 'var(--app-text)', minHeight: '100px', marginBottom: '20px', outline: 'none', resize: 'none' }}
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setRejectRequest(null)}
                className="admin-secondary-link"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 16px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={handleRejectSubmit}
                className="admin-primary-button"
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: '600', cursor: rejectionReason.trim() ? 'pointer' : 'not-allowed', opacity: rejectionReason.trim() ? 1 : 0.6 }}
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
