import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  QrCode,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Lock,
  Bell,
  Users,
  Smartphone,
  ChevronDown,
  Menu,
  X,
  Shield,
  Activity,
  FileCheck,
  GraduationCap,
  Building2,
  ScanLine,
  Zap,
  Check,
  ChevronRight,
  HelpCircle,
  Car,
  Fingerprint,
  Layers,
  Flame,
  UserCheck,
} from 'lucide-react'
import logo from '../assets/dwarpal_logo.png'

// --- ROLE PORTAL DATA ---
const PORTALS_DATA = [
  {
    id: 'student',
    title: 'Students',
    badge: 'Fast & Effortless',
    icon: GraduationCap,
    headline: 'Request passes in 30 seconds & track approvals in real time',
    description:
      'No more paper forms or manual signatures. Submit reason, dates, and vehicle info straight from your phone, and receive immediate push alerts once approved.',
    highlights: [
      'Instant digital request generation with reason categorization',
      'Dynamic, tamper-proof QR gatepass stored in your pocket',
      'Live tracking of faculty & HOD review status',
      'Automatic leave history and personal pass archives',
    ],
    actionText: 'Student Quick Login',
    actionLink: '/student/login',
    previewBadge: 'ACTIVE PASS VALID',
    previewTitle: 'Aarav Sharma • 2024-CS-089',
    previewSubtitle: 'B.Tech Computer Science | Sem IV',
    previewTime: 'Valid Today: 14:00 - 18:30 IST',
    statusColor: 'tw:bg-emerald-500/20 tw:text-emerald-300 tw:border-emerald-500/30',
  },
  {
    id: 'faculty',
    title: 'Faculty & HODs',
    badge: 'Streamlined Authority',
    icon: UserCheck,
    headline: '1-Tap Digital Approvals & Smart Leave Workflows',
    description:
      'Review pending student gatepasses with full student academic context. Approve, reject with custom remarks, or forward up the chain with a single tap.',
    highlights: [
      'Filtered departmental inbox for pending requests',
      'One-tap approve, reject, or forward to HOD/Principal',
      'Faculty leave adjustment wizard with proxy lecturer mapping',
      'Instant student notification dispatch upon action',
    ],
    actionText: 'Faculty & Staff Login',
    actionLink: '/faculty/login',
    previewBadge: 'PENDING FACULTY ACTION',
    previewTitle: 'Dept. of Information Technology',
    previewSubtitle: '3 Requests Awaiting Class Coordinator Review',
    previewTime: 'Avg. Decision Time: 1.4 mins',
    statusColor: 'tw:bg-blue-500/20 tw:text-blue-300 tw:border-blue-500/30',
  },
  {
    id: 'security',
    title: 'Campus Security',
    badge: 'Sub-Second Verification',
    icon: ScanLine,
    headline: 'Ultra-Fast Gate Terminal & Verification Scanner',
    description:
      'Equip security officers at campus checkpoints with instant optical scanning, vehicle number matching, and tamper-proof student identity verification.',
    highlights: [
      'High-speed camera scanner with zero lag QR validation',
      'Emergency manual lookup by roll number or vehicle registration',
      'Single-tap OUT timestamping and automatic IN return logging',
      'Real-time campus exit & entry activity ledger',
    ],
    actionText: 'Gatekeeper Terminal Login',
    actionLink: '/security/login',
    previewBadge: 'GATE TERMINAL 01 • MAIN GATE',
    previewTitle: 'Optical Scanner Ready',
    previewSubtitle: 'Active Gate Officer: Unit Alpha',
    previewTime: '1,420 Passes Verified Today',
    statusColor: 'tw:bg-cyan-500/20 tw:text-cyan-300 tw:border-cyan-500/30',
  },
  {
    id: 'admin',
    title: 'Administration & CAO',
    badge: 'Campus Intelligence',
    icon: Building2,
    headline: 'Comprehensive Oversight, Analytics & Policy Control',
    description:
      'Gain real-time visibility over campus population density, cross-departmental gate activity, emergency lockdown controls, and exportable compliance records.',
    highlights: [
      'Live campus occupancy meters and peak gate traffic metrics',
      'Centralized student roster & user access level controls',
      'Complete audit logs with immutable timestamps',
      'Instant emergency broadcast and gate restriction triggers',
    ],
    actionText: 'Admin Workspace',
    actionLink: '/access-portal',
    previewBadge: 'EXECUTIVE OVERVIEW',
    previewTitle: 'Campus Access Center',
    previewSubtitle: 'Overall Campus Activity: 99.8% Compliance',
    previewTime: 'All 4 Gate Checkpoints Synchronized',
    statusColor: 'tw:bg-purple-500/20 tw:text-purple-300 tw:border-purple-500/30',
  },
]

// --- CORE FEATURES ---
const FEATURES = [
  {
    icon: QrCode,
    title: 'Dynamic Holographic QR',
    description:
      'Proprietary animated QR tokens with rolling expiration intervals, anti-screenshot security shields, and cryptographic validation.',
    tag: 'Tamper-Proof',
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    iconColor: 'tw:text-cyan-400',
  },
  {
    icon: Layers,
    title: 'Multi-Tier Approval Hierarchy',
    description:
      'Intelligent request routing through Student -> Class Coordinator -> HOD -> CAO -> Security Desk with automated escalation rules.',
    tag: 'Automated Routing',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    iconColor: 'tw:text-emerald-400',
  },
  {
    icon: ScanLine,
    title: 'Instant Gate Terminal Scanner',
    description:
      'Sub-second camera scanning with offline buffer sync, vehicle plate verification, and instant OUT/IN entry timestamping.',
    tag: '< 0.8s Scan Time',
    gradient: 'from-indigo-500/20 via-blue-500/10 to-transparent',
    iconColor: 'tw:text-indigo-400',
  },
  {
    icon: Fingerprint,
    title: 'WebAuthn & Biometric Security',
    description:
      'Seamless TouchID, FaceID, and hardware passkey support alongside military-grade multi-factor OTP protection.',
    tag: 'Zero-Trust Passkeys',
    gradient: 'from-purple-500/20 via-fuchsia-500/10 to-transparent',
    iconColor: 'tw:text-purple-400',
  },
  {
    icon: Bell,
    title: 'Real-Time Push & Email Matrix',
    description:
      'Direct browser push notifications and automated email dispatches informing students, wardens, and parents on every gate transition.',
    tag: 'Live Alerts',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    iconColor: 'tw:text-amber-400',
  },
  {
    icon: Activity,
    title: 'Real-Time Campus Analytics',
    description:
      'Live campus headcount indicators, department leave trends, emergency lockdown overrides, and instant Excel audit exports.',
    tag: 'Full Audit Trail',
    gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',
    iconColor: 'tw:text-rose-400',
  },
]

// --- HOW IT WORKS STEPS ---
const STEPS = [
  {
    step: '01',
    title: 'Apply in Seconds',
    desc: 'Student submits a digital gatepass with leave category, expected return time, destination, and vehicle details.',
    icon: Smartphone,
    color: 'tw:text-cyan-400',
    border: 'tw:border-cyan-500/30',
  },
  {
    step: '02',
    title: 'Faculty Sign-off',
    desc: 'Assigned Coordinator or HOD reviews the request with student leave history and approves with 1-click.',
    icon: FileCheck,
    color: 'tw:text-blue-400',
    border: 'tw:border-blue-500/30',
  },
  {
    step: '03',
    title: 'Gate Verification',
    desc: 'Campus security scans the dynamic holographic QR code at the checkpoint terminal in less than 0.8 seconds.',
    icon: ScanLine,
    color: 'tw:text-emerald-400',
    border: 'tw:border-emerald-500/30',
  },
  {
    step: '04',
    title: 'Safe Return Logged',
    desc: 'Return scan marks entry timestamp, verifies safe campus arrival, and archives the pass automatically.',
    icon: CheckCircle2,
    color: 'tw:text-purple-400',
    border: 'tw:border-purple-500/30',
  },
]

// --- FAQ DATA ---
const FAQS = [
  {
    q: 'How does the dynamic QR code prevent students from faking or screenshotting passes?',
    a: 'DwarPal gatepasses employ cryptographic rolling tokens with live animated security watermarks and micro-timestamp pulses. A static screenshot immediately flags as invalid at the security terminal because the token rotates continuously and expires immediately after validation.',
  },
  {
    q: 'What happens if campus Wi-Fi or mobile data is slow at the security checkpoint?',
    a: 'DwarPal is built as a resilient Progressive Web Application (PWA). The security terminal maintains an encrypted local offline buffer that instantly validates active passes and syncs timestamp records the moment network connectivity resumes.',
  },
  {
    q: 'How do students get notified when faculty approves or rejects their gatepass?',
    a: 'Students receive instant Web Push notifications directly to their smartphone browser or desktop, alongside an automated real-time status update in their student dashboard and email inbox.',
  },
  {
    q: 'Can students register themselves on the platform?',
    a: 'Yes! Students can access the dedicated student registration portal (/student/register) using their verified college enrollment number, department, semester, and official email.',
  },
  {
    q: 'Can campus security manually verify a student if their phone battery dies?',
    a: 'Yes. Security officers have a secure manual lookup terminal to verify identity instantly using the student’s enrollment number, name, or vehicle registration plate.',
  },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activePortalTab, setActivePortalTab] = useState('student')
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const activePortal = PORTALS_DATA.find((p) => p.id === activePortalTab) || PORTALS_DATA[0]

  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-[#070e17] tw:text-slate-100 tw:relative tw:overflow-x-hidden tw:selection:bg-cyan-500/30 tw:selection:text-cyan-200">
      {/* --- AMBIENT GLOW EFFECTS (High performance, pure CSS) --- */}
      <div className="tw:fixed tw:inset-0 tw:pointer-events-none tw:z-0 tw:overflow-hidden">
        <div className="tw:absolute tw:top-[-10%] tw:left-1/2 tw:-translate-x-1/2 tw:w-[900px] tw:h-[500px] tw:bg-gradient-to-b tw:from-[#1d4ed8]/20 tw:via-[#0ea5e9]/10 tw:to-transparent tw:rounded-full tw:blur-[130px]" />
        <div className="tw:absolute tw:top-[35%] tw:left-[-10%] tw:w-[600px] tw:h-[600px] tw:bg-[#10b981]/10 tw:rounded-full tw:blur-[140px]" />
        <div className="tw:absolute tw:top-[60%] tw:right-[-10%] tw:w-[700px] tw:h-[700px] tw:bg-[#6366f1]/10 tw:rounded-full tw:blur-[150px]" />
        {/* Subtle high-tech grid texture */}
        <div 
          className="tw:absolute tw:inset-0 tw:opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="tw:relative tw:z-10 tw:flex tw:flex-col tw:min-h-screen">
        {/* ======================================================== */}
        {/* 1. STICKY GLASS HEADER NAVBAR                           */}
        {/* ======================================================== */}
        <header className="tw:sticky tw:top-0 tw:z-50 tw:w-full tw:border-b tw:border-slate-800/80 tw:bg-[#070e17]/80 tw:backdrop-blur-xl">
          <div className="tw:max-w-7xl tw:mx-auto tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:h-20 tw:flex tw:items-center tw:justify-between tw:gap-4">
            
            {/* Brand Logo */}
            <Link to="/" className="tw:flex tw:items-center tw:gap-3.5 tw:group">
              <div className="tw:relative tw:flex tw:items-center tw:justify-center">
                <img
                  src={logo}
                  alt="DwarPal"
                  className="tw:h-10 tw:w-auto tw:object-contain tw:transition-transform tw:duration-300 group-hover:tw:scale-105"
                />
                <div className="tw:absolute tw:-inset-1 tw:bg-cyan-500/20 tw:rounded-full tw:blur-sm tw:opacity-0 group-hover:tw:opacity-100 tw:transition-opacity" />
              </div>
              <div className="tw:flex tw:flex-col">
                <span className="tw:font-mono tw:text-lg tw:font-black tw:tracking-[0.25em] tw:uppercase tw:text-white group-hover:tw:text-cyan-300 tw:transition-colors">
                  DwarPal
                </span>
                <span className="tw:text-[9px] tw:font-mono tw:tracking-widest tw:text-slate-400 tw:uppercase">
                  Digital Gatekeeper
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="tw:hidden tw:md:flex tw:items-center tw:gap-8 tw:text-xs tw:font-medium tw:tracking-wider tw:uppercase tw:text-slate-300">
              <a href="#features" className="hover:tw:text-cyan-400 tw:transition-colors">Features</a>
              <a href="#workflow" className="hover:tw:text-cyan-400 tw:transition-colors">How It Works</a>
              <a href="#portals" className="hover:tw:text-cyan-400 tw:transition-colors">Portals</a>
              <a href="#security" className="hover:tw:text-cyan-400 tw:transition-colors">Security</a>
              <a href="#faq" className="hover:tw:text-cyan-400 tw:transition-colors">FAQ</a>
            </nav>

            {/* Header Right Actions */}
            <div className="tw:hidden tw:sm:flex tw:items-center tw:gap-3">
              {/* System Active Badge */}
              <div className="tw:hidden tw:lg:flex tw:items-center tw:gap-2 tw:px-3 tw:py-1.5 tw:rounded-full tw:bg-emerald-500/10 tw:border tw:border-emerald-500/20 tw:text-[10px] tw:font-mono tw:text-emerald-400">
                <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-emerald-400 tw:animate-ping" />
                <span>SYSTEM ONLINE</span>
              </div>

              {/* Direct Student Login */}
              <Link
                to="/student/login"
                className="tw:px-3.5 tw:py-2 tw:text-xs tw:font-medium tw:text-slate-300 hover:tw:text-white tw:border tw:border-slate-800 hover:tw:border-slate-700 tw:rounded-lg tw:bg-slate-900/60 hover:tw:bg-slate-800/80 tw:transition-all"
              >
                Student Login
              </Link>

              {/* Primary Access Portal CTA */}
              <Link
                to="/access-portal"
                className="tw:relative tw:inline-flex tw:items-center tw:gap-2 tw:px-5 tw:py-2.5 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-white tw:rounded-lg tw:bg-gradient-to-r tw:from-cyan-600 tw:via-blue-600 tw:to-indigo-600 hover:tw:from-cyan-500 hover:tw:to-indigo-500 tw:shadow-lg tw:shadow-blue-500/20 hover:tw:shadow-cyan-500/30 tw:transition-all tw:duration-200"
              >
                <span>Access Portal</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="tw:md:hidden tw:p-2 tw:rounded-lg tw:bg-slate-900 tw:border tw:border-slate-800 tw:text-slate-300 hover:tw:text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile Drawer Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="tw:md:hidden tw:border-b tw:border-slate-800 tw:bg-[#070e17]/95 tw:backdrop-blur-2xl tw:px-6 tw:py-6 tw:space-y-5"
              >
                <nav className="tw:flex tw:flex-col tw:space-y-4 tw:text-sm tw:font-medium tw:tracking-wider tw:uppercase tw:text-slate-300">
                  <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-cyan-400">Features</a>
                  <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-cyan-400">How It Works</a>
                  <a href="#portals" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-cyan-400">Role Portals</a>
                  <a href="#security" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-cyan-400">Security</a>
                  <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-cyan-400">FAQ</a>
                </nav>

                <div className="tw:pt-4 tw:border-t tw:border-slate-800 tw:grid tw:grid-cols-2 tw:gap-3">
                  <Link
                    to="/student/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="tw:text-center tw:py-3 tw:text-xs tw:font-medium tw:rounded-lg tw:bg-slate-900 tw:border tw:border-slate-800 tw:text-slate-200"
                  >
                    Student Login
                  </Link>
                  <Link
                    to="/faculty/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="tw:text-center tw:py-3 tw:text-xs tw:font-medium tw:rounded-lg tw:bg-slate-900 tw:border tw:border-slate-800 tw:text-slate-200"
                  >
                    Faculty Login
                  </Link>
                </div>

                <Link
                  to="/access-portal"
                  onClick={() => setMobileMenuOpen(false)}
                  className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:w-full tw:py-3.5 tw:text-xs tw:font-bold tw:uppercase tw:tracking-wider tw:text-white tw:rounded-lg tw:bg-gradient-to-r tw:from-cyan-600 tw:to-blue-600 tw:shadow-md"
                >
                  <span>Launch Access Portal</span>
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ======================================================== */}
        {/* 2. HERO SECTION                                         */}
        {/* ======================================================== */}
        <section className="tw:relative tw:pt-12 tw:pb-20 tw:lg:pt-20 tw:lg:pb-32 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-12 tw:gap-12 tw:lg:gap-8 tw:items-center">
            
            {/* Hero Left Content */}
            <div className="tw:lg:col-span-7 tw:space-y-8 tw:text-center tw:lg:text-left">
              
              {/* Live Pill Announcement */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="tw:inline-flex tw:items-center tw:gap-2.5 tw:px-4 tw:py-2 tw:rounded-full tw:bg-slate-900/90 tw:border tw:border-cyan-500/30 tw:shadow-lg tw:shadow-cyan-500/10"
              >
                <Sparkles size={14} className="tw:text-cyan-400 tw:animate-pulse" />
                <span className="tw:text-xs tw:font-mono tw:tracking-wide tw:text-cyan-300">
                  Campus Gatepass System 2.0
                </span>
                <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-emerald-400 tw:animate-ping" />
              </motion.div>

              {/* Headline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="tw:space-y-3"
              >
                <h1 className="tw:text-4xl tw:sm:text-5xl tw:lg:text-6xl tw:font-black tw:tracking-tight tw:leading-[1.1] tw:text-white">
                  Intelligent Campus Access,{' '}
                  <span className="tw:text-transparent tw:bg-clip-text tw:bg-gradient-to-r tw:from-cyan-400 tw:via-blue-400 tw:to-indigo-400">
                    Instant Gatepass
                  </span>{' '}
                  Verification.
                </h1>
                <p className="tw:text-base tw:sm:text-lg tw:text-slate-300 tw:max-w-2xl tw:mx-auto tw:lg:mx-0 tw:leading-relaxed tw:font-normal">
                  Say goodbye to paper slips and manual gate queues. DwarPal automates student leave requests, 1-tap faculty sign-offs, biometric security, and sub-second QR gate scanning for your entire campus.
                </p>
              </motion.div>

              {/* Hero Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:lg:justify-start tw:gap-4"
              >
                <Link
                  to="/access-portal"
                  className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-gradient-to-r tw:from-cyan-500 tw:via-blue-600 tw:to-indigo-600 hover:tw:from-cyan-400 hover:tw:to-indigo-500 tw:text-white tw:font-bold tw:text-sm tw:tracking-wider tw:uppercase tw:shadow-xl tw:shadow-cyan-500/20 hover:tw:shadow-cyan-500/40 tw:transition-all tw:duration-200 tw:flex tw:items-center tw:justify-center tw:gap-3"
                >
                  <span>Launch Access Portal</span>
                  <ArrowRight size={18} />
                </Link>

                <Link
                  to="/student/login"
                  className="tw:w-full tw:sm:w-auto tw:px-7 tw:py-4 tw:rounded-xl tw:bg-slate-900/90 hover:tw:bg-slate-800 tw:border tw:border-slate-700 hover:tw:border-slate-600 tw:text-slate-200 hover:tw:text-white tw:font-semibold tw:text-sm tw:transition-all tw:flex tw:items-center tw:justify-center tw:gap-2.5"
                >
                  <GraduationCap size={18} className="tw:text-cyan-400" />
                  <span>Student Direct Login</span>
                </Link>
              </motion.div>

              {/* Student Registration Link prompt */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="tw:flex tw:items-center tw:justify-center tw:lg:justify-start tw:gap-2 tw:text-xs tw:text-slate-400"
              >
                <span>New student joining this semester?</span>
                <Link
                  to="/student/register"
                  className="tw:text-cyan-400 hover:tw:text-cyan-300 tw:font-semibold tw:underline tw:underline-offset-4 tw:transition-colors"
                >
                  Create Student Account &rarr;
                </Link>
              </motion.div>

              {/* Trust Badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="tw:pt-4 tw:border-t tw:border-slate-800/80 tw:grid tw:grid-cols-3 tw:gap-4 tw:text-left"
              >
                <div className="tw:flex tw:items-center tw:gap-2.5">
                  <div className="tw:p-2 tw:rounded-lg tw:bg-cyan-500/10 tw:text-cyan-400">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:text-white">256-Bit Cryptography</p>
                    <p className="tw:text-[11px] tw:text-slate-400">Anti-tamper tokens</p>
                  </div>
                </div>

                <div className="tw:flex tw:items-center tw:gap-2.5">
                  <div className="tw:p-2 tw:rounded-lg tw:bg-emerald-500/10 tw:text-emerald-400">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:text-white">&lt; 0.8s Validation</p>
                    <p className="tw:text-[11px] tw:text-slate-400">Zero gate queues</p>
                  </div>
                </div>

                <div className="tw:flex tw:items-center tw:gap-2.5">
                  <div className="tw:p-2 tw:rounded-lg tw:bg-blue-500/10 tw:text-blue-400">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:text-white">PWA & Web Push</p>
                    <p className="tw:text-[11px] tw:text-slate-400">Zero app install</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Hero Right Visual: Simulated Live Gatepass Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="tw:lg:col-span-5 tw:relative tw:flex tw:justify-center"
            >
              {/* Outer Glow container */}
              <div className="tw:relative tw:w-full tw:max-w-md">
                
                {/* Floating Badge: Verification Speed */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="tw:absolute tw:-top-6 tw:-left-4 tw:z-20 tw:flex tw:items-center tw:gap-2.5 tw:px-3.5 tw:py-2 tw:rounded-xl tw:bg-[#0c1a2e]/90 tw:backdrop-blur-xl tw:border tw:border-cyan-500/40 tw:shadow-xl tw:shadow-cyan-500/20"
                >
                  <div className="tw:h-2 tw:w-2 tw:rounded-full tw:bg-cyan-400 tw:animate-ping" />
                  <span className="tw:text-xs tw:font-mono tw:font-bold tw:text-cyan-300">
                    ⚡ 0.8s Scan Verified
                  </span>
                </motion.div>

                {/* Floating Badge: Push Alert */}
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 1 }}
                  className="tw:absolute tw:-bottom-5 tw:-right-3 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:px-3.5 tw:py-2 tw:rounded-xl tw:bg-[#0c1a2e]/90 tw:backdrop-blur-xl tw:border tw:border-emerald-500/40 tw:shadow-xl tw:shadow-emerald-500/20"
                >
                  <Bell size={14} className="tw:text-emerald-400" />
                  <span className="tw:text-xs tw:font-mono tw:font-bold tw:text-emerald-300">
                    Parent Push Dispatched
                  </span>
                </motion.div>

                {/* The Smart Gatepass Card UI */}
                <div className="tw:relative tw:rounded-2xl tw:p-6 tw:bg-gradient-to-b tw:from-[#0f233a] tw:via-[#091524] tw:to-[#060e18] tw:border tw:border-cyan-500/30 tw:shadow-2xl tw:shadow-blue-950/80 tw:space-y-5 tw:overflow-hidden">
                  
                  {/* Hologram Shimmer Ribbon */}
                  <div className="tw:absolute tw:top-0 tw:left-0 tw:right-0 tw:h-1.5 tw:bg-gradient-to-r tw:from-cyan-400 tw:via-emerald-400 tw:to-blue-500" />

                  {/* Pass Header */}
                  <div className="tw:flex tw:items-center tw:justify-between tw:pt-1">
                    <div className="tw:flex tw:items-center tw:gap-3">
                      <div className="tw:h-12 tw:w-12 tw:rounded-xl tw:bg-gradient-to-tr tw:from-cyan-600 tw:to-blue-700 tw:flex tw:items-center tw:justify-center tw:text-white tw:font-bold tw:text-base tw:shadow-md tw:border tw:border-cyan-400/30">
                        AS
                      </div>
                      <div>
                        <div className="tw:flex tw:items-center tw:gap-2">
                          <h3 className="tw:font-bold tw:text-white tw:text-sm">Aarav Sharma</h3>
                          <span className="tw:px-1.5 tw:py-0.5 tw:rounded tw:bg-emerald-500/20 tw:text-emerald-300 tw:text-[10px] tw:font-mono">
                            VERIFIED
                          </span>
                        </div>
                        <p className="tw:text-xs tw:text-slate-400">Roll: 2024-CS-089 • Sem IV</p>
                      </div>
                    </div>

                    <div className="tw:text-right">
                      <span className="tw:inline-block tw:px-2.5 tw:py-1 tw:rounded-full tw:bg-emerald-500/20 tw:border tw:border-emerald-500/30 tw:text-[10px] tw:font-mono tw:font-bold tw:text-emerald-300">
                        APPROVED
                      </span>
                    </div>
                  </div>

                  {/* Simulated QR Code with Live Laser Scanning Effect */}
                  <div className="tw:relative tw:flex tw:flex-col tw:items-center tw:justify-center tw:p-5 tw:rounded-xl tw:bg-slate-950/80 tw:border tw:border-slate-800">
                    <div className="tw:relative tw:p-3 tw:rounded-xl tw:bg-white tw:shadow-lg">
                      <QrCode size={130} className="tw:text-slate-950" />
                      
                      {/* Animated Laser Scanning Line */}
                      <motion.div
                        animate={{ top: ['5%', '90%', '5%'] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                        className="tw:absolute tw:left-2 tw:right-2 tw:h-0.5 tw:bg-gradient-to-r tw:from-transparent tw:via-cyan-500 tw:to-transparent tw:shadow-[0_0_8px_#06b6d4]"
                      />
                    </div>

                    {/* QR Security Meta */}
                    <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-[11px] tw:font-mono tw:text-cyan-400">
                      <ShieldCheck size={13} />
                      <span>DYNAMIC TOKEN: EXP-02:44:18</span>
                    </div>
                  </div>

                  {/* Pass Metadata Grid */}
                  <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:text-xs tw:font-mono tw:bg-slate-900/60 tw:p-3.5 tw:rounded-xl tw:border tw:border-slate-800">
                    <div>
                      <span className="tw:text-slate-400 tw:text-[10px] tw:block">OUT TIME</span>
                      <span className="tw:font-bold tw:text-white">Today, 14:15 IST</span>
                    </div>
                    <div>
                      <span className="tw:text-slate-400 tw:text-[10px] tw:block">EXPECTED IN</span>
                      <span className="tw:font-bold tw:text-white">Today, 18:30 IST</span>
                    </div>
                    <div>
                      <span className="tw:text-slate-400 tw:text-[10px] tw:block">LEAVE REASON</span>
                      <span className="tw:text-cyan-300">Technical Symposium</span>
                    </div>
                    <div>
                      <span className="tw:text-slate-400 tw:text-[10px] tw:block">GATE AUTHORIZED</span>
                      <span className="tw:text-emerald-300">Main Campus Gate 01</span>
                    </div>
                  </div>

                  {/* Live Security Gate Check Status */}
                  <div className="tw:flex tw:items-center tw:justify-between tw:px-3.5 tw:py-2.5 tw:rounded-lg tw:bg-emerald-950/40 tw:border tw:border-emerald-500/30 tw:text-xs">
                    <div className="tw:flex tw:items-center tw:gap-2 tw:text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="tw:font-semibold">Security Clearance Verified</span>
                    </div>
                    <span className="tw:text-[10px] tw:font-mono tw:text-slate-400">Gate #1 Logged</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. CAMPUS METRICS & REAL-TIME IMPACT COUNTERS            */}
        {/* ======================================================== */}
        <section className="tw:border-y tw:border-slate-800/80 tw:bg-[#09131f]/90 tw:backdrop-blur-md tw:py-10 tw:px-4 tw:sm:px-6 tw:lg:px-8">
          <div className="tw:max-w-7xl tw:mx-auto tw:grid tw:grid-cols-2 tw:md:grid-cols-4 tw:gap-8 tw:text-center">
            
            <div className="tw:space-y-1">
              <p className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:font-mono">
                99.9<span className="tw:text-cyan-400">%</span>
              </p>
              <p className="tw:text-xs tw:font-medium tw:uppercase tw:tracking-wider tw:text-slate-400">
                Gatepass Accuracy
              </p>
            </div>

            <div className="tw:space-y-1">
              <p className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:font-mono">
                &lt; 0.8<span className="tw:text-emerald-400">s</span>
              </p>
              <p className="tw:text-xs tw:font-medium tw:uppercase tw:tracking-wider tw:text-slate-400">
                Gate Scan Turnaround
              </p>
            </div>

            <div className="tw:space-y-1">
              <p className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:font-mono">
                100<span className="tw:text-blue-400">%</span>
              </p>
              <p className="tw:text-xs tw:font-medium tw:uppercase tw:tracking-wider tw:text-slate-400">
                Paperless Campus Audit
              </p>
            </div>

            <div className="tw:space-y-1">
              <p className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:font-mono">
                6<span className="tw:text-purple-400">+</span>
              </p>
              <p className="tw:text-xs tw:font-medium tw:uppercase tw:tracking-wider tw:text-slate-400">
                Integrated Campus Roles
              </p>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. CORE FEATURES (BENTO GRID)                            */}
        {/* ======================================================== */}
        <section id="features" className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:text-center tw:max-w-3xl tw:mx-auto tw:space-y-4 tw:mb-16">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-cyan-500/10 tw:border tw:border-cyan-500/20 tw:text-cyan-400 tw:text-xs tw:font-mono tw:uppercase tw:tracking-widest">
              <Sparkles size={13} />
              <span>Next-Gen Capabilities</span>
            </div>
            <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
              Engineered for Enterprise Campus Security
            </h2>
            <p className="tw:text-slate-300 tw:text-sm tw:sm:text-base tw:leading-relaxed">
              Every touchpoint—from student submission to faculty sign-off and gate verification—is optimized for zero friction, high security, and complete transparency.
            </p>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:md:grid-cols-2 tw:lg:grid-cols-3 tw:gap-6">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="tw:group tw:relative tw:p-8 tw:rounded-2xl tw:bg-gradient-to-b tw:from-[#0d1c2d] tw:to-[#07101b] tw:border tw:border-slate-800 hover:tw:border-cyan-500/40 tw:transition-all tw:duration-300 hover:tw:-translate-y-1 tw:shadow-xl hover:tw:shadow-cyan-500/10 tw:overflow-hidden"
                >
                  {/* Subtle hover gradient flare */}
                  <div className={`tw:absolute tw:-top-24 tw:-right-24 tw:w-48 tw:h-48 tw:bg-gradient-to-br ${feature.gradient} tw:rounded-full tw:blur-3xl tw:opacity-0 group-hover:tw:opacity-100 tw:transition-opacity tw:duration-500`} />

                  <div className="tw:relative tw:space-y-4">
                    <div className="tw:flex tw:items-center tw:justify-between">
                      <div className="tw:p-3 tw:rounded-xl tw:bg-slate-900/90 tw:border tw:border-slate-800 group-hover:tw:border-cyan-500/30 tw:transition-colors">
                        <Icon size={22} className={feature.iconColor} />
                      </div>
                      <span className="tw:px-2.5 tw:py-1 tw:rounded-full tw:bg-slate-800/80 tw:text-[10px] tw:font-mono tw:text-slate-300">
                        {feature.tag}
                      </span>
                    </div>

                    <h3 className="tw:text-lg tw:font-bold tw:text-white group-hover:tw:text-cyan-300 tw:transition-colors">
                      {feature.title}
                    </h3>

                    <p className="tw:text-xs tw:sm:text-sm tw:text-slate-300 tw:leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 5. INTERACTIVE ROLE PORTALS SHOWCASE                     */}
        {/* ======================================================== */}
        <section id="portals" className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:text-center tw:max-w-3xl tw:mx-auto tw:space-y-4 tw:mb-12">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-blue-500/10 tw:border tw:border-blue-500/20 tw:text-blue-400 tw:text-xs tw:font-mono tw:uppercase tw:tracking-widest">
              <Users size={13} />
              <span>Tailored Experiences</span>
            </div>
            <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
              A Dedicated Workspace for Every Campus Persona
            </h2>
            <p className="tw:text-slate-300 tw:text-sm tw:sm:text-base">
              Explore how DwarPal delivers specialized tools designed for students, faculty approvers, security officers, and executive leadership.
            </p>
          </div>

          {/* Role Tab Switcher */}
          <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:flex-wrap tw:mb-10">
            {PORTALS_DATA.map((portal) => {
              const Icon = portal.icon
              const isActive = activePortalTab === portal.id
              return (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => setActivePortalTab(portal.id)}
                  className={`tw:flex tw:items-center tw:gap-2 tw:px-5 tw:py-3 tw:rounded-xl tw:text-xs tw:font-bold tw:uppercase tw:tracking-wider tw:transition-all tw:duration-200 ${
                    isActive
                      ? 'tw:bg-gradient-to-r tw:from-cyan-600 tw:to-blue-600 tw:text-white tw:shadow-lg tw:shadow-blue-500/20'
                      : 'tw:bg-slate-900/80 hover:tw:bg-slate-800 tw:text-slate-400 hover:tw:text-slate-200 tw:border tw:border-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  <span>{portal.title}</span>
                </button>
              )
            })}
          </div>

          {/* Active Portal Showcase Card */}
          <motion.div
            key={activePortal.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="tw:rounded-3xl tw:p-8 tw:lg:p-12 tw:bg-gradient-to-b tw:from-[#0d1c2d] tw:via-[#091523] tw:to-[#060f1a] tw:border tw:border-slate-800 tw:shadow-2xl tw:shadow-slate-950/80"
          >
            <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-12 tw:gap-10 tw:items-center">
              
              {/* Portal Left Description */}
              <div className="tw:lg:col-span-7 tw:space-y-6">
                <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-md tw:bg-cyan-500/10 tw:text-cyan-400 tw:text-xs tw:font-mono">
                  <span>{activePortal.badge}</span>
                </div>

                <h3 className="tw:text-2xl tw:sm:text-3xl tw:font-bold tw:text-white tw:leading-snug">
                  {activePortal.headline}
                </h3>

                <p className="tw:text-sm tw:sm:text-base tw:text-slate-300 tw:leading-relaxed">
                  {activePortal.description}
                </p>

                <div className="tw:space-y-3 tw:pt-2">
                  {activePortal.highlights.map((h, i) => (
                    <div key={i} className="tw:flex tw:items-start tw:gap-3">
                      <div className="tw:p-1 tw:rounded-full tw:bg-emerald-500/10 tw:text-emerald-400 tw:mt-0.5">
                        <Check size={13} />
                      </div>
                      <span className="tw:text-xs tw:sm:text-sm tw:text-slate-200">{h}</span>
                    </div>
                  ))}
                </div>

                <div className="tw:pt-4">
                  <Link
                    to={activePortal.actionLink}
                    className="tw:inline-flex tw:items-center tw:gap-2.5 tw:px-6 tw:py-3.5 tw:rounded-xl tw:bg-gradient-to-r tw:from-cyan-500 tw:to-blue-600 hover:tw:from-cyan-400 hover:tw:to-blue-500 tw:text-white tw:font-bold tw:text-xs tw:uppercase tw:tracking-wider tw:shadow-md tw:transition-all"
                  >
                    <span>{activePortal.actionText}</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              {/* Portal Right Simulated UI Preview */}
              <div className="tw:lg:col-span-5">
                <div className="tw:rounded-2xl tw:p-6 tw:bg-slate-950/90 tw:border tw:border-slate-800 tw:shadow-xl tw:space-y-4">
                  <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-800 tw:pb-3">
                    <span className={`tw:px-2.5 tw:py-1 tw:rounded-md tw:text-[10px] tw:font-mono tw:font-bold tw:border ${activePortal.statusColor}`}>
                      {activePortal.previewBadge}
                    </span>
                    <span className="tw:text-[11px] tw:font-mono tw:text-slate-400">DwarPal Verified</span>
                  </div>

                  <div className="tw:space-y-1">
                    <h4 className="tw:font-bold tw:text-white tw:text-base">{activePortal.previewTitle}</h4>
                    <p className="tw:text-xs tw:text-slate-400">{activePortal.previewSubtitle}</p>
                  </div>

                  <div className="tw:p-4 tw:rounded-xl tw:bg-slate-900/90 tw:border tw:border-slate-800 tw:space-y-2">
                    <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                      <span className="tw:text-slate-400">Live Status</span>
                      <span className="tw:text-emerald-400 tw:font-mono tw:font-semibold">SYNCHRONIZED</span>
                    </div>
                    <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                      <span className="tw:text-slate-400">Metric Indicator</span>
                      <span className="tw:text-cyan-300 tw:font-mono">{activePortal.previewTime}</span>
                    </div>
                  </div>

                  <div className="tw:flex tw:items-center tw:justify-between tw:text-[11px] tw:text-slate-400 tw:pt-1">
                    <span>Audit Log ID: #DP-9924-OK</span>
                    <span className="tw:text-emerald-400">✓ Security Valid</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </section>

        {/* ======================================================== */}
        {/* 6. HOW IT WORKS 4-STEP WORKFLOW                          */}
        {/* ======================================================== */}
        <section id="workflow" className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:text-center tw:max-w-3xl tw:mx-auto tw:space-y-4 tw:mb-16">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-emerald-500/10 tw:border tw:border-emerald-500/20 tw:text-emerald-400 tw:text-xs tw:font-mono tw:uppercase tw:tracking-widest">
              <Zap size={13} />
              <span>Step-By-Step Simplicity</span>
            </div>
            <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
              How DwarPal Automates Campus Exit & Entry
            </h2>
            <p className="tw:text-slate-300 tw:text-sm tw:sm:text-base">
              A frictionless digital lifecycle taking a student from request to campus return in seconds.
            </p>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:gap-6">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              return (
                <div
                  key={step.step}
                  className="tw:relative tw:p-6 tw:rounded-2xl tw:bg-gradient-to-b tw:from-[#0d1b2a] tw:to-[#07101b] tw:border tw:border-slate-800 tw:space-y-4"
                >
                  <div className="tw:flex tw:items-center tw:justify-between">
                    <span className={`tw:font-mono tw:text-2xl tw:font-black ${step.color}`}>
                      {step.step}
                    </span>
                    <div className={`tw:p-2.5 tw:rounded-xl tw:bg-slate-900 tw:border ${step.border}`}>
                      <Icon size={18} className={step.color} />
                    </div>
                  </div>

                  <h3 className="tw:text-base tw:font-bold tw:text-white">{step.title}</h3>
                  <p className="tw:text-xs tw:text-slate-300 tw:leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 7. SECURITY & ENTERPRISE COMPLIANCE                     */}
        {/* ======================================================== */}
        <section id="security" className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:rounded-3xl tw:p-8 tw:lg:p-14 tw:bg-gradient-to-r tw:from-[#0c1e34] tw:via-[#091523] tw:to-[#06101c] tw:border tw:border-cyan-500/30 tw:shadow-2xl tw:shadow-cyan-950/40">
            <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-12 tw:gap-10 tw:items-center">
              
              <div className="tw:lg:col-span-7 tw:space-y-6">
                <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-cyan-500/10 tw:border tw:border-cyan-500/20 tw:text-cyan-400 tw:text-xs tw:font-mono tw:uppercase">
                  <Lock size={13} />
                  <span>Enterprise Zero-Trust Standard</span>
                </div>

                <h2 className="tw:text-2xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
                  Bank-Grade Encryption, Real-Time Audit, Zero Data Leaks
                </h2>

                <p className="tw:text-slate-300 tw:text-sm tw:sm:text-base tw:leading-relaxed">
                  DwarPal is built from the ground up with strict OWASP A03 defenses, Content Security Policies (CSP), biometric passkey authentication, rate-limiting, and session sandboxing.
                </p>

                <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:gap-4 tw:pt-2">
                  <div className="tw:p-4 tw:rounded-xl tw:bg-slate-900/80 tw:border tw:border-slate-800 tw:space-y-1.5">
                    <p className="tw:text-xs tw:font-bold tw:text-white tw:flex tw:items-center tw:gap-1.5">
                      <ShieldCheck size={14} className="tw:text-cyan-400" />
                      Dynamic Token Rotation
                    </p>
                    <p className="tw:text-[11px] tw:text-slate-400">
                      QR tokens refresh every few seconds, making screenshots or fakes impossible to authenticate.
                    </p>
                  </div>

                  <div className="tw:p-4 tw:rounded-xl tw:bg-slate-900/80 tw:border tw:border-slate-800 tw:space-y-1.5">
                    <p className="tw:text-xs tw:font-bold tw:text-white tw:flex tw:items-center tw:gap-1.5">
                      <Fingerprint size={14} className="tw:text-purple-400" />
                      FIDO2 / WebAuthn
                    </p>
                    <p className="tw:text-[11px] tw:text-slate-400">
                      Zero password vulnerabilities. Secure your gatekeeper and faculty logins with Touch ID & Face ID.
                    </p>
                  </div>
                </div>
              </div>

              <div className="tw:lg:col-span-5 tw:flex tw:justify-center">
                <div className="tw:w-full tw:max-w-sm tw:p-6 tw:rounded-2xl tw:bg-slate-950/90 tw:border tw:border-cyan-500/30 tw:space-y-4">
                  <div className="tw:flex tw:items-center tw:gap-3 tw:text-emerald-400">
                    <Shield size={24} />
                    <span className="tw:font-bold tw:text-white tw:text-sm">Security Matrix Validated</span>
                  </div>

                  <div className="tw:space-y-2.5 tw:text-xs tw:font-mono tw:text-slate-300">
                    <div className="tw:flex tw:justify-between tw:py-1.5 tw:border-b tw:border-slate-800">
                      <span className="tw:text-slate-400">Data Transmission</span>
                      <span className="tw:text-emerald-400">TLS 1.3 / HTTPS</span>
                    </div>
                    <div className="tw:flex tw:justify-between tw:py-1.5 tw:border-b tw:border-slate-800">
                      <span className="tw:text-slate-400">Biometrics</span>
                      <span className="tw:text-cyan-400">Hardware Bound</span>
                    </div>
                    <div className="tw:flex tw:justify-between tw:py-1.5 tw:border-b tw:border-slate-800">
                      <span className="tw:text-slate-400">Rate Limiting</span>
                      <span className="tw:text-purple-400">Strict IP & Session</span>
                    </div>
                    <div className="tw:flex tw:justify-between tw:py-1.5">
                      <span className="tw:text-slate-400">Audit Compliance</span>
                      <span className="tw:text-emerald-400">100% Immutable</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 8. INTERACTIVE FAQ ACCORDION                             */}
        {/* ======================================================== */}
        <section id="faq" className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-4xl tw:mx-auto tw:w-full">
          <div className="tw:text-center tw:space-y-4 tw:mb-14">
            <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-purple-500/10 tw:border tw:border-purple-500/20 tw:text-purple-400 tw:text-xs tw:font-mono tw:uppercase tw:tracking-widest">
              <HelpCircle size={13} />
              <span>Got Questions?</span>
            </div>
            <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="tw:text-slate-300 tw:text-sm tw:sm:text-base">
              Everything you need to know about DwarPal campus digital gatepass operations.
            </p>
          </div>

          <div className="tw:space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="tw:rounded-2xl tw:bg-slate-900/70 tw:border tw:border-slate-800 hover:tw:border-slate-700 tw:transition-colors tw:overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    className="tw:w-full tw:p-6 tw:text-left tw:flex tw:items-center tw:justify-between tw:gap-4"
                  >
                    <span className="tw:font-bold tw:text-white tw:text-sm tw:sm:text-base">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`tw:text-cyan-400 tw:transition-transform tw:duration-300 tw:flex-shrink-0 ${
                        isOpen ? 'tw:rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="tw:px-6 tw:pb-6 tw:text-xs tw:sm:text-sm tw:text-slate-300 tw:leading-relaxed tw:border-t tw:border-slate-800/60 tw:pt-4"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 9. BOTTOM CALL-TO-ACTION BANNER                         */}
        {/* ======================================================== */}
        <section className="tw:py-16 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-7xl tw:mx-auto tw:w-full">
          <div className="tw:relative tw:rounded-3xl tw:p-10 tw:sm:p-16 tw:bg-gradient-to-r tw:from-cyan-900/60 tw:via-blue-900/60 tw:to-indigo-950/70 tw:border tw:border-cyan-500/40 tw:shadow-2xl tw:shadow-cyan-900/30 tw:text-center tw:space-y-8 tw:overflow-hidden">
            
            {/* Background ambient flare */}
            <div className="tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:w-[600px] tw:h-[300px] tw:bg-cyan-500/10 tw:rounded-full tw:blur-[100px] tw:pointer-events-none" />

            <div className="tw:relative tw:max-w-2xl tw:mx-auto tw:space-y-4">
              <h2 className="tw:text-3xl tw:sm:text-5xl tw:font-black tw:text-white tw:tracking-tight">
                Ready to Modernize Your Campus Access?
              </h2>
              <p className="tw:text-slate-200 tw:text-sm tw:sm:text-base">
                Join universities and institutions using DwarPal for zero-queue gatepasses, biometric trust, and automated faculty workflows.
              </p>
            </div>

            <div className="tw:relative tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:gap-4">
              <Link
                to="/access-portal"
                className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-white tw:hover:bg-slate-100 tw:text-slate-950 tw:font-black tw:text-xs tw:uppercase tw:tracking-widest tw:shadow-xl tw:transition-all tw:flex tw:items-center tw:justify-center tw:gap-2.5"
              >
                <span>Enter Access Portal</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/student/register"
                className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-slate-900/80 hover:tw:bg-slate-800 tw:border tw:border-white/20 tw:text-white tw:font-bold tw:text-xs tw:uppercase tw:tracking-widest tw:transition-all"
              >
                Register Student Account
              </Link>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 10. COMPREHENSIVE ENTERPRISE FOOTER                      */}
        {/* ======================================================== */}
        <footer className="tw:mt-auto tw:border-t tw:border-slate-800/80 tw:bg-[#050b12] tw:py-14 tw:px-4 tw:sm:px-6 tw:lg:px-8">
          <div className="tw:max-w-7xl tw:mx-auto tw:space-y-10">
            
            <div className="tw:grid tw:grid-cols-1 tw:md:grid-cols-4 tw:gap-8">
              
              {/* Col 1: Brand & Bio */}
              <div className="tw:space-y-4 tw:md:col-span-1">
                <div className="tw:flex tw:items-center tw:gap-3">
                  <img src={logo} alt="DwarPal" className="tw:h-8 tw:w-auto" />
                  <span className="tw:font-mono tw:text-base tw:font-black tw:tracking-[0.25em] tw:uppercase tw:text-white">
                    DwarPal
                  </span>
                </div>
                <p className="tw:text-xs tw:text-slate-400 tw:leading-relaxed">
                  Next-generation digital gatepass and intelligent campus physical access control platform.
                </p>
                <div className="tw:flex tw:items-center tw:gap-2 tw:text-[10px] tw:font-mono tw:text-emerald-400">
                  <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-emerald-400 tw:animate-ping" />
                  <span>ALL GATE TERMINALS ACTIVE</span>
                </div>
              </div>

              {/* Col 2: Portals */}
              <div className="tw:space-y-3">
                <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                  Portals & Access
                </p>
                <ul className="tw:space-y-2 tw:text-xs tw:text-slate-400">
                  <li><Link to="/student/login" className="hover:tw:text-cyan-400 tw:transition-colors">Student Login</Link></li>
                  <li><Link to="/faculty/login" className="hover:tw:text-cyan-400 tw:transition-colors">Faculty & Staff Login</Link></li>
                  <li><Link to="/security/login" className="hover:tw:text-cyan-400 tw:transition-colors">Gatekeeper Terminal</Link></li>
                  <li><Link to="/student/register" className="hover:tw:text-cyan-400 tw:transition-colors">Student Registration</Link></li>
                  <li><Link to="/access-portal" className="hover:tw:text-cyan-400 tw:transition-colors">Master Access Portal</Link></li>
                </ul>
              </div>

              {/* Col 3: Legal & Security */}
              <div className="tw:space-y-3">
                <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                  Compliance & Legal
                </p>
                <ul className="tw:space-y-2 tw:text-xs tw:text-slate-400">
                  <li><Link to="/privacy-policy" className="hover:tw:text-cyan-400 tw:transition-colors">Privacy Policy</Link></li>
                  <li><Link to="/privacy-policy" className="hover:tw:text-cyan-400 tw:transition-colors">Terms of Service</Link></li>
                  <li><Link to="/privacy-policy" className="hover:tw:text-cyan-400 tw:transition-colors">Cookie Preferences</Link></li>
                  <li><Link to="/support" className="hover:tw:text-cyan-400 tw:transition-colors">Helpdesk & Support</Link></li>
                </ul>
              </div>

              {/* Col 4: Emergency / Support Info */}
              <div className="tw:space-y-3">
                <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                  Campus Support
                </p>
                <p className="tw:text-xs tw:text-slate-400 tw:leading-relaxed">
                  For immediate campus checkpoint assistance or technical emergency:
                </p>
                <div className="tw:p-3 tw:rounded-xl tw:bg-slate-900/80 tw:border tw:border-slate-800 tw:space-y-1">
                  <p className="tw:text-[11px] tw:font-mono tw:text-cyan-400">helpdesk@dwarpal.campus</p>
                  <p className="tw:text-[10px] tw:font-mono tw:text-slate-500">24/7 Security Hotline</p>
                </div>
              </div>

            </div>

            {/* Bottom copyright line */}
            <div className="tw:pt-8 tw:border-t tw:border-slate-800/60 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-[11px] tw:font-mono tw:text-slate-500">
              <p>&copy; {new Date().getFullYear()} DwarPal Systems. All rights reserved.</p>
              <div className="tw:flex tw:items-center tw:gap-6">
                <span>VERSION 2.4.0</span>
                <span>SECURED WITH SHA-256</span>
              </div>
            </div>

          </div>
        </footer>
      </div>
    </div>
  )
}

