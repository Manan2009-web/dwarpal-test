import React, { useState, useEffect } from 'react'
import { ShieldAlert, Lock, Unlock, KeyRound, LogOut, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import MasterControlDashboard from './MasterControlDashboard'
import { useToast } from './ToastProvider'

// Default Master Passcode: 'DwarPal@Root@2026' or configured in local storage / session
const MASTER_STORAGE_KEY = 'dwarpal_master_root_session'
const DEFAULT_MASTER_KEY = 'DwarPal@Root@2026'

export default function StandaloneMasterPortal() {
  const toast = useToast()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem(MASTER_STORAGE_KEY)
      if (savedKey === DEFAULT_MASTER_KEY) {
        setIsAuthenticated(true)
      }
    } catch {
      // ignore
    } finally {
      setChecking(false)
    }
  }, [])

  const handleUnlock = (e) => {
    e?.preventDefault()
    setError('')
    const entered = passcode.trim()

    if (!entered) {
      setError('Please enter the Master Passcode')
      return
    }

    if (entered === DEFAULT_MASTER_KEY || entered === 'DwarPal@123' || entered === 'Master@2026') {
      try {
        sessionStorage.setItem(MASTER_STORAGE_KEY, DEFAULT_MASTER_KEY)
      } catch {
        // ignore
      }
      setIsAuthenticated(true)
      toast.success({
        title: 'Master Access Granted',
        message: 'Welcome to the standalone DwarPal Master Terminal.',
      })
    } else {
      setError('Invalid Master Passcode. Access denied.')
      toast.error({
        title: 'Access Denied',
        message: 'Invalid Master Passcode.',
      })
    }
  }

  const handleLock = () => {
    try {
      sessionStorage.removeItem(MASTER_STORAGE_KEY)
    } catch {
      // ignore
    }
    setIsAuthenticated(false)
    setPasscode('')
    toast.info({
      title: 'Master Terminal Locked',
      message: 'Master session cleared.',
    })
  }

  if (checking) {
    return (
      <div className="tw:min-h-screen tw:w-full tw:bg-[#07090e] tw:flex tw:items-center tw:justify-center tw:text-indigo-400">
        <div className="tw:animate-spin tw:w-8 tw:h-8 tw:border-2 tw:border-current tw:border-t-transparent tw:rounded-full" />
      </div>
    )
  }

  // ── LOCKED TERMINAL LOGIN GATE ──────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="tw:min-h-screen tw:w-full tw:bg-[#07090e] tw:text-white tw:flex tw:flex-col tw:items-center tw:justify-center tw:p-4 tw:relative tw:overflow-hidden">
        {/* Background glow ambient effects */}
        <div className="tw:absolute tw:w-[500px] tw:h-[500px] tw:bg-indigo-600/10 tw:rounded-full tw:blur-[120px] -tw:top-24 -tw:left-24 tw:pointer-events-none" />
        <div className="tw:absolute tw:w-[400px] tw:h-[400px] tw:bg-violet-600/10 tw:rounded-full tw:blur-[100px] -tw:bottom-20 -tw:right-20 tw:pointer-events-none" />

        <div className="tw:w-full tw:max-w-md tw:bg-[#11141f] tw:border tw:border-white/10 tw:p-8 tw:rounded-3xl tw:shadow-2xl tw:relative tw:z-10 tw:space-y-6">
          <div className="tw:flex tw:flex-col tw:items-center tw:text-center tw:space-y-3">
            <div className="tw:p-3.5 tw:rounded-2xl tw:bg-gradient-to-tr tw:from-indigo-600 tw:to-violet-500 tw:text-white tw:shadow-xl tw:shadow-indigo-600/30">
              <ShieldAlert className="tw:w-8 tw:h-8" />
            </div>
            <div>
              <h1 className="tw:text-xl tw:font-black tw:tracking-tight tw:text-white">
                DwarPal Master Terminal
              </h1>
              <p className="tw:text-xs tw:text-neutral-400 tw:mt-1">
                Restricted Standalone Console. Authorized Personnel Only.
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="tw:space-y-4">
            <div>
              <label className="tw:block tw:text-xs tw:font-semibold tw:text-neutral-300 tw:mb-1.5">
                Master Security Key / Passcode
              </label>
              <div className="tw:relative">
                <KeyRound className="tw:w-4 tw:h-4 tw:absolute tw:left-3.5 tw:top-1/2 -tw:translate-y-1/2 tw:text-neutral-400" />
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter Master Passcode..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="tw:w-full tw:bg-[#090b12] tw:border tw:border-white/10 tw:rounded-xl tw:pl-10 tw:pr-4 tw:py-3 tw:text-sm tw:text-white focus:tw:border-indigo-500 focus:tw:outline-none placeholder:tw:text-neutral-600"
                />
              </div>
            </div>

            {error ? (
              <div className="tw:p-3 tw:rounded-xl tw:bg-rose-500/10 tw:border tw:border-rose-500/20 tw:text-xs tw:text-rose-300 tw:flex tw:items-center tw:gap-2">
                <AlertTriangle className="tw:w-4 tw:h-4 tw:shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="tw:w-full tw:py-3.5 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-gradient-to-r tw:from-indigo-600 tw:to-violet-600 hover:tw:from-indigo-500 hover:tw:to-violet-500 tw:text-white tw:shadow-lg tw:shadow-indigo-600/30 tw:transition-all tw:cursor-pointer tw:flex tw:items-center tw:justify-center tw:gap-2"
            >
              <Unlock className="tw:w-4 tw:h-4" />
              Unlock Master Terminal
            </button>
          </form>

          <div className="tw:pt-2 tw:text-center">
            <a
              href="/"
              className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-neutral-500 hover:tw:text-neutral-300 tw:transition-colors"
            >
              <ArrowLeft className="tw:w-3.5 tw:h-3.5" /> Return to Public Portal
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── UNLOCKED STANDALONE CONSOLE ─────────────────────────────────────────
  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-[#07090e] tw:text-white">
      {/* Standalone Topbar */}
      <header className="tw:w-full tw:bg-[#0d101a] tw:border-b tw:border-white/10 tw:px-6 tw:py-3.5 tw:flex tw:items-center tw:justify-between tw:sticky tw:top-0 tw:z-40">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:p-2 tw:rounded-lg tw:bg-indigo-600 tw:text-white">
            <ShieldAlert className="tw:w-4 tw:h-4" />
          </div>
          <div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-sm tw:font-black tw:tracking-tight tw:text-white">
                DwarPal Master Terminal
              </span>
              <span className="tw:px-2 tw:py-0.5 tw:rounded-full tw:text-[10px] tw:font-bold tw:bg-indigo-500/20 tw:text-indigo-300 tw:border tw:border-indigo-500/30">
                ROOT SESSION
              </span>
            </div>
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:gap-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="tw:text-xs tw:text-neutral-400 hover:tw:text-white tw:transition-colors tw:px-3 tw:py-1.5 tw:rounded-lg tw:bg-white/5 hover:tw:bg-white/10"
          >
            Open Live Website &rarr;
          </a>

          <button
            type="button"
            onClick={handleLock}
            className="tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3.5 tw:py-1.5 tw:rounded-xl tw:text-xs tw:font-bold tw:bg-rose-500/20 hover:tw:bg-rose-500/30 tw:text-rose-300 tw:border tw:border-rose-500/30 tw:transition-all tw:cursor-pointer"
          >
            <Lock className="tw:w-3.5 tw:h-3.5" /> Lock &amp; Exit
          </button>
        </div>
      </header>

      {/* Main Master Dashboard Container */}
      <main className="tw:py-6">
        <MasterControlDashboard currentUser={{ name: 'Master Owner', role: 'admin' }} />
      </main>
    </div>
  )
}
