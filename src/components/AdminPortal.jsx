import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  User,
  Users,
  UserPlus,
  UserCheck,
  UserRoundCog,
  XCircle,
} from 'lucide-react'
import AppBrand from './AppBrand'
import StudentManagementPanel from './StudentManagementPanel'
import { useToast } from './ToastProvider'
import {
  downloadAdminExport,
  fetchAdminExportHistory,
  fetchAdminExportOptions,
  fetchAdminExportPreview,
  fetchAdminExportRecords,
  getApiErrorMessage,
} from '../lib/dwarpalApi'

const DEFAULT_FILTERS = {
  reportType: 'all_gatepasses',
  recordPartition: 'mixed',
  detailLevel: 'summary_detailed',
  datePreset: '',
  from: '',
  to: '',
  createdFrom: '',
  createdTo: '',
  department: '',
  program: '',
  semester: '',
  studentId: '',
  facultyId: '',
  personSearch: '',
  name: '',
  enrollmentNo: '',
  employeeId: '',
  roleType: '',
  status: '',
  approvedBy: '',
  gatepassType: '',
  leaveType: '',
  loadAdjustmentType: '',
  vehicleMode: 'all',
  coordinatorOnly: false,
  includeSeparateStudentSheets: false,
  notes: '',
}

const DETAIL_LEVEL_OPTIONS = [
  { value: 'summary_detailed', label: 'Summary + Detailed' },
  { value: 'detailed_only', label: 'Detailed Only' },
  { value: 'summary_only', label: 'Summary Only' },
]

const FORMAT_TABS = [
  { value: 'excel', label: 'Excel Export', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF Export', icon: FileText },
]

function getAdminSection(pathname) {
  if (pathname.startsWith('/admin/export/history')) return 'history'
  return pathname.split('/')[2] || 'dashboard'
}

function formatMetric(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function readAllowedReportTypes(options) {
  return Array.isArray(options?.reportTypes) ? options.reportTypes.filter((item) => item.allowed !== false) : []
}

function getAdminNavItems(currentUser) {
  const isSecurity = currentUser.role === 'security'
  const isCoord = Boolean(currentUser.isCoordinator || currentUser.coordinatorAssignment?.isCoordinator || currentUser.coordinatorScope?.isCoordinator)
  
  if (currentUser.role === 'it') {
    return [
      { key: 'students', label: 'Add Student', icon: UserPlus, to: '/admin/students' },
      { key: 'student-history', label: 'Student Reg History', icon: History, to: '/admin/student-history' },
      { key: 'settings', label: 'Settings', icon: Settings, to: '/admin/settings' }
    ]
  }

  if (isCoord) {
    return [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
      { key: 'gatepasses', label: 'Gatepass Ops', icon: ClipboardList, to: '/admin/gatepasses' },
      { key: 'reports', label: 'Reports', icon: BarChart3, to: '/admin/reports' },
      { key: 'students', label: 'Students', icon: Users, to: '/admin/students' },
      { key: 'export', label: 'Export Center', icon: Download, to: '/admin/export' },
    ]
  }

  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
    { key: 'gatepasses', label: 'Gatepass Ops', icon: ClipboardList, to: '/admin/gatepasses' },
    { key: 'reports', label: 'Reports', icon: BarChart3, to: '/admin/reports' },
  ]

  if (!isSecurity) {
    if (currentUser.role !== 'cao') {
      items.push({ key: 'students', label: 'Students', icon: Users, to: '/admin/students' })
    }
    items.push(
      { key: 'faculty', label: 'Faculty', icon: UserRoundCog, to: '/admin/faculty' },
      { key: 'coordinators', label: 'Coordinators', icon: UserCheck, to: '/admin/coordinators' },
      { key: 'export', label: 'Export Center', icon: Download, to: '/admin/export' },
      { key: 'history', label: 'Export History', icon: History, to: '/admin/export/history' },
    )
  }

  items.push({ key: 'settings', label: 'Settings', icon: Settings, to: '/admin/settings' })
  return items
}

function buildFiltersForRequest(filters) {
  const request = { ...filters }

  Object.keys(request).forEach((key) => {
    if (request[key] === '' || request[key] === null || request[key] === undefined) {
      delete request[key]
    }
  })

  if (request.vehicleMode === 'all') {
    delete request.vehicleMode
  }

  if (!request.datePreset) {
    delete request.datePreset
  }

  if (!request.coordinatorOnly) {
    delete request.coordinatorOnly
  }

  if (!request.includeSeparateStudentSheets) {
    delete request.includeSeparateStudentSheets
  }

  return request
}

function getSectionFilterOverrides(activeSection) {
  if (activeSection === 'students' || activeSection === 'student-history') {
    return { recordPartition: 'students', reportType: 'student_report' }
  }

  if (activeSection === 'faculty') {
    return { recordPartition: 'faculty', reportType: 'faculty_report' }
  }

  if (activeSection === 'coordinators') {
    return { recordPartition: 'faculty', reportType: 'faculty_report', coordinatorOnly: true }
  }

  return {}
}

function applySectionFilters(filters, activeSection) {
  return {
    ...filters,
    ...getSectionFilterOverrides(activeSection),
  }
}

function getSelectedIdPayload(selectedRows = {}) {
  return Object.values(selectedRows).reduce(
    (result, row) => {
      if (row.userType === 'student') {
        result.selectedStudentIds.push(row.id)
      } else {
        result.selectedFacultyIds.push(row.id)
      }

      return result
    },
    { selectedStudentIds: [], selectedFacultyIds: [] },
  )
}

function buildExportPayload(filters, activeSection, selectedRows, exportScope) {
  const sectionFilters = applySectionFilters(filters, activeSection)

  if (exportScope === 'bulk') {
    return buildFiltersForRequest({
      reportType: sectionFilters.reportType,
      recordPartition: sectionFilters.recordPartition,
      detailLevel: sectionFilters.detailLevel,
      coordinatorOnly: sectionFilters.coordinatorOnly,
      includeSeparateStudentSheets: sectionFilters.includeSeparateStudentSheets,
      notes: sectionFilters.notes,
      exportScope,
    })
  }

  const request = buildFiltersForRequest({
    ...sectionFilters,
    exportScope,
  })

  if (exportScope === 'selected') {
    return {
      ...request,
      ...getSelectedIdPayload(selectedRows),
    }
  }

  return request
}

function AdminSidebar({ currentUser, activeSection, isOpen, onLinkClick }) {
  const navItems = getAdminNavItems(currentUser)

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand">
        <AppBrand size="md" align="start" />
      </div>
      <div className="admin-user-chip">
        <div className="admin-user-chip-avatar">
          <User size={18} />
        </div>
        <div className="admin-user-chip-info">
          <strong>{currentUser.name}</strong>
          <span>{[currentUser.role?.toUpperCase(), currentUser.department].filter(Boolean).join(' | ')}</span>
        </div>
      </div>
      <nav className="admin-nav" aria-label="Admin portal navigation">
        {navItems.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`admin-nav-link ${activeSection === item.key ? 'active' : ''}`}
            onClick={onLinkClick}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer" style={{ padding: '0.5rem 0.2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--app-shell-muted)', opacity: 0.8 }}>DwarPal v1.0</span>
      </div>
    </aside>
  )
}

function AdminHeader({ currentUser, title, subtitle, onRefresh, refreshing, onToggleSidebar, onOpenSupport, onLogout }) {
  return (
    <header className="admin-header">
      <div className="admin-header-title-section" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          type="button"
          className="admin-hamburger-button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSidebar && onToggleSidebar()
          }}
          aria-label="Toggle sidebar menu"
        >
          <Menu size={22} />
        </button>
        <div>
          <p className="admin-eyebrow">DwarPal Admin Portal</p>
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
            <CircleHelp size={18} />
          </button>
        ) : null}
        
        <Link
          className="admin-icon-button"
          to={`/${currentUser.role}/dashboard`}
          title="User Dashboard"
          aria-label="User Dashboard"
        >
          <LayoutDashboard size={18} />
        </Link>

        <button
          type="button"
          className="admin-icon-button admin-logout-button"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>

        <div className="admin-header-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--app-surface-border)', margin: '0 4px' }} />

        <button
          type="button"
          className="admin-icon-button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh admin data"
          title="Refresh Data"
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
        </button>
        <div className="admin-header-user">
          <div className="header-avatar">
            <User size={16} />
          </div>
          <div className="user-details">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.employeeId || currentUser.enrollment || currentUser.role?.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function StatCard({ label, value, icon: Icon, tone = '' }) {
  return (
    <article className={`admin-stat-card ${tone}`}>
      <div className="admin-stat-icon">{Icon ? <Icon size={18} /> : null}</div>
      <div>
        <p>{label}</p>
        <strong>{formatMetric(value)}</strong>
      </div>
    </article>
  )
}

function FilterSelect({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function FilterInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SectionTabs({ title, value, options, onChange, locked = false }) {
  return (
    <div className="admin-section-tabs">
      <span>{title}</span>
      <div className="admin-segment-group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            disabled={locked && value !== option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ExportFilterPanel({ filters, options, onChange, onReset, lockedPartition = '' }) {
  const allowedReports = readAllowedReportTypes(options)
  const filterOptions = options?.filters || {}
  const people = options?.people || {}
  const access = options?.access || {}
  const isCoord = Boolean(access.coordinatorScope?.isCoordinator)
  const coordScope = access.coordinatorScope || {}

  return (
    <section className="admin-filter-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Filters</p>
          <h2>Data Scope & Search</h2>
          <span>Neutral defaults stay unselected until you choose a scope or search term.</span>
        </div>
        <button type="button" className="admin-text-button" onClick={onReset}>
          Clear filters
        </button>
      </div>

      <div className="admin-filter-grid">
        <FilterSelect label="Report type" value={filters.reportType} onChange={(value) => onChange('reportType', value)}>
          {allowedReports.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Date preset" value={filters.datePreset} onChange={(value) => onChange('datePreset', value)}>
          <option value="">All dates</option>
          <option value="custom">Custom Range</option>
          {(filterOptions.datePresets || []).map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, ' ')}
            </option>
          ))}
        </FilterSelect>
        {filters.datePreset === 'custom' ? (
          <>
            <FilterInput
              label="Date From"
              type="date"
              value={filters.from || ''}
              onChange={(value) => onChange('from', value)}
            />
            <FilterInput
              label="Date To"
              type="date"
              value={filters.to || ''}
              onChange={(value) => onChange('to', value)}
            />
          </>
        ) : null}
        {!isCoord && (
          <FilterSelect label="Role type" value={filters.roleType} onChange={(value) => onChange('roleType', value)}>
            <option value="">All roles</option>
            {(filterOptions.roleTypes || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect label="Status" value={filters.status} onChange={(value) => onChange('status', value)}>
          <option value="">All statuses</option>
          {(filterOptions.statuses || []).map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, ' ')}
            </option>
          ))}
        </FilterSelect>
      </div>

      <details className="admin-filter-section" open>
        <summary>
          <Search size={17} />
          Search fields
        </summary>
        <div className="admin-filter-grid">
          <FilterInput
            label="Global search"
            value={filters.personSearch}
            onChange={(value) => onChange('personSearch', value)}
            placeholder="Name, enrollment, employee ID, email"
          />
          <FilterInput label="Name" value={filters.name} onChange={(value) => onChange('name', value)} placeholder="Search by full name" />
          <FilterInput
            label="Enrollment no"
            value={filters.enrollmentNo}
            onChange={(value) => onChange('enrollmentNo', value)}
            placeholder="Student enrollment number"
          />
          <FilterInput
            label="Employee ID"
            value={filters.employeeId}
            onChange={(value) => onChange('employeeId', value)}
            placeholder="Faculty or staff employee ID"
          />
        </div>
      </details>

      <details className="admin-filter-section" open>
        <summary>
          <SlidersHorizontal size={17} />
          Academic and user scope
        </summary>
        <div className="admin-filter-grid">
          {!isCoord && (
            <FilterSelect label="Data partition" value={filters.recordPartition} onChange={(value) => onChange('recordPartition', value)} disabled={Boolean(lockedPartition)}>
              {(filterOptions.recordPartitions || ['students', 'faculty', 'mixed']).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
          )}
          <FilterSelect 
            label="Department" 
            value={isCoord ? coordScope.department : filters.department} 
            onChange={(value) => onChange('department', value)}
            disabled={isCoord}
          >
            {isCoord ? (
              <option value={coordScope.department}>{coordScope.department}</option>
            ) : (
              <>
                <option value="">All departments</option>
                {(filterOptions.departments || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </>
            )}
          </FilterSelect>
          <FilterSelect 
            label="Program" 
            value={isCoord ? coordScope.program : filters.program} 
            onChange={(value) => onChange('program', value)}
            disabled={isCoord}
          >
            {isCoord ? (
              <option value={coordScope.program}>{coordScope.program}</option>
            ) : (
              <>
                <option value="">All programs</option>
                {(filterOptions.programs || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </>
            )}
          </FilterSelect>
          <FilterSelect 
            label="Semester" 
            value={isCoord ? coordScope.semester : filters.semester} 
            onChange={(value) => onChange('semester', value)}
            disabled={isCoord}
          >
            {isCoord ? (
              <option value={coordScope.semester}>Semester {coordScope.semester}</option>
            ) : (
              <>
                <option value="">All semesters</option>
                {(filterOptions.semesters || []).map((item) => (
                  <option key={item} value={item}>
                    Semester {item}
                  </option>
                ))}
              </>
            )}
          </FilterSelect>
          <FilterSelect label="Student" value={filters.studentId} onChange={(value) => onChange('studentId', value)}>
            <option value="">Any student</option>
            {(people.students || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </FilterSelect>
          {!isCoord && (
            <FilterSelect label="Faculty" value={filters.facultyId} onChange={(value) => onChange('facultyId', value)}>
              <option value="">Any faculty</option>
              {(people.faculty || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </FilterSelect>
          )}
        </div>
        {!isCoord && (
          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={filters.coordinatorOnly}
              onChange={(event) => onChange('coordinatorOnly', event.target.checked)}
            />
            <span>Only coordinator records</span>
          </label>
        )}
      </details>

      <details className="admin-filter-section">
        <summary>
          <Building2 size={17} />
          Workflow and export details
        </summary>
        <div className="admin-filter-grid">
          <FilterSelect label="Gatepass type" value={filters.gatepassType} onChange={(value) => onChange('gatepassType', value)}>
            <option value="">All gatepasses</option>
            <option value="student">Student gatepasses</option>
            <option value="faculty">Faculty gatepasses</option>
          </FilterSelect>
          <FilterSelect label="Leave type" value={filters.leaveType} onChange={(value) => onChange('leaveType', value)}>
            <option value="">All leave types</option>
            {[
              'Academic On Duty',
              'Casual Leave',
              'Compensatory Off',
              'Leave Without Pay',
              'Maternity Leave',
              'On Duty',
              'Paternity Leave',
              'Short Leave',
              'Summer Vacation',
              'Wedding Leave'
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Vehicle" value={filters.vehicleMode} onChange={(value) => onChange('vehicleMode', value)}>
            <option value="all">All</option>
            <option value="vehicle">Vehicle only</option>
            <option value="no_vehicle">No vehicle</option>
          </FilterSelect>
          <FilterInput
            label="Approved by"
            value={filters.approvedBy}
            onChange={(value) => onChange('approvedBy', value)}
            placeholder="Reviewer or approver name / ID"
          />
          <FilterInput
            label="Load adjustment"
            value={filters.loadAdjustmentType}
            onChange={(value) => onChange('loadAdjustmentType', value)}
            placeholder="Subject, class, faculty"
          />
          <FilterInput label="Gatepass from" type="date" value={filters.from} onChange={(value) => onChange('from', value)} />
          <FilterInput label="Gatepass to" type="date" value={filters.to} onChange={(value) => onChange('to', value)} />
          <FilterInput label="Created from" type="date" value={filters.createdFrom} onChange={(value) => onChange('createdFrom', value)} />
          <FilterInput label="Created to" type="date" value={filters.createdTo} onChange={(value) => onChange('createdTo', value)} />
        </div>
      </details>

      <label className="admin-check-row">
        <input
          type="checkbox"
          checked={filters.includeSeparateStudentSheets}
          onChange={(event) => onChange('includeSeparateStudentSheets', event.target.checked)}
        />
        <span>Add separate per-user detail sheets when exporting</span>
      </label>
    </section>
  )
}

function PreviewPanel({ preview, loading, error, selectedCount }) {
  if (loading) {
    return <section className="admin-preview-panel">Generating preview...</section>
  }

  if (error) {
    return <section className="admin-preview-panel error">{error}</section>
  }

  const summary = preview?.summary || {}
  const userCounts = preview?.userCounts || {}

  return (
    <section className="admin-preview-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Preview</p>
          <h2>{preview?.empty ? 'No records found' : `${formatMetric(preview?.recordCount)} detailed rows ready`}</h2>
          <span>{selectedCount ? `${formatMetric(selectedCount)} selected record(s) prepared for single or multi-export.` : 'Use the table below to select one, many, or filtered records.'}</span>
        </div>
      </div>
      <div className="admin-stat-grid compact">
        <StatCard label="Students" value={userCounts.students} icon={Users} />
        <StatCard label="Faculty" value={userCounts.faculty} icon={UserRoundCog} />
        <StatCard label="Selected" value={selectedCount} icon={ShieldCheck} tone="info" />
        <StatCard label="Pending" value={summary.totalPending} icon={History} tone="warning" />
      </div>
      {preview?.busiestDepartment ? (
        <div className="admin-insight-strip">
          <Building2 size={18} />
          <span>
            Highest activity: <strong>{preview.busiestDepartment.department}</strong> with{' '}
            {formatMetric(preview.busiestDepartment.totalGatepasses)} gatepasses.
          </span>
        </div>
      ) : null}
    </section>
  )
}

function RecordsPanel({
  rows,
  meta,
  loading,
  selectedRows,
  currentFormat,
  exportBusy,
  onToggleRow,
  onToggleAllVisible,
  onExport,
  onClearFilters,
  onClearSelection,
  onPageChange,
  onStudentClick,
  activeSection = 'export',
  personSearchVal = '',
  onSearchChange,
}) {
  const selectedCount = Object.keys(selectedRows).length
  const selectableRows = rows.filter((row) => row.id)
  const visibleRowKeys = selectableRows.map((row) => row.rowKey)
  const allVisibleSelected = visibleRowKeys.length > 0 && visibleRowKeys.every((key) => Boolean(selectedRows[key]))
  const formatLabel = currentFormat === 'pdf' ? 'PDF' : 'Excel'

  return (
    <section className="admin-records-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">{activeSection === 'students' ? 'Students List' : 'Admin Data Table'}</p>
          <h2>{activeSection === 'students' ? 'Class Student Roster' : 'Filtered records'}</h2>
          <span>{activeSection === 'students' ? 'Click a student row to view their complete gatepass timeline.' : 'Search, paginate, select one row, or export mixed selected records from the current scope.'}</span>
        </div>
      </div>

      {activeSection !== 'students' && (
        <div className="admin-table-toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          {activeSection === 'students' && onSearchChange && (
            <div className="admin-search-wrapper" style={{ position: 'relative', minWidth: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--app-shell-muted)' }} />
              <input
                type="text"
                placeholder="Search students..."
                value={personSearchVal}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{
                  paddingLeft: '32px',
                  height: '2.2rem',
                  width: '100%',
                  borderRadius: '6px',
                  border: '1px solid var(--control-border)',
                  background: 'var(--app-surface)',
                  color: 'var(--app-shell-text)'
                }}
              />
            </div>
          )}
          <div className="admin-table-selection" style={{ marginLeft: activeSection === 'students' ? '0' : 'auto' }}>
            <span className="admin-selection-count">{formatMetric(selectedCount)} selected</span>
            {selectedCount ? (
              <button type="button" className="admin-text-button" onClick={onClearSelection}>
                Clear selection
              </button>
            ) : null}
          </div>
          <div className="admin-inline-actions" style={{ marginLeft: activeSection === 'students' ? 'auto' : '0' }}>
            <button
              type="button"
              className="admin-primary-button inline"
              onClick={() => onExport('selected')}
              disabled={!selectedCount || exportBusy}
            >
              <Download size={16} />
              <span>{exportBusy ? 'Generating...' : `Export Selected ${formatLabel}`}</span>
            </button>
            <button type="button" className="admin-secondary-link" onClick={() => onExport('filtered')} disabled={exportBusy}>
              Export Filtered
            </button>
            <button type="button" className="admin-secondary-link" onClick={() => onExport('bulk')} disabled={exportBusy}>
              Export Full Data
            </button>
            <button type="button" className="admin-text-button" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-empty-state">Loading records...</div>
      ) : rows.length ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-record-table">
              <thead>
                <tr>
                  {activeSection !== 'students' && (
                    <th>
                      <input type="checkbox" checked={allVisibleSelected} onChange={(event) => onToggleAllVisible(event.target.checked)} />
                    </th>
                  )}
                  <th>Name</th>
                  <th>ID</th>
                  <th className="col-user-type">User Type</th>
                  <th className="col-dept">Department</th>
                  <th className="col-prog-sem">Program / Semester</th>
                  <th className="col-contact">Contact</th>
                  <th>Total</th>
                  <th>Approved</th>
                  <th className="col-rejected">Rejected</th>
                  <th className="col-pending">Pending</th>
                  <th className="col-out-ret">Out / Returned</th>
                  <th className="col-last-act">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const handleRowClick = (event) => {
                    if (event.target.type === 'checkbox' || event.target.closest('td:first-child')) {
                      if (activeSection !== 'students') return
                    }
                    if (row.userType === 'student' && onStudentClick) {
                      onStudentClick(row)
                    }
                  }
                  
                  return (
                    <tr 
                      key={row.rowKey} 
                      onClick={handleRowClick}
                      style={{ cursor: row.userType === 'student' ? 'pointer' : 'default' }}
                      className={row.userType === 'student' ? 'interactive-row' : ''}
                    >
                      {activeSection !== 'students' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedRows[row.rowKey])}
                            disabled={!row.id}
                            onChange={() => onToggleRow(row)}
                          />
                        </td>
                      )}
                    <td>
                      <div className="admin-record-primary">
                        <strong>{row.name}</strong>
                        <span>{row.email || row.phone || 'No contact available'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="admin-record-badge">{row.primaryId || 'Not available'}</span>
                    </td>
                    <td className="col-user-type">
                      <span className="admin-record-type">{[row.userType, row.roleType].filter(Boolean).join(' / ')}</span>
                    </td>
                    <td className="col-dept">{row.department || 'All departments'}</td>
                    <td className="col-prog-sem">{[row.program, row.semester ? `Sem ${row.semester}` : ''].filter(Boolean).join(' | ') || 'Not applicable'}</td>
                    <td className="col-contact">{[row.phone, row.email].filter(Boolean).join(' | ') || 'Not available'}</td>
                    <td>{formatMetric(row.totalRequests)}</td>
                    <td>{formatMetric(row.approvedCount)}</td>
                    <td className="col-rejected">{formatMetric(row.rejectedCount)}</td>
                    <td className="col-pending">{formatMetric(row.pendingCount)}</td>
                    <td className="col-out-ret">{`${formatMetric(row.outCount)} / ${formatMetric(row.returnedCount)}`}</td>
                    <td className="col-last-act">{formatDateTime(row.lastActivityAt)}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
          <div className="admin-pager">
            <button type="button" className="admin-icon-button" onClick={() => onPageChange(meta.page - 1)} disabled={!meta.hasPrevPage}>
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {meta.page || 1} of {meta.totalPages || 1}
            </span>
            <button type="button" className="admin-icon-button" onClick={() => onPageChange(meta.page + 1)} disabled={!meta.hasNextPage}>
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      ) : (
        <div className="admin-empty-state">No records match the current filters.</div>
      )}
    </section>
  )
}

function HistoryPanel({ history, loading, onRefresh }) {
  return (
    <section className="admin-history-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Saved Export History</p>
          <h2>Recent generated reports</h2>
        </div>
        <button type="button" className="admin-text-button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="admin-empty-state">Loading export history...</div>
      ) : history.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report</th>
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
                  <td>{item.exportFormat?.toUpperCase()}</td>
                  <td>{item.generatedBy?.fullName || item.generatedBySnapshot?.name || 'Admin'}</td>
                  <td>{formatDateTime(item.generatedAt)}</td>
                  <td>
                    <span className={`admin-status ${item.status}`}>{item.status}</span>
                  </td>
                  <td>{formatMetric(item.recordCount)}</td>
                  <td>{item.fileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty-state">No export history yet.</div>
      )}
    </section>
  )
}

function DashboardOverview({ preview, options, currentUser, onStudentClick }) {
  const summary = preview?.summary || {}
  const access = options?.access || preview?.access || {}
  const [searchQuery, setSearchQuery] = useState('')

  const isCoord = Boolean(currentUser?.isCoordinator || currentUser?.coordinatorAssignment?.isCoordinator || currentUser?.coordinatorScope?.isCoordinator)
  const studentLeaderboard = preview?.studentLeaderboard || []
  const weeklyTrend = preview?.weeklyTrend || []
  const activeInactiveRatio = preview?.activeInactiveRatio || { active: 0, inactive: 0 }

  const sortedLeaderboard = useMemo(() => {
    return [...studentLeaderboard].sort((a, b) => (b.totalGatepasses || 0) - (a.totalGatepasses || 0))
  }, [studentLeaderboard])

  const filteredLeaderboard = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return sortedLeaderboard
    return sortedLeaderboard.filter((s) => 
      String(s.name || '').toLowerCase().includes(q) || 
      String(s.enrollmentNo || '').toLowerCase().includes(q)
    )
  }, [sortedLeaderboard, searchQuery])

  const activeCount = activeInactiveRatio.active || 0
  const pendingCount = summary.totalPending || 0
  const approvedCount = summary.totalApproved || 0
  const totalCount = preview?.recordCount || summary.totalGatepasses || 0

  const card4 = isCoord
    ? { label: 'Rejected Passes', value: summary.totalRejected || 0, icon: XCircle, tone: 'danger' }
    : currentUser?.role === 'hod'
      ? { label: 'Active Outside', value: activeCount, icon: SlidersHorizontal, tone: 'info' }
      : { label: 'Faculty Leaves', value: summary.totalFacultyRequests || 0, icon: UserRoundCog, tone: 'info' }

  const showLeaderboard = studentLeaderboard.length > 0 || isCoord || ['hod', 'principal', 'admin', 'cao'].includes(currentUser?.role)

  const pieData = [
    { label: 'Active', value: activeCount, color: '#3B82F6' },
    { label: 'Returned / Inactive', value: activeInactiveRatio.inactive || 0, color: '#9CA3AF' }
  ]

  return (
    <div className="admin-page-stack">
      {/* Welcome Scope Banner */}
      <div className="admin-welcome-banner">
        <div className="admin-welcome-copy">
          <p className="admin-eyebrow">DwarPal Management Panel</p>
          <h2>Welcome back, {currentUser.name}</h2>
          <span>
            Overseeing campus security, logs, and activity records for your assigned scope.
          </span>
        </div>
        <div className="admin-welcome-badges">
          <div className="admin-welcome-badge">
            <span className="label">Access Level</span>
            <span className="val">{access.role || currentUser.role?.toUpperCase()}</span>
          </div>
          <div className="admin-welcome-badge">
            <span className="label">Department</span>
            <span className="val">{access.department || 'All Departments'}</span>
          </div>
          <div className="admin-welcome-badge">
            <span className="label">Scope Type</span>
            <span className="val">{access.scopeType || 'Role Scoped'}</span>
          </div>
        </div>
      </div>

      {/* Stats Metric Cards Grid */}
      <div className="admin-stat-grid">
        <StatCard label="Total Gatepasses" value={totalCount} icon={ClipboardList} />
        <StatCard label="Approved Passes" value={approvedCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Pending Review" value={pendingCount} icon={History} tone="warning" />
        <StatCard label={card4.label} value={card4.value} icon={card4.icon} tone={card4.tone} />
      </div>

      {/* Main Analytics Grid layout */}
      <div className="admin-dashboard-grid">
        {/* Column 1: Activity Leaderboard */}
        {showLeaderboard && (
          <section className="admin-wide-panel admin-leaderboard-card">
            <div className="admin-panel-heading" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div>
                <p className="admin-eyebrow">Student Ledger</p>
                <h2>Gatepass Leaderboard</h2>
                <span className="subtext">Students sorted by number of gatepasses taken. Click to inspect complete logs.</span>
              </div>
              <div className="admin-search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search student or enrollment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
              </div>
            </div>
            
            <div className="admin-table-wrap leaderboard-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Enrollment Number</th>
                    <th className="text-right">Total Passes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.length ? (
                    filteredLeaderboard.map((student) => (
                      <tr 
                        key={student.user?._id || student.enrollmentNo || student.id} 
                        onClick={() => onStudentClick && onStudentClick(student)}
                        className="leaderboard-row"
                      >
                        <td>
                          <strong className="student-name">{student.name}</strong>
                        </td>
                        <td>
                          <span className="student-enrollment">{student.enrollmentNo}</span>
                        </td>
                        <td className="text-right">
                          <span className="status-badge approved">{student.totalGatepasses || student.totalRequests || 0}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center empty-cell">
                        No student activity found within your scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Column 2: visual widgets */}
        <div className="admin-charts-column">
          <section className="admin-wide-panel admin-chart-panel-card">
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">Trends</p>
                <h2>Weekly Volumes</h2>
              </div>
            </div>
            <div className="mini-chart-container">
              <SvgLineChart data={weeklyTrend} height={150} />
            </div>
          </section>

          <section className="admin-wide-panel admin-chart-panel-card">
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">Distribution</p>
                <h2>Active Status</h2>
              </div>
            </div>
            <div className="mini-chart-container pie-container">
              <SvgPieChart data={pieData} size={140} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StudentDetailModal({ student, onClose }) {
  const [gatepasses, setGatepasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const studentId = student?.id || student?.user?._id
    if (!studentId) return

    setLoading(true)
    setError('')
    fetchAdminExportRecords({
      studentId,
      recordPartition: 'students',
      reportType: 'individual_student_history',
      detailLevel: 'detailed_only'
    })
      .then((res) => {
        setGatepasses(res.rows || [])
      })
      .catch((err) => {
        console.error(err)
        setError('Failed to fetch gatepass history.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [student])

  if (!student) return null

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }} onClick={onClose}>
      <div className="admin-wide-panel" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem', background: 'var(--app-surface)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', borderRadius: '12px' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--app-surface-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div>
            <p className="admin-eyebrow" style={{ margin: 0 }}>Student Profile & History</p>
            <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', color: 'var(--app-shell-text)' }}>{student.name}</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--app-shell-muted)' }}>
              {student.enrollmentNo || student.primaryId} | {student.program} {student.semester ? `Semester ${student.semester}` : ''} ({student.department})
            </span>
          </div>
          <button type="button" className="admin-text-button" style={{ fontSize: '1.5rem', padding: '0.25rem 0.5rem', lineHeight: '1', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--app-shell-muted)' }} onClick={onClose}>&times;</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--app-shell-bg, #F8FAFC)', border: '1px solid var(--app-surface-border)' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', color: 'var(--app-shell-muted)' }}>Contact Details</p>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Email: {student.email || 'N/A'}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Phone: {student.phone || 'N/A'}</p>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'var(--app-shell-bg, #F8FAFC)', border: '1px solid var(--app-surface-border)' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', color: 'var(--app-shell-muted)' }}>Summary Stats</p>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span>Total: <strong>{student.totalGatepasses || student.totalRequests || 0}</strong></span>
              <span style={{ color: '#10B981' }}>Approved: <strong>{student.approvedCount || 0}</strong></span>
              <span style={{ color: '#F59E0B' }}>Pending: <strong>{student.pendingCount || 0}</strong></span>
              <span style={{ color: '#EF4444' }}>Rejected: <strong>{student.rejectedCount || 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Gatepass Timeline list */}
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--app-shell-text)' }}>Gatepass History Log</h3>
        
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', minHeight: '200px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--app-shell-muted)' }}>Loading gatepass timeline...</div>
          ) : error ? (
            <div style={{ color: 'var(--danger)', padding: '1rem', textAlign: 'center' }}>{error}</div>
          ) : gatepasses.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {gatepasses.map((gp, idx) => (
                <div key={gp.rowKey || idx} style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--app-surface-border)', background: 'var(--app-surface)', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--app-shell-text)' }}>
                      #{gp.requestNumber || 'Gatepass'}
                    </span>
                    <span className={`status-badge ${gp.approvalStatus === 'completed' ? 'approved' : gp.approvalStatus === 'checked_out_by_security' ? 'out' : gp.approvalStatus.startsWith('rejected') ? 'rejected' : 'pending'}`}>
                      {gp.approvalStatus?.replace(/_/g, ' ') || 'Pending'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--app-shell-muted)' }}>
                    <div>
                      <strong>Departure:</strong> {formatDateTime(gp.gatepassDate)}
                    </div>
                    <div>
                      <strong>Expected Return:</strong> {gp.returnTime || 'N/A'}
                    </div>
                    {gp.actualReturnTime && (
                      <div>
                        <strong>Returned At:</strong> {formatDateTime(gp.actualReturnTime)}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', borderTop: '1px solid var(--app-surface-border)', paddingTop: '0.5rem' }}>
                    <p style={{ margin: '0 0 0.25rem 0' }}><strong>Reason:</strong> {gp.reason}</p>
                    <p style={{ margin: '0 0 0.25rem 0' }}><strong>Destination:</strong> {gp.destination || 'N/A'} {gp.vehicleNumber ? `| Vehicle: ${gp.vehicleNumber}` : ''}</p>
                    {gp.rejectionReason && (
                      <p style={{ margin: 0, color: 'var(--danger)' }}><strong>Rejection Comment:</strong> {gp.rejectionReason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--app-shell-muted)' }}>No gatepasses found.</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--app-surface-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="admin-primary-button inline" onClick={onClose}>Close Profile</button>
        </div>
        
      </div>
    </div>
  )
}

function SvgPieChart({ data, size = 180 }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: 'auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={size / 2.5} fill="var(--app-surface-border, #E5E7EB)" />
        </svg>
        <span style={{ fontSize: '0.85rem', color: 'var(--app-shell-muted)' }}>No data available</span>
      </div>
    )
  }
  
  let accumulatedAngle = -90
  const radius = size / 3
  const cx = size / 2
  const cy = size / 2
  
  const slices = data.map((item) => {
    if (item.value === 0) return null
    const percentage = item.value / total
    const angle = percentage * 360
    
    const startAngleRad = (accumulatedAngle * Math.PI) / 180
    const endAngleRad = ((accumulatedAngle + angle) * Math.PI) / 180
    
    const x1 = cx + radius * Math.cos(startAngleRad)
    const y1 = cy + radius * Math.sin(startAngleRad)
    const x2 = cx + radius * Math.cos(endAngleRad)
    const y2 = cy + radius * Math.sin(endAngleRad)
    
    const largeArcFlag = angle > 180 ? 1 : 0
    
    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ')
    
    accumulatedAngle += angle
    
    return {
      pathData,
      color: item.color,
      label: item.label,
      value: item.value,
      percentage: (percentage * 100).toFixed(1)
    }
  }).filter(Boolean)
  
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', width: '100%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.pathData}
            fill={slice.color}
            style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
            title={`${slice.label}: ${slice.value} (${slice.percentage}%)`}
          />
        ))}
        <circle cx={cx} cy={cy} r={radius * 0.5} fill="var(--app-surface, #ffffff)" />
      </svg>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '120px' }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: item.color }} />
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

function SvgLineChart({ data, width = 360, height = 180 }) {
  if (!data || data.length === 0) {
    return <span style={{ fontSize: '0.85rem', color: 'var(--app-shell-muted)', margin: 'auto' }}>No trend data available</span>
  }
  
  const counts = data.map((d) => d.count)
  const maxCount = Math.max(...counts, 5)
  
  const paddingLeft = 35
  const paddingRight = 15
  const paddingTop = 15
  const paddingBottom = 25
  
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  
  const pointsCount = data.length
  const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth
  
  const points = data.map((d, i) => {
    const x = paddingLeft + i * stepX
    const y = paddingTop + chartHeight - (d.count / maxCount) * chartHeight
    return { x, y, label: d.week, count: d.count }
  })
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : ''
    
  const gridLinesCount = 4
  const gridLines = Array.from({ length: gridLinesCount + 1 }).map((_, i) => {
    const y = paddingTop + (i / gridLinesCount) * chartHeight
    const value = Math.round(maxCount - (i / gridLinesCount) * maxCount)
    return { y, value }
  })
  
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {gridLines.map((line, i) => (
        <g key={i}>
          <line
            x1={paddingLeft}
            y1={line.y}
            x2={width - paddingRight}
            y2={line.y}
            stroke="var(--app-surface-border, #E5E7EB)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <text
            x={paddingLeft - 8}
            y={line.y + 3}
            textAnchor="end"
            fontSize="8"
            fill="var(--app-shell-muted, #9CA3AF)"
          >
            {line.value}
          </text>
        </g>
      ))}
      
      {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}
      
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#ffffff"
            stroke="#3B82F6"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
          />
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fontSize="7"
            fontWeight="bold"
            fill="#2563EB"
          >
            {p.count}
          </text>
          <text
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="8"
            fill="var(--app-shell-muted, #9CA3AF)"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function GatepassOpsPage({ preview }) {
  const summary = preview?.summary || {}
  
  const data = [
    { label: 'Approved', value: summary.totalApproved || 0, color: '#10B981' },
    { label: 'Pending', value: summary.totalPending || 0, color: '#F59E0B' },
    { label: 'Rejected', value: summary.totalRejected || 0, color: '#EF4444' },
    { label: 'Out', value: summary.totalOut || 0, color: '#3B82F6' },
    { label: 'Returned', value: summary.totalReturned || 0, color: '#6B7280' },
  ]
  
  return (
    <div className="admin-page-stack">
      <div className="gatepass-ops-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div className="admin-page-stack">
          <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <StatCard label="Total" value={summary.totalGatepasses} icon={ClipboardList} />
            <StatCard label="Approved" value={summary.totalApproved} icon={ShieldCheck} tone="success" />
            <StatCard label="Pending" value={summary.totalPending} icon={History} tone="warning" />
            <StatCard label="Rejected" value={summary.totalRejected} icon={XCircle} tone="danger" />
            <StatCard label="Out" value={summary.totalOut} icon={ClipboardList} />
            <StatCard label="Return" value={summary.totalReturned} icon={History} />
          </div>
        </div>
        
        <section className="admin-wide-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 1rem 0', alignSelf: 'flex-start' }}>Status Distribution</h3>
          <SvgPieChart data={data} size={180} />
        </section>
      </div>
    </div>
  )
}

function ReportsPage({ preview }) {
  const weeklyTrend = preview?.weeklyTrend || []
  const activeInactiveRatio = preview?.activeInactiveRatio || { active: 0, inactive: 0 }
  
  const pieData = [
    { label: 'Active', value: activeInactiveRatio.active || 0, color: '#3B82F6' },
    { label: 'Inactive / Completed', value: activeInactiveRatio.inactive || 0, color: '#9CA3AF' }
  ]
  
  return (
    <div className="admin-page-stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem' }}>
        
        <section className="admin-wide-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Trends</p>
              <h2>Weekly Gatepass Activity</h2>
              <span>Weekly volume of gatepasses issued over the last 8 weeks.</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
            <SvgLineChart data={weeklyTrend} />
          </div>
        </section>
        
        <section className="admin-wide-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">Distribution</p>
              <h2>Active vs Inactive</h2>
              <span>Ratio of active (in progress/out) vs inactive (completed/rejected/cancelled) gatepasses.</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
            <SvgPieChart data={pieData} size={180} />
          </div>
        </section>
        
      </div>
    </div>
  )
}

function SettingsPage({ currentUser, options }) {
  const access = options?.access || {}
  return (
    <section className="admin-wide-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Settings</p>
          <h2>Admin access profile</h2>
        </div>
      </div>
      <div className="admin-info-grid">
        <span>Name</span>
        <strong>{currentUser.name}</strong>
        <span>Role</span>
        <strong>{currentUser.role}</strong>
        <span>Scope Type</span>
        <strong>{access.scopeType || 'user'}</strong>
        <span>Permissions</span>
        <strong>{currentUser.permissions?.length ? currentUser.permissions.join(', ') : 'Default role permissions'}</strong>
        <span>Coordinator</span>
        <strong>{currentUser.isCoordinator || currentUser.coordinatorScope?.isCoordinator ? 'Yes' : 'No'}</strong>
      </div>
    </section>
  )
}

function ExportWorkspace({
  activeSection,
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
  onExportFormatChange,
  onDownload,
  onToggleRow,
  onToggleAllVisible,
  onClearSelection,
  onPageChange,
  onStudentClick,
}) {
  const lockedPartition = getSectionFilterOverrides(activeSection).recordPartition || ''
  const partitionOptions = lockedPartition
    ? [
        {
          value: lockedPartition,
          label:
            lockedPartition === 'students'
              ? 'Students'
              : lockedPartition === 'faculty'
                ? 'Faculty'
                : 'Mixed / Combined',
        },
      ]
    : [
        { value: 'students', label: 'Students' },
        { value: 'faculty', label: 'Faculty' },
        { value: 'mixed', label: 'Mixed / Combined' },
      ]

  const isCoord = Boolean(options?.access?.isCoordinator || options?.access?.scopeType === 'class scoped')
  const isStudentsSectionCoord = activeSection === 'students' && isCoord

  return (
    <div className="admin-export-page">
      {!isStudentsSectionCoord && (
        <>
          <section className="admin-wide-panel admin-toolbar-panel">
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">Export Data</p>
                <h2>Students, faculty, mixed, selected, filtered, and bulk exports</h2>
              </div>
            </div>
            <div className="admin-toolbar-grid">
              <SectionTabs
                title="Partition"
                value={filters.recordPartition}
                locked={Boolean(lockedPartition)}
                onChange={(value) => onFilterChange('recordPartition', value)}
                options={partitionOptions}
              />
              <SectionTabs title="Format" value={exportFormat} onChange={onExportFormatChange} options={FORMAT_TABS} />
              <SectionTabs title="Detail" value={filters.detailLevel} onChange={(value) => onFilterChange('detailLevel', value)} options={DETAIL_LEVEL_OPTIONS} />
            </div>
          </section>

          <div className="admin-export-grid">
            <ExportFilterPanel
              filters={filters}
              options={options}
              onChange={onFilterChange}
              onReset={onResetFilters}
              lockedPartition={lockedPartition}
            />
            <PreviewPanel preview={preview} loading={previewLoading} error={previewError} selectedCount={Object.keys(selectedRows).length} />
          </div>
        </>
      )}

      <RecordsPanel
        rows={records}
        meta={recordsMeta}
        loading={recordsLoading}
        selectedRows={selectedRows}
        currentFormat={exportFormat}
        exportBusy={exportBusy}
        onToggleRow={onToggleRow}
        onToggleAllVisible={onToggleAllVisible}
        onExport={onDownload}
        onClearFilters={onResetFilters}
        onClearSelection={onClearSelection}
        onPageChange={onPageChange}
        onStudentClick={onStudentClick}
        activeSection={activeSection}
        personSearchVal={filters.personSearch || ''}
        onSearchChange={(val) => onFilterChange('personSearch', val)}
      />
    </div>
  )
}

export default function AdminPortal({ currentUser, onLogout, onOpenSupport = null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const activeSection = getAdminSection(location.pathname)
  const isCoord = useMemo(() => {
    return Boolean(currentUser.isCoordinator || currentUser.coordinatorAssignment?.isCoordinator || currentUser.coordinatorScope?.isCoordinator)
  }, [currentUser])

  useEffect(() => {
    if (isCoord && ['faculty', 'coordinators', 'settings', 'history'].includes(activeSection)) {
      navigate('/admin/dashboard', { replace: true })
    }
    if (currentUser?.role === 'it' && !['students', 'student-history', 'settings'].includes(activeSection)) {
      navigate('/admin/students', { replace: true })
    }
    if (currentUser?.role === 'cao' && activeSection === 'students') {
      navigate('/admin/dashboard', { replace: true })
    }
    if (currentUser?.role !== 'it' && activeSection === 'student-history') {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [activeSection, isCoord, currentUser?.role, navigate])

  const showStudentManagement = (activeSection === 'students' || activeSection === 'student-history') && currentUser?.role === 'it'
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [options, setOptions] = useState(null)
  const [preview, setPreview] = useState(null)
  const [records, setRecords] = useState([])
  const [recordsMeta, setRecordsMeta] = useState({})
  const [history, setHistory] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [loadingFormat, setLoadingFormat] = useState('')
  const [exportFormat, setExportFormat] = useState('excel')
  const [selectedRows, setSelectedRows] = useState({})
  const [recordsPage, setRecordsPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null)

  const effectiveFilters = useMemo(() => applySectionFilters(filters, activeSection), [filters, activeSection])
  const requestFilters = useMemo(() => buildFiltersForRequest(effectiveFilters), [effectiveFilters])

  const dataSection = ['export', 'students', 'faculty', 'coordinators'].includes(activeSection) && !showStudentManagement
  const refreshBusy = optionsLoading || previewLoading || recordsLoading

  useEffect(() => {
    setRecordsPage(1)
  }, [activeSection])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsLoading(true)
    fetchAdminExportOptions(
      {
        q: filters.personSearch || filters.name || filters.employeeId || filters.enrollmentNo,
        department: effectiveFilters.department,
        semester: effectiveFilters.semester,
        recordPartition: effectiveFilters.recordPartition,
        coordinatorOnly: effectiveFilters.coordinatorOnly,
      },
      controller.signal,
    )
      .then((result) => {
        setOptions(result)
        const allowedReports = readAllowedReportTypes(result)

        if (allowedReports.length && !allowedReports.some((item) => item.value === effectiveFilters.reportType)) {
          setFilters((previous) => ({ ...previous, reportType: allowedReports[0].value }))
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        toast.error({ title: 'Admin options failed', message: getApiErrorMessage(error, 'Unable to load admin options.') })
      })
      .finally(() => setOptionsLoading(false))

    return () => controller.abort()
  }, [
    effectiveFilters.coordinatorOnly,
    effectiveFilters.department,
    effectiveFilters.recordPartition,
    effectiveFilters.reportType,
    effectiveFilters.semester,
    filters.employeeId,
    filters.enrollmentNo,
    filters.name,
    filters.personSearch,
    toast,
  ])

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError('')
      fetchAdminExportPreview(requestFilters, controller.signal)
        .then((result) => setPreview(result))
        .catch((error) => {
          if (error?.name === 'AbortError') return
          setPreviewError(getApiErrorMessage(error, 'Unable to generate preview.'))
        })
        .finally(() => setPreviewLoading(false))
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [requestFilters])

  useEffect(() => {
    if (!dataSection) {
      setRecords([])
      setRecordsMeta({})
      setRecordsLoading(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setRecordsLoading(true)
      fetchAdminExportRecords({ ...requestFilters, page: recordsPage, limit: 12 }, controller.signal)
        .then((result) => {
          setRecords(result.rows)
          setRecordsMeta(result.meta || {})
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return
          toast.error({ title: 'Record load failed', message: getApiErrorMessage(error, 'Unable to load export records.') })
        })
        .finally(() => setRecordsLoading(false))
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [dataSection, recordsPage, requestFilters, toast])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const result = await fetchAdminExportHistory()
      setHistory(result.history)
    } catch (error) {
      toast.error({ title: 'Export history failed', message: getApiErrorMessage(error, 'Unable to load export history.') })
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeSection === 'history') {
      loadHistory()
    }
  }, [activeSection, loadHistory])

  function handleFilterChange(key, value) {
    setRecordsPage(1)
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  function handleResetFilters() {
    setRecordsPage(1)
    setFilters(DEFAULT_FILTERS)
  }

  function handleToggleRow(row) {
    if (!row?.id) {
      return
    }

    setSelectedRows((previous) => {
      const next = { ...previous }

      if (next[row.rowKey]) {
        delete next[row.rowKey]
        return next
      }

      next[row.rowKey] = row
      return next
    })
  }

  function handleToggleAllVisible(checked) {
    setSelectedRows((previous) => {
      const next = { ...previous }

      records.forEach((row) => {
        if (!row.id) {
          return
        }

        if (checked) {
          next[row.rowKey] = row
        } else {
          delete next[row.rowKey]
        }
      })

      return next
    })
  }

  function handleClearSelection() {
    setSelectedRows({})
  }

  async function handleDownload(exportScope) {
    if (loadingFormat) return

    if (exportScope === 'selected' && !Object.keys(selectedRows).length) {
      toast.warning({ title: 'No rows selected', message: 'Select one or more student or faculty records first.' })
      return
    }

    const format = exportFormat === 'pdf' ? 'pdf' : 'excel'
    const payload = buildExportPayload(filters, activeSection, selectedRows, exportScope)
    setLoadingFormat(format)

    try {
      const result = await downloadAdminExport(format, payload)
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success({ title: 'Export ready', message: `${result.fileName} downloaded successfully.` })
      loadHistory()
    } catch (error) {
      toast.error({ title: 'Export failed', message: getApiErrorMessage(error, 'Unable to generate export.') })
    } finally {
      setLoadingFormat('')
    }
  }

  const titleMap = {
    dashboard: 'Admin Dashboard',
    gatepasses: 'Gatepass Operations',
    students: currentUser?.role === 'it' ? 'Add Student' : 'Students',
    'student-history': 'Student Registration History',
    faculty: 'Faculty',
    coordinators: 'Coordinators',
    reports: 'Reports',
    export: 'Export Center',
    history: 'Export History',
    settings: 'Settings',
  }

  return (
    <div className={`admin-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {sidebarOpen ? (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      ) : null}
      <AdminSidebar
        currentUser={currentUser}
        activeSection={activeSection}
        isOpen={sidebarOpen}
        onLinkClick={() => setSidebarOpen(false)}
      />
      <main className="admin-main">
        <AdminHeader
          currentUser={currentUser}
          title={titleMap[activeSection] || 'Admin Portal'}
          subtitle="Compact college operations, scoped records, and audit-grade exports."
          refreshing={refreshBusy}
          onToggleSidebar={() => {
            if (window.innerWidth > 1100) {
              setSidebarCollapsed((prev) => !prev)
            } else {
              setSidebarOpen((prev) => !prev)
            }
          }}
          onRefresh={() => {
            setRecordsPage(1)
            setFilters((previous) => ({ ...previous }))
            if (activeSection === 'history') {
              loadHistory()
            }
          }}
          onOpenSupport={onOpenSupport}
          onLogout={onLogout}
        />

        {activeSection === 'history' ? <HistoryPanel history={history} loading={historyLoading} onRefresh={loadHistory} /> : null}

        {activeSection === 'dashboard' ? (
          <DashboardOverview
            preview={preview}
            options={options}
            currentUser={currentUser}
            onStudentClick={(student) => setSelectedStudentForModal(student)}
          />
        ) : null}

        {activeSection === 'gatepasses' ? <GatepassOpsPage preview={preview} /> : null}

        {activeSection === 'reports' ? <ReportsPage preview={preview} /> : null}

        {showStudentManagement ? <StudentManagementPanel currentUser={currentUser} activeSection={activeSection} /> : null}

        {activeSection === 'settings' ? <SettingsPage currentUser={currentUser} options={options} /> : null}

        {dataSection ? (
          <ExportWorkspace
            activeSection={activeSection}
            filters={effectiveFilters}
            options={options}
            preview={preview}
            previewLoading={previewLoading}
            previewError={previewError}
            records={records}
            recordsMeta={recordsMeta}
            recordsLoading={recordsLoading}
            exportFormat={exportFormat}
            exportBusy={Boolean(loadingFormat)}
            selectedRows={selectedRows}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            onExportFormatChange={setExportFormat}
            onDownload={handleDownload}
            onToggleRow={handleToggleRow}
            onToggleAllVisible={handleToggleAllVisible}
            onClearSelection={handleClearSelection}
            onPageChange={setRecordsPage}
            onStudentClick={(student) => setSelectedStudentForModal(student)}
          />
        ) : null}

        {selectedStudentForModal ? (
          <StudentDetailModal
            student={selectedStudentForModal}
            onClose={() => setSelectedStudentForModal(null)}
          />
        ) : null}
      </main>
    </div>
  )
}
