import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield,
  QrCode,
  Smartphone,
  CheckCircle2,
  Lock,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Zap,
  Clock,
  Eye,
  AlertTriangle,
  UserCheck,
  Building,
  Radio,
  FileCheck,
  Flame,
  Globe,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Bell,
  Check,
  Cpu,
  RefreshCw,
  Send,
  User,
  School,
  Terminal,
} from 'lucide-react'

// --- SAMPLE DATA ---
const MODULES = [
  {
    id: 'student-pass',
    category: 'STUDENT PORTAL',
    year: '2026',
    title: 'Dynamic Rolling QR Gatepass',
    tagline: 'Cryptographic anti-screenshot rotating token technology',
    description:
      'Generates a live, self-refreshing dynamic QR token with animated security watermarks. Static screenshots are rendered immediately invalid at gate terminals.',
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    accentColor: '#3b82f6',
    badge: 'ANTI-FORGERY',
    metrics: ['< 5s Token Refresh', 'Zero Screenshot Leaks', 'Instant Push Alerts'],
    previewType: 'qr',
  },
  {
    id: 'guard-terminal',
    category: 'CHECKPOINT OPS',
    year: '2026',
    title: 'Sub-Second Optical Terminal',
    tagline: 'Offline-first camera scanner interface for security officers',
    description:
      'Equips campus gatekeepers with sub-second camera scanning, automatic vehicle number plate logging, emergency manual student roll lookups, and offline sync.',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    accentColor: '#10b981',
    badge: 'SUB-SECOND SYNC',
    metrics: ['340ms Verification', 'Offline-First PWA', 'License Plate Log'],
    previewType: 'terminal',
  },
  {
    id: 'faculty-desk',
    category: 'ACADEMIC HIERARCHY',
    year: '2026',
    title: 'Multi-Tier Approval Matrix',
    tagline: 'Streamlined leave governance for Faculty, HODs & Wardens',
    description:
      'Hierarchical approval workflows routed by student year, branch, and hostel block. Includes one-tap bulk approvals, proxy delegation, and automated parent notifications.',
    gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
    accentColor: '#8b5cf6',
    badge: 'AUTOMATED ROUTING',
    metrics: ['1-Tap Review Desk', 'Parent SMS Sync', 'Customizable Rules'],
    previewType: 'faculty',
  },
  {
    id: 'master-telemetry',
    category: 'CAMPUS COMMAND',
    year: '2026',
    title: 'Executive Telemetry & Audit Hub',
    tagline: 'Real-time headcounts, curfew tracking and compliance logs',
    description:
      'High-level visibility for Principals, Chairmen, and Security Chiefs. Track live in-campus vs out-of-campus headcounts, overdue return alerts, and export audit sheets.',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    accentColor: '#f59e0b',
    badge: 'EXECUTIVE INTELLIGENCE',
    metrics: ['Live Population Census', 'Overstay Radar', '1-Click Audit Export'],
    previewType: 'analytics',
  },
]

const FAQS = [
  {
    num: '01',
    q: 'How does the dynamic rotating QR token prevent pass sharing or screenshots?',
    a: 'DwarPal gatepasses embed a time-synchronized cryptographic seed that continuously re-hashes the QR code every few seconds alongside an animated micro-watermark. When a student shows a static screenshot or recorded video, the gatekeeper terminal instantly detects the expired signature and sounds an alert.',
  },
  {
    num: '02',
    q: 'What happens if campus Wi-Fi or cellular networks fail at the gate checkpoint?',
    a: 'The DwarPal Gate Terminal is built as an offline-first Progressive Web Application with local cryptographically-verifiable token caching. It continues scanning, verifying valid student passes, and logging timestamps locally without interruption, auto-syncing the audit trail to the cloud once connectivity resumes.',
  },
  {
    num: '03',
    q: 'Can parents receive automated alerts when a student exits or enters campus?',
    a: 'Yes. As soon as the optical terminal registers an exit or entry scan, DwarPal’s event engine dispatches automated push notifications, SMS alerts, and email notifications to registered parent contact numbers with precise timestamps.',
  },
  {
    num: '04',
    q: 'How are faculty advisors, HODs, and hostel wardens notified of leave requests?',
    a: 'When a student requests a day pass or night outpass, it routes automatically to the assigned Class Coordinator or Hostel Warden based on the institution’s configured approval policy. Faculty receive instant push & web notifications and can approve in 1-tap with full academic attendance context.',
  },
  {
    num: '05',
    q: 'How fast can an institution or residential community deploy DwarPal?',
    a: 'A campus can be fully configured in less than 24 hours. You can bulk-import students and faculty via Excel/CSV or enable instant self-service enrollment at the dedicated registration portal (/student/register).',
  },
  {
    num: '06',
    q: 'Is DwarPal compatible with existing vehicle boom barriers and biometric gates?',
    a: 'Yes. DwarPal offers REST and Webhook APIs for integrating with automated RFID boom barriers, speed gates, turnstiles, and existing campus ERP databases.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      'DwarPal eliminated our paper entry registers and weekend gate bottlenecks completely. We processed over 4,200 hostel students during Diwali leave in record time without a single discrepancy.',
    author: 'Col. Rajesh Sharma (Retd.)',
    role: 'Chief Security Officer, Apex Institute of Technology',
    tag: 'Campus Security',
    initials: 'RS',
  },
  {
    quote:
      'The multi-tier approval hierarchy is brilliant. Faculty advisors get leave requests categorized by urgency, and parents receive instant automated SMS updates when students check out.',
    author: 'Dr. Sunita Deshmukh',
    role: 'Dean of Student Affairs, MET University',
    tag: 'Academic Administration',
    initials: 'SD',
  },
  {
    quote:
      'The dynamic QR code is a lifesaver. No more physical passes to get signed by three different professors. I can apply on my phone in 30 seconds and check out smoothly at the main gate.',
    author: 'Ananya Verma',
    role: 'Student Council President & 4th Year Engg.',
    tag: 'Student Experience',
    initials: 'AV',
  },
  {
    quote:
      'Having offline scanner capability at the remote back-gate where cellular reception is spotty made DwarPal the only system that actually worked flawlessly under real conditions.',
    author: 'Vikramjit Singh',
    role: 'Facility & Operations Director, Global City Housing',
    tag: 'Operations',
    initials: 'VS',
  },
]

const INSIGHTS = [
  {
    category: 'SECURITY PROTOCOL',
    date: 'Aug 2026',
    readTime: '4 min read',
    title: 'Zero-Trust Gatekeeping: How Dynamic Cryptographic Tokens Defeat Pass Forgery',
    description:
      'Why traditional static QR codes fail at campus gates and how rotating time-bound micro-watermarks restore institutional integrity.',
  },
  {
    category: 'INFRASTRUCTURE',
    date: 'Aug 2026',
    readTime: '3 min read',
    title: 'Designing Offline-First Scanner PWAs for 100% Gate Uptime',
    description:
      'Architecting local key validation and conflict-free replicated data types for high-traffic checkpoints during network blackouts.',
  },
  {
    category: 'CAMPUS AUTOMATION',
    date: 'Jul 2026',
    readTime: '5 min read',
    title: 'Eliminating the Paper Trail: How 1-Tap Faculty Leave Approvals Save 300+ Hours',
    description:
      'A case study on streamlining approval hierarchies, reducing hostel administration overhead, and building parent trust.',
  },
]

export default function DisplayLandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(0)
  const [activeTab, setActiveTab] = useState('student') // 'student', 'guard', 'parent'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)

  // Interactive sandbox state
  const [dynamicCode, setDynamicCode] = useState('DP-9482-X9')
  const [qrTimer, setQrTimer] = useState(15)
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [alertLogs, setAlertLogs] = useState([
    { id: 1, time: '18:42:10', text: 'Exit pass #DP-8921 scanned at North Gate terminal', status: 'VERIFIED' },
    { id: 2, time: '18:42:11', text: 'Automated SMS dispatched to parent contact (+91 98*** **412)', status: 'SENT' },
  ])

  // Rolling dynamic token simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setQrTimer((prev) => {
        if (prev <= 1) {
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
          setDynamicCode(`DP-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`)
          return 15
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSimulateScan = () => {
    setIsVerifying(true)
    setScanResult(null)
    setTimeout(() => {
      setIsVerifying(false)
      const now = new Date().toTimeString().split(' ')[0]
      const newScan = {
        student: 'Aarav Patel (CS-2023-042)',
        passId: dynamicCode,
        destination: 'City Center (Library Study)',
        validUntil: 'Today, 21:30',
        vehicle: 'MH-12-DE-4419 (Two Wheeler)',
        timestamp: now,
      }
      setScanResult(newScan)
      setAlertLogs((prev) => [
        {
          id: Date.now(),
          time: now,
          text: `Pass #${dynamicCode} scanned for Aarav Patel (CS-2023-042)`,
          status: 'VERIFIED',
        },
        {
          id: Date.now() + 1,
          time: now,
          text: `Parent SMS & Push alert dispatched for Aarav Patel`,
          status: 'DISPATCHED',
        },
        ...prev.slice(0, 4),
      ])
    }, 450)
  }

  const handleLogoClick = () => {
    const next = logoClicks + 1
    if (next >= 5) {
      navigate('/master-control')
      return
    }
    setLogoClicks(next)
    setTimeout(() => setLogoClicks(0), 3000)
  }

  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-[#09090b] tw:text-zinc-100 tw:font-sans tw:selection:bg-blue-600 tw:selection:text-white tw:relative tw:overflow-x-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="tw:fixed tw:top-[-10%] tw:left-1/2 tw:-translate-x-1/2 tw:w-[90vw] tw:max-w-[1100px] tw:h-[500px] tw:bg-gradient-to-b tw:from-blue-600/[0.08] tw:via-indigo-600/[0.04] tw:to-transparent tw:rounded-full tw:blur-[140px] tw:pointer-events-none tw:z-0" />
      <div className="tw:fixed tw:bottom-[-20%] tw:right-[-10%] tw:w-[60vw] tw:max-w-[800px] tw:h-[450px] tw:bg-gradient-to-tl tw:from-emerald-600/[0.05] tw:to-transparent tw:rounded-full tw:blur-[160px] tw:pointer-events-none tw:z-0" />

      {/* ======================================================== */}
      {/* 1. FLOATING PILL NAVBAR (Display Framer Style)           */}
      {/* ======================================================== */}
      <div className="tw:fixed tw:top-5 tw:inset-x-0 tw:z-50 tw:flex tw:justify-center tw:px-4 tw:pointer-events-none">
        <nav className="tw:w-full tw:max-w-4xl tw:bg-zinc-950/80 tw:backdrop-blur-xl tw:border tw:border-zinc-800/80 tw:shadow-[0_20px_50px_rgba(0,0,0,0.6)] tw:rounded-full tw:px-4 tw:py-2 tw:flex tw:items-center tw:justify-between tw:pointer-events-auto tw:transition-all">
          {/* Logo */}
          <div
            onClick={handleLogoClick}
            className="tw:flex tw:items-center tw:gap-2.5 tw:cursor-pointer tw:select-none tw:pl-2"
          >
            <div className="tw:w-7 tw:h-7 tw:rounded-full tw:bg-gradient-to-tr tw:from-blue-600 tw:to-cyan-400 tw:flex tw:items-center tw:justify-center tw:shadow-md">
              <Shield className="tw:w-4 tw:h-4 tw:text-white" />
            </div>
            <div className="tw:flex tw:flex-col">
              <span className="tw:text-sm tw:font-bold tw:tracking-wider tw:text-white tw:leading-none">
                DwarPal
              </span>
              <span className="tw:text-[9px] tw:font-mono tw:text-zinc-400 tw:tracking-widest tw:uppercase">
                Security v2.4
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="tw:hidden tw:md:tw:flex tw:items-center tw:gap-6 tw:text-xs tw:font-medium tw:text-zinc-300">
            <a href="#modules" className="hover:tw:text-white tw:transition-colors">
              Modules
            </a>
            <a href="#sandbox" className="hover:tw:text-white tw:transition-colors">
              Live Demo
            </a>
            <a href="#metrics" className="hover:tw:text-white tw:transition-colors">
              Architecture
            </a>
            <a href="#testimonials" className="hover:tw:text-white tw:transition-colors">
              Testimonials
            </a>
            <a href="#faq" className="hover:tw:text-white tw:transition-colors">
              FAQ
            </a>
          </div>

          {/* Action CTAs */}
          <div className="tw:flex tw:items-center tw:gap-2">
            {/* Quick Switch to Classic Dotted */}
            <Link
              to="/"
              className="tw:hidden tw:sm:tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-mono tw:text-zinc-400 hover:tw:text-zinc-200 tw:bg-zinc-900/90 hover:tw:bg-zinc-800 tw:border tw:border-zinc-800 tw:px-3 tw:py-1.5 tw:rounded-full tw:transition-all"
              title="Switch to original Dotted Canvas Landing"
            >
              <span className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-blue-400" />
              <span>Dotted Mode</span>
            </Link>

            {/* Launch App Button */}
            <Link
              to="/access-portal"
              className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:bg-white hover:tw:bg-zinc-200 tw:text-zinc-950 tw:px-4 tw:py-1.5 tw:rounded-full tw:shadow-md hover:tw:shadow-white/10 tw:transition-all tw:cursor-pointer"
            >
              <span>Access Portal</span>
              <ArrowRight className="tw:w-3.5 tw:h-3.5" />
            </Link>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="tw:flex tw:md:tw:hidden tw:p-1.5 tw:text-zinc-400 hover:tw:text-white tw:rounded-lg"
            >
              {mobileMenuOpen ? <X className="tw:w-5 tw:h-5" /> : <Menu className="tw:w-5 tw:h-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="tw:fixed tw:top-20 tw:inset-x-4 tw:z-40 tw:bg-zinc-900/95 tw:backdrop-blur-2xl tw:border tw:border-zinc-800 tw:rounded-3xl tw:p-6 tw:shadow-2xl tw:flex tw:flex-col tw:gap-4 tw:md:tw:hidden"
          >
            <a
              href="#modules"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-zinc-200 tw:py-2 tw:border-b tw:border-zinc-800/60"
            >
              Modules & Features
            </a>
            <a
              href="#sandbox"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-zinc-200 tw:py-2 tw:border-b tw:border-zinc-800/60"
            >
              Interactive Sandbox Demo
            </a>
            <a
              href="#metrics"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-zinc-200 tw:py-2 tw:border-b tw:border-zinc-800/60"
            >
              System Architecture
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-zinc-200 tw:py-2 tw:border-b tw:border-zinc-800/60"
            >
              Frequently Asked Questions
            </a>
            <div className="tw:pt-2 tw:flex tw:flex-col tw:gap-2">
              <Link
                to="/access-portal"
                className="tw:w-full tw:text-center tw:py-3 tw:bg-blue-600 tw:text-white tw:font-semibold tw:rounded-xl tw:text-sm"
              >
                Launch Access Portal
              </Link>
              <Link
                to="/"
                className="tw:w-full tw:text-center tw:py-2.5 tw:bg-zinc-800 tw:text-zinc-300 tw:font-medium tw:rounded-xl tw:text-xs"
              >
                Switch to Dotted Canvas View
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. HERO SECTION (Clean, Minimalist, High-Impact)         */}
      {/* ======================================================== */}
      <section className="tw:relative tw:pt-36 tw:pb-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:flex tw:flex-col tw:items-center tw:text-center tw:z-10">
        
        {/* Status Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="tw:inline-flex tw:items-center tw:gap-2.5 tw:px-4 tw:py-1.5 tw:rounded-full tw:bg-zinc-900/90 tw:border tw:border-zinc-800/90 tw:shadow-inner tw:mb-8"
        >
          <span className="tw:relative tw:flex tw:h-2 tw:w-2">
            <span className="tw:animate-ping tw:absolute tw:inline-flex tw:h-full tw:w-full tw:rounded-full tw:bg-emerald-400 tw:opacity-75"></span>
            <span className="tw:relative tw:inline-flex tw:rounded-full tw:h-2 tw:w-2 tw:bg-emerald-500"></span>
          </span>
          <span className="tw:text-[11px] tw:font-mono tw:tracking-widest tw:text-zinc-300 tw:uppercase">
            2026 ZERO-TRUST ACCESS PROTOCOL
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="tw:text-4xl tw:sm:tw:text-6xl tw:md:tw:text-7xl tw:font-bold tw:tracking-tight tw:text-white tw:max-w-4xl tw:leading-[1.1]"
        >
          The Intelligent Gatekeeper for Modern Institutions.
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="tw:mt-6 tw:text-base tw:sm:tw:text-lg tw:md:tw:text-xl tw:text-zinc-400 tw:max-w-2xl tw:leading-relaxed tw:font-normal"
        >
          Replace fragile paper registers and static passes with cryptographically signed rotating QR tokens, sub-second optical terminals, and multi-tier leave approval intelligence.
        </motion.p>

        {/* Hero CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="tw:mt-10 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-4"
        >
          <Link
            to="/access-portal"
            className="tw:px-8 tw:py-3.5 tw:rounded-full tw:bg-white hover:tw:bg-zinc-200 tw:text-zinc-950 tw:font-semibold tw:text-sm tw:shadow-lg tw:shadow-white/10 tw:transition-all tw:flex tw:items-center tw:gap-2 tw:group"
          >
            <span>Launch Access Workspace</span>
            <ArrowRight className="tw:w-4 tw:h-4 group-hover:tw:translate-x-1 tw:transition-transform" />
          </Link>

          <a
            href="#sandbox"
            className="tw:px-7 tw:py-3.5 tw:rounded-full tw:bg-zinc-900/90 hover:tw:bg-zinc-800 tw:text-zinc-200 tw:border tw:border-zinc-800 tw:font-medium tw:text-sm tw:transition-all tw:flex tw:items-center tw:gap-2"
          >
            <Sparkles className="tw:w-4 tw:h-4 tw:text-blue-400" />
            <span>Interactive Simulator</span>
          </a>

          <Link
            to="/student/register"
            className="tw:px-6 tw:py-3.5 tw:rounded-full tw:bg-zinc-950 tw:text-zinc-400 hover:tw:text-white tw:border tw:border-zinc-800/80 tw:font-mono tw:text-xs tw:tracking-wider tw:transition-all"
          >
            STUDENT ENROLLMENT →
          </Link>
        </motion.div>

        {/* ======================================================== */}
        {/* 3. HERO QUICK-CARDS (Display Framer 3-Column Style)     */}
        {/* ======================================================== */}
        <div className="tw:mt-16 tw:w-full tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-3 tw:gap-4 tw:text-left">
          
          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-900/40 tw:border tw:border-zinc-800/70 tw:backdrop-blur-sm hover:tw:border-zinc-700/80 tw:transition-all tw:group">
            <div className="tw:w-9 tw:h-9 tw:rounded-xl tw:bg-blue-500/10 tw:border tw:border-blue-500/20 tw:flex tw:items-center tw:justify-center tw:text-blue-400 tw:mb-4">
              <QrCode className="tw:w-5 tw:h-5" />
            </div>
            <h3 className="tw:text-base tw:font-semibold tw:text-white group-hover:tw:text-blue-300 tw:transition-colors">
              Dynamic QR Passes
            </h3>
            <p className="tw:mt-2 tw:text-xs tw:text-zinc-400 tw:leading-relaxed">
              Cryptographic rolling tokens refreshing every few seconds with dynamic watermarks. Completely eliminates pass forgery and screenshot reuse.
            </p>
          </div>

          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-900/40 tw:border tw:border-zinc-800/70 tw:backdrop-blur-sm hover:tw:border-zinc-700/80 tw:transition-all tw:group">
            <div className="tw:w-9 tw:h-9 tw:rounded-xl tw:bg-emerald-500/10 tw:border tw:border-emerald-500/20 tw:flex tw:items-center tw:justify-center tw:text-emerald-400 tw:mb-4">
              <Zap className="tw:w-5 tw:h-5" />
            </div>
            <h3 className="tw:text-base tw:font-semibold tw:text-white group-hover:tw:text-emerald-300 tw:transition-colors">
              Sub-Second Terminal
            </h3>
            <p className="tw:mt-2 tw:text-xs tw:text-zinc-400 tw:leading-relaxed">
              Offline-first optical scanner for gate officers with vehicle registration verification, camera feeds, and automated cloud sync.
            </p>
          </div>

          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-900/40 tw:border tw:border-zinc-800/70 tw:backdrop-blur-sm hover:tw:border-zinc-700/80 tw:transition-all tw:group">
            <div className="tw:w-9 tw:h-9 tw:rounded-xl tw:bg-purple-500/10 tw:border tw:border-purple-500/20 tw:flex tw:items-center tw:justify-center tw:text-purple-400 tw:mb-4">
              <Layers className="tw:w-5 tw:h-5" />
            </div>
            <h3 className="tw:text-base tw:font-semibold tw:text-white group-hover:tw:text-purple-300 tw:transition-colors">
              Multi-Tier Approvals
            </h3>
            <p className="tw:mt-2 tw:text-xs tw:text-zinc-400 tw:leading-relaxed">
              Automated hierarchical workflow routing requests from Faculty Advisors to HODs and Wardens, with instant parent SMS updates.
            </p>
          </div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. SELECTED MODULES SHOWCASE (Display Bento Grid)        */}
      {/* ======================================================== */}
      <section id="modules" className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        
        {/* Section Header */}
        <div className="tw:flex tw:flex-col tw:md:tw:flex-row tw:md:tw:items-end tw:justify-between tw:mb-12 tw:gap-4">
          <div>
            <div className="tw:text-xs tw:font-mono tw:tracking-widest tw:text-blue-400 tw:uppercase tw:mb-2">
              CORE SYSTEM ARCHITECTURE
            </div>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-white">
              Selected Modules
            </h2>
          </div>
          <p className="tw:text-xs tw:text-zinc-400 tw:max-w-md">
            Purpose-built interfaces tailored for students, checkpoint security officers, academic deans, and institutional leadership.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8">
          {MODULES.map((mod, idx) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="tw:group tw:rounded-3xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 hover:tw:border-zinc-700 tw:overflow-hidden tw:flex tw:flex-col tw:transition-all tw:shadow-xl hover:tw:shadow-2xl"
            >
              {/* Card Preview Window */}
              <div className={`tw:h-64 tw:sm:tw:h-72 tw:w-full tw:bg-gradient-to-br ${mod.gradient} tw:border-b tw:border-zinc-800/60 tw:p-6 tw:relative tw:flex tw:items-center tw:justify-center tw:overflow-hidden`}>
                
                {/* Background Ambient Grid */}
                <div className="tw:absolute tw:inset-0 tw:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] tw:opacity-30" />

                {/* Badge */}
                <div className="tw:absolute tw:top-4 tw:left-4 tw:px-3 tw:py-1 tw:rounded-full tw:bg-zinc-900/90 tw:border tw:border-zinc-700/60 tw:text-[10px] tw:font-mono tw:tracking-wider tw:text-zinc-300 tw:z-10">
                  {mod.category} · {mod.year}
                </div>

                {/* Module Mockup Displays */}
                {mod.previewType === 'qr' && (
                  <div className="tw:w-64 tw:bg-zinc-900/90 tw:backdrop-blur-md tw:border tw:border-blue-500/30 tw:rounded-2xl tw:p-4 tw:shadow-2xl tw:relative tw:z-10 tw:transform group-hover:tw:scale-105 tw:transition-transform">
                    <div className="tw:flex tw:items-center tw:justify-between tw:mb-3">
                      <span className="tw:text-[10px] tw:font-mono tw:text-blue-400 tw:font-bold">ACTIVE GATEPASS</span>
                      <span className="tw:px-2 tw:py-0.5 tw:rounded-full tw:bg-emerald-500/20 tw:text-emerald-400 tw:text-[9px] tw:font-mono">VALID</span>
                    </div>
                    <div className="tw:bg-white tw:p-3 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center">
                      <div className="tw:w-28 tw:h-28 tw:bg-zinc-950 tw:rounded-lg tw:flex tw:items-center tw:justify-center tw:relative tw:overflow-hidden">
                        <QrCode className="tw:w-20 tw:h-20 tw:text-white" />
                        <div className="tw:absolute tw:inset-x-0 tw:h-1 tw:bg-blue-400 tw:shadow-[0_0_8px_#38bdf8] tw:animate-pulse" />
                      </div>
                      <span className="tw:text-[10px] tw:font-mono tw:text-zinc-800 tw:font-bold tw:mt-2">
                        {dynamicCode}
                      </span>
                    </div>
                    <div className="tw:mt-2.5 tw:flex tw:justify-between tw:text-[10px] tw:text-zinc-400 tw:font-mono">
                      <span>Syncing in {qrTimer}s</span>
                      <span className="tw:text-blue-400">Hostel Outpass</span>
                    </div>
                  </div>
                )}

                {mod.previewType === 'terminal' && (
                  <div className="tw:w-72 tw:bg-zinc-900/90 tw:backdrop-blur-md tw:border tw:border-emerald-500/30 tw:rounded-2xl tw:p-4 tw:shadow-2xl tw:relative tw:z-10 tw:transform group-hover:tw:scale-105 tw:transition-transform">
                    <div className="tw:flex tw:items-center tw:justify-between tw:mb-2">
                      <div className="tw:flex tw:items-center tw:gap-1.5">
                        <span className="tw:w-2 tw:h-2 tw:rounded-full tw:bg-emerald-400 tw:animate-pulse" />
                        <span className="tw:text-[10px] tw:font-mono tw:text-zinc-300">OPTICAL SCANNER READY</span>
                      </div>
                      <span className="tw:text-[9px] tw:font-mono tw:text-zinc-500">GATE-01</span>
                    </div>
                    <div className="tw:h-28 tw:rounded-xl tw:bg-black/60 tw:border tw:border-zinc-800 tw:relative tw:flex tw:items-center tw:justify-center">
                      <div className="tw:w-20 tw:h-20 tw:border-2 tw:border-emerald-400/50 tw:border-dashed tw:rounded-lg tw:flex tw:items-center tw:justify-center">
                        <CheckCircle2 className="tw:w-8 tw:h-8 tw:text-emerald-400" />
                      </div>
                      <div className="tw:absolute tw:bottom-2 tw:inset-x-2 tw:bg-emerald-950/80 tw:border tw:border-emerald-500/40 tw:rounded-md tw:p-1 tw:text-center">
                        <span className="tw:text-[10px] tw:font-mono tw:text-emerald-300 tw:font-bold">VERIFIED: DISHA NAIR (PASS #8192)</span>
                      </div>
                    </div>
                  </div>
                )}

                {mod.previewType === 'faculty' && (
                  <div className="tw:w-72 tw:bg-zinc-900/90 tw:backdrop-blur-md tw:border tw:border-purple-500/30 tw:rounded-2xl tw:p-4 tw:shadow-2xl tw:relative tw:z-10 tw:transform group-hover:tw:scale-105 tw:transition-transform">
                    <div className="tw:flex tw:items-center tw:justify-between tw:mb-2.5">
                      <span className="tw:text-[10px] tw:font-mono tw:text-purple-300 tw:font-bold">LEAVE APPROVAL QUEUE</span>
                      <span className="tw:text-[9px] tw:bg-purple-500/20 tw:text-purple-300 tw:px-2 tw:py-0.5 tw:rounded-full">1 PENDING</span>
                    </div>
                    <div className="tw:bg-zinc-950 tw:border tw:border-zinc-800 tw:rounded-xl tw:p-2.5 tw:text-left">
                      <div className="tw:flex tw:justify-between tw:items-start">
                        <div>
                          <div className="tw:text-xs tw:font-semibold tw:text-white">Rohan Kulkarni</div>
                          <div className="tw:text-[10px] tw:text-zinc-400">ECE - Sem 6 · Outpass</div>
                        </div>
                        <span className="tw:text-[9px] tw:bg-amber-500/20 tw:text-amber-300 tw:px-1.5 tw:py-0.5 tw:rounded">Urgent</span>
                      </div>
                      <div className="tw:mt-3 tw:flex tw:gap-2">
                        <button className="tw:flex-1 tw:py-1 tw:bg-emerald-600 hover:tw:bg-emerald-500 tw:text-white tw:text-[10px] tw:font-bold tw:rounded-md tw:transition-colors">
                          Approve
                        </button>
                        <button className="tw:px-3 tw:py-1 tw:bg-zinc-800 tw:text-zinc-300 tw:text-[10px] tw:rounded-md">
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {mod.previewType === 'analytics' && (
                  <div className="tw:w-72 tw:bg-zinc-900/90 tw:backdrop-blur-md tw:border tw:border-amber-500/30 tw:rounded-2xl tw:p-4 tw:shadow-2xl tw:relative tw:z-10 tw:transform group-hover:tw:scale-105 tw:transition-transform">
                    <div className="tw:flex tw:items-center tw:justify-between tw:mb-2">
                      <span className="tw:text-[10px] tw:font-mono tw:text-amber-400 tw:font-bold">CAMPUS POPULATION</span>
                      <span className="tw:text-[9px] tw:text-emerald-400">● LIVE</span>
                    </div>
                    <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:mt-2">
                      <div className="tw:bg-zinc-950 tw:p-2.5 tw:rounded-xl tw:border tw:border-zinc-800">
                        <div className="tw:text-[10px] tw:text-zinc-400">Inside Campus</div>
                        <div className="tw:text-lg tw:font-bold tw:text-white tw:mt-0.5">3,412</div>
                      </div>
                      <div className="tw:bg-zinc-950 tw:p-2.5 tw:rounded-xl tw:border tw:border-zinc-800">
                        <div className="tw:text-[10px] tw:text-zinc-400">On Outpass</div>
                        <div className="tw:text-lg tw:font-bold tw:text-amber-400 tw:mt-0.5">284</div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Card Content Body */}
              <div className="tw:p-8 tw:flex tw:flex-col tw:justify-between tw:flex-grow">
                <div>
                  <div className="tw:flex tw:items-center tw:justify-between tw:mb-3">
                    <span className="tw:text-xs tw:font-mono tw:text-zinc-500 tw:uppercase tw:tracking-wider">
                      {mod.tagline}
                    </span>
                    <span className="tw:text-[10px] tw:font-mono tw:px-2.5 tw:py-0.5 tw:rounded-full tw:bg-zinc-900 tw:border tw:border-zinc-800 tw:text-zinc-300">
                      {mod.badge}
                    </span>
                  </div>
                  <h3 className="tw:text-2xl tw:font-bold tw:text-white group-hover:tw:text-blue-300 tw:transition-colors">
                    {mod.title}
                  </h3>
                  <p className="tw:mt-3 tw:text-sm tw:text-zinc-400 tw:leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                {/* Metrics Pill Row */}
                <div className="tw:mt-6 tw:pt-6 tw:border-t tw:border-zinc-800/80 tw:flex tw:flex-wrap tw:gap-2">
                  {mod.metrics.map((metric, mIdx) => (
                    <span
                      key={mIdx}
                      className="tw:text-[11px] tw:font-mono tw:text-zinc-300 tw:bg-zinc-900/80 tw:border tw:border-zinc-800 tw:px-3 tw:py-1 tw:rounded-md"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. INTERACTIVE LIVE DEMO SANDBOX                         */}
      {/* ======================================================== */}
      <section id="sandbox" className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        <div className="tw:rounded-3xl tw:bg-gradient-to-b tw:from-zinc-900/90 tw:to-zinc-950/90 tw:border tw:border-zinc-800 tw:p-8 tw:sm:tw:p-12 tw:shadow-2xl">
          
          {/* Header */}
          <div className="tw:text-center tw:max-w-2xl tw:mx-auto tw:mb-10">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-blue-500/10 tw:border tw:border-blue-500/20 tw:text-blue-400 tw:text-xs tw:font-mono tw:mb-4">
              <Sparkles className="tw:w-3.5 tw:h-3.5" />
              <span>TEST THE ENGINE LIVE</span>
            </div>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-white">
              Experience the DwarPal Verification Flow
            </h2>
            <p className="tw:mt-3 tw:text-sm tw:text-zinc-400">
              Switch roles between a student generating a dynamic pass, a guard at the terminal, and an instant parent alert dispatcher.
            </p>
          </div>

          {/* Interactive Role Switcher Tabs */}
          <div className="tw:flex tw:justify-center tw:mb-8">
            <div className="tw:inline-flex tw:p-1.5 tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800">
              <button
                onClick={() => setActiveTab('student')}
                className={`tw:px-5 tw:py-2 tw:rounded-xl tw:text-xs tw:font-semibold tw:transition-all ${
                  activeTab === 'student'
                    ? 'tw:bg-blue-600 tw:text-white tw:shadow-md'
                    : 'tw:text-zinc-400 hover:tw:text-white'
                }`}
              >
                1. Student Pass Generation
              </button>
              <button
                onClick={() => setActiveTab('guard')}
                className={`tw:px-5 tw:py-2 tw:rounded-xl tw:text-xs tw:font-semibold tw:transition-all ${
                  activeTab === 'guard'
                    ? 'tw:bg-emerald-600 tw:text-white tw:shadow-md'
                    : 'tw:text-zinc-400 hover:tw:text-white'
                }`}
              >
                2. Gate Terminal Scan
              </button>
              <button
                onClick={() => setActiveTab('parent')}
                className={`tw:px-5 tw:py-2 tw:rounded-xl tw:text-xs tw:font-semibold tw:transition-all ${
                  activeTab === 'parent'
                    ? 'tw:bg-purple-600 tw:text-white tw:shadow-md'
                    : 'tw:text-zinc-400 hover:tw:text-white'
                }`}
              >
                3. Parent Real-Time Sync
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="tw:bg-zinc-950/90 tw:border tw:border-zinc-800/80 tw:rounded-2xl tw:p-6 tw:sm:tw:p-8">
            
            {activeTab === 'student' && (
              <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                <div>
                  <span className="tw:text-xs tw:font-mono tw:text-blue-400 tw:uppercase tw:tracking-widest">
                    STEP 1 : SMARTPHONE VIEW
                  </span>
                  <h3 className="tw:text-2xl tw:font-bold tw:text-white tw:mt-1">
                    Rolling Cryptographic Dynamic QR
                  </h3>
                  <p className="tw:text-xs tw:text-zinc-400 tw:mt-3 tw:leading-relaxed">
                    Notice how the pass token updates continuously. Even if someone takes a screenshot, the optical terminal will reject it the moment the seed timestamp expires.
                  </p>
                  
                  <div className="tw:mt-6 tw:space-y-3">
                    <div className="tw:flex tw:items-center tw:gap-3 tw:text-xs tw:text-zinc-300">
                      <Check className="tw:w-4 tw:h-4 tw:text-emerald-400" />
                      <span>Zero-pass leakage with dynamic time-stamped hash</span>
                    </div>
                    <div className="tw:flex tw:items-center tw:gap-3 tw:text-xs tw:text-zinc-300">
                      <Check className="tw:w-4 tw:h-4 tw:text-emerald-400" />
                      <span>Includes student photo ID, branch, and approved curfew hours</span>
                    </div>
                    <div className="tw:flex tw:items-center tw:gap-3 tw:text-xs tw:text-zinc-300">
                      <Check className="tw:w-4 tw:h-4 tw:text-emerald-400" />
                      <span>Works seamlessly offline on cached Progressive Web App</span>
                    </div>
                  </div>

                  <div className="tw:mt-8 tw:flex tw:gap-3">
                    <button
                      onClick={() => {
                        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
                        setDynamicCode(`DP-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`)
                        setQrTimer(15)
                      }}
                      className="tw:px-5 tw:py-2.5 tw:bg-blue-600 hover:tw:bg-blue-500 tw:text-white tw:text-xs tw:font-semibold tw:rounded-xl tw:flex tw:items-center tw:gap-2 tw:transition-colors"
                    >
                      <RefreshCw className="tw:w-3.5 tw:h-3.5" />
                      <span>Force Cycle Token Seed</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('guard')}
                      className="tw:px-5 tw:py-2.5 tw:bg-zinc-800 hover:tw:bg-zinc-700 tw:text-zinc-200 tw:text-xs tw:font-semibold tw:rounded-xl tw:transition-colors"
                    >
                      Simulate Gate Scan →
                    </button>
                  </div>
                </div>

                {/* Digital Card Preview */}
                <div className="tw:flex tw:justify-center">
                  <div className="tw:w-full tw:max-w-xs tw:bg-gradient-to-b tw:from-zinc-900 tw:to-zinc-950 tw:border tw:border-blue-500/40 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:relative tw:overflow-hidden">
                    <div className="tw:flex tw:justify-between tw:items-center tw:border-b tw:border-zinc-800 tw:pb-3 tw:mb-4">
                      <div>
                        <div className="tw:text-xs tw:font-bold tw:text-white">Apex University Campus</div>
                        <div className="tw:text-[10px] tw:font-mono tw:text-blue-400">OFFICIAL GATEPASS</div>
                      </div>
                      <span className="tw:w-2.5 tw:h-2.5 tw:rounded-full tw:bg-emerald-400 tw:animate-ping" />
                    </div>

                    <div className="tw:flex tw:items-center tw:gap-3 tw:mb-4">
                      <div className="tw:w-12 tw:h-12 tw:rounded-xl tw:bg-blue-600/20 tw:border tw:border-blue-400/30 tw:flex tw:items-center tw:justify-center tw:text-blue-300 tw:font-bold">
                        AP
                      </div>
                      <div>
                        <div className="tw:text-sm tw:font-bold tw:text-white">Aarav Patel</div>
                        <div className="tw:text-[10px] tw:font-mono tw:text-zinc-400">ID: CS-2023-042 · Hostel Block C</div>
                      </div>
                    </div>

                    <div className="tw:bg-white tw:p-4 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center tw:shadow-inner">
                      <div className="tw:w-36 tw:h-36 tw:bg-zinc-950 tw:rounded-lg tw:flex tw:items-center tw:justify-center tw:relative">
                        <QrCode className="tw:w-28 tw:h-28 tw:text-white" />
                      </div>
                      <div className="tw:mt-2 tw:text-xs tw:font-mono tw:font-bold tw:text-zinc-900">
                        {dynamicCode}
                      </div>
                    </div>

                    <div className="tw:mt-4 tw:bg-zinc-900/90 tw:rounded-lg tw:p-2.5 tw:border tw:border-zinc-800 tw:flex tw:justify-between tw:items-center tw:text-[10px] tw:font-mono">
                      <span className="tw:text-zinc-400">Token Hash Refresh:</span>
                      <span className="tw:text-blue-400 tw:font-bold">{qrTimer}s remaining</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'guard' && (
              <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                <div>
                  <span className="tw:text-xs tw:font-mono tw:text-emerald-400 tw:uppercase tw:tracking-widest">
                    STEP 2 : CHECKPOINT TERMINAL
                  </span>
                  <h3 className="tw:text-2xl tw:font-bold tw:text-white tw:mt-1">
                    Optical Scanner Verification
                  </h3>
                  <p className="tw:text-xs tw:text-zinc-400 tw:mt-3 tw:leading-relaxed">
                    Test the gatekeeper camera scanner. Click <strong>"Simulate Scan"</strong> to trigger sub-second validation, vehicle number verification, and automated audit logging.
                  </p>

                  <div className="tw:mt-6 tw:p-4 tw:rounded-xl tw:bg-zinc-900/60 tw:border tw:border-zinc-800">
                    <div className="tw:text-xs tw:font-mono tw:text-zinc-400 tw:mb-2">CURRENT CHECKPOINT STATUS:</div>
                    <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                      <span className="tw:text-zinc-300">Terminal Mode:</span>
                      <span className="tw:text-emerald-400 tw:font-mono tw:font-bold">OPTICAL FAST-SCAN</span>
                    </div>
                    <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:mt-1.5">
                      <span className="tw:text-zinc-300">Avg Scan Latency:</span>
                      <span className="tw:text-emerald-400 tw:font-mono">340 ms</span>
                    </div>
                  </div>

                  <div className="tw:mt-8 tw:flex tw:gap-3">
                    <button
                      onClick={handleSimulateScan}
                      disabled={isVerifying}
                      className="tw:px-6 tw:py-3 tw:bg-emerald-600 hover:tw:bg-emerald-500 tw:text-white tw:text-xs tw:font-semibold tw:rounded-xl tw:flex tw:items-center tw:gap-2 tw:transition-colors tw:shadow-lg disabled:tw:opacity-60"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="tw:w-4 tw:h-4 tw:animate-spin" />
                          <span>Scanning Token...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="tw:w-4 tw:h-4" />
                          <span>Simulate Camera Scan (Pass #{dynamicCode})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Terminal Screen Simulation */}
                <div className="tw:flex tw:justify-center">
                  <div className="tw:w-full tw:max-w-sm tw:bg-black tw:border tw:border-emerald-500/40 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:font-mono">
                    <div className="tw:flex tw:justify-between tw:items-center tw:border-b tw:border-zinc-800 tw:pb-2.5 tw:mb-3 tw:text-[10px]">
                      <span className="tw:text-emerald-400">TERMINAL: GATE-01-NORTH</span>
                      <span className="tw:text-zinc-400">OFFLINE READY</span>
                    </div>

                    {scanResult ? (
                      <div className="tw:bg-emerald-950/40 tw:border tw:border-emerald-500/50 tw:rounded-xl tw:p-4 tw:space-y-2">
                        <div className="tw:flex tw:items-center tw:gap-2 tw:text-emerald-400 tw:text-xs tw:font-bold">
                          <CheckCircle2 className="tw:w-4 tw:h-4" />
                          <span>PASS VERIFIED · EXIT APPROVED</span>
                        </div>
                        <div className="tw:text-[11px] tw:text-white tw:pt-2 tw:border-t tw:border-emerald-500/20">
                          <div><strong>Student:</strong> {scanResult.student}</div>
                          <div className="tw:mt-1"><strong>Pass Token:</strong> {scanResult.passId}</div>
                          <div className="tw:mt-1"><strong>Vehicle:</strong> {scanResult.vehicle}</div>
                          <div className="tw:mt-1"><strong>Curfew:</strong> {scanResult.validUntil}</div>
                          <div className="tw:mt-1"><strong>Timestamp:</strong> {scanResult.timestamp}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="tw:h-48 tw:border tw:border-dashed tw:border-zinc-800 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center tw:text-zinc-500 tw:text-center tw:p-4">
                        <QrCode className="tw:w-12 tw:h-12 tw:text-zinc-600 tw:mb-2" />
                        <span className="tw:text-[11px]">Point camera at dynamic QR</span>
                        <span className="tw:text-[9px] tw:text-zinc-600 tw:mt-1">Click "Simulate Camera Scan" to test</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'parent' && (
              <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                <div>
                  <span className="tw:text-xs tw:font-mono tw:text-purple-400 tw:uppercase tw:tracking-widest">
                    STEP 3 : AUTOMATED NOTIFICATION LAYER
                  </span>
                  <h3 className="tw:text-2xl tw:font-bold tw:text-white tw:mt-1">
                    Instant Parent & Warden Sync
                  </h3>
                  <p className="tw:text-xs tw:text-zinc-400 tw:mt-3 tw:leading-relaxed">
                    The instant an optical gate scan is verified, webhooks and push dispatchers send real-time SMS and WhatsApp notifications to registered parent contacts and hostel wardens.
                  </p>

                  <div className="tw:mt-6 tw:space-y-2">
                    <div className="tw:p-3 tw:bg-zinc-900 tw:border tw:border-zinc-800 tw:rounded-xl tw:flex tw:items-center tw:justify-between tw:text-xs">
                      <span className="tw:text-zinc-300">Push Delivery Speed:</span>
                      <span className="tw:text-purple-400 tw:font-mono">&lt; 850 ms</span>
                    </div>
                    <div className="tw:p-3 tw:bg-zinc-900 tw:border tw:border-zinc-800 tw:rounded-xl tw:flex tw:items-center tw:justify-between tw:text-xs">
                      <span className="tw:text-zinc-300">Carrier SMS Failover:</span>
                      <span className="tw:text-emerald-400 tw:font-mono">ENABLED</span>
                    </div>
                  </div>

                  <div className="tw:mt-8">
                    <Link
                      to="/access-portal"
                      className="tw:inline-flex tw:items-center tw:gap-2 tw:px-6 tw:py-3 tw:bg-white tw:text-zinc-950 tw:font-semibold tw:text-xs tw:rounded-xl hover:tw:bg-zinc-200 tw:transition-colors"
                    >
                      <span>Deploy DwarPal in Your Institution</span>
                      <ArrowRight className="tw:w-3.5 tw:h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Notification Feed Mockup */}
                <div>
                  <div className="tw:bg-zinc-900/90 tw:border tw:border-purple-500/30 tw:rounded-2xl tw:p-5 tw:shadow-2xl">
                    <div className="tw:flex tw:items-center tw:gap-2 tw:mb-4">
                      <Bell className="tw:w-4 tw:h-4 tw:text-purple-400" />
                      <span className="tw:text-xs tw:font-mono tw:font-bold tw:text-white">LIVE EVENT DISPATCH LOG</span>
                    </div>
                    <div className="tw:space-y-2.5">
                      {alertLogs.map((log) => (
                        <div
                          key={log.id}
                          className="tw:p-3 tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:rounded-xl tw:text-[11px] tw:flex tw:items-start tw:justify-between tw:gap-3"
                        >
                          <div>
                            <div className="tw:text-zinc-300">{log.text}</div>
                            <div className="tw:text-[9px] tw:font-mono tw:text-zinc-500 tw:mt-0.5">{log.time}</div>
                          </div>
                          <span className="tw:px-2 tw:py-0.5 tw:rounded tw:bg-purple-900/40 tw:border tw:border-purple-500/30 tw:text-purple-300 tw:text-[9px] tw:font-mono">
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. METRICS & ZERO-TRUST COMPARISON                       */}
      {/* ======================================================== */}
      <section id="metrics" className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        
        {/* Metric Numbers */}
        <div className="tw:grid tw:grid-cols-2 tw:md:tw:grid-cols-4 tw:gap-4 tw:mb-16">
          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:text-center">
            <div className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:text-white">99.99%</div>
            <div className="tw:text-xs tw:font-mono tw:text-zinc-400 tw:mt-1">GATE SCANNER UPTIME</div>
          </div>
          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:text-center">
            <div className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:text-blue-400">&lt; 400ms</div>
            <div className="tw:text-xs tw:font-mono tw:text-zinc-400 tw:mt-1">OPTICAL VERIFICATION</div>
          </div>
          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:text-center">
            <div className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:text-emerald-400">100%</div>
            <div className="tw:text-xs tw:font-mono tw:text-zinc-400 tw:mt-1">OFFLINE CAPABILITY</div>
          </div>
          <div className="tw:p-6 tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:text-center">
            <div className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:text-purple-400">0</div>
            <div className="tw:text-xs tw:font-mono tw:text-zinc-400 tw:mt-1">PASS FORGERY INCIDENTS</div>
          </div>
        </div>

        {/* Security Comparison Table */}
        <div className="tw:rounded-3xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:overflow-hidden tw:shadow-xl">
          <div className="tw:p-6 tw:sm:tw:p-8 tw:border-b tw:border-zinc-800/80">
            <div className="tw:text-xs tw:font-mono tw:tracking-widest tw:text-blue-400 tw:uppercase">
              TECHNICAL COMPARISON
            </div>
            <h3 className="tw:text-2xl tw:font-bold tw:text-white tw:mt-1">
              Traditional Methods vs. DwarPal Zero-Trust Gatekeeper
            </h3>
          </div>

          <div className="tw:overflow-x-auto">
            <table className="tw:w-full tw:text-left tw:border-collapse tw:text-xs tw:sm:tw:text-sm">
              <thead>
                <tr className="tw:border-b tw:border-zinc-800 tw:bg-zinc-900/40 tw:font-mono tw:text-zinc-400">
                  <th className="tw:p-4 tw:sm:tw:p-6">CAPABILITY</th>
                  <th className="tw:p-4 tw:sm:tw:p-6 tw:text-zinc-500">PAPER REGISTERS</th>
                  <th className="tw:p-4 tw:sm:tw:p-6 tw:text-zinc-500">STATIC QR APPS</th>
                  <th className="tw:p-4 tw:sm:tw:p-6 tw:text-blue-400 tw:font-bold">DWARPAL GATEKEEPER</th>
                </tr>
              </thead>
              <tbody className="tw:divide-y tw:divide-zinc-800/60 tw:text-zinc-300">
                <tr>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:font-medium tw:text-white">Screenshot / Forgery Protection</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-red-400">None (Fake sign)</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-red-400">Vulnerable to sharing</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-emerald-400 tw:font-semibold">Cryptographic Rotating Hash</td>
                </tr>
                <tr>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:font-medium tw:text-white">Offline Gate Operation</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-emerald-400">Manual Paper</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-red-400">Fails on no network</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-emerald-400 tw:font-semibold">100% Offline-First PWA Cache</td>
                </tr>
                <tr>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:font-medium tw:text-white">Real-Time Parent SMS Sync</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-red-400">None</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-zinc-400">Manual Broadcast</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-emerald-400 tw:font-semibold">Sub-Second Automated Dispatch</td>
                </tr>
                <tr>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:font-medium tw:text-white">Executive Headcount Telemetry</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-red-400">Hours to tally registers</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-zinc-400">Static Reports</td>
                  <td className="tw:p-4 tw:sm:tw:p-6 tw:text-emerald-400 tw:font-semibold">Live Real-Time Radar Dashboard</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. TESTIMONIALS ("A few words" Display Framer Style)     */}
      {/* ======================================================== */}
      <section id="testimonials" className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        
        <div className="tw:text-center tw:mb-12">
          <div className="tw:text-xs tw:font-mono tw:tracking-widest tw:text-blue-400 tw:uppercase tw:mb-2">
            INSTITUTIONAL TRUST
          </div>
          <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-white">
            A few words from campus leaders
          </h2>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="tw:p-8 tw:rounded-3xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 hover:tw:border-zinc-700 tw:flex tw:flex-col tw:justify-between tw:transition-all"
            >
              <p className="tw:text-sm tw:sm:tw:text-base tw:text-zinc-300 tw:leading-relaxed tw:italic">
                "{t.quote}"
              </p>

              <div className="tw:mt-6 tw:pt-6 tw:border-t tw:border-zinc-900 tw:flex tw:items-center tw:justify-between">
                <div className="tw:flex tw:items-center tw:gap-3">
                  <div className="tw:w-10 tw:h-10 tw:rounded-full tw:bg-zinc-800 tw:border tw:border-zinc-700 tw:flex tw:items-center tw:justify-center tw:text-xs tw:font-bold tw:text-white">
                    {t.initials}
                  </div>
                  <div>
                    <div className="tw:text-sm tw:font-semibold tw:text-white">{t.author}</div>
                    <div className="tw:text-xs tw:text-zinc-400">{t.role}</div>
                  </div>
                </div>
                <span className="tw:text-[10px] tw:font-mono tw:text-zinc-400 tw:bg-zinc-900 tw:px-2.5 tw:py-1 tw:rounded-md tw:border tw:border-zinc-800">
                  {t.tag}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. MOST ASKED QUESTIONS (Display Numbered Accordion)     */}
      {/* ======================================================== */}
      <section id="faq" className="tw:py-20 tw:px-6 tw:max-w-4xl tw:mx-auto tw:relative tw:z-10">
        
        <div className="tw:text-center tw:mb-12">
          <div className="tw:text-xs tw:font-mono tw:tracking-widest tw:text-blue-400 tw:uppercase tw:mb-2">
            FAQ
          </div>
          <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-white">
            Most asked questions
          </h2>
        </div>

        <div className="tw:space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="tw:rounded-2xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 tw:overflow-hidden tw:transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                  className="tw:w-full tw:p-6 tw:text-left tw:flex tw:items-center tw:justify-between tw:gap-4 tw:hover:bg-zinc-900/40 tw:transition-colors"
                >
                  <div className="tw:flex tw:items-center tw:gap-4">
                    <span className="tw:text-xs tw:font-mono tw:text-zinc-500">
                      ({faq.num})
                    </span>
                    <span className="tw:text-sm tw:sm:tw:text-base tw:font-semibold tw:text-white">
                      {faq.q}
                    </span>
                  </div>
                  <ChevronDown
                    className={`tw:w-4 tw:h-4 tw:text-zinc-400 tw:transition-transform tw:duration-300 tw:flex-shrink-0 ${
                      isOpen ? 'tw:rotate-180 tw:text-blue-400' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="tw:overflow-hidden"
                    >
                      <div className="tw:px-6 tw:pb-6 tw:pt-1 tw:text-xs tw:sm:tw:text-sm tw:text-zinc-400 tw:leading-relaxed tw:border-t tw:border-zinc-900">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 9. SECURITY INSIGHTS & UPDATES ("Updates")               */}
      {/* ======================================================== */}
      <section className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        <div className="tw:flex tw:items-end tw:justify-between tw:mb-12">
          <div>
            <div className="tw:text-xs tw:font-mono tw:tracking-widest tw:text-blue-400 tw:uppercase tw:mb-2">
              LATEST INSIGHTS
            </div>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-white">
              Security & Infrastructure Updates
            </h2>
          </div>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-3 tw:gap-6">
          {INSIGHTS.map((article, idx) => (
            <div
              key={idx}
              className="tw:p-6 tw:rounded-3xl tw:bg-zinc-950 tw:border tw:border-zinc-800/80 hover:tw:border-zinc-700 tw:flex tw:flex-col tw:justify-between tw:transition-all tw:group"
            >
              <div>
                <div className="tw:flex tw:items-center tw:justify-between tw:text-[10px] tw:font-mono tw:text-zinc-500 tw:mb-4">
                  <span className="tw:text-blue-400">{article.category}</span>
                  <span>{article.date} · {article.readTime}</span>
                </div>
                <h3 className="tw:text-base tw:font-bold tw:text-white group-hover:tw:text-blue-300 tw:transition-colors tw:leading-snug">
                  {article.title}
                </h3>
                <p className="tw:mt-3 tw:text-xs tw:text-zinc-400 tw:leading-relaxed">
                  {article.description}
                </p>
              </div>

              <div className="tw:mt-6 tw:pt-4 tw:border-t tw:border-zinc-900 tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-medium tw:text-zinc-300 group-hover:tw:text-white">
                <span>Read paper</span>
                <ChevronRight className="tw:w-3.5 tw:h-3.5 group-hover:tw:translate-x-1 tw:transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 10. GIANT HIGH-IMPACT CTA BANNER                         */}
      {/* ======================================================== */}
      <section className="tw:py-20 tw:px-6 tw:max-w-6xl tw:mx-auto tw:relative tw:z-10">
        <div className="tw:rounded-[36px] tw:bg-gradient-to-b tw:from-zinc-900 tw:to-zinc-950 tw:border tw:border-zinc-800 tw:p-8 tw:sm:tw:p-16 tw:text-center tw:relative tw:overflow-hidden tw:shadow-2xl">
          
          {/* Subtle Accent Flare */}
          <div className="tw:absolute tw:top-[-50%] tw:left-1/2 tw:-translate-x-1/2 tw:w-[500px] tw:h-[300px] tw:bg-blue-600/10 tw:rounded-full tw:blur-[120px] tw:pointer-events-none" />

          <div className="tw:relative tw:z-10 tw:max-w-3xl tw:mx-auto">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3.5 tw:py-1 tw:rounded-full tw:bg-zinc-800 tw:border tw:border-zinc-700 tw:text-zinc-300 tw:text-xs tw:font-mono tw:mb-6">
              <span>LET'S CONNECT</span>
            </div>
            
            <h2 className="tw:text-3xl tw:sm:tw:text-5xl tw:font-bold tw:tracking-tight tw:text-white">
              Ready to secure your institution with DwarPal?
            </h2>
            
            <p className="tw:mt-4 tw:text-sm tw:sm:tw:text-base tw:text-zinc-400 tw:max-w-xl tw:mx-auto">
              Join leading universities, colleges, and gated communities upgrading to zero-trust gatekeeping. Set up in under 24 hours.
            </p>

            <div className="tw:mt-8 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-4">
              <Link
                to="/access-portal"
                className="tw:px-8 tw:py-4 tw:rounded-full tw:bg-white hover:tw:bg-zinc-200 tw:text-zinc-950 tw:font-bold tw:text-sm tw:shadow-xl tw:transition-all"
              >
                Access Portal Now →
              </Link>
              <Link
                to="/student/register"
                className="tw:px-6 tw:py-4 tw:rounded-full tw:bg-zinc-900 hover:tw:bg-zinc-800 tw:text-zinc-200 tw:border tw:border-zinc-700 tw:font-medium tw:text-sm tw:transition-all"
              >
                Student Self-Enrollment
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 11. FOOTER (Display Framer Multi-Column Style)           */}
      {/* ======================================================== */}
      <footer className="tw:border-t tw:border-zinc-900 tw:bg-zinc-950 tw:py-16 tw:px-6 tw:relative tw:z-10">
        <div className="tw:max-w-6xl tw:mx-auto tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-5 tw:gap-10 tw:mb-12">
          
          {/* Col 1 & 2: Brand */}
          <div className="tw:md:tw:col-span-2">
            <div className="tw:flex tw:items-center tw:gap-2.5 tw:mb-4">
              <div className="tw:w-7 tw:h-7 tw:rounded-full tw:bg-blue-600 tw:flex tw:items-center tw:justify-center">
                <Shield className="tw:w-4 tw:h-4 tw:text-white" />
              </div>
              <span className="tw:text-base tw:font-bold tw:text-white">DwarPal</span>
            </div>
            <p className="tw:text-xs tw:text-zinc-400 tw:leading-relaxed tw:max-w-sm">
              Next-generation institutional access control and gate security system. Zero-trust dynamic passes, sub-second terminal verification, and live campus telemetry.
            </p>
            <div className="tw:mt-6 tw:flex tw:items-center tw:gap-2 tw:text-xs tw:font-mono tw:text-emerald-400">
              <span className="tw:w-2 tw:h-2 tw:rounded-full tw:bg-emerald-500 tw:animate-pulse" />
              <span>All Systems Operational (v2.4.0)</span>
            </div>
          </div>

          {/* Col 3: Portals */}
          <div>
            <div className="tw:text-xs tw:font-mono tw:tracking-wider tw:text-zinc-400 tw:uppercase tw:mb-4">
              PORTALS
            </div>
            <ul className="tw:space-y-2.5 tw:text-xs tw:text-zinc-400">
              <li>
                <Link to="/student/login" className="hover:tw:text-white tw:transition-colors">
                  Student Portal
                </Link>
              </li>
              <li>
                <Link to="/faculty/login" className="hover:tw:text-white tw:transition-colors">
                  Faculty Leave Desk
                </Link>
              </li>
              <li>
                <Link to="/security/login" className="hover:tw:text-white tw:transition-colors">
                  Gate Security Terminal
                </Link>
              </li>
              <li>
                <Link to="/student/register" className="hover:tw:text-white tw:transition-colors">
                  Student Self-Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Views */}
          <div>
            <div className="tw:text-xs tw:font-mono tw:tracking-wider tw:text-zinc-400 tw:uppercase tw:mb-4">
              EXPERIENCES
            </div>
            <ul className="tw:space-y-2.5 tw:text-xs tw:text-zinc-400">
              <li>
                <Link to="/" className="hover:tw:text-white tw:transition-colors tw:flex tw:items-center tw:gap-1.5">
                  <span className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-blue-400" />
                  <span>Dotted Canvas Landing (Primary)</span>
                </Link>
              </li>
              <li>
                <Link to="/display" className="hover:tw:text-white tw:transition-colors tw:text-white">
                  Display Showcase View
                </Link>
              </li>
              <li>
                <Link to="/bloom" className="hover:tw:text-white tw:transition-colors">
                  Bloom Luxury Landing
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Legal & Help */}
          <div>
            <div className="tw:text-xs tw:font-mono tw:tracking-wider tw:text-zinc-400 tw:uppercase tw:mb-4">
              GOVERNANCE
            </div>
            <ul className="tw:space-y-2.5 tw:text-xs tw:text-zinc-400">
              <li>
                <Link to="/privacy-policy" className="hover:tw:text-white tw:transition-colors">
                  Privacy Policy & Data Security
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:tw:text-white tw:transition-colors">
                  Technical Support
                </Link>
              </li>
              <li>
                <span className="tw:text-zinc-400">
                  contact@dwarpal.internal
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="tw:max-w-6xl tw:mx-auto tw:pt-8 tw:border-t tw:border-zinc-900 tw:flex tw:flex-col tw:sm:tw:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-[11px] tw:font-mono tw:text-zinc-400">
          <div>© {new Date().getFullYear()} DwarPal Access Systems. All rights reserved.</div>
          <div className="tw:flex tw:gap-6">
            <Link to="/privacy-policy" className="hover:tw:text-white tw:transition-colors">PRIVACY</Link>
            <Link to="/support" className="hover:tw:text-white tw:transition-colors">SECURITY AUDIT</Link>
            <Link to="/" className="hover:tw:text-white tw:transition-colors">DOTTED VIEW</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
