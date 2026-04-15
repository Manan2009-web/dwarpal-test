import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRoundCog,
} from 'lucide-react'
import AppBrand from './AppBrand'
import { useToast } from './ToastProvider'
import {
  downloadAdminExport,
  fetchAdminExportHistory,
  fetchAdminExportOptions,
  fetchAdminExportPreview,
  getApiErrorMessage,
} from '../lib/dwarpalApi'

const DEFAULT_FILTERS = {
  reportType: 'all_gatepasses',
  datePreset: 'this_month',
  from: '',
  to: '',
  department: '',
  program: '',
  semester: '',
  division: '',
  academicYear: '',
  studentId: '',
  facultyId: '',
  personSearch: '',
  roleType: '',
  status: '',
  approvedBy: '',
  gatepassType: '',
  leaveType: '',
  loadAdjustmentType: '',
  vehicleMode: 'all',
  exportMode: 'summary',
  includeSeparateStudentSheets: false,
  notes: '',
}

const ADMIN_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
  { key: 'gatepasses', label: 'Gatepasses', icon: ClipboardList, to: '/admin/gatepasses' },
  { key: 'students', label: 'Students', icon: Users, to: '/admin/students' },
  { key: 'faculty', label: 'Faculty', icon: UserRoundCog, to: '/admin/faculty' },
  { key: 'coordinators', label: 'Coordinators', icon: ShieldCheck, to: '/admin/coordinators' },
  { key: 'reports', label: 'Reports', icon: BarChart3, to: '/admin/reports' },
  { key: 'export', label: 'Export Center', icon: Download, to: '/admin/export' },
  { key: 'history', label: 'Export History', icon: History, to: '/admin/export/history' },
  { key: 'settings', label: 'Settings', icon: Settings, to: '/admin/settings' },
]

function getAdminSection(pathname) {
  if (pathname.startsWith('/admin/export/history')) return 'history'
  const section = pathname.split('/')[2] || 'dashboard'
  return section === 'export' ? 'export' : section
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

function buildFiltersForRequest(filters) {
  const request = { ...filters }

  Object.keys(request).forEach((key) => {
    if (request[key] === '' || request[key] === null || request[key] === undefined) {
      delete request[key]
    }
  })

  return request
}

function AdminSidebar({ currentUser, activeSection, onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <AppBrand size="md" align="start" />
      </div>
      <div className="admin-user-chip">
        <strong>{currentUser.name}</strong>
        <span>{[currentUser.role, currentUser.department].filter(Boolean).join(' | ')}</span>
      </div>
      <nav className="admin-nav" aria-label="Admin portal navigation">
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`admin-nav-link ${activeSection === item.key ? 'active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <Link className="admin-secondary-link" to={currentUser.role === 'student' ? '/student/dashboard' : `/${currentUser.role}/dashboard`}>
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

function AdminHeader({ currentUser, title, subtitle, onRefresh, refreshing }) {
  return (
    <header className="admin-header">
      <div>
        <p className="admin-eyebrow">DwarPal Admin Portal</p>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
      <div className="admin-header-actions">
        <button type="button" className="admin-icon-button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh admin data">
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

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
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

function ExportFilterPanel({ filters, options, onChange, onReset }) {
  const allowedReports = readAllowedReportTypes(options)
  const people = options?.people || {}
  const filterOptions = options?.filters || {}

  return (
    <section className="admin-filter-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Filters</p>
          <h2>Report Builder</h2>
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
        <FilterSelect label="Export mode" value={filters.exportMode} onChange={(value) => onChange('exportMode', value)}>
          {(filterOptions.exportModes || ['summary', 'individual', 'per_student']).map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, ' ')}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Date preset" value={filters.datePreset} onChange={(value) => onChange('datePreset', value)}>
          {(filterOptions.datePresets || ['today', 'this_week', 'this_month', 'last_month', 'custom']).map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, ' ')}
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
          <SlidersHorizontal size={17} />
          Date and class scope
        </summary>
        <div className="admin-filter-grid">
          <FilterInput label="From" type="date" value={filters.from} onChange={(value) => onChange('from', value)} />
          <FilterInput label="To" type="date" value={filters.to} onChange={(value) => onChange('to', value)} />
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
          <FilterInput label="Division / class" value={filters.division} onChange={(value) => onChange('division', value)} placeholder="A, B, C" />
          <FilterInput label="Academic year" value={filters.academicYear} onChange={(value) => onChange('academicYear', value)} placeholder="2025-26" />
        </div>
      </details>

      <details className="admin-filter-section">
        <summary>
          <Search size={17} />
          Person and request filters
        </summary>
        <div className="admin-filter-grid">
          <FilterInput label="Person search" value={filters.personSearch} onChange={(value) => onChange('personSearch', value)} placeholder="Name, ID, email" />
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
          <FilterSelect label="Role type" value={filters.roleType} onChange={(value) => onChange('roleType', value)}>
            <option value="">All roles</option>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
          </FilterSelect>
          <FilterSelect label="Gatepass type" value={filters.gatepassType} onChange={(value) => onChange('gatepassType', value)}>
            <option value="">All gatepasses</option>
            <option value="student">Student gatepasses</option>
            <option value="faculty">Faculty gatepasses</option>
          </FilterSelect>
          <FilterSelect label="Vehicle" value={filters.vehicleMode} onChange={(value) => onChange('vehicleMode', value)}>
            <option value="all">All</option>
            <option value="vehicle">Vehicle</option>
            <option value="no_vehicle">No vehicle</option>
          </FilterSelect>
          <FilterSelect label="Leave type" value={filters.leaveType} onChange={(value) => onChange('leaveType', value)}>
            <option value="">All leave types</option>
            {['CL', 'EL', 'SL', 'LWP', 'OD', 'Others'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterInput label="Load adjustment" value={filters.loadAdjustmentType} onChange={(value) => onChange('loadAdjustmentType', value)} placeholder="Subject, class, faculty" />
        </div>
      </details>

      <label className="admin-check-row">
        <input
          type="checkbox"
          checked={filters.includeSeparateStudentSheets}
          onChange={(event) => onChange('includeSeparateStudentSheets', event.target.checked)}
        />
        <span>Individual worksheet for each selected student</span>
      </label>
    </section>
  )
}

function PreviewPanel({ preview, loading, error }) {
  if (loading) {
    return <section className="admin-preview-panel">Generating preview...</section>
  }

  if (error) {
    return <section className="admin-preview-panel error">{error}</section>
  }

  const summary = preview?.summary || {}

  return (
    <section className="admin-preview-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Preview</p>
          <h2>{preview?.empty ? 'No records found' : `${formatMetric(preview?.recordCount)} records ready`}</h2>
        </div>
      </div>
      <div className="admin-stat-grid compact">
        <StatCard label="Gatepasses" value={summary.totalGatepasses} icon={ClipboardList} />
        <StatCard label="Approved" value={summary.totalApproved} icon={ShieldCheck} tone="success" />
        <StatCard label="Rejected" value={summary.totalRejected} icon={FileText} tone="danger" />
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

function ExportCenter({
  filters,
  options,
  preview,
  previewLoading,
  previewError,
  onFilterChange,
  onResetFilters,
  onDownload,
  loadingFormat,
  activeTab,
  onTabChange,
  history,
  historyLoading,
  onRefreshHistory,
}) {
  const canExport = !previewLoading && !previewError && !loadingFormat

  return (
    <div className="admin-export-page">
      <div className="admin-tabs">
        <button type="button" className={activeTab === 'excel' ? 'active' : ''} onClick={() => onTabChange('excel')}>
          <FileSpreadsheet size={17} />
          Excel Export
        </button>
        <button type="button" className={activeTab === 'pdf' ? 'active' : ''} onClick={() => onTabChange('pdf')}>
          <FileText size={17} />
          PDF Export
        </button>
        <button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => onTabChange('history')}>
          <History size={17} />
          Saved Export History
        </button>
      </div>

      {activeTab === 'history' ? (
        <HistoryPanel history={history} loading={historyLoading} onRefresh={onRefreshHistory} />
      ) : (
        <div className="admin-export-grid">
          <ExportFilterPanel filters={filters} options={options} onChange={onFilterChange} onReset={onResetFilters} />
          <div className="admin-export-side">
            <PreviewPanel preview={preview} loading={previewLoading} error={previewError} />
            <section className="admin-download-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">{activeTab === 'pdf' ? 'PDF' : 'Excel'} Download</p>
                  <h2>Generate report</h2>
                </div>
              </div>
              <p>
                Files are generated on the backend with the same scoped filters shown in the preview. Duplicate clicks are blocked while
                the report is being built.
              </p>
              <button
                type="button"
                className="admin-primary-button"
                disabled={!canExport}
                onClick={() => onDownload(activeTab === 'pdf' ? 'pdf' : 'excel')}
              >
                {loadingFormat ? <RefreshCw size={18} className="spin" /> : activeTab === 'pdf' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                <span>
                  {loadingFormat
                    ? 'Generating...'
                    : activeTab === 'pdf'
                      ? 'Download PDF Report'
                      : 'Download Excel Workbook'}
                </span>
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
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
        <StatCard label="Total Gatepasses" value={summary.totalGatepasses} icon={ClipboardList} />
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
        </div>
        <div className="admin-info-grid">
          <span>Role</span>
          <strong>{access.role || 'admin'}</strong>
          <span>Department</span>
          <strong>{access.department || 'All departments'}</strong>
          <span>Coordinator Scope</span>
          <strong>
            {access.coordinatorScope?.isCoordinator
              ? [access.coordinatorScope.department, access.coordinatorScope.semester ? `Sem ${access.coordinatorScope.semester}` : '']
                  .filter(Boolean)
                  .join(' | ')
              : 'Not coordinator scoped'}
          </strong>
        </div>
      </section>
      <section className="admin-wide-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Reports</p>
            <h2>Available report types</h2>
          </div>
          <Link className="admin-text-button" to="/admin/export">
            Open Export Center
          </Link>
        </div>
        <div className="admin-chip-list">
          {readAllowedReportTypes(options).map((item) => (
            <span key={item.value}>{item.label}</span>
          ))}
        </div>
      </section>
    </div>
  )
}

function DirectoryPage({ title, description, rows, type }) {
  return (
    <section className="admin-wide-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">{type}</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
      </div>
      {rows?.length ? (
        <div className="admin-card-grid">
          {rows.map((item) => (
            <article className="admin-directory-card" key={item.id}>
              <strong>{item.label}</strong>
              <span>{[item.department, item.program, item.semester ? `Sem ${item.semester}` : item.role].filter(Boolean).join(' | ')}</span>
              {item.isCoordinator ? <small>Coordinator</small> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">No records available for your current scope.</div>
      )}
    </section>
  )
}

function ReportsPage({ preview }) {
  const summary = preview?.summary || {}
  return (
    <div className="admin-page-stack">
      <section className="admin-wide-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Report Preview</p>
            <h2>Current month report snapshot</h2>
          </div>
          <Link className="admin-text-button" to="/admin/export">
            Build Custom Export
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
            <h2>Monthly activity</h2>
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

function renderAdminPage({
  activeSection,
  currentUser,
  filters,
  options,
  preview,
  previewLoading,
  previewError,
  onFilterChange,
  onResetFilters,
  onDownload,
  loadingFormat,
  exportTab,
  onExportTabChange,
  history,
  historyLoading,
  onRefreshHistory,
}) {
  if (activeSection === 'export' || activeSection === 'history') {
    return (
      <ExportCenter
        filters={filters}
        options={options}
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        onDownload={onDownload}
        loadingFormat={loadingFormat}
        activeTab={activeSection === 'history' ? 'history' : exportTab}
        onTabChange={onExportTabChange}
        history={history}
        historyLoading={historyLoading}
        onRefreshHistory={onRefreshHistory}
      />
    )
  }

  if (activeSection === 'students') {
    return (
      <DirectoryPage
        title="Scoped students"
        description="Students visible to your admin role and coordinator scope."
        rows={options?.people?.students || []}
        type="Students"
      />
    )
  }

  if (activeSection === 'faculty') {
    return (
      <DirectoryPage
        title="Scoped faculty"
        description="Faculty and staff visible to your admin role."
        rows={options?.people?.faculty || []}
        type="Faculty"
      />
    )
  }

  if (activeSection === 'coordinators') {
    return (
      <DirectoryPage
        title="Class coordinators"
        description="Coordinator assignments available in your current scope."
        rows={(options?.people?.faculty || []).filter((item) => item.isCoordinator)}
        type="Coordinators"
      />
    )
  }

  if (activeSection === 'reports' || activeSection === 'gatepasses') {
    return <ReportsPage preview={preview} />
  }

  if (activeSection === 'settings') {
    return <SettingsPage currentUser={currentUser} options={options} />
  }

  return <DashboardOverview preview={preview} options={options} />
}

export default function AdminPortal({ currentUser, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const activeSection = getAdminSection(location.pathname)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [options, setOptions] = useState(null)
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [loadingFormat, setLoadingFormat] = useState('')
  const [exportTab, setExportTab] = useState('excel')

  const requestFilters = useMemo(() => buildFiltersForRequest(filters), [filters])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsLoading(true)
    fetchAdminExportOptions({ q: filters.personSearch, department: filters.department, semester: filters.semester }, controller.signal)
      .then((result) => {
        setOptions(result)
        const allowedReports = readAllowedReportTypes(result)
        if (allowedReports.length && !allowedReports.some((item) => item.value === filters.reportType)) {
          setFilters((previous) => ({ ...previous, reportType: allowedReports[0].value }))
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        toast.error({ title: 'Admin options failed', message: getApiErrorMessage(error, 'Unable to load admin options.') })
      })
      .finally(() => setOptionsLoading(false))

    return () => controller.abort()
  }, [filters.department, filters.personSearch, filters.reportType, filters.semester, toast])

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      const allowedReports = readAllowedReportTypes(options)
      if (options && !allowedReports.length) {
        setPreview(null)
        setPreviewLoading(false)
        setPreviewError('No export permissions are configured for this account.')
        return
      }

      if (options && !allowedReports.some((item) => item.value === filters.reportType)) {
        return
      }

      setPreviewLoading(true)
      setPreviewError('')
      fetchAdminExportPreview(requestFilters, controller.signal)
        .then((result) => setPreview(result))
        .catch((error) => {
          if (error?.name === 'AbortError') return
          setPreviewError(getApiErrorMessage(error, 'Unable to generate preview.'))
        })
        .finally(() => setPreviewLoading(false))
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [filters.reportType, options, requestFilters])

  useEffect(() => {
    if (activeSection === 'history') {
      loadHistory()
    }
  }, [activeSection])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const result = await fetchAdminExportHistory()
      setHistory(result.history)
    } catch (error) {
      toast.error({ title: 'Export history failed', message: getApiErrorMessage(error, 'Unable to load export history.') })
    } finally {
      setHistoryLoading(false)
    }
  }

  function handleFilterChange(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  async function handleDownload(format) {
    if (loadingFormat) return

    setLoadingFormat(format)
    try {
      const result = await downloadAdminExport(format, requestFilters)
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

  function handleExportTabChange(tab) {
    if (tab === 'history') {
      navigate('/admin/export/history')
      return
    }

    setExportTab(tab)
    if (activeSection === 'history') {
      navigate('/admin/export')
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
    <div className="admin-shell">
      <AdminSidebar currentUser={currentUser} activeSection={activeSection} onLogout={onLogout} />
      <main className="admin-main">
        <AdminHeader
          currentUser={currentUser}
          title={titleMap[activeSection] || 'Admin Portal'}
          subtitle="Role-scoped reports, exports, and operational visibility."
          refreshing={optionsLoading || previewLoading}
          onRefresh={() => {
            setFilters((previous) => ({ ...previous }))
            if (activeSection === 'history') loadHistory()
          }}
        />
        {renderAdminPage({
          activeSection,
          currentUser,
          filters,
          options,
          preview,
          previewLoading,
          previewError,
          onFilterChange: handleFilterChange,
          onResetFilters: handleResetFilters,
          onDownload: handleDownload,
          loadingFormat,
          exportTab,
          onExportTabChange: handleExportTabChange,
          history,
          historyLoading,
          onRefreshHistory: loadHistory,
        })}
      </main>
    </div>
  )
}
