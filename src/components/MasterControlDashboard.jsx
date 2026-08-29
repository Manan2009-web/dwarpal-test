import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  SlidersHorizontal,
  FileText,
  Building2,
  ShieldAlert,
  Users,
  Activity,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Phone,
  Mail,
  Clock,
  MapPin,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Eye,
  X,
  ShieldCheck,
  Radio,
  Server,
  Zap,
} from 'lucide-react'
import {
  fetchAdminSiteConfig,
  updateCmsConfig,
  updateRulesConfig,
  updateFeatureFlags,
  setEmergencyLockdown,
  fetchMasterUsers,
  updateMasterUserAccount,
  fetchSystemHealthOverview,
  getApiErrorMessage,
} from '../lib/dwarpalApi'
import { useToast } from './ToastProvider'
import { useSiteConfig } from './SiteConfigContext'
import { ROLE_OPTIONS as ROLES, DEPARTMENTS, PROGRAM_OPTIONS as STUDENT_PROGRAMS, SEMESTER_OPTIONS as SEMESTERS } from '../mockData'

const TABS = [
  { id: 'cms', label: 'CMS & Content', icon: FileText },
  { id: 'rules', label: 'Academic & Pass Rules', icon: Building2 },
  { id: 'flags', label: 'Emergency & Flags', icon: ShieldAlert },
  { id: 'users', label: 'Master User Directory', icon: Users },
  { id: 'health', label: 'System Health & Audit', icon: Activity },
]

export default function MasterControlDashboard({ currentUser }) {
  const toast = useToast()
  const { refreshConfig: refreshGlobalConfig } = useSiteConfig()
  const [activeTab, setActiveTab] = useState('cms')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Full admin configuration state
  const [config, setConfig] = useState(null)

  // CMS Form State
  const [cmsForm, setCmsForm] = useState({
    hero: {
      headline: '',
      subheadline: '',
      badgeText: '',
      ctaPrimaryText: '',
      ctaPrimaryLink: '',
      ctaSecondaryText: '',
      ctaSecondaryLink: '',
    },
    announcementBanner: {
      enabled: false,
      message: '',
      type: 'info',
      link: '',
    },
    support: {
      appName: 'DwarPal',
      supportEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      operatingHours: '',
      officeLocation: '',
    },
    faqs: [],
    branding: {
      siteTitle: '',
      footerText: '',
    },
  })

  // Rules Form State
  const [rulesForm, setRulesForm] = useState({
    departments: [],
    programs: [],
    semesters: [],
    gatepass: {
      minReasonLength: 5,
      maxReasonLength: 500,
      maxActivePassesPerStudent: 1,
      allowedCheckoutStartHour: '06:00',
      allowedCheckoutEndHour: '21:00',
      curfewReturnHour: '22:00',
      allowWeekendPasses: true,
    },
  })

  // New item inputs
  const [newDepartment, setNewDepartment] = useState('')
  const [newProgram, setNewProgram] = useState('')

  // Feature Flags State
  const [featuresForm, setFeaturesForm] = useState({
    maintenanceMode: {
      enabled: false,
      message: '',
    },
    campusLockdown: {
      enabled: false,
      reason: '',
    },
    studentSelfRegistration: {
      enabled: true,
      notice: '',
    },
    biometricAuth: {
      enabled: true,
    },
  })

  // Master Users State
  const [users, setUsers] = useState([])
  const [userMeta, setUserMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 })
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null)
  const [editRoleValue, setEditRoleValue] = useState('')
  const [editStatusValue, setEditStatusValue] = useState('')
  const [resetPasswordValue, setResetPasswordValue] = useState('')

  // System Health State
  const [healthData, setHealthData] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // FAQ Modal
  const [faqModalOpen, setFaqModalOpen] = useState(false)
  const [faqEditIndex, setFaqEditIndex] = useState(-1)
  const [faqQuestion, setFaqQuestion] = useState('')
  const [faqAnswer, setFaqAnswer] = useState('')

  // Load Admin Config
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminSiteConfig()
      if (data) {
        setConfig(data)
        if (data.cms) setCmsForm(data.cms)
        if (data.rules) setRulesForm(data.rules)
        if (data.features) setFeaturesForm(data.features)
      }
    } catch (err) {
      toast.error({
        title: 'Could not load configuration',
        message: getApiErrorMessage(err, 'Failed to fetch Master Control configuration.'),
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Load Master Users
  const loadUsers = useCallback(
    async (page = 1) => {
      setUsersLoading(true)
      try {
        const result = await fetchMasterUsers({
          page,
          limit: 15,
          search: userSearch,
          role: userRoleFilter,
          status: userStatusFilter,
        })
        setUsers(result.users)
        setUserMeta(result.meta)
      } catch (err) {
        toast.error({
          title: 'Failed to load users',
          message: getApiErrorMessage(err, 'Could not retrieve user directory.'),
        })
      } finally {
        setUsersLoading(false)
      }
    },
    [userSearch, userRoleFilter, userStatusFilter, toast],
  )

  // Load System Health
  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const data = await fetchSystemHealthOverview()
      setHealthData(data)
    } catch (err) {
      toast.error({
        title: 'Health check failed',
        message: getApiErrorMessage(err, 'Unable to fetch system health status.'),
      })
    } finally {
      setHealthLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1)
    } else if (activeTab === 'health') {
      loadHealth()
    }
  }, [activeTab, loadUsers, loadHealth])

  // Save CMS
  const handleSaveCms = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      await updateCmsConfig(cmsForm)
      await refreshGlobalConfig()
      toast.success({
        title: 'CMS Updated',
        message: 'Website content, hero copy, and contacts saved successfully!',
      })
      loadConfig()
    } catch (err) {
      toast.error({
        title: 'Save Failed',
        message: getApiErrorMessage(err, 'Could not save CMS configuration.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // Save Rules
  const handleSaveRules = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      await updateRulesConfig(rulesForm)
      await refreshGlobalConfig()
      toast.success({
        title: 'Rules Updated',
        message: 'Academic departments, programs, and gatepass rules saved successfully!',
      })
      loadConfig()
    } catch (err) {
      toast.error({
        title: 'Save Failed',
        message: getApiErrorMessage(err, 'Could not update system rules.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // Save Feature Flags
  const handleSaveFeatures = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      await updateFeatureFlags(featuresForm)
      await refreshGlobalConfig()
      toast.success({
        title: 'Feature Flags Updated',
        message: 'Maintenance mode and system feature flags updated successfully!',
      })
      loadConfig()
    } catch (err) {
      toast.error({
        title: 'Save Failed',
        message: getApiErrorMessage(err, 'Could not update feature flags.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // Trigger Campus Lockdown
  const handleToggleLockdown = async (enable) => {
    const reason = enable
      ? prompt('Enter emergency reason for Campus Lockdown:', 'Campus Security Emergency Protocol')
      : ''
    if (enable && reason === null) return

    setSaving(true)
    try {
      await setEmergencyLockdown({ enabled: enable, reason: reason || 'Emergency lockdown' })
      await refreshGlobalConfig()
      toast.warning({
        title: enable ? 'LOCKDOWN ACTIVE' : 'Lockdown Lifted',
        message: enable
          ? 'Emergency lockdown initiated campus-wide. All gatepass requests are restricted.'
          : 'Campus security lockdown lifted.',
      })
      loadConfig()
    } catch (err) {
      toast.error({
        title: 'Lockdown action failed',
        message: getApiErrorMessage(err, 'Could not change lockdown status.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // FAQ Modal Handlers
  const handleOpenFaqModal = (index = -1) => {
    setFaqEditIndex(index)
    if (index >= 0 && cmsForm.faqs[index]) {
      setFaqQuestion(cmsForm.faqs[index].question)
      setFaqAnswer(cmsForm.faqs[index].answer)
    } else {
      setFaqQuestion('')
      setFaqAnswer('')
    }
    setFaqModalOpen(true)
  }

  const handleSaveFaqItem = () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast.warning({ title: 'Incomplete FAQ', message: 'Please enter both question and answer.' })
      return
    }

    const updatedFaqs = [...(cmsForm.faqs || [])]
    if (faqEditIndex >= 0) {
      updatedFaqs[faqEditIndex] = {
        ...updatedFaqs[faqEditIndex],
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
      }
    } else {
      updatedFaqs.push({
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        order: updatedFaqs.length + 1,
      })
    }

    setCmsForm((prev) => ({ ...prev, faqs: updatedFaqs }))
    setFaqModalOpen(false)
  }

  const handleDeleteFaqItem = (index) => {
    const updatedFaqs = cmsForm.faqs.filter((_, i) => i !== index)
    setCmsForm((prev) => ({ ...prev, faqs: updatedFaqs }))
  }

  // Department / Program Helpers
  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return
    const trimmed = newDepartment.trim()
    if (rulesForm.departments?.includes(trimmed)) {
      toast.info({ title: 'Already exists', message: 'This department is already listed.' })
      return
    }
    setRulesForm((prev) => ({
      ...prev,
      departments: [...(prev.departments || []), trimmed],
    }))
    setNewDepartment('')
  }

  const handleRemoveDepartment = (dept) => {
    setRulesForm((prev) => ({
      ...prev,
      departments: prev.departments.filter((d) => d !== dept),
    }))
  }

  const handleAddProgram = () => {
    if (!newProgram.trim()) return
    const trimmed = newProgram.trim()
    if (rulesForm.programs?.includes(trimmed)) {
      toast.info({ title: 'Already exists', message: 'This program is already listed.' })
      return
    }
    setRulesForm((prev) => ({
      ...prev,
      programs: [...(prev.programs || []), trimmed],
    }))
    setNewProgram('')
  }

  const handleRemoveProgram = (prog) => {
    setRulesForm((prev) => ({
      ...prev,
      programs: prev.programs.filter((p) => p !== prog),
    }))
  }

  // Update Master User
  const handleSaveMasterUser = async () => {
    if (!selectedUserForEdit) return
    setSaving(true)
    try {
      const payload = {
        role: editRoleValue,
        status: editStatusValue,
      }
      if (resetPasswordValue.trim()) {
        payload.newPassword = resetPasswordValue.trim()
      }

      await updateMasterUserAccount(selectedUserForEdit.id || selectedUserForEdit._id, payload)
      toast.success({
        title: 'User Updated',
        message: `Account for ${selectedUserForEdit.name} was updated successfully!`,
      })
      setSelectedUserForEdit(null)
      setResetPasswordValue('')
      loadUsers(userMeta.page)
    } catch (err) {
      toast.error({
        title: 'Update failed',
        message: getApiErrorMessage(err, 'Could not update user account.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tw:w-full tw:max-w-7xl tw:mx-auto tw:p-4 tw:sm:tw:p-6 tw:space-y-6">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="tw:flex tw:flex-col tw:md:tw:flex-row tw:items-start tw:md:tw:items-center tw:justify-between tw:gap-4 tw:bg-[#141824]/90 tw:backdrop-blur-md tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:shadow-xl">
        <div>
          <div className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:p-2.5 tw:rounded-xl tw:bg-gradient-to-tr tw:from-indigo-600 tw:to-violet-500 tw:text-white tw:shadow-lg tw:shadow-indigo-500/30">
              <SlidersHorizontal className="tw:w-6 tw:h-6" />
            </div>
            <div>
              <h1 className="tw:text-2xl tw:font-black tw:text-white tw:tracking-tight">
                Master Control Hub
              </h1>
              <p className="tw:text-xs tw:text-neutral-400">
                Centralized CMS, academic rules, emergency switches, and omni-user governance.
              </p>
            </div>
          </div>
        </div>

        {/* Global Status Pills & Quick Refresh */}
        <div className="tw:flex tw:items-center tw:gap-3 tw:flex-wrap">
          {featuresForm?.campusLockdown?.enabled ? (
            <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1 tw:rounded-full tw:text-xs tw:font-bold tw:bg-rose-500/20 tw:text-rose-400 tw:border tw:border-rose-500/30 tw:animate-pulse">
              <ShieldAlert className="tw:w-3.5 tw:h-3.5" /> LOCKDOWN ACTIVE
            </span>
          ) : featuresForm?.maintenanceMode?.enabled ? (
            <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1 tw:rounded-full tw:text-xs tw:font-bold tw:bg-amber-500/20 tw:text-amber-400 tw:border tw:border-amber-500/30">
              <AlertTriangle className="tw:w-3.5 tw:h-3.5" /> MAINTENANCE MODE
            </span>
          ) : (
            <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1 tw:rounded-full tw:text-xs tw:font-bold tw:bg-emerald-500/20 tw:text-emerald-400 tw:border tw:border-emerald-500/30">
              <CheckCircle2 className="tw:w-3.5 tw:h-3.5" /> SYSTEM NORMAL
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              loadConfig()
              if (activeTab === 'users') loadUsers(userMeta.page)
              if (activeTab === 'health') loadHealth()
            }}
            disabled={loading || saving}
            className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1.5 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-white/5 hover:tw:bg-white/10 tw:text-white tw:border tw:border-white/10 tw:transition-all tw:cursor-pointer"
          >
            <RefreshCw className={`tw:w-3.5 tw:h-3.5 ${loading ? 'tw:animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── TAB SELECTOR ─────────────────────────────────────────────────── */}
      <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-x-auto tw:pb-2 tw:border-b tw:border-white/10">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`tw:flex tw:items-center tw:gap-2 tw:px-4 tw:py-2.5 tw:rounded-xl tw:text-xs tw:font-bold tw:transition-all tw:whitespace-nowrap tw:cursor-pointer ${
                isActive
                  ? 'tw:bg-indigo-600 tw:text-white tw:shadow-md tw:shadow-indigo-600/30'
                  : 'tw:bg-[#141824]/60 tw:text-neutral-400 hover:tw:text-white hover:tw:bg-white/5 tw:border tw:border-white/5'
              }`}
            >
              <Icon className="tw:w-4 tw:h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: CMS & WEBSITE CONTENT ─────────────────────────────────── */}
      {activeTab === 'cms' ? (
        <form onSubmit={handleSaveCms} className="tw:space-y-6">
          {/* Hero Section Card */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
              <Sparkles className="tw:w-5 tw:h-5 tw:text-indigo-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">Landing Page Hero & Copy</h2>
            </div>
            <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-4">
              <div className="tw:space-y-1.5 tw:md:tw:col-span-2">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Hero Headline
                </label>
                <input
                  type="text"
                  value={cmsForm.hero?.headline || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      hero: { ...cmsForm.hero, headline: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5 tw:md:tw:col-span-2">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Subheadline / Pitch
                </label>
                <textarea
                  rows={2}
                  value={cmsForm.hero?.subheadline || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      hero: { ...cmsForm.hero, subheadline: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Top Badge Text
                </label>
                <input
                  type="text"
                  value={cmsForm.hero?.badgeText || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      hero: { ...cmsForm.hero, badgeText: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Primary Button Text
                </label>
                <input
                  type="text"
                  value={cmsForm.hero?.ctaPrimaryText || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      hero: { ...cmsForm.hero, ctaPrimaryText: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Announcement Ticker Banner */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:pb-3">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Radio className="tw:w-5 tw:h-5 tw:text-amber-400" />
                <h2 className="tw:text-base tw:font-bold tw:text-white">
                  Live Announcement Ticker Banner
                </h2>
              </div>
              <label className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer">
                <span className="tw:text-xs tw:text-neutral-300">Enable Banner:</span>
                <input
                  type="checkbox"
                  checked={Boolean(cmsForm.announcementBanner?.enabled)}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      announcementBanner: {
                        ...cmsForm.announcementBanner,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="tw:w-4 tw:h-4 tw:accent-indigo-600 tw:rounded"
                />
              </label>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-3 tw:gap-4">
              <div className="tw:space-y-1.5 tw:md:tw:col-span-2">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Banner Message
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus gates will observe holiday timings on Oct 31st."
                  value={cmsForm.announcementBanner?.message || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      announcementBanner: {
                        ...cmsForm.announcementBanner,
                        message: e.target.value,
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Alert Tone
                </label>
                <select
                  value={cmsForm.announcementBanner?.type || 'info'}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      announcementBanner: {
                        ...cmsForm.announcementBanner,
                        type: e.target.value,
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Warning (Amber)</option>
                  <option value="alert">Alert (Red)</option>
                  <option value="success">Success (Green)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Support Desk Contacts */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
              <Phone className="tw:w-5 tw:h-5 tw:text-emerald-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">
                Support Desk & Help Contacts
              </h2>
            </div>
            <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-4">
              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Primary Helpline
                </label>
                <input
                  type="text"
                  value={cmsForm.support?.primaryPhone || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      support: { ...cmsForm.support, primaryPhone: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Secondary Helpline
                </label>
                <input
                  type="text"
                  value={cmsForm.support?.secondaryPhone || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      support: { ...cmsForm.support, secondaryPhone: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Support Email
                </label>
                <input
                  type="email"
                  value={cmsForm.support?.supportEmail || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      support: { ...cmsForm.support, supportEmail: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Physical Office Location
                </label>
                <input
                  type="text"
                  value={cmsForm.support?.officeLocation || ''}
                  onChange={(e) =>
                    setCmsForm({
                      ...cmsForm,
                      support: { ...cmsForm.support, officeLocation: e.target.value },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>
            </div>
          </div>

          {/* FAQ Manager */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:pb-3">
              <div className="tw:flex tw:items-center tw:gap-2">
                <HelpCircle className="tw:w-5 tw:h-5 tw:text-indigo-400" />
                <h2 className="tw:text-base tw:font-bold tw:text-white">FAQ Manager</h2>
              </div>
              <button
                type="button"
                onClick={() => handleOpenFaqModal(-1)}
                className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1.5 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-indigo-600 hover:tw:bg-indigo-500 tw:text-white tw:transition-colors tw:cursor-pointer"
              >
                <Plus className="tw:w-3.5 tw:h-3.5" /> Add FAQ
              </button>
            </div>

            <div className="tw:space-y-3">
              {(cmsForm.faqs || []).map((faq, idx) => (
                <div
                  key={idx}
                  className="tw:p-4 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:flex tw:items-start tw:justify-between tw:gap-4"
                >
                  <div className="tw:space-y-1">
                    <p className="tw:text-sm tw:font-bold tw:text-white">{faq.question}</p>
                    <p className="tw:text-xs tw:text-neutral-400">{faq.answer}</p>
                  </div>
                  <div className="tw:flex tw:items-center tw:gap-1.5 tw:shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenFaqModal(idx)}
                      className="tw:p-1.5 tw:rounded-lg tw:bg-white/5 hover:tw:bg-white/10 tw:text-neutral-300 hover:tw:text-white tw:cursor-pointer"
                    >
                      <Edit2 className="tw:w-3.5 tw:h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFaqItem(idx)}
                      className="tw:p-1.5 tw:rounded-lg tw:bg-rose-500/10 hover:tw:bg-rose-500/20 tw:text-rose-400 tw:cursor-pointer"
                    >
                      <Trash2 className="tw:w-3.5 tw:h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tw:flex tw:justify-end">
            <button
              type="submit"
              disabled={saving}
              className="tw:inline-flex tw:items-center tw:gap-2 tw:px-6 tw:py-3 tw:rounded-xl tw:text-sm tw:font-bold tw:bg-gradient-to-r tw:from-indigo-600 tw:to-violet-600 hover:tw:from-indigo-500 hover:tw:to-violet-500 tw:text-white tw:shadow-lg tw:shadow-indigo-600/30 tw:transition-all tw:cursor-pointer"
            >
              <Save className="tw:w-4 tw:h-4" />
              {saving ? 'Saving...' : 'Save CMS Changes'}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── TAB 2: ACADEMIC & OPERATIONAL RULES ───────────────────────────── */}
      {activeTab === 'rules' ? (
        <form onSubmit={handleSaveRules} className="tw:space-y-6">
          {/* Department List Manager */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
              <Building2 className="tw:w-5 tw:h-5 tw:text-indigo-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">Academic Departments</h2>
            </div>

            <div className="tw:flex tw:gap-2">
              <input
                type="text"
                placeholder="Add new department name..."
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddDepartment()
                  }
                }}
                className="tw:flex-1 tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
              />
              <button
                type="button"
                onClick={handleAddDepartment}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-indigo-600 hover:tw:bg-indigo-500 tw:text-white tw:cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="tw:flex tw:flex-wrap tw:gap-2">
              {(rulesForm.departments || []).map((dept) => (
                <span
                  key={dept}
                  className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1.5 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-[#0c0f17] tw:text-neutral-200 tw:border tw:border-white/10"
                >
                  {dept}
                  <button
                    type="button"
                    onClick={() => handleRemoveDepartment(dept)}
                    className="tw:text-neutral-500 hover:tw:text-rose-400 tw:cursor-pointer"
                  >
                    <X className="tw:w-3.5 tw:h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Academic Degree Programs */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
              <Building2 className="tw:w-5 tw:h-5 tw:text-violet-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">Degree Programs</h2>
            </div>

            <div className="tw:flex tw:gap-2">
              <input
                type="text"
                placeholder="Add new program..."
                value={newProgram}
                onChange={(e) => setNewProgram(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddProgram()
                  }
                }}
                className="tw:flex-1 tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
              />
              <button
                type="button"
                onClick={handleAddProgram}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-violet-600 hover:tw:bg-violet-500 tw:text-white tw:cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="tw:flex tw:flex-wrap tw:gap-2">
              {(rulesForm.programs || []).map((prog) => (
                <span
                  key={prog}
                  className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1.5 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-[#0c0f17] tw:text-neutral-200 tw:border tw:border-white/10"
                >
                  {prog}
                  <button
                    type="button"
                    onClick={() => handleRemoveProgram(prog)}
                    className="tw:text-neutral-500 hover:tw:text-rose-400 tw:cursor-pointer"
                  >
                    <X className="tw:w-3.5 tw:h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Gatepass Operating Timings & Constraints */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
              <Clock className="tw:w-5 tw:h-5 tw:text-amber-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">
                Gatepass Timings & Constraints
              </h2>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:sm:tw:grid-cols-2 tw:md:tw:grid-cols-3 tw:gap-4">
              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Allowed Checkout Window Start
                </label>
                <input
                  type="time"
                  value={rulesForm.gatepass?.allowedCheckoutStartHour || '06:00'}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      gatepass: {
                        ...rulesForm.gatepass,
                        allowedCheckoutStartHour: e.target.value,
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Allowed Checkout Window End
                </label>
                <input
                  type="time"
                  value={rulesForm.gatepass?.allowedCheckoutEndHour || '21:00'}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      gatepass: {
                        ...rulesForm.gatepass,
                        allowedCheckoutEndHour: e.target.value,
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Campus Curfew Return Deadline
                </label>
                <input
                  type="time"
                  value={rulesForm.gatepass?.curfewReturnHour || '22:00'}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      gatepass: {
                        ...rulesForm.gatepass,
                        curfewReturnHour: e.target.value,
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Max Active Passes per Student
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rulesForm.gatepass?.maxActivePassesPerStudent || 1}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      gatepass: {
                        ...rulesForm.gatepass,
                        maxActivePassesPerStudent: Number(e.target.value),
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Minimum Reason Length (characters)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={rulesForm.gatepass?.minReasonLength || 5}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      gatepass: {
                        ...rulesForm.gatepass,
                        minReasonLength: Number(e.target.value),
                      },
                    })
                  }
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div className="tw:flex tw:items-center tw:gap-3 tw:pt-6">
                <label className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(rulesForm.gatepass?.allowWeekendPasses)}
                    onChange={(e) =>
                      setRulesForm({
                        ...rulesForm,
                        gatepass: {
                          ...rulesForm.gatepass,
                          allowWeekendPasses: e.target.checked,
                        },
                      })
                    }
                    className="tw:w-4 tw:h-4 tw:accent-indigo-600 tw:rounded"
                  />
                  <span className="tw:text-xs tw:font-semibold tw:text-neutral-200">
                    Allow Weekend Gatepasses
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="tw:flex tw:justify-end">
            <button
              type="submit"
              disabled={saving}
              className="tw:inline-flex tw:items-center tw:gap-2 tw:px-6 tw:py-3 tw:rounded-xl tw:text-sm tw:font-bold tw:bg-gradient-to-r tw:from-indigo-600 tw:to-violet-600 hover:tw:from-indigo-500 hover:tw:to-violet-500 tw:text-white tw:shadow-lg tw:shadow-indigo-600/30 tw:transition-all tw:cursor-pointer"
            >
              <Save className="tw:w-4 tw:h-4" />
              {saving ? 'Saving...' : 'Save Academic & Pass Rules'}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── TAB 3: EMERGENCY CONTROLS & FEATURE FLAGS ─────────────────────── */}
      {activeTab === 'flags' ? (
        <div className="tw:space-y-6">
          {/* CAMPUS EMERGENCY LOCKDOWN CARD */}
          <div className="tw:bg-gradient-to-tr tw:from-rose-950/80 tw:to-[#141824] tw:border tw:border-rose-500/40 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:flex-col tw:sm:tw:flex-row tw:items-start tw:sm:tw:items-center tw:justify-between tw:gap-4">
              <div className="tw:flex tw:items-center tw:gap-3">
                <div className="tw:p-3 tw:rounded-xl tw:bg-rose-500/20 tw:text-rose-400 tw:border tw:border-rose-500/30">
                  <ShieldAlert className="tw:w-6 tw:h-6 tw:animate-pulse" />
                </div>
                <div>
                  <h2 className="tw:text-lg tw:font-black tw:text-rose-100">
                    Campus Security Lockdown
                  </h2>
                  <p className="tw:text-xs tw:text-rose-300/80">
                    1-Click emergency override. Instantly suspends gatepass generation across the entire campus.
                  </p>
                </div>
              </div>

              {featuresForm?.campusLockdown?.enabled ? (
                <button
                  type="button"
                  onClick={() => handleToggleLockdown(false)}
                  disabled={saving}
                  className="tw:px-5 tw:py-2.5 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-emerald-600 hover:tw:bg-emerald-500 tw:text-white tw:shadow-lg tw:shadow-emerald-600/30 tw:transition-all tw:cursor-pointer"
                >
                  Lift Lockdown
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleLockdown(true)}
                  disabled={saving}
                  className="tw:px-5 tw:py-2.5 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-rose-600 hover:tw:bg-rose-500 tw:text-white tw:shadow-lg tw:shadow-rose-600/40 tw:transition-all tw:cursor-pointer"
                >
                  INITIATE LOCKDOWN
                </button>
              )}
            </div>

            {featuresForm?.campusLockdown?.enabled ? (
              <div className="tw:p-3.5 tw:rounded-xl tw:bg-rose-900/40 tw:border tw:border-rose-700/50 tw:text-xs tw:text-rose-200">
                <strong>Status:</strong> LOCKDOWN ACTIVE &bull; Reason: {featuresForm.campusLockdown.reason || 'Campus Security Emergency'}
              </div>
            ) : null}
          </div>

          {/* Maintenance Mode & Feature Switches Form */}
          <form onSubmit={handleSaveFeatures} className="tw:space-y-6">
            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-6">
              <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-white/10 tw:pb-3">
                <Zap className="tw:w-5 tw:h-5 tw:text-amber-400" />
                <h2 className="tw:text-base tw:font-bold tw:text-white">System Feature Switches</h2>
              </div>

              {/* Maintenance Mode Toggle */}
              <div className="tw:p-4 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:space-y-3">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <div>
                    <h3 className="tw:text-sm tw:font-bold tw:text-white">
                      Maintenance Mode (Public Interceptor)
                    </h3>
                    <p className="tw:text-xs tw:text-neutral-400">
                      When enabled, public visitors and students see a maintenance screen. Admins retain full access.
                    </p>
                  </div>
                  <label className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(featuresForm.maintenanceMode?.enabled)}
                      onChange={(e) =>
                        setFeaturesForm({
                          ...featuresForm,
                          maintenanceMode: {
                            ...featuresForm.maintenanceMode,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="tw:w-5 tw:h-5 tw:accent-amber-500 tw:rounded"
                    />
                  </label>
                </div>

                {featuresForm.maintenanceMode?.enabled ? (
                  <div className="tw:pt-2">
                    <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                      Custom Visitor Message
                    </label>
                    <input
                      type="text"
                      value={featuresForm.maintenanceMode?.message || ''}
                      onChange={(e) =>
                        setFeaturesForm({
                          ...featuresForm,
                          maintenanceMode: {
                            ...featuresForm.maintenanceMode,
                            message: e.target.value,
                          },
                        })
                      }
                      placeholder="DwarPal is undergoing maintenance..."
                      className="tw:mt-1 tw:w-full tw:bg-[#141824] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-xs tw:text-white focus:tw:border-amber-500 focus:tw:outline-none"
                    />
                  </div>
                ) : null}
              </div>

              {/* Student Self-Registration Switch */}
              <div className="tw:p-4 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:flex tw:items-center tw:justify-between">
                <div>
                  <h3 className="tw:text-sm tw:font-bold tw:text-white">
                    Student Self-Registration Portal
                  </h3>
                  <p className="tw:text-xs tw:text-neutral-400">
                    Allow new students to register self-service at /student/register.
                  </p>
                </div>
                <label className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(featuresForm.studentSelfRegistration?.enabled)}
                    onChange={(e) =>
                      setFeaturesForm({
                        ...featuresForm,
                        studentSelfRegistration: {
                          ...featuresForm.studentSelfRegistration,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="tw:w-5 tw:h-5 tw:accent-indigo-600 tw:rounded"
                  />
                </label>
              </div>

              {/* Biometric Passkey Auth Switch */}
              <div className="tw:p-4 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:flex tw:items-center tw:justify-between">
                <div>
                  <h3 className="tw:text-sm tw:font-bold tw:text-white">
                    Biometric WebAuthn (Passkey) Support
                  </h3>
                  <p className="tw:text-xs tw:text-neutral-400">
                    Allow biometric fingerprint/FaceID passkey authentication across compatible devices.
                  </p>
                </div>
                <label className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(featuresForm.biometricAuth?.enabled)}
                    onChange={(e) =>
                      setFeaturesForm({
                        ...featuresForm,
                        biometricAuth: {
                          ...featuresForm.biometricAuth,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="tw:w-5 tw:h-5 tw:accent-indigo-600 tw:rounded"
                  />
                </label>
              </div>
            </div>

            <div className="tw:flex tw:justify-end">
              <button
                type="submit"
                disabled={saving}
                className="tw:inline-flex tw:items-center tw:gap-2 tw:px-6 tw:py-3 tw:rounded-xl tw:text-sm tw:font-bold tw:bg-gradient-to-r tw:from-indigo-600 tw:to-violet-600 hover:tw:from-indigo-500 hover:tw:to-violet-500 tw:text-white tw:shadow-lg tw:shadow-indigo-600/30 tw:transition-all tw:cursor-pointer"
              >
                <Save className="tw:w-4 tw:h-4" />
                {saving ? 'Saving...' : 'Save Feature Switches'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ── TAB 4: MASTER USER & ROLE DIRECTORY ─────────────────────────── */}
      {activeTab === 'users' ? (
        <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-6">
          <div className="tw:flex tw:flex-col tw:md:tw:flex-row tw:items-start tw:md:tw:items-center tw:justify-between tw:gap-4">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Users className="tw:w-5 tw:h-5 tw:text-indigo-400" />
              <h2 className="tw:text-base tw:font-bold tw:text-white">
                Master User & Role Directory ({userMeta.total} Total)
              </h2>
            </div>

            {/* Filters */}
            <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap tw:w-full tw:md:tw:w-auto">
              <div className="tw:relative tw:flex-1 tw:md:tw:w-64">
                <Search className="tw:w-4 tw:h-4 tw:absolute tw:left-3 tw:top-1/2 -tw:translate-y-1/2 tw:text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search name, email, roll..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
                  className="tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:pl-9 tw:pr-3.5 tw:py-2 tw:text-xs tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value)
                }}
                className="tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3 tw:py-2 tw:text-xs tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value)
                }}
                className="tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3 tw:py-2 tw:text-xs tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>

              <button
                type="button"
                onClick={() => loadUsers(1)}
                className="tw:px-3.5 tw:py-2 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-indigo-600 hover:tw:bg-indigo-500 tw:text-white tw:cursor-pointer"
              >
                Filter
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="tw:overflow-x-auto tw:rounded-xl tw:border tw:border-white/10">
            <table className="tw:w-full tw:text-left tw:text-xs tw:text-neutral-300">
              <thead className="tw:bg-[#0c0f17] tw:text-neutral-400 tw:font-semibold tw:border-b tw:border-white/10">
                <tr>
                  <th className="tw:p-3.5">User</th>
                  <th className="tw:p-3.5">Role</th>
                  <th className="tw:p-3.5">Department / Details</th>
                  <th className="tw:p-3.5">Status</th>
                  <th className="tw:p-3.5 tw:text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="tw:divide-y tw:divide-white/5 tw:bg-[#141824]/40">
                {usersLoading ? (
                  <tr>
                    <td colSpan={5} className="tw:p-8 tw:text-center tw:text-neutral-400">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="tw:p-8 tw:text-center tw:text-neutral-400">
                      No users found matching current filters.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id || u._id} className="hover:tw:bg-white/5">
                      <td className="tw:p-3.5">
                        <div className="tw:font-bold tw:text-white">{u.name}</div>
                        <div className="tw:text-[11px] tw:text-neutral-400">{u.email}</div>
                        {u.phone ? (
                          <div className="tw:text-[10px] tw:text-neutral-500">{u.phone}</div>
                        ) : null}
                      </td>
                      <td className="tw:p-3.5">
                        <span className="tw:inline-block tw:px-2.5 tw:py-0.5 tw:rounded-full tw:text-[11px] tw:font-bold tw:bg-indigo-500/20 tw:text-indigo-300 tw:border tw:border-indigo-500/30">
                          {u.role?.toUpperCase()}
                        </span>
                      </td>
                      <td className="tw:p-3.5">
                        <div className="tw:text-white">{u.department || 'General'}</div>
                        <div className="tw:text-[11px] tw:text-neutral-400">
                          {u.enrollment || u.employeeId || '-'}
                        </div>
                      </td>
                      <td className="tw:p-3.5">
                        <span
                          className={`tw:inline-block tw:px-2 tw:py-0.5 tw:rounded-md tw:text-[10px] tw:font-bold ${
                            u.status === 'active'
                              ? 'tw:bg-emerald-500/20 tw:text-emerald-300'
                              : u.status === 'suspended'
                              ? 'tw:bg-rose-500/20 tw:text-rose-300'
                              : 'tw:bg-amber-500/20 tw:text-amber-300'
                          }`}
                        >
                          {u.status?.toUpperCase() || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="tw:p-3.5 tw:text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForEdit(u)
                            setEditRoleValue(u.role || 'student')
                            setEditStatusValue(u.status || 'active')
                            setResetPasswordValue('')
                          }}
                          className="tw:inline-flex tw:items-center tw:gap-1 tw:px-2.5 tw:py-1 tw:rounded-lg tw:bg-white/10 hover:tw:bg-white/20 tw:text-white tw:text-xs tw:cursor-pointer"
                        >
                          <Edit2 className="tw:w-3 tw:h-3" /> Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="tw:flex tw:items-center tw:justify-between tw:pt-2">
            <span className="tw:text-xs tw:text-neutral-400">
              Page {userMeta.page} of {userMeta.totalPages} ({userMeta.total} records)
            </span>
            <div className="tw:flex tw:items-center tw:gap-2">
              <button
                type="button"
                disabled={userMeta.page <= 1 || usersLoading}
                onClick={() => loadUsers(userMeta.page - 1)}
                className="tw:p-2 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:text-neutral-300 hover:tw:text-white disabled:tw:opacity-40 tw:cursor-pointer"
              >
                <ChevronLeft className="tw:w-4 tw:h-4" />
              </button>
              <button
                type="button"
                disabled={userMeta.page >= userMeta.totalPages || usersLoading}
                onClick={() => loadUsers(userMeta.page + 1)}
                className="tw:p-2 tw:rounded-xl tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:text-neutral-300 hover:tw:text-white disabled:tw:opacity-40 tw:cursor-pointer"
              >
                <ChevronRight className="tw:w-4 tw:h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── TAB 5: SYSTEM HEALTH & AUDIT TRAIL ───────────────────────────── */}
      {activeTab === 'health' ? (
        <div className="tw:space-y-6">
          {/* Health Stats Grid */}
          <div className="tw:grid tw:grid-cols-2 tw:sm:tw:grid-cols-3 tw:md:tw:grid-cols-5 tw:gap-4">
            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-4 tw:rounded-2xl">
              <p className="tw:text-xs tw:text-neutral-400">Total Users</p>
              <p className="tw:text-2xl tw:font-black tw:text-white tw:mt-1">
                {healthData?.metrics?.totalUsers || 0}
              </p>
            </div>

            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-4 tw:rounded-2xl">
              <p className="tw:text-xs tw:text-neutral-400">Total Gatepasses</p>
              <p className="tw:text-2xl tw:font-black tw:text-indigo-400 tw:mt-1">
                {healthData?.metrics?.totalGatepasses || 0}
              </p>
            </div>

            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-4 tw:rounded-2xl">
              <p className="tw:text-xs tw:text-neutral-400">Pending Approvals</p>
              <p className="tw:text-2xl tw:font-black tw:text-amber-400 tw:mt-1">
                {healthData?.metrics?.pendingGatepasses || 0}
              </p>
            </div>

            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-4 tw:rounded-2xl">
              <p className="tw:text-xs tw:text-neutral-400">Email Queue Pending</p>
              <p className="tw:text-2xl tw:font-black tw:text-violet-400 tw:mt-1">
                {healthData?.metrics?.pendingEmailQueue || 0}
              </p>
            </div>

            <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-4 tw:rounded-2xl">
              <p className="tw:text-xs tw:text-neutral-400">Server Uptime</p>
              <p className="tw:text-lg tw:font-black tw:text-emerald-400 tw:mt-2">
                {Math.floor((healthData?.uptimeSeconds || 0) / 60)} min
              </p>
            </div>
          </div>

          {/* Live Audit Log Stream */}
          <div className="tw:bg-[#141824]/80 tw:border tw:border-white/10 tw:p-6 tw:rounded-2xl tw:space-y-4">
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:pb-3">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Activity className="tw:w-5 tw:h-5 tw:text-emerald-400" />
                <h2 className="tw:text-base tw:font-bold tw:text-white">
                  Real-time System Audit Trail
                </h2>
              </div>
              <button
                type="button"
                onClick={loadHealth}
                className="tw:p-1.5 tw:rounded-lg tw:bg-white/5 hover:tw:bg-white/10 tw:text-neutral-300 hover:tw:text-white tw:cursor-pointer"
              >
                <RefreshCw className="tw:w-4 tw:h-4" />
              </button>
            </div>

            <div className="tw:overflow-x-auto tw:rounded-xl tw:border tw:border-white/10">
              <table className="tw:w-full tw:text-left tw:text-xs tw:text-neutral-300">
                <thead className="tw:bg-[#0c0f17] tw:text-neutral-400 tw:font-semibold tw:border-b tw:border-white/10">
                  <tr>
                    <th className="tw:p-3">Time</th>
                    <th className="tw:p-3">Actor</th>
                    <th className="tw:p-3">Action</th>
                    <th className="tw:p-3">Message</th>
                  </tr>
                </thead>
                <tbody className="tw:divide-y tw:divide-white/5 tw:bg-[#141824]/40">
                  {healthLoading ? (
                    <tr>
                      <td colSpan={4} className="tw:p-6 tw:text-center tw:text-neutral-400">
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : (healthData?.recentAuditLogs || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="tw:p-6 tw:text-center tw:text-neutral-400">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    healthData.recentAuditLogs.map((log) => (
                      <tr key={log._id} className="hover:tw:bg-white/5">
                        <td className="tw:p-3 tw:text-neutral-400 tw:whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="tw:p-3">
                          <span className="tw:font-semibold tw:text-white">
                            {log.actor?.name || 'System / Guest'}
                          </span>
                          {log.actor?.role ? (
                            <span className="tw:ml-1.5 tw:text-[10px] tw:text-neutral-400">
                              ({log.actor.role})
                            </span>
                          ) : null}
                        </td>
                        <td className="tw:p-3">
                          <span className="tw:inline-block tw:px-2 tw:py-0.5 tw:rounded tw:text-[10px] tw:font-bold tw:bg-indigo-500/20 tw:text-indigo-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="tw:p-3 tw:text-neutral-300">{log.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── FAQ MODAL ────────────────────────────────────────────────────── */}
      {faqModalOpen ? (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:p-4 tw:bg-black/70 tw:backdrop-blur-sm">
          <div className="tw:w-full tw:max-w-lg tw:bg-[#141824] tw:border tw:border-white/10 tw:rounded-2xl tw:p-6 tw:space-y-4 tw:shadow-2xl">
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:pb-3">
              <h3 className="tw:text-base tw:font-bold tw:text-white">
                {faqEditIndex >= 0 ? 'Edit FAQ Item' : 'Add FAQ Item'}
              </h3>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="tw:text-neutral-400 hover:tw:text-white tw:cursor-pointer"
              >
                <X className="tw:w-4 tw:h-4" />
              </button>
            </div>

            <div className="tw:space-y-3">
              <div>
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">Question</label>
                <input
                  type="text"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. How do I request a gatepass?"
                  className="tw:mt-1 tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>

              <div>
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">Answer</label>
                <textarea
                  rows={4}
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="Provide a clear, helpful explanation..."
                  className="tw:mt-1 tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>
            </div>

            <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:pt-3 tw:border-t tw:border-white/10">
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-white/5 hover:tw:bg-white/10 tw:text-neutral-300 tw:cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFaqItem}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-indigo-600 hover:tw:bg-indigo-500 tw:text-white tw:cursor-pointer"
              >
                Save FAQ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── USER EDIT MODAL ──────────────────────────────────────────────── */}
      {selectedUserForEdit ? (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:p-4 tw:bg-black/70 tw:backdrop-blur-sm">
          <div className="tw:w-full tw:max-w-md tw:bg-[#141824] tw:border tw:border-white/10 tw:rounded-2xl tw:p-6 tw:space-y-4 tw:shadow-2xl">
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:pb-3">
              <div>
                <h3 className="tw:text-base tw:font-bold tw:text-white">
                  Manage User: {selectedUserForEdit.name}
                </h3>
                <p className="tw:text-xs tw:text-neutral-400">{selectedUserForEdit.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="tw:text-neutral-400 hover:tw:text-white tw:cursor-pointer"
              >
                <X className="tw:w-4 tw:h-4" />
              </button>
            </div>

            <div className="tw:space-y-4">
              <div>
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Assign System Role
                </label>
                <select
                  value={editRoleValue}
                  onChange={(e) => setEditRoleValue(e.target.value)}
                  className="tw:mt-1 tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Account Status
                </label>
                <select
                  value={editStatusValue}
                  onChange={(e) => setEditStatusValue(e.target.value)}
                  className="tw:mt-1 tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="suspended">Suspended (Blocked from Login)</option>
                  <option value="pending">Pending Approval</option>
                </select>
              </div>

              <div>
                <label className="tw:text-xs tw:font-semibold tw:text-neutral-300">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder="Enter new password (min 6 chars)..."
                  className="tw:mt-1 tw:w-full tw:bg-[#0c0f17] tw:border tw:border-white/10 tw:rounded-xl tw:px-3.5 tw:py-2 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none"
                />
              </div>
            </div>

            <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:pt-3 tw:border-t tw:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-semibold tw:bg-white/5 hover:tw:bg-white/10 tw:text-neutral-300 tw:cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMasterUser}
                className="tw:px-4 tw:py-2 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-indigo-600 hover:tw:bg-indigo-500 tw:text-white tw:cursor-pointer"
              >
                {saving ? 'Updating...' : 'Save User Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
