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
  Users,
  UserCheck,
  UserRoundCog,
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
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
    { key: 'gatepasses', label: 'Gatepass Ops', icon: ClipboardList, to: '/admin/gatepasses' },
    { key: 'reports', label: 'Reports', icon: BarChart3, to: '/admin/reports' },
  ]

  if (!isSecurity) {
    items.push(
      { key: 'students', label: 'Students', icon: Users, to: '/admin/students' },
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
  if (activeSection === 'students') {
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

function AdminSidebar({ currentUser, activeSection, onLogout, onOpenSupport, isOpen, onLinkClick }) {
  const navItems = getAdminNavItems(currentUser)

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand">
        <AppBrand size="md" align="start" />
      </div>
      <div className="admin-user-chip">
        <strong>{currentUser.name}</strong>
        <span>{[currentUser.role, currentUser.department].filter(Boolean).join(' | ')}</span>
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
      <div className="admin-sidebar-footer">
        {onOpenSupport ? (
          <button type="button" className="admin-secondary-link" onClick={onOpenSupport}>
            <CircleHelp size={16} />
            <span>Help</span>
          </button>
        ) : null}
        <Link className="admin-secondary-link" to={`/${currentUser.role}/dashboard`} onClick={onLinkClick}>
          User Panel
        </Link>
        <button type="button" className="admin-logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

function AdminHeader({ currentUser, title, subtitle, onRefresh, refreshing, onToggleSidebar }) {
  return (
    <header className="admin-header">
      <div className="admin-header-title-section" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          type="button"
          className="admin-hamburger-button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar menu"
        >
          <Menu size={22} />
        </button>
        <div>
          <p className="admin-eyebrow">DwarPal Admin Portal</p>
          <h1>{title}</h1>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="admin-header-actions">
        <button
          type="button"
          className="admin-icon-button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh admin data"
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
        </button>
        <div className="admin-header-user">
          <strong>{currentUser.name}</strong>
          <span>{currentUser.employeeId || currentUser.enrollment || currentUser.role}</span>
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
        <FilterSelect label="Role type" value={filters.roleType} onChange={(value) => onChange('roleType', value)}>
          <option value="">All roles</option>
          {(filterOptions.roleTypes || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
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
          <FilterSelect label="Data partition" value={filters.recordPartition} onChange={(value) => onChange('recordPartition', value)} disabled={Boolean(lockedPartition)}>
            {(filterOptions.recordPartitions || ['students', 'faculty', 'mixed']).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Department" value={filters.department} onChange={(value) => onChange('department', value)}>
            <option value="">All departments</option>
            {(filterOptions.departments || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Program" value={filters.program} onChange={(value) => onChange('program', value)}>
            <option value="">All programs</option>
            {(filterOptions.programs || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Semester" value={filters.semester} onChange={(value) => onChange('semester', value)}>
            <option value="">All semesters</option>
            {(filterOptions.semesters || []).map((item) => (
              <option key={item} value={item}>
                Semester {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Student" value={filters.studentId} onChange={(value) => onChange('studentId', value)}>
            <option value="">Any student</option>
            {(people.students || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Faculty" value={filters.facultyId} onChange={(value) => onChange('facultyId', value)}>
            <option value="">Any faculty</option>
            {(people.faculty || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <label className="admin-check-row">
          <input
            type="checkbox"
            checked={filters.coordinatorOnly}
            onChange={(event) => onChange('coordinatorOnly', event.target.checked)}
          />
          <span>Only coordinator records</span>
        </label>
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
          <p className="admin-eyebrow">Admin Data Table</p>
          <h2>Filtered records</h2>
          <span>Search, paginate, select one row, or export mixed selected records from the current scope.</span>
        </div>
      </div>

      <div className="admin-table-toolbar">
        <div className="admin-table-selection">
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

      {loading ? (
        <div className="admin-empty-state">Loading records...</div>
      ) : rows.length ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-record-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allVisibleSelected} onChange={(event) => onToggleAllVisible(event.target.checked)} />
                  </th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>User Type</th>
                  <th>Department</th>
                  <th>Program / Semester</th>
                  <th>Contact</th>
                  <th>Total</th>
                  <th>Approved</th>
                  <th>Rejected</th>
                  <th>Pending</th>
                  <th>Out / Returned</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
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
                        <span>{row.email || row.phone || 'No contact available'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="admin-record-badge">{row.primaryId || 'Not available'}</span>
                    </td>
                    <td>
                      <span className="admin-record-type">{[row.userType, row.roleType].filter(Boolean).join(' / ')}</span>
                    </td>
                    <td>{row.department || 'All departments'}</td>
                    <td>{[row.program, row.semester ? `Sem ${row.semester}` : ''].filter(Boolean).join(' | ') || 'Not applicable'}</td>
                    <td>{[row.phone, row.email].filter(Boolean).join(' | ') || 'Not available'}</td>
                    <td>{formatMetric(row.totalRequests)}</td>
                    <td>{formatMetric(row.approvedCount)}</td>
                    <td>{formatMetric(row.rejectedCount)}</td>
                    <td>{formatMetric(row.pendingCount)}</td>
                    <td>{`${formatMetric(row.outCount)} / ${formatMetric(row.returnedCount)}`}</td>
                    <td>{formatDateTime(row.lastActivityAt)}</td>
                  </tr>
                ))}
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

function DashboardOverview({ preview, options }) {
  const summary = preview?.summary || {}
  const access = options?.access || preview?.access || {}

  return (
    <div className="admin-page-stack">
      <div className="admin-stat-grid">
        <StatCard label="Detailed Records" value={preview?.recordCount} icon={ClipboardList} />
        <StatCard label="Approved" value={summary.totalApproved} icon={ShieldCheck} tone="success" />
        <StatCard label="Pending" value={summary.totalPending} icon={History} tone="warning" />
        <StatCard label="Faculty Requests" value={summary.totalFacultyRequests} icon={UserRoundCog} />
      </div>
      <section className="admin-wide-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Access Scope</p>
            <h2>{access.scopeType || 'admin'} access</h2>
          </div>
          <Link className="admin-text-button" to="/admin/export">
            Open Export Center
          </Link>
        </div>
        <div className="admin-info-grid">
          <span>Role</span>
          <strong>{access.role || 'admin'}</strong>
          <span>Department</span>
          <strong>{access.department || 'All departments'}</strong>
          <span>Export Scope</span>
          <strong>{access.scopeType || 'role scoped'}</strong>
        </div>
      </section>
    </div>
  )
}

function ReportsPage({ preview }) {
  const summary = preview?.summary || {}
  return (
    <div className="admin-page-stack">
      <section className="admin-wide-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Current Snapshot</p>
            <h2>Operational report summary</h2>
          </div>
          <Link className="admin-text-button" to="/admin/export">
            Build detailed export
          </Link>
        </div>
        <div className="admin-stat-grid compact">
          <StatCard label="Approved" value={summary.totalApproved} icon={ShieldCheck} tone="success" />
          <StatCard label="Rejected" value={summary.totalRejected} icon={FileText} tone="danger" />
          <StatCard label="Out" value={summary.totalOut} icon={ClipboardList} />
          <StatCard label="Returned" value={summary.totalReturned} icon={History} />
        </div>
      </section>
      <section className="admin-wide-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Trend</p>
            <h2>Recent monthly activity</h2>
          </div>
        </div>
        <div className="admin-trend-list">
          {(preview?.monthlyTrend || []).map((item) => (
            <div key={item.month} className="admin-trend-row">
              <strong>{item.month}</strong>
              <span>Students {formatMetric(item.studentGatepasses)}</span>
              <span>Faculty {formatMetric(item.facultyGatepasses)}</span>
              <span>Leave {formatMetric(item.leaveRequests)}</span>
            </div>
          ))}
        </div>
      </section>
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

  return (
    <div className="admin-export-page">
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
      />
    </div>
  )
}

export default function AdminPortal({ currentUser, onLogout, onOpenSupport = null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const activeSection = getAdminSection(location.pathname)
  const showStudentManagement = activeSection === 'students' && currentUser.role === 'cao'
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
    students: 'Students',
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
        onLogout={onLogout}
        onOpenSupport={onOpenSupport}
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
        />

        {activeSection === 'history' ? <HistoryPanel history={history} loading={historyLoading} onRefresh={loadHistory} /> : null}

        {activeSection === 'dashboard' ? <DashboardOverview preview={preview} options={options} /> : null}

        {activeSection === 'reports' || activeSection === 'gatepasses' ? <ReportsPage preview={preview} /> : null}

        {showStudentManagement ? <StudentManagementPanel /> : null}

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
          />
        ) : null}
      </main>
    </div>
  )
}
