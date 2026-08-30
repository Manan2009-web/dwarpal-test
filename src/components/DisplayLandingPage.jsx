import React, { useState, useEffect, lazy, Suspense } from 'react'
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

const GhostFibers = lazy(() => import('./ui/GhostFibers'))

// --- SELECTED WORK (MODULES) ---
const SELECTED_WORK = [
  {
    id: 'dynamic-pass',
    category: 'Templates',
    year: '2026',
    title: 'Guidy',
    subtitle: 'Dynamic QR Gatepass Studio',
    tagline: 'Cryptographic anti-screenshot rotating token technology',
    description:
      'A minimal, high-speed mobile gatepass system built for students and hostel residents. Features live time-synchronized dynamic QR codes with animated micro-watermarks that instantly invalidate screenshots.',
    badge: 'Framer',
    link: '/student/login',
    type: 'pass',
  },
  {
    id: 'optical-terminal',
    category: 'Templates',
    year: '2026',
    title: 'Feature',
    subtitle: 'Optical Guard Terminal',
    tagline: 'Sub-second optical camera scanning & vehicle plate logging',
    description:
      'A clean, dark-themed checkpoint interface for campus security officers. Equipped with offline-first PWA caching, camera scanner reticle, vehicle plate lookup, and emergency manual roll search.',
    badge: 'Framer',
    link: '/security/login',
    type: 'terminal',
  },
  {
    id: 'approval-desk',
    category: 'Templates',
    year: '2026',
    title: 'Refined',
    subtitle: 'Faculty Leave Matrix',
    tagline: 'Multi-tier hierarchy with instant parent SMS dispatch',
    description:
      'A streamlined governance dashboard for Faculty Advisors, HODs, Wardens, and Directors. 1-tap review queues, attendance context overlays, and automated parent communication.',
    badge: 'Framer',
    link: '/faculty/login',
    type: 'hierarchy',
  },
  {
    id: 'telemetry-hub',
    category: 'Templates',
    year: '2026',
    title: 'Enroll',
    subtitle: 'Campus Command & Telemetry',
    tagline: 'Real-time population census, curfew tracking & audit logs',
    description:
      'Executive dashboard delivering live in-campus vs outpass headcounts, curfew violation radars, and one-click PDF/Excel compliance audit log exports for leadership.',
    badge: 'Framer',
    link: '/access-portal',
    type: 'telemetry',
  },
]

// --- FAQS ---
const FAQS = [
  {
    index: '(1)',
    q: 'How does the dynamic rotating QR token prevent pass sharing or screenshots?',
    a: 'DwarPal gatepasses use a time-synchronized cryptographic hash that updates every few seconds with an animated security watermark. A static screenshot or screen recording will fail signature verification immediately at the gate checkpoint scanner.',
  },
  {
    index: '(2)',
    q: 'What happens if the campus Wi-Fi or cellular network goes offline at the gate?',
    a: 'The gate terminal functions as an offline-first Progressive Web Application with local cryptographically-verifiable token caching. It verifies passes offline with sub-second speed and automatically syncs timestamps to the cloud once connectivity resumes.',
  },
  {
    index: '(3)',
    q: 'Can parents receive automated notifications when a student exits or enters?',
    a: 'Yes. As soon as the security officer scans the pass at any gate checkpoint, DwarPal’s event engine dispatches automated push notifications and carrier SMS alerts to registered parent mobile numbers.',
  },
  {
    index: '(4)',
    q: 'How long does it take to deploy DwarPal in a university or gated society?',
    a: 'Deployment is fast and frictionless. You can bulk-import students, faculty, and security personnel via Excel/CSV or enable self-service onboarding at the student registration portal in under 24 hours.',
  },
]

// --- TESTIMONIALS ---
const TESTIMONIALS = [
  {
    name: 'Emily T.',
    handle: '@kuipermarc',
    role: 'Chief Security Officer',
    text: '“DwarPal its speed and reliability knows no bounds! The optical scanner terminal handled over 4,200 student festival exits with zero gate congestion and flawless audit accuracy.”',
  },
  {
    name: 'Chris L.',
    handle: '@chris_campus',
    role: 'Dean of Student Affairs',
    text: '“Working with DwarPal was a breeze. Faculty advisors review leave requests in one tap, and parents love receiving instant verified checkout alerts on their phones.”',
  },
  {
    name: 'Sophie M.',
    handle: '@sophiem_warden',
    role: 'Senior Hostel Warden',
    text: '“It transformed our night curfew and leave logging completely. The real-time headcount telemetry gives our team total visibility and peace of mind every single night.”',
  },
  {
    name: 'David K.',
    handle: '@david_techlead',
    role: 'Director of Campus Infrastructure',
    text: '“DwarPal its design work is always fresh and innovative. The offline-first architecture ensured 100% uptime even when severe weather knocked out our campus optical fiber.”',
  },
]

// --- LATEST UPDATES ---
const UPDATES = [
  {
    author: 'Mira Caldwell',
    date: 'Jul 3, 2026',
    title: 'How to build a zero-trust campus gatekeeping protocol',
    excerpt: 'Why static QR passes fail in real campus conditions and how rotating cryptographic seeds restore total access security.',
  },
  {
    author: 'Celeste Holloway',
    date: 'Jun 1, 2026',
    title: 'Designing offline-first terminal scanners for 100% gate uptime',
    excerpt: 'Architecting local cryptographic verification and conflict-free replicated data sync for high-traffic checkpoints.',
  },
]

export default function DisplayLandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)

  // Interactive Live Demo Sandbox State
  const [dynamicCode, setDynamicCode] = useState('DP-9482-X9')
  const [qrTimer, setQrTimer] = useState(15)
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [activeSandboxTab, setActiveSandboxTab] = useState('student') // 'student', 'terminal', 'alerts'
  const [alertLogs, setAlertLogs] = useState([
    { id: 1, time: '19:14:02', text: 'Exit pass #DP-8921 scanned at North Gate terminal', status: 'VERIFIED' },
    { id: 2, time: '19:14:03', text: 'Automated SMS dispatched to parent contact (+91 98*** **412)', status: 'DISPATCHED' },
  ])

  // Rolling dynamic token countdown
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
        vehicle: 'MH-12-DE-4419',
        timestamp: now,
      }
      setScanResult(newScan)
      setAlertLogs((prev) => [
        {
          id: Date.now(),
          time: now,
          text: `Pass #${dynamicCode} verified for Aarav Patel (CS-2023-042)`,
          status: 'VERIFIED',
        },
        {
          id: Date.now() + 1,
          time: now,
          text: `Parent SMS & Push alert dispatched for Aarav Patel`,
          status: 'DISPATCHED',
        },
        ...prev.slice(0, 3),
      ])
    }, 380)
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
    <div
      className="tw:min-h-screen tw:w-full tw:text-[#ffffff] tw:selection:bg-[#2b7fff] tw:selection:text-white tw:relative tw:overflow-x-hidden"
      style={{
        backgroundColor: '#07070a',
        fontFamily: '"Geist", "Inter Display", "Mona Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ======================================================== */}
      {/* BACKGROUND: GHOST FIBERS (React Bits) + AMBIENT GRID    */}
      {/* ======================================================== */}
      
      {/* 1. GhostFibers WebGL Fiber Simulation (Full visibility behind transparent glass) */}
      <div className="tw:fixed tw:inset-0 tw:pointer-events-none tw:z-0 tw:w-full tw:h-full tw:overflow-hidden">
        <Suspense fallback={null}>
          <GhostFibers
            lineColor="#191040"
            glowColor="#3d40ba"
            speed={0.22}
            scale={2}
            rotation={0}
            rotationSpeed={0.25}
            layers={5}
            waveAmplitude={0.016}
            waveFrequency={3}
            waveSpeed={0.16}
            layerSpeed={0.08}
            twist={0.11}
            twistFrequency={5}
            twistSpeed={1.2}
            lineFrequency={5}
            lineSpacing={2}
            lineSharpness={16}
            glowFalloff={10}
            glowIntensity={1.75}
            brightness={2.1}
            blueBoost={1.3}
            vignette={0.65}
            grain={0.04}
            dpr={1}
          />
        </Suspense>
      </div>

      {/* 2. Transparent Soft Contrast Overlay */}
      <div 
        className="tw:fixed tw:inset-0 tw:pointer-events-none tw:z-0"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 50% 15%, rgba(7, 7, 10, 0.1) 0%, rgba(7, 7, 10, 0.5) 100%)',
        }}
      />

      {/* 3. Subtle Technical Grid Pattern Overlay with Radial Mask */}
      <div 
        className="tw:fixed tw:inset-0 tw:pointer-events-none tw:z-0 tw:opacity-35"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 45%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 45%, transparent 100%)',
        }}
      />

      {/* ======================================================== */}
      {/* FLOATING CORNER BADGE ("Use for free" Display Style)     */}
      {/* ======================================================== */}
      <div className="tw:fixed tw:bottom-5 tw:right-5 tw:z-50 tw:pointer-events-auto">
        <Link
          to="/"
          className="tw:flex tw:items-center tw:gap-2 tw:px-4 tw:py-2 tw:rounded-full tw:text-xs tw:font-medium tw:transition-all tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:tw:scale-105 tw:backdrop-blur-xl"
          style={{
            backgroundColor: 'rgba(25, 25, 35, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: '#ffffff',
          }}
          title="Switch to original interactive Dotted Canvas Landing"
        >
          <span className="tw:w-2 tw:h-2 tw:rounded-full tw:bg-[#2b7fff] tw:animate-pulse" />
          <span>Dotted Mode</span>
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 1. HEADER (Exact Display Framer Navbar)                  */}
      {/* ======================================================== */}
      <header className="tw:w-full tw:max-w-5xl tw:mx-auto tw:px-6 tw:py-8 tw:flex tw:items-center tw:justify-between tw:relative tw:z-40">
        
        {/* Brand / Logo */}
        <div
          onClick={handleLogoClick}
          className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer tw:select-none"
        >
          <div className="tw:w-6 tw:h-6 tw:rounded-md tw:bg-[#2b7fff] tw:flex tw:items-center tw:justify-center tw:shadow-md">
            <Shield className="tw:w-3.5 tw:h-3.5 tw:text-white" />
          </div>
          <span className="tw:text-lg tw:font-bold tw:tracking-tight tw:text-[#ffffff]">
            DwarPal
          </span>
        </div>

        {/* Center Desktop Links in Frosted Capsule */}
        <nav 
          className="tw:hidden tw:md:tw:flex tw:items-center tw:gap-8 tw:px-6 tw:py-2.5 tw:rounded-full tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:backdrop-blur-xl tw:shadow-[0_4px_24px_0_rgba(0,0,0,0.25)]"
          style={{
            backgroundColor: 'rgba(20, 20, 30, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <a href="#work" className="hover:tw:text-[#ffffff] tw:transition-colors">
            Work
          </a>
          <a href="#demo" className="hover:tw:text-[#ffffff] tw:transition-colors">
            Live Demo
          </a>
          <a href="#about" className="hover:tw:text-[#ffffff] tw:transition-colors">
            About
          </a>
          <a href="#updates" className="hover:tw:text-[#ffffff] tw:transition-colors">
            Blog
          </a>
          <a href="#faq" className="hover:tw:text-[#ffffff] tw:transition-colors">
            FAQ
          </a>
          <a href="#contact" className="hover:tw:text-[#ffffff] tw:transition-colors">
            Contact
          </a>
        </nav>

        {/* Right CTA Button */}
        <div className="tw:flex tw:items-center tw:gap-3">
          <Link
            to="/access-portal"
            className="tw:px-5 tw:py-2 tw:rounded-full tw:text-xs tw:font-semibold tw:transition-all hover:tw:scale-105 tw:shadow-[0_0_20px_rgba(43,127,255,0.4)] tw:backdrop-blur-xl"
            style={{
              backgroundColor: '#2b7fff',
              color: '#ffffff',
            }}
          >
            Access Portal
          </Link>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="tw:flex tw:md:tw:hidden tw:p-2 tw:text-[#9a9aa1] hover:tw:text-[#ffffff]"
            style={{ background: 'transparent', border: 'none' }}
          >
            {mobileMenuOpen ? <X className="tw:w-5 tw:h-5" /> : <Menu className="tw:w-5 tw:h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Sheet */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="tw:fixed tw:inset-x-4 tw:top-20 tw:z-50 tw:p-6 tw:rounded-2xl tw:flex tw:flex-col tw:gap-4 tw:md:tw:hidden tw:backdrop-blur-2xl tw:shadow-2xl"
            style={{
              backgroundColor: 'rgba(15, 15, 22, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <a
              href="#work"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-[#ffffff] tw:py-2"
            >
              Work
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-[#ffffff] tw:py-2"
            >
              Live Demo
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-[#ffffff] tw:py-2"
            >
              FAQ
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="tw:text-sm tw:font-medium tw:text-[#ffffff] tw:py-2"
            >
              Contact
            </a>
            <div className="tw:pt-2 tw:flex tw:flex-col tw:gap-2">
              <Link
                to="/access-portal"
                className="tw:w-full tw:text-center tw:py-2.5 tw:rounded-full tw:bg-[#2b7fff] tw:text-white tw:text-xs tw:font-semibold tw:shadow-[0_0_20px_rgba(43,127,255,0.4)]"
              >
                Access Portal
              </Link>
              <Link
                to="/"
                className="tw:w-full tw:text-center tw:py-2.5 tw:rounded-full tw:bg-white/10 tw:text-[#9a9aa1] tw:text-xs"
              >
                Switch to Dotted Canvas View
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="tw:w-full tw:max-w-5xl tw:mx-auto tw:px-6 tw:space-y-24 tw:md:tw:space-y-32 tw:pb-24 tw:relative tw:z-10">
        
        {/* ======================================================== */}
        {/* 2. HERO SECTION (Exact Display Framer Layout)            */}
        {/* ======================================================== */}
        <section className="tw:pt-12 tw:md:tw:pt-20">
          
          {/* Eyebrow Pill Badge */}
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3.5 tw:py-1.5 tw:rounded-full tw:mb-6 tw:backdrop-blur-xl tw:shadow-md"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#9a9aa1',
              fontSize: '12px',
            }}
          >
            <span className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-emerald-400 tw:animate-pulse" />
            <span>Open for campuses</span>
          </div>

          {/* Big Hero Title */}
          <h1 className="tw:text-4xl tw:sm:tw:text-6xl tw:md:tw:text-7xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:leading-[1.08] tw:max-w-3xl">
            Digital Gatekeeper
          </h1>

          {/* Hero Subheadline */}
          <p className="tw:mt-6 tw:text-base tw:sm:tw:text-lg tw:md:tw:text-xl tw:text-[#9a9aa1] tw:max-w-xl tw:leading-relaxed">
            An intelligent digital security and campus access management platform making institutions safe.
          </p>

          {/* 3 Horizontal Hero Bento Cards (Glassmorphic Transparent Surfaces) */}
          <div className="tw:mt-12 tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-3 tw:gap-4">
            
            {/* Card 1: Websites / Gatepasses */}
            <div
              className="tw:p-6 tw:rounded-2xl tw:flex tw:flex-col tw:justify-between tw:min-h-[160px] tw:transition-all hover:tw:bg-white/[0.08] hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
              style={{
                backgroundColor: 'rgba(18, 18, 26, 0.42)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div>
                <h3 className="tw:text-lg tw:font-bold tw:text-[#ffffff]">
                  Gatepasses
                </h3>
                <p className="tw:mt-2 tw:text-[13px] tw:text-[#9a9aa1] tw:leading-relaxed">
                  Responsive dynamic passes and instant QR approvals for students and residents.
                </p>
              </div>
            </div>

            {/* Card 2: Apps / Terminals */}
            <div
              className="tw:p-6 tw:rounded-2xl tw:flex tw:flex-col tw:justify-between tw:min-h-[160px] tw:transition-all hover:tw:bg-white/[0.08] hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
              style={{
                backgroundColor: 'rgba(18, 18, 26, 0.42)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div>
                <h3 className="tw:text-lg tw:font-bold tw:text-[#ffffff]">
                  Terminals
                </h3>
                <p className="tw:mt-2 tw:text-[13px] tw:text-[#9a9aa1] tw:leading-relaxed">
                  Sub-second camera scanning and vehicle plate lookup for security officers.
                </p>
              </div>
            </div>

            {/* Card 3: Design systems / Governance */}
            <div
              className="tw:p-6 tw:rounded-2xl tw:flex tw:flex-col tw:justify-between tw:min-h-[160px] tw:transition-all hover:tw:bg-white/[0.08] hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
              style={{
                backgroundColor: 'rgba(18, 18, 26, 0.42)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div>
                <h3 className="tw:text-lg tw:font-bold tw:text-[#ffffff]">
                  Governance
                </h3>
                <p className="tw:mt-2 tw:text-[13px] tw:text-[#9a9aa1] tw:leading-relaxed">
                  Building robust and flexible multi-tier leave approval systems for easy scalability.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. SELECTED WORK SECTION (Transparent Glass Cards)       */}
        {/* ======================================================== */}
        <section id="work">
          
          {/* Section Header */}
          <div className="tw:mb-8">
            <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:tracking-[0.02em]">
              Let me show you
            </span>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-1">
              Selected work
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="tw:space-y-8">
            {SELECTED_WORK.map((work, idx) => (
              <div
                key={work.id}
                className="tw:rounded-3xl tw:overflow-hidden tw:transition-all hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
                style={{
                  backgroundColor: 'rgba(18, 18, 26, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {/* Visual Preview Container - Frosted Glass */}
                <div
                  className="tw:w-full tw:h-72 tw:sm:tw:h-96 tw:p-6 tw:sm:tw:p-8 tw:flex tw:items-center tw:justify-center tw:relative tw:overflow-hidden tw:backdrop-blur-md"
                  style={{
                    backgroundColor: 'rgba(10, 10, 15, 0.3)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {/* Subtle Grid Lines inside preview frame */}
                  <div className="tw:absolute tw:inset-0 tw:bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] tw:opacity-20" />

                  {/* Card Content Visuals - Glass Paneling */}
                  {work.type === 'pass' && (
                    <div
                      className="tw:w-72 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:relative tw:z-10 tw:backdrop-blur-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:border-b tw:border-white/10 tw:pb-3 tw:mb-3">
                        <span className="tw:text-xs tw:font-bold tw:text-white">DwarPal Digital Pass</span>
                        <span className="tw:text-[10px] tw:text-emerald-400 tw:font-mono">VALID</span>
                      </div>
                      <div 
                        className="tw:p-4 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center tw:backdrop-blur-md"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                      >
                        <QrCode className="tw:w-28 tw:h-28 tw:text-black" />
                        <span className="tw:text-[11px] tw:font-mono tw:font-bold tw:text-black tw:mt-2">
                          {dynamicCode}
                        </span>
                      </div>
                      <div className="tw:mt-3 tw:flex tw:justify-between tw:text-[11px] tw:text-[#9a9aa1] tw:font-mono">
                        <span>Hash refresh: {qrTimer}s</span>
                        <span className="tw:text-[#2b7fff]">Day Outpass</span>
                      </div>
                    </div>
                  )}

                  {work.type === 'terminal' && (
                    <div
                      className="tw:w-80 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:relative tw:z-10 tw:backdrop-blur-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:border-b tw:border-white/10 tw:pb-2.5 tw:mb-3 tw:text-[11px] tw:font-mono">
                        <span className="tw:text-emerald-400">CHECKPOINT: NORTH GATE-01</span>
                        <span className="tw:text-zinc-400">ONLINE</span>
                      </div>
                      <div 
                        className="tw:h-28 tw:rounded-xl tw:border tw:border-white/10 tw:flex tw:flex-col tw:items-center tw:justify-center tw:p-3 tw:backdrop-blur-md"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                      >
                        <CheckCircle2 className="tw:w-8 tw:h-8 tw:text-emerald-400 tw:mb-1.5" />
                        <span className="tw:text-xs tw:font-bold tw:text-emerald-300">PASS VERIFIED (340ms)</span>
                        <span className="tw:text-[10px] tw:text-zinc-400 tw:mt-0.5">Vehicle: MH-12-DE-4419</span>
                      </div>
                    </div>
                  )}

                  {work.type === 'hierarchy' && (
                    <div
                      className="tw:w-80 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:relative tw:z-10 tw:backdrop-blur-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:mb-3">
                        <span className="tw:text-xs tw:font-bold tw:text-white">Leave Requests Queue</span>
                        <span className="tw:text-[10px] tw:bg-purple-950/80 tw:text-purple-300 tw:px-2 tw:py-0.5 tw:rounded-full tw:border tw:border-purple-500/30">
                          1 PENDING
                        </span>
                      </div>
                      <div 
                        className="tw:p-3 tw:rounded-xl tw:border tw:border-white/10 tw:backdrop-blur-md"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                      >
                        <div className="tw:text-xs tw:font-semibold tw:text-white">Rohan Kulkarni</div>
                        <div className="tw:text-[11px] tw:text-[#9a9aa1]">ECE Sem-6 · Family Emergency</div>
                        <div className="tw:mt-2.5 tw:flex tw:gap-2">
                          <button className="tw:flex-1 tw:py-1 tw:bg-emerald-600/90 hover:tw:bg-emerald-600 tw:text-white tw:text-[11px] tw:font-semibold tw:rounded-md tw:shadow-sm">
                            Approve & Notify Parent
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {work.type === 'telemetry' && (
                    <div
                      className="tw:w-80 tw:rounded-2xl tw:p-5 tw:shadow-2xl tw:relative tw:z-10 tw:backdrop-blur-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:mb-3">
                        <span className="tw:text-xs tw:font-bold tw:text-white">Live Campus Telemetry</span>
                        <span className="tw:text-[10px] tw:text-emerald-400">● LIVE SENSORS</span>
                      </div>
                      <div className="tw:grid tw:grid-cols-2 tw:gap-2">
                        <div 
                          className="tw:p-3 tw:rounded-xl tw:border tw:border-white/10 tw:backdrop-blur-md"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                        >
                          <div className="tw:text-[10px] tw:text-[#9a9aa1]">Inside Campus</div>
                          <div className="tw:text-lg tw:font-bold tw:text-white tw:mt-0.5">3,412</div>
                        </div>
                        <div 
                          className="tw:p-3 tw:rounded-xl tw:border tw:border-white/10 tw:backdrop-blur-md"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                        >
                          <div className="tw:text-[10px] tw:text-[#9a9aa1]">Active Outpass</div>
                          <div className="tw:text-lg tw:font-bold tw:text-amber-400 tw:mt-0.5">284</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Meta & Details */}
                <div className="tw:p-6 tw:sm:tw:p-8 tw:flex tw:flex-col tw:sm:tw:flex-row tw:sm:tw:items-center tw:justify-between tw:gap-6">
                  <div>
                    <div className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-[#9a9aa1]">
                      <span>{work.category}</span>
                      <span>·</span>
                      <span>{work.year}</span>
                    </div>
                    <h3 className="tw:text-2xl tw:font-bold tw:text-[#ffffff] tw:mt-1">
                      {work.title}
                    </h3>
                    <p className="tw:text-[13px] tw:text-[#9a9aa1] tw:mt-1">
                      {work.subtitle} — {work.tagline}
                    </p>
                  </div>

                  <Link
                    to={work.link}
                    className="tw:inline-flex tw:items-center tw:justify-center tw:px-5 tw:py-2.5 tw:rounded-full tw:text-xs tw:font-semibold tw:transition-all hover:tw:bg-[#2b7fff] hover:tw:text-white tw:backdrop-blur-xl"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                    }}
                  >
                    See case
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. LIVE INTERACTIVE DEMO SANDBOX (Transparent Glass)     */}
        {/* ======================================================== */}
        <section id="demo" className="tw:scroll-mt-20">
          <div
            className="tw:rounded-3xl tw:p-6 tw:sm:tw:p-10 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
            style={{
              backgroundColor: 'rgba(18, 18, 26, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="tw:text-center tw:max-w-xl tw:mx-auto tw:mb-8">
              <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1]">
                Interactive Simulator
              </span>
              <h2 className="tw:text-2xl tw:sm:tw:text-3xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-1">
                Test the DwarPal Engine Live
              </h2>
              <p className="tw:text-xs tw:text-[#9a9aa1] tw:mt-2">
                Click below to simulate dynamic token generation, checkpoint optical verification, and automated notification alerts.
              </p>
            </div>

            {/* Sandbox Tabs */}
            <div className="tw:flex tw:justify-center tw:mb-8">
              <div
                className="tw:inline-flex tw:p-1.5 tw:rounded-full tw:backdrop-blur-xl"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button
                  onClick={() => setActiveSandboxTab('student')}
                  className={`tw:px-4 tw:py-1.5 tw:rounded-full tw:text-xs tw:font-medium tw:transition-all ${
                    activeSandboxTab === 'student'
                      ? 'tw:bg-[#2b7fff] tw:text-white tw:shadow-[0_0_15px_rgba(43,127,255,0.4)]'
                      : 'tw:bg-transparent tw:text-[#9a9aa1] hover:tw:text-white'
                  }`}
                  style={{
                    backgroundColor: activeSandboxTab === 'student' ? '#2b7fff' : 'transparent',
                    border: 'none',
                    color: activeSandboxTab === 'student' ? '#ffffff' : '#9a9aa1',
                  }}
                >
                  1. Dynamic Pass
                </button>
                <button
                  onClick={() => setActiveSandboxTab('terminal')}
                  className={`tw:px-4 tw:py-1.5 tw:rounded-full tw:text-xs tw:font-medium tw:transition-all ${
                    activeSandboxTab === 'terminal'
                      ? 'tw:bg-[#2b7fff] tw:text-white tw:shadow-[0_0_15px_rgba(43,127,255,0.4)]'
                      : 'tw:bg-transparent tw:text-[#9a9aa1] hover:tw:text-white'
                  }`}
                  style={{
                    backgroundColor: activeSandboxTab === 'terminal' ? '#2b7fff' : 'transparent',
                    border: 'none',
                    color: activeSandboxTab === 'terminal' ? '#ffffff' : '#9a9aa1',
                  }}
                >
                  2. Optical Terminal
                </button>
                <button
                  onClick={() => setActiveSandboxTab('alerts')}
                  className={`tw:px-4 tw:py-1.5 tw:rounded-full tw:text-xs tw:font-medium tw:transition-all ${
                    activeSandboxTab === 'alerts'
                      ? 'tw:bg-[#2b7fff] tw:text-white tw:shadow-[0_0_15px_rgba(43,127,255,0.4)]'
                      : 'tw:bg-transparent tw:text-[#9a9aa1] hover:tw:text-white'
                  }`}
                  style={{
                    backgroundColor: activeSandboxTab === 'alerts' ? '#2b7fff' : 'transparent',
                    border: 'none',
                    color: activeSandboxTab === 'alerts' ? '#ffffff' : '#9a9aa1',
                  }}
                >
                  3. Event Dispatch
                </button>
              </div>
            </div>

            {/* Sandbox Content Container */}
            <div
              className="tw:p-6 tw:rounded-2xl tw:backdrop-blur-xl"
              style={{
                backgroundColor: 'rgba(10, 10, 16, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {activeSandboxTab === 'student' && (
                <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                  <div>
                    <h3 className="tw:text-lg tw:font-bold tw:text-white">
                      Time-Synchronized Dynamic QR
                    </h3>
                    <p className="tw:text-xs tw:text-[#9a9aa1] tw:mt-2 tw:leading-relaxed">
                      Every pass token is mathematically generated with a time-bound cryptographic seed. If a student screenshots the pass, the token signature will expire in seconds and will be rejected at the gate.
                    </p>
                    <div className="tw:mt-6 tw:flex tw:gap-3">
                      <button
                        onClick={() => {
                          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
                          setDynamicCode(`DP-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`)
                          setQrTimer(15)
                        }}
                        className="tw:px-4 tw:py-2 tw:rounded-full tw:bg-white/10 tw:text-white tw:border tw:border-white/15 tw:text-xs tw:font-medium hover:tw:bg-[#2b7fff] tw:transition-colors tw:flex tw:items-center tw:gap-2 tw:backdrop-blur-xl"
                        style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}
                      >
                        <RefreshCw className="tw:w-3.5 tw:h-3.5" />
                        <span>Regenerate Seed Hash</span>
                      </button>
                      <button
                        onClick={() => setActiveSandboxTab('terminal')}
                        className="tw:px-4 tw:py-2 tw:rounded-full tw:bg-[#2b7fff] tw:text-white tw:text-xs tw:font-semibold hover:tw:bg-blue-600 tw:transition-colors tw:shadow-[0_0_15px_rgba(43,127,255,0.35)]"
                        style={{ backgroundColor: '#2b7fff', border: 'none', color: '#ffffff' }}
                      >
                        Next: Simulate Gate Scan →
                      </button>
                    </div>
                  </div>

                  <div className="tw:flex tw:justify-center">
                    <div
                      className="tw:w-64 tw:p-4 tw:rounded-2xl tw:shadow-2xl tw:backdrop-blur-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:text-[11px] tw:font-mono tw:mb-3">
                        <span className="tw:text-white">Aarav Patel (CS-042)</span>
                        <span className="tw:text-emerald-400">ACTIVE</span>
                      </div>
                      <div 
                        className="tw:p-4 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center tw:backdrop-blur-md"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                      >
                        <QrCode className="tw:w-28 tw:h-28 tw:text-black" />
                        <span className="tw:text-xs tw:font-mono tw:font-bold tw:text-black tw:mt-2">
                          {dynamicCode}
                        </span>
                      </div>
                      <div className="tw:mt-3 tw:text-[10px] tw:font-mono tw:text-center tw:text-[#9a9aa1]">
                        Seed cycles in <span className="tw:text-[#2b7fff] tw:font-bold">{qrTimer}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSandboxTab === 'terminal' && (
                <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                  <div>
                    <h3 className="tw:text-lg tw:font-bold tw:text-white">
                      Sub-Second Optical Terminal
                    </h3>
                    <p className="tw:text-xs tw:text-[#9a9aa1] tw:mt-2 tw:leading-relaxed">
                      Click <strong>"Trigger Optical Scan"</strong> to simulate high-throughput gatekeeper camera verification with instant vehicle lookup and audit timestamping.
                    </p>
                    <div className="tw:mt-6">
                      <button
                        onClick={handleSimulateScan}
                        disabled={isVerifying}
                        className="tw:px-5 tw:py-2.5 tw:rounded-full tw:bg-[#2b7fff] tw:text-white tw:text-xs tw:font-semibold hover:tw:bg-blue-600 tw:transition-colors tw:flex tw:items-center tw:gap-2 disabled:tw:opacity-60 tw:shadow-[0_0_20px_rgba(43,127,255,0.35)]"
                        style={{ backgroundColor: '#2b7fff', border: 'none', color: '#ffffff' }}
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw className="tw:w-3.5 tw:h-3.5 tw:animate-spin" />
                            <span>Verifying Cryptographic Seed...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="tw:w-3.5 tw:h-3.5" />
                            <span>Trigger Optical Scan (Pass #{dynamicCode})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="tw:flex tw:justify-center">
                    <div
                      className="tw:w-72 tw:p-4 tw:rounded-2xl tw:font-mono tw:text-xs tw:backdrop-blur-2xl tw:shadow-2xl"
                      style={{
                        backgroundColor: 'rgba(25, 25, 35, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                      }}
                    >
                      <div className="tw:flex tw:justify-between tw:items-center tw:border-b tw:border-white/10 tw:pb-2 tw:mb-3 tw:text-[10px]">
                        <span className="tw:text-emerald-400">TERMINAL: GATE-01</span>
                        <span className="tw:text-[#9a9aa1]">READY</span>
                      </div>
                      {scanResult ? (
                        <div className="tw:space-y-1.5 tw:p-3 tw:bg-emerald-950/50 tw:border tw:border-emerald-500/40 tw:rounded-xl tw:backdrop-blur-md">
                          <div className="tw:text-emerald-400 tw:font-bold">✓ PASS VERIFIED (340ms)</div>
                          <div className="tw:text-[11px] tw:text-white">Student: {scanResult.student}</div>
                          <div className="tw:text-[11px] tw:text-zinc-300">Pass: {scanResult.passId}</div>
                          <div className="tw:text-[11px] tw:text-zinc-300">Vehicle: {scanResult.vehicle}</div>
                          <div className="tw:text-[10px] tw:text-zinc-400">Time: {scanResult.timestamp}</div>
                        </div>
                      ) : (
                        <div 
                          className="tw:h-28 tw:border tw:border-dashed tw:border-white/15 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:justify-center tw:text-zinc-400 tw:text-center tw:p-3"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
                        >
                          <span>Camera Stream Ready</span>
                          <span className="tw:text-[10px] tw:text-zinc-500 tw:mt-1">Click button to scan</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSandboxTab === 'alerts' && (
                <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-8 tw:items-center">
                  <div>
                    <h3 className="tw:text-lg tw:font-bold tw:text-white">
                      Instant Parent & Warden Dispatch
                    </h3>
                    <p className="tw:text-xs tw:text-[#9a9aa1] tw:mt-2 tw:leading-relaxed">
                      Every verified checkout triggers instant webhook notifications to registered parents and hostel wardens in under 850ms with zero manual effort.
                    </p>
                    <div className="tw:mt-6">
                      <Link
                        to="/access-portal"
                        className="tw:px-5 tw:py-2.5 tw:rounded-full tw:bg-[#2b7fff] tw:text-white tw:text-xs tw:font-semibold hover:tw:bg-blue-600 tw:transition-colors tw:inline-block tw:shadow-[0_0_20px_rgba(43,127,255,0.35)]"
                        style={{ backgroundColor: '#2b7fff', color: '#ffffff' }}
                      >
                        Deploy DwarPal in Your Campus →
                      </Link>
                    </div>
                  </div>

                  <div>
                    <div className="tw:space-y-2">
                      {alertLogs.map((log) => (
                        <div
                          key={log.id}
                          className="tw:p-3 tw:rounded-xl tw:text-[11px] tw:flex tw:items-start tw:justify-between tw:gap-2 tw:backdrop-blur-xl"
                          style={{
                            backgroundColor: 'rgba(25, 25, 35, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                          }}
                        >
                          <div>
                            <div className="tw:text-white">{log.text}</div>
                            <div className="tw:text-[9px] tw:text-[#9a9aa1] tw:font-mono tw:mt-0.5">{log.time}</div>
                          </div>
                          <span className="tw:text-[9px] tw:font-mono tw:text-emerald-400 tw:bg-emerald-950/70 tw:border tw:border-emerald-500/30 tw:px-2 tw:py-0.5 tw:rounded">
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 5. FAQ SECTION (Transparent Glass Accordion)             */}
        {/* ======================================================== */}
        <section id="faq">
          <div className="tw:mb-8">
            <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:tracking-[0.02em]">
              FAQ
            </span>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-1">
              Most asked questions
            </h2>
          </div>

          <div className="tw:space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="tw:rounded-2xl tw:overflow-hidden tw:transition-all hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_4px_24px_0_rgba(0,0,0,0.25)]"
                  style={{
                    backgroundColor: 'rgba(18, 18, 26, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="tw:w-full tw:p-6 tw:text-left tw:flex tw:items-center tw:justify-between tw:gap-4 tw:bg-transparent hover:tw:bg-white/[0.05] tw:transition-colors tw:text-white tw:cursor-pointer"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <div className="tw:flex tw:items-center tw:gap-4">
                      <span className="tw:text-sm tw:font-medium tw:text-[#9a9aa1]">
                        {faq.index}
                      </span>
                      <span className="tw:text-base tw:font-semibold tw:text-[#ffffff]">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown
                      className={`tw:w-4 tw:h-4 tw:text-[#9a9aa1] tw:transition-transform tw:duration-300 ${
                        isOpen ? 'tw:rotate-180 tw:text-[#ffffff]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="tw:overflow-hidden"
                      >
                        <div
                          className="tw:px-6 tw:pb-6 tw:pt-2 tw:text-[13px] tw:text-[#9a9aa1] tw:leading-relaxed"
                          style={{
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
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
        {/* 6. TESTIMONIALS SECTION (Transparent Glass Cards)        */}
        {/* ======================================================== */}
        <section>
          <div className="tw:mb-8">
            <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:tracking-[0.02em]">
              Testimonials
            </span>
            <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-1">
              A few words
            </h2>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-4">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="tw:p-6 tw:sm:tw:p-8 tw:rounded-2xl tw:flex tw:flex-col tw:justify-between tw:transition-all hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
                style={{
                  backgroundColor: 'rgba(18, 18, 26, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <p className="tw:text-[14px] tw:text-[#9a9aa1] tw:leading-relaxed">
                  {t.text}
                </p>

                <div className="tw:mt-6 tw:pt-6 tw:flex tw:items-center tw:justify-between"
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div>
                    <div className="tw:text-sm tw:font-bold tw:text-[#ffffff]">
                      {t.name}
                    </div>
                    <div className="tw:text-xs tw:text-[#9a9aa1]">
                      {t.role}
                    </div>
                  </div>
                  <span className="tw:text-xs tw:text-[#9a9aa1]">
                    {t.handle}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 7. UPDATES / BLOG (Transparent Glass Cards)              */}
        {/* ======================================================== */}
        <section id="updates">
          <div className="tw:flex tw:items-end tw:justify-between tw:mb-8">
            <div>
              <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:tracking-[0.02em]">
                Latest
              </span>
              <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-1">
                Updates
              </h2>
            </div>
            <a href="#updates" className="tw:text-xs tw:font-medium tw:text-[#9a9aa1] hover:tw:text-white">
              See all
            </a>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-2 tw:gap-4">
            {UPDATES.map((article, idx) => (
              <div
                key={idx}
                className="tw:p-6 tw:sm:tw:p-8 tw:rounded-2xl tw:flex tw:flex-col tw:justify-between tw:transition-all hover:tw:bg-white/[0.08] hover:tw:border-white/20 tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
                style={{
                  backgroundColor: 'rgba(18, 18, 26, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <div>
                  <div className="tw:text-xs tw:text-[#9a9aa1] tw:mb-3">
                    {article.author} · {article.date}
                  </div>
                  <h3 className="tw:text-lg tw:font-bold tw:text-[#ffffff] tw:leading-snug">
                    {article.title}
                  </h3>
                  <p className="tw:text-[13px] tw:text-[#9a9aa1] tw:mt-2 tw:leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 8. CTA SECTION (Transparent Glass Banner)                */}
        {/* ======================================================== */}
        <section id="contact" className="tw:pt-8">
          <div
            className="tw:p-8 tw:sm:tw:p-14 tw:rounded-3xl tw:text-center tw:backdrop-blur-2xl tw:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
            style={{
              backgroundColor: 'rgba(20, 20, 30, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <span className="tw:text-[13px] tw:font-medium tw:text-[#9a9aa1] tw:tracking-[0.02em]">
              let's connect
            </span>
            <h2 className="tw:text-3xl tw:sm:tw:text-5xl tw:font-bold tw:tracking-tight tw:text-[#ffffff] tw:mt-2 tw:max-w-xl tw:mx-auto tw:leading-tight">
              Ready to create something awesome together?
            </h2>
            <p className="tw:text-sm tw:text-[#9a9aa1] tw:mt-4 tw:max-w-md tw:mx-auto">
              Upgrade your university, college, or gated community to zero-trust gatekeeping with DwarPal.
            </p>
            <div className="tw:mt-8 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
              <Link
                to="/access-portal"
                className="tw:px-6 tw:py-3 tw:rounded-full tw:text-xs tw:font-semibold tw:transition-all hover:tw:scale-105 tw:shadow-[0_0_25px_rgba(43,127,255,0.45)]"
                style={{
                  backgroundColor: '#2b7fff',
                  color: '#ffffff',
                }}
              >
                Access Portal Now
              </Link>
              <Link
                to="/student/register"
                className="tw:px-6 tw:py-3 tw:rounded-full tw:text-xs tw:font-medium tw:transition-all hover:tw:bg-[#2b7fff] hover:tw:text-white tw:backdrop-blur-xl"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                }}
              >
                Student Registration
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* ======================================================== */}
      {/* 9. FOOTER (Frosted Glass Panel)                          */}
      {/* ======================================================== */}
      <footer
        className="tw:w-full tw:py-16 tw:px-6 tw:relative tw:z-10 tw:backdrop-blur-2xl"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(7, 7, 10, 0.65)',
        }}
      >
        <div className="tw:w-full tw:max-w-5xl tw:mx-auto">
          
          <div className="tw:grid tw:grid-cols-2 tw:md:tw:grid-cols-4 tw:gap-8 tw:mb-12">
            
            {/* Brand column */}
            <div className="tw:col-span-2">
              <span className="tw:text-base tw:font-bold tw:text-white">
                DwarPal
              </span>
              <p className="tw:text-xs tw:text-[#9a9aa1] tw:mt-2 tw:max-w-sm tw:leading-relaxed">
                A modern security & access intelligence platform for campuses and gated communities.
              </p>
            </div>

            {/* Pages Column */}
            <div>
              <div className="tw:text-xs tw:font-bold tw:text-white tw:mb-3">
                Pages
              </div>
              <ul className="tw:space-y-2 tw:text-xs tw:text-[#9a9aa1]">
                <li>
                  <a href="#work" className="hover:tw:text-white tw:transition-colors">Work</a>
                </li>
                <li>
                  <a href="#about" className="hover:tw:text-white tw:transition-colors">About</a>
                </li>
                <li>
                  <a href="#updates" className="hover:tw:text-white tw:transition-colors">Blog</a>
                </li>
                <li>
                  <a href="#contact" className="hover:tw:text-white tw:transition-colors">Contact</a>
                </li>
                <li>
                  <Link to="/" className="hover:tw:text-white tw:transition-colors">Dotted Mode</Link>
                </li>
              </ul>
            </div>

            {/* Socials Column */}
            <div>
              <div className="tw:text-xs tw:font-bold tw:text-white tw:mb-3">
                Socials
              </div>
              <ul className="tw:space-y-2 tw:text-xs tw:text-[#9a9aa1]">
                <li>
                  <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:tw:text-white tw:transition-colors">Twitter (X)</a>
                </li>
                <li>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:tw:text-white tw:transition-colors">Instagram</a>
                </li>
                <li>
                  <a href="https://dribbble.com" target="_blank" rel="noreferrer" className="hover:tw:text-white tw:transition-colors">Dribbble</a>
                </li>
                <li>
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:tw:text-white tw:transition-colors">LinkedIn</a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div
            className="tw:pt-8 tw:flex tw:flex-col tw:sm:tw:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-xs tw:text-[#9a9aa1]"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div>
              Get template · Built for DwarPal · All templates
            </div>
            <div>
              © DwarPal. All rights reserved.
            </div>
          </div>

        </div>
      </footer>
    </div>
  )
}
