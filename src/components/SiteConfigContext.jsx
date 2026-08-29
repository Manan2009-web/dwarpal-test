import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchPublicSiteConfig } from '../lib/dwarpalApi'
import { DEPARTMENTS, PROGRAM_OPTIONS, SEMESTER_OPTIONS } from '../mockData'
import { AlertTriangle, Info, BellRing, CheckCircle, ShieldAlert, X } from 'lucide-react'

const DEFAULT_SITE_CONFIG = {
  cms: {
    hero: {
      headline: 'Autonomous Campus Gatepass & Security Infrastructure',
      subheadline: 'Replace paper chits with cryptographic dynamic QR gatepasses, multi-tier automated approvals, and sub-second gate scanning.',
      badgeText: 'CAMPUS GATEPASS 2.0',
      ctaPrimaryText: 'Access Security Portal',
      ctaPrimaryLink: '/access-portal',
      ctaSecondaryText: 'Student Registration',
      ctaSecondaryLink: '/student/register',
    },
    announcementBanner: {
      enabled: false,
      message: '',
      type: 'info',
      link: '',
    },
    support: {
      appName: 'DwarPal',
      supportEmail: 'dwarpal@neotech.ac.in',
      primaryPhone: '+91 93285 63802',
      secondaryPhone: '+91 92657 93539',
      operatingHours: 'Monday – Saturday, 8:00 AM – 6:00 PM IST',
      officeLocation: 'Central Security Cabin / IT Helpdesk, Gate 1',
    },
    faqs: [
      {
        question: 'How do I submit a campus gatepass request?',
        answer: 'From your dashboard, tap the "+ New Gatepass" button. Fill in the departure date, leaving time, expected return time, reason for leaving, and destination, then submit.',
        order: 1,
      },
      {
        question: 'Who reviews and approves my gatepass?',
        answer: 'Student gatepasses are reviewed by your department Academic HOD or Principal, depending on your program. Once approved, an encrypted QR code becomes available.',
        order: 2,
      },
      {
        question: 'How does the security guard verify my gatepass at the gate?',
        answer: 'Open your approved gatepass on DwarPal and tap "View QR Code." Show the dynamic QR code to the guard. The guard scans it with the DwarPal Security terminal.',
        order: 3,
      },
    ],
    branding: {
      siteTitle: 'DwarPal — Intelligent Campus Pass System',
      footerText: '© 2026 DwarPal. NeoTech Technical Campus. All rights reserved.',
    },
  },
  rules: {
    departments: DEPARTMENTS || [],
    programs: PROGRAM_OPTIONS || [],
    semesters: SEMESTER_OPTIONS || [1, 2, 3, 4, 5, 6, 7, 8],
    gatepass: {
      minReasonLength: 5,
      maxReasonLength: 500,
      allowedCheckoutStartHour: '06:00',
      allowedCheckoutEndHour: '21:00',
      curfewReturnHour: '22:00',
      allowWeekendPasses: true,
    },
  },
  features: {
    maintenanceMode: {
      enabled: false,
      message: 'DwarPal is currently undergoing scheduled maintenance.',
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
  },
}

const SiteConfigContext = createContext({
  config: DEFAULT_SITE_CONFIG,
  loading: false,
  refreshConfig: async () => {},
})

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('dwarpal_cached_site_config')
      return saved ? JSON.parse(saved) : DEFAULT_SITE_CONFIG
    } catch {
      return DEFAULT_SITE_CONFIG
    }
  })
  const [loading, setLoading] = useState(false)

  const refreshConfig = useCallback(async () => {
    setLoading(true)
    try {
      const liveConfig = await fetchPublicSiteConfig()
      if (liveConfig) {
        setConfig((prev) => ({
          cms: { ...prev.cms, ...(liveConfig.cms || {}) },
          rules: { ...prev.rules, ...(liveConfig.rules || {}) },
          features: { ...prev.features, ...(liveConfig.features || {}) },
        }))
        try {
          localStorage.setItem('dwarpal_cached_site_config', JSON.stringify(liveConfig))
        } catch {
          // ignore storage full
        }
      }
    } catch (err) {
      console.warn('[SiteConfigProvider] Failed to fetch live site config, using cached/default:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshConfig()
  }, [refreshConfig])

  return (
    <SiteConfigContext.Provider value={{ config, loading, refreshConfig }}>
      <SiteAnnouncementBanner config={config} />
      {children}
    </SiteConfigContext.Provider>
  )
}

export function useSiteConfig() {
  const context = useContext(SiteConfigContext)
  return context || { config: DEFAULT_SITE_CONFIG, loading: false, refreshConfig: async () => {} }
}

export function SiteAnnouncementBanner({ config }) {
  const [dismissed, setDismissed] = useState(false)
  const banner = config?.cms?.announcementBanner
  const maintenance = config?.features?.maintenanceMode
  const lockdown = config?.features?.campusLockdown

  if (lockdown?.enabled) {
    return (
      <aside aria-label="Campus emergency advisory" className="tw:w-full tw:bg-rose-950 tw:text-rose-100 tw:border-b tw:border-rose-800 tw:px-4 tw:py-2.5 tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-semibold tw:shadow-md tw:sticky tw:top-0 tw:z-50">
        <div className="tw:flex tw:items-center tw:gap-2 tw:max-w-6xl tw:mx-auto tw:w-full">
          <ShieldAlert className="tw:w-4 tw:h-4 tw:text-rose-400 tw:shrink-0 tw:animate-pulse" />
          <span>
            <strong>CAMPUS SECURITY LOCKDOWN ACTIVE:</strong> {lockdown.reason || 'All automated gatepass exits are temporarily restricted by Campus Authority.'}
          </span>
        </div>
      </aside>
    )
  }

  if (maintenance?.enabled) {
    return (
      <aside aria-label="Maintenance advisory" className="tw:w-full tw:bg-amber-950 tw:text-amber-100 tw:border-b tw:border-amber-800 tw:px-4 tw:py-2.5 tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-medium tw:sticky tw:top-0 tw:z-50">
        <div className="tw:flex tw:items-center tw:gap-2 tw:max-w-6xl tw:mx-auto tw:w-full">
          <AlertTriangle className="tw:w-4 tw:h-4 tw:text-amber-400 tw:shrink-0" />
          <span>
            <strong>MAINTENANCE NOTICE:</strong> {maintenance.message || 'System undergoing scheduled maintenance.'}
          </span>
        </div>
      </aside>
    )
  }

  if (!banner?.enabled || !banner?.message || dismissed) {
    return null
  }

  const toneMap = {
    info: 'tw:bg-sky-950 tw:text-sky-100 tw:border-sky-800 tw:text-sky-300',
    warning: 'tw:bg-amber-950 tw:text-amber-100 tw:border-amber-800 tw:text-amber-300',
    alert: 'tw:bg-rose-950 tw:text-rose-100 tw:border-rose-800 tw:text-rose-300',
    success: 'tw:bg-emerald-950 tw:text-emerald-100 tw:border-emerald-800 tw:text-emerald-300',
  }

  const currentTone = toneMap[banner.type] || toneMap.info

  return (
    <aside aria-label="Site announcement banner" className={`tw:w-full tw:border-b tw:px-4 tw:py-2 tw:flex tw:items-center tw:justify-between tw:text-xs tw:sticky tw:top-0 tw:z-50 ${currentTone}`}>
      <div className="tw:flex tw:items-center tw:gap-2 tw:max-w-6xl tw:mx-auto tw:w-full tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-2">
          <BellRing className="tw:w-3.5 tw:h-3.5 tw:shrink-0" />
          <span>{banner.message}</span>
          {banner.link ? (
            <a href={banner.link} className="tw:underline tw:font-semibold tw:ml-1 hover:tw:opacity-80">
              Details &rarr;
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="tw:p-1 tw:rounded hover:tw:bg-white/10 tw:transition-colors tw:cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="tw:w-3.5 tw:h-3.5" />
        </button>
      </div>
    </aside>
  )
}
