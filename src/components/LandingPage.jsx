import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  QrCode,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
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
  HelpCircle,
  Car,
  Fingerprint,
  Layers,
  UserCheck,
  Send,
  AlertCircle,
  Laptop,
  CheckCircle,
  Eye,
  RefreshCw,
  Compass,
} from 'lucide-react'
import logo from '../assets/dwarpal_logo.png'

// --- REAL-WORLD ROLE EXPERIENCES ---
const ROLES_SHOWCASE = [
  {
    id: 'students',
    role: 'Students & Hostellers',
    badge: 'Zero Friction',
    headline: 'No more standing outside faculty offices for a paper signature.',
    story:
      'Whether heading home for Diwali, attending an off-campus hackathon, or stepping out for a medical visit—submit your pass in 30 seconds from your room. Track real-time approvals and present your secure digital pass right at the gate.',
    metrics: [
      { label: 'Application Time', val: '< 30 sec' },
      { label: 'Approval Speed', val: 'Real-time' },
      { label: 'Paper Forms', val: '0 needed' },
    ],
    features: [
      'Instant digital leave request with customizable reason categories',
      'Dynamic rolling cryptographic QR code that cannot be screenshot or forwarded',
      'Live timeline updates as coordinator and HOD review your pass',
      'Automatic leave history records and personal gate logs',
    ],
    actionText: 'Student Portal Login',
    actionLink: '/student/login',
  },
  {
    id: 'faculty',
    role: 'Faculty & Class Coordinators',
    badge: '1-Tap Authority',
    headline: 'Review and sign passes without breaking your teaching flow.',
    story:
      'Gone are the days of paper registers piling up on your desk. Review student academic context, verify attendance thresholds, and approve or reject with custom feedback with a single tap from anywhere on campus.',
    metrics: [
      { label: 'Queue Time', val: 'Instant' },
      { label: 'Batch Actions', val: 'Enabled' },
      { label: 'Leave Logs', val: 'Automated' },
    ],
    features: [
      'Dedicated departmental inbox organized by semester and urgency',
      'One-tap approve, reject with remarks, or escalate to HOD / Principal',
      'Faculty leave adjustment wizard with proxy lecturer assignment',
      'Automatic instant push dispatch to student smartphone',
    ],
    actionText: 'Faculty & Staff Login',
    actionLink: '/faculty/login',
  },
  {
    id: 'security',
    role: 'Campus Security & Gatekeepers',
    badge: 'Sub-Second Turnaround',
    headline: 'Keep campus gates moving fast with zero counterfeit risk.',
    story:
      'Security officers at vehicle and pedestrian gates use our ultra-fast optical camera scanner. High-speed verification checks rolling tokens, matches vehicle numbers, and logs OUT/IN timestamps in under 800 milliseconds.',
    metrics: [
      { label: 'Scan Turnaround', val: '< 0.8 sec' },
      { label: 'Offline Sync', val: 'Buffered' },
      { label: 'Vehicle Match', val: '1-Click' },
    ],
    features: [
      'High-speed optical camera scanner with instant visual verification',
      'Manual emergency lookup by student roll number or vehicle registration',
      'One-tap OUT timestamping and automatic IN return clearance',
      'Offline cryptographic buffer ensuring validation during network drops',
    ],
    actionText: 'Gatekeeper Terminal Login',
    actionLink: '/security/login',
  },
  {
    id: 'leadership',
    role: 'Principals & Trust Leadership',
    badge: 'Institutional Intelligence',
    headline: 'Total visibility, effortless compliance, and campus safety.',
    story:
      'Gain real-time oversight over campus occupancy, cross-departmental leave trends, emergency lockdown capabilities, and automated compliance records for university accreditation.',
    metrics: [
      { label: 'Live Headcount', val: '100% Accurate' },
      { label: 'Audit Trail', val: 'Immutable' },
      { label: 'Emergency Alert', val: '1-Click' },
    ],
    features: [
      'Live campus population meters and peak gate traffic metrics',
      'Centralized student roster governance & access tier control',
      'Complete audit logs with tamper-proof cryptographic timestamps',
      'One-click emergency gate restriction and campus-wide broadcast',
    ],
    actionText: 'Administrative Workspace',
    actionLink: '/access-portal',
  },
]

// --- REAL-WORLD PROBLEM VS DWARPAL COMPARISON ---
const COMPARISON_POINTS = [
  {
    category: 'Requesting Permission',
    oldWay: 'Chasing faculty across campus between classes with paper slips.',
    dwarpalWay: 'Submit in 30 seconds from smartphone with reason and return time.',
  },
  {
    category: 'Approval Workflow',
    oldWay: 'Waiting hours outside cabins; handwritten signatures easily forged.',
    dwarpalWay: '1-tap digital approval with cryptographic timestamp and audit trail.',
  },
  {
    category: 'Security Checkpoint',
    oldWay: 'Long physical queues; guards manually scribbling in paper registers.',
    dwarpalWay: 'Sub-second optical scan with anti-screenshot dynamic QR code.',
  },
  {
    category: 'Parent & Campus Safety',
    oldWay: 'Parents have zero visibility on when their ward leaves or arrives.',
    dwarpalWay: 'Instant automated Web Push & email notifications on gate exit/entry.',
  },
]

// --- WORKFLOW PHASES ---
const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Student Requests in 30s',
    subtitle: 'From Phone or Laptop',
    description:
      'Student selects reason (Academic, Medical, Weekend Home), specifies expected return time, and enters vehicle details if applicable.',
    accent: 'tw:text-amber-400',
  },
  {
    number: '02',
    title: 'Faculty 1-Tap Sign-off',
    subtitle: 'Digital Verification',
    description:
      'Class Coordinator or HOD receives an instant alert, checks student history, and approves or remarks with a single tap.',
    accent: 'tw:text-sky-400',
  },
  {
    number: '03',
    title: 'Sub-Second Gate Scan',
    subtitle: 'Optical Terminal Check',
    description:
      'Security officer scans the animated dynamic QR code at the checkpoint. The system validates the token in under 800ms and marks OUT.',
    accent: 'tw:text-emerald-400',
  },
  {
    number: '04',
    title: 'Safe Return & Auto-Archive',
    subtitle: 'Full Ledger Record',
    description:
      'Upon return, a quick scan marks the student safely back on campus, closing the pass and updating real-time occupancy counts.',
    accent: 'tw:text-purple-400',
  },
]

// --- FREQUENTLY ASKED QUESTIONS ---
const FAQS = [
  {
    question: 'How does DwarPal prevent students from sharing screenshot gatepasses?',
    answer:
      'DwarPal uses rolling cryptographic security tokens that refresh dynamically with micro-timestamp animation. A static screenshot immediately flags as invalid at the security terminal because the token expires every few seconds.',
  },
  {
    question: 'What happens if campus Wi-Fi or cellular network drops at the gate?',
    answer:
      'The DwarPal security terminal is a resilient Progressive Web Application (PWA). It features an encrypted local buffer capable of validating valid passes offline and immediately syncing audit timestamps when connection resumes.',
  },
  {
    question: 'Can parents receive automated notifications when students exit campus?',
    answer:
      'Yes. The system automatically triggers real-time Web Push alerts and automated email notifications with exact exit and return timestamps as soon as the security guard scans the student at the gate.',
  },
  {
    question: 'How do new students get onboarded to the system?',
    answer:
      'Students can register directly via the self-service student registration portal using their institutional enrollment number, department, semester, and verified email.',
  },
  {
    question: 'What if a student’s smartphone battery dies while they are outside?',
    answer:
      'Security officers have an emergency lookup mode on the gate terminal to verify active approved passes by student enrollment ID or vehicle registration number.',
  },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeRoleIndex, setActiveRoleIndex] = useState(0)
  const [openFaq, setOpenFaq] = useState(0)

  // Interactive Live Gate Simulator State
  const [simStep, setSimStep] = useState(1) // 1: Request, 2: Approved, 3: Scanned Out, 4: Returned
  const [simIsAnimating, setSimIsAnimating] = useState(false)

  // Scroll Progress Hook
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  // Hero Parallax Scroll
  const heroRef = useRef(null)
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroCardY = useTransform(heroScroll, [0, 1], [0, 80])
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0.2])

  // Simulator step progression
  const handleSimulateNext = () => {
    if (simIsAnimating) return
    setSimIsAnimating(true)
    setTimeout(() => {
      setSimStep((prev) => (prev >= 4 ? 1 : prev + 1))
      setSimIsAnimating(false)
    }, 400)
  }

  const handleSimulateReset = () => {
    setSimStep(1)
  }

  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-[#06090e] tw:text-slate-100 tw:relative tw:overflow-x-hidden tw:selection:bg-amber-400/20 tw:selection:text-amber-200">
      
      {/* ======================================================== */}
      {/* 0. LUXURY SCROLL PROGRESS BAR                            */}
      {/* ======================================================== */}
      <motion.div
        className="tw:fixed tw:top-0 tw:left-0 tw:right-0 tw:h-[3px] tw:bg-gradient-to-r tw:from-amber-400 tw:via-sky-400 tw:to-emerald-400 tw:origin-left tw:z-[100]"
        style={{ scaleX }}
      />

      {/* ======================================================== */}
      {/* 1. BESPOKE FLOATING NAVIGATION PILL                      */}
      {/* ======================================================== */}
      <header className="tw:fixed tw:top-4 tw:left-0 tw:right-0 tw:z-50 tw:px-4 tw:sm:px-6 tw:max-w-6xl tw:mx-auto">
        <nav className="tw:flex tw:items-center tw:justify-between tw:px-5 tw:py-3.5 tw:rounded-2xl tw:bg-[#0b1118]/80 tw:backdrop-blur-2xl tw:border tw:border-white/[0.09] tw:shadow-2xl tw:shadow-black/60">
          
          {/* Brand Logo & Live Pulse */}
          <Link to="/" className="tw:flex tw:items-center tw:gap-3.5 tw:group">
            <div className="tw:relative tw:flex tw:items-center tw:justify-center">
              <img
                src={logo}
                alt="DwarPal"
                className="tw:h-9 tw:w-auto tw:object-contain tw:transition-transform tw:duration-300 group-hover:tw:scale-105"
              />
            </div>
            <div className="tw:flex tw:flex-col">
              <span className="tw:font-mono tw:text-base tw:font-black tw:tracking-[0.22em] tw:uppercase tw:text-white group-hover:tw:text-amber-300 tw:transition-colors">
                DwarPal
              </span>
              <span className="tw:text-[9px] tw:font-mono tw:tracking-widest tw:text-slate-400 tw:uppercase">
                Institutional Access
              </span>
            </div>
          </Link>

          {/* Nav Anchor Links (Desktop) */}
          <div className="tw:hidden tw:md:flex tw:items-center tw:gap-7 tw:text-xs tw:font-medium tw:tracking-wider tw:uppercase tw:text-slate-300">
            <a href="#experience" className="hover:tw:text-amber-300 tw:transition-colors">Campus Roles</a>
            <a href="#simulator" className="hover:tw:text-amber-300 tw:transition-colors">Live Simulator</a>
            <a href="#contrast" className="hover:tw:text-amber-300 tw:transition-colors">The Standard</a>
            <a href="#workflow" className="hover:tw:text-amber-300 tw:transition-colors">Workflow</a>
            <a href="#faq" className="hover:tw:text-amber-300 tw:transition-colors">FAQ</a>
          </div>

          {/* Action CTAs */}
          <div className="tw:hidden tw:sm:flex tw:items-center tw:gap-3">
            <Link
              to="/student/login"
              className="tw:px-3.5 tw:py-2 tw:text-xs tw:font-medium tw:text-slate-300 hover:tw:text-white tw:border tw:border-white/[0.08] hover:tw:border-white/20 tw:rounded-xl tw:bg-white/[0.03] hover:tw:bg-white/[0.06] tw:transition-all"
            >
              Student Login
            </Link>

            <Link
              to="/access-portal"
              className="tw:relative tw:inline-flex tw:items-center tw:gap-2 tw:px-4.5 tw:py-2 tw:text-xs tw:font-bold tw:uppercase tw:tracking-wider tw:text-slate-950 tw:rounded-xl tw:bg-gradient-to-r tw:from-amber-300 tw:via-amber-400 tw:to-amber-500 hover:tw:from-amber-200 hover:tw:to-amber-400 tw:shadow-lg tw:shadow-amber-400/20 tw:transition-all tw:duration-200"
            >
              <span>Access Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="tw:md:hidden tw:p-2 tw:rounded-xl tw:bg-white/[0.05] tw:border tw:border-white/[0.08] tw:text-slate-300 hover:tw:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="tw:md:hidden tw:mt-2 tw:p-6 tw:rounded-2xl tw:bg-[#0b1118]/95 tw:backdrop-blur-2xl tw:border tw:border-white/[0.1] tw:shadow-2xl tw:space-y-4"
            >
              <div className="tw:flex tw:flex-col tw:space-y-3 tw:text-xs tw:font-bold tw:uppercase tw:tracking-widest tw:text-slate-300">
                <a href="#experience" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-amber-300">Campus Roles</a>
                <a href="#simulator" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-amber-300">Live Simulator</a>
                <a href="#contrast" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-amber-300">The Standard</a>
                <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-amber-300">Workflow</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:tw:text-amber-300">FAQ</a>
              </div>

              <div className="tw:pt-4 tw:border-t tw:border-white/[0.08] tw:grid tw:grid-cols-2 tw:gap-3">
                <Link
                  to="/student/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="tw:text-center tw:py-3 tw:text-xs tw:font-medium tw:rounded-xl tw:bg-white/[0.04] tw:border tw:border-white/[0.08] tw:text-slate-200"
                >
                  Student Login
                </Link>
                <Link
                  to="/faculty/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="tw:text-center tw:py-3 tw:text-xs tw:font-medium tw:rounded-xl tw:bg-white/[0.04] tw:border tw:border-white/[0.08] tw:text-slate-200"
                >
                  Faculty Login
                </Link>
              </div>

              <Link
                to="/access-portal"
                onClick={() => setMobileMenuOpen(false)}
                className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:w-full tw:py-3.5 tw:text-xs tw:font-bold tw:uppercase tw:tracking-wider tw:text-slate-950 tw:rounded-xl tw:bg-amber-400 tw:shadow-md"
              >
                <span>Launch Access Portal</span>
                <ArrowRight size={14} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ======================================================== */}
      {/* 2. BESPOKE HERO SECTION (Editorial Luxury)               */}
      {/* ======================================================== */}
      <section
        ref={heroRef}
        className="tw:relative tw:pt-36 tw:pb-24 tw:lg:pt-48 tw:lg:pb-36 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full"
      >
        {/* Subtle Luxury Atmospheric Backdrops */}
        <div className="tw:absolute tw:top-1/4 tw:left-1/2 tw:-translate-x-1/2 tw:w-[700px] tw:h-[350px] tw:bg-gradient-to-b tw:from-amber-500/[0.06] tw:via-sky-500/[0.04] tw:to-transparent tw:rounded-full tw:blur-[130px] tw:pointer-events-none" />

        <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-12 tw:gap-12 tw:lg:gap-8 tw:items-center">
          
          {/* Hero Content Left */}
          <div className="tw:lg:col-span-7 tw:space-y-8 tw:text-center tw:lg:text-left">
            
            {/* Status Pill */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="tw:inline-flex tw:items-center tw:gap-2.5 tw:px-4 tw:py-2 tw:rounded-full tw:bg-[#0f1722]/80 tw:border tw:border-white/[0.09] tw:shadow-lg"
            >
              <span className="tw:h-2 tw:w-2 tw:rounded-full tw:bg-emerald-400 tw:animate-pulse" />
              <span className="tw:text-xs tw:font-mono tw:tracking-wider tw:text-slate-300">
                Institutional Campus Gatepass Standard
              </span>
            </motion.div>

            {/* Editorial Main Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="tw:space-y-4"
            >
              <h1 className="tw:text-4xl tw:sm:text-5xl tw:lg:text-6xl tw:font-black tw:tracking-tight tw:leading-[1.08] tw:text-white">
                Campus Freedom,{' '}
                <span className="tw:text-transparent tw:bg-clip-text tw:bg-gradient-to-r tw:from-amber-300 tw:via-amber-400 tw:to-amber-500">
                  Institutional Trust
                </span>{' '}
                — Automated.
              </h1>
              <p className="tw:text-base tw:sm:text-lg tw:text-slate-300 tw:max-w-xl tw:mx-auto tw:lg:mx-0 tw:leading-relaxed tw:font-normal">
                DwarPal replaces handwritten register queues, paper slips, and delayed sign-offs with seamless 30-second digital requests, 1-tap faculty reviews, and sub-second optical gate validation.
              </p>
            </motion.div>

            {/* Primary Action Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:lg:justify-start tw:gap-4"
            >
              <Link
                to="/access-portal"
                className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-gradient-to-r tw:from-amber-400 tw:via-amber-400 tw:to-amber-500 hover:tw:from-amber-300 hover:tw:to-amber-400 tw:text-slate-950 tw:font-black tw:text-xs tw:uppercase tw:tracking-widest tw:shadow-xl tw:shadow-amber-400/20 hover:tw:shadow-amber-400/30 tw:transition-all tw:duration-200 tw:flex tw:items-center tw:justify-center tw:gap-3"
              >
                <span>Launch Access Portal</span>
                <ArrowRight size={16} />
              </Link>

              <a
                href="#simulator"
                className="tw:w-full tw:sm:w-auto tw:px-6 tw:py-4 tw:rounded-xl tw:bg-white/[0.04] hover:tw:bg-white/[0.08] tw:border tw:border-white/[0.1] hover:tw:border-white/20 tw:text-slate-200 hover:tw:text-white tw:font-semibold tw:text-xs tw:uppercase tw:tracking-wider tw:transition-all tw:flex tw:items-center tw:justify-center tw:gap-2.5"
              >
                <Compass size={16} className="tw:text-amber-400" />
                <span>Test Live Simulator</span>
              </a>
            </motion.div>

            {/* Student Registration Prompt */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="tw:flex tw:items-center tw:justify-center tw:lg:justify-start tw:gap-2 tw:text-xs tw:text-slate-400"
            >
              <span>Enrolled this academic year?</span>
              <Link
                to="/student/register"
                className="tw:text-amber-400 hover:tw:text-amber-300 tw:font-semibold tw:underline tw:underline-offset-4 tw:transition-colors"
              >
                Register Your Student Account &rarr;
              </Link>
            </motion.div>
          </div>

          {/* Hero Visual Right: 3D Holographic Pass Preview */}
          <motion.div
            style={{ y: heroCardY, opacity: heroOpacity }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="tw:lg:col-span-5 tw:relative tw:flex tw:justify-center"
          >
            {/* Ambient Card Glow */}
            <div className="tw:relative tw:w-full tw:max-w-md">
              
              {/* Luxury Floating Security Seal */}
              <div className="tw:absolute tw:-top-5 tw:-left-4 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:px-3.5 tw:py-1.5 tw:rounded-xl tw:bg-[#0c141e]/90 tw:backdrop-blur-xl tw:border tw:border-white/[0.12] tw:shadow-xl">
                <ShieldCheck size={14} className="tw:text-emerald-400" />
                <span className="tw:text-[11px] tw:font-mono tw:text-slate-200">
                  TAMPER-PROOF TOKEN
                </span>
              </div>

              {/* Luxury Pass Card */}
              <div className="tw:rounded-3xl tw:p-6 tw:bg-gradient-to-b tw:from-[#0d1622] tw:via-[#09101a] tw:to-[#060a10] tw:border tw:border-white/[0.12] tw:shadow-2xl tw:shadow-black/90 tw:space-y-5 tw:relative tw:overflow-hidden">
                
                {/* Gold Accent Rim */}
                <div className="tw:absolute tw:top-0 tw:left-0 tw:right-0 tw:h-[2px] tw:bg-gradient-to-r tw:from-amber-400/80 tw:via-emerald-400/80 tw:to-sky-400/80" />

                {/* Card Top: Student Profile */}
                <div className="tw:flex tw:items-center tw:justify-between tw:pt-1">
                  <div className="tw:flex tw:items-center tw:gap-3">
                    <div className="tw:h-12 tw:w-12 tw:rounded-2xl tw:bg-gradient-to-tr tw:from-amber-400/20 tw:to-amber-500/10 tw:border tw:border-amber-400/30 tw:flex tw:items-center tw:justify-center tw:text-amber-300 tw:font-bold tw:text-sm">
                      AV
                    </div>
                    <div>
                      <h3 className="tw:font-bold tw:text-white tw:text-sm">Aryan Verma</h3>
                      <p className="tw:text-xs tw:text-slate-400">Roll: 2024-CS-042 • B.Tech CSE</p>
                    </div>
                  </div>

                  <span className="tw:px-3 tw:py-1 tw:rounded-full tw:bg-emerald-500/15 tw:border tw:border-emerald-500/30 tw:text-[10px] tw:font-mono tw:font-bold tw:text-emerald-300">
                    APPROVED
                  </span>
                </div>

                {/* Dynamic QR Display with Laser Scanner */}
                <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:p-5 tw:rounded-2xl tw:bg-black/50 tw:border tw:border-white/[0.06] tw:relative">
                  <div className="tw:relative tw:p-3 tw:rounded-xl tw:bg-white tw:shadow-inner">
                    <QrCode size={120} className="tw:text-slate-950" />
                    
                    {/* Animated Scanning Laser */}
                    <motion.div
                      animate={{ top: ['8%', '88%', '8%'] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                      className="tw:absolute tw:left-2 tw:right-2 tw:h-[2px] tw:bg-gradient-to-r tw:from-transparent tw:via-amber-500 tw:to-transparent tw:shadow-[0_0_8px_#f59e0b]"
                    />
                  </div>

                  <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-[10px] tw:font-mono tw:text-amber-300/90">
                    <Clock size={12} />
                    <span>EXPIRING IN 02:35:10 • GATE 01</span>
                  </div>
                </div>

                {/* Meta details */}
                <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:text-xs tw:font-mono tw:bg-white/[0.02] tw:p-3.5 tw:rounded-xl tw:border tw:border-white/[0.05]">
                  <div>
                    <span className="tw:text-slate-400 tw:text-[10px] tw:block">OUT TIME</span>
                    <span className="tw:font-bold tw:text-white">Today, 14:30 IST</span>
                  </div>
                  <div>
                    <span className="tw:text-slate-400 tw:text-[10px] tw:block">RETURN BY</span>
                    <span className="tw:font-bold tw:text-white">Today, 19:00 IST</span>
                  </div>
                  <div className="tw:col-span-2">
                    <span className="tw:text-slate-400 tw:text-[10px] tw:block">REASON / DESTINATION</span>
                    <span className="tw:text-slate-200">Inter-University Robotics Meet</span>
                  </div>
                </div>

                {/* Gate Security Scan Stamp */}
                <div className="tw:flex tw:items-center tw:justify-between tw:px-3.5 tw:py-2.5 tw:rounded-xl tw:bg-emerald-950/30 tw:border tw:border-emerald-500/20 tw:text-xs">
                  <div className="tw:flex tw:items-center tw:gap-2 tw:text-emerald-400">
                    <CheckCircle2 size={15} />
                    <span className="tw:font-semibold">Security Check Passed</span>
                  </div>
                  <span className="tw:text-[10px] tw:font-mono tw:text-slate-400">Main Gate 01</span>
                </div>

              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. INTERACTIVE LIVE GATE SIMULATOR (Tangible Experience) */}
      {/* ======================================================== */}
      <section
        id="simulator"
        className="tw:py-20 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full"
      >
        <div className="tw:rounded-3xl tw:p-8 tw:lg:p-12 tw:bg-gradient-to-b tw:from-[#0d1520] tw:to-[#070c12] tw:border tw:border-white/[0.1] tw:shadow-2xl tw:shadow-black/80 tw:space-y-8">
          
          {/* Simulator Header */}
          <div className="tw:flex tw:flex-col tw:md:flex-row tw:md:items-end tw:justify-between tw:gap-4 tw:border-b tw:border-white/[0.08] tw:pb-6">
            <div className="tw:space-y-2">
              <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-amber-400/10 tw:border tw:border-amber-400/20 tw:text-amber-300 tw:text-xs tw:font-mono tw:uppercase">
                <Sparkles size={13} />
                <span>Interactive Demonstration</span>
              </div>
              <h2 className="tw:text-2xl tw:sm:text-3xl tw:font-bold tw:text-white">
                Experience the 4-Stage Gatepass Lifecycle
              </h2>
              <p className="tw:text-xs tw:sm:text-sm tw:text-slate-300">
                Click through each step below to simulate how students, faculty approvers, and gate security interact in real time.
              </p>
            </div>

            <div className="tw:flex tw:items-center tw:gap-3">
              <button
                type="button"
                onClick={handleSimulateNext}
                disabled={simIsAnimating}
                className="tw:px-5 tw:py-2.5 tw:rounded-xl tw:bg-amber-400 hover:tw:bg-amber-300 tw:text-slate-950 tw:font-bold tw:text-xs tw:uppercase tw:tracking-wider tw:transition-all tw:shadow-md tw:flex tw:items-center tw:gap-2"
              >
                <span>Advance Step</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleSimulateReset}
                className="tw:p-2.5 tw:rounded-xl tw:bg-white/[0.05] hover:tw:bg-white/[0.1] tw:border tw:border-white/[0.08] tw:text-slate-300"
                title="Reset simulation"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Simulator Step Progress Tracker */}
          <div className="tw:grid tw:grid-cols-4 tw:gap-2 tw:text-center">
            {[
              { num: 1, label: '1. Request Created' },
              { num: 2, label: '2. Faculty Approved' },
              { num: 3, label: '3. Gate OUT Verified' },
              { num: 4, label: '4. Safe Return Logged' },
            ].map((st) => (
              <button
                key={st.num}
                type="button"
                onClick={() => setSimStep(st.num)}
                className={`tw:py-3 tw:px-2 tw:rounded-xl tw:text-xs tw:font-mono tw:transition-all tw:border ${
                  simStep === st.num
                    ? 'tw:bg-amber-400/15 tw:border-amber-400/40 tw:text-amber-300 tw:font-bold'
                    : simStep > st.num
                      ? 'tw:bg-emerald-500/10 tw:border-emerald-500/30 tw:text-emerald-400'
                      : 'tw:bg-white/[0.02] tw:border-white/[0.05] tw:text-slate-400'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Simulator Visual Preview: Two Screen Split */}
          <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-2 tw:gap-6 tw:pt-2">
            
            {/* Screen 1: Student Phone Screen Simulation */}
            <div className="tw:rounded-2xl tw:p-6 tw:bg-black/60 tw:border tw:border-white/[0.08] tw:space-y-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-mono tw:text-slate-400 tw:border-b tw:border-white/[0.06] tw:pb-3">
                <span className="tw:flex tw:items-center tw:gap-1.5">
                  <Smartphone size={14} className="tw:text-amber-400" />
                  Student Mobile View
                </span>
                <span className="tw:text-slate-300">DwarPal Student App</span>
              </div>

              <div className="tw:p-4 tw:rounded-xl tw:bg-white/[0.02] tw:border tw:border-white/[0.05] tw:space-y-3">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <span className="tw:text-xs tw:font-bold tw:text-white">Gatepass #DP-2024-881</span>
                  {simStep === 1 && (
                    <span className="tw:px-2.5 tw:py-0.5 tw:rounded-full tw:bg-amber-400/20 tw:text-amber-300 tw:text-[10px] tw:font-mono">
                      PENDING REVIEW
                    </span>
                  )}
                  {simStep >= 2 && (
                    <span className="tw:px-2.5 tw:py-0.5 tw:rounded-full tw:bg-emerald-500/20 tw:text-emerald-300 tw:text-[10px] tw:font-mono">
                      DIGITALLY SIGNED
                    </span>
                  )}
                </div>

                <p className="tw:text-xs tw:text-slate-300">
                  {simStep === 1 && 'Your pass request has been sent to Class Coordinator Dr. Sharma.'}
                  {simStep === 2 && 'Approved! Show your live QR code to the guard at the campus gate.'}
                  {simStep === 3 && 'Currently OUT of campus. Please return before 19:00 IST.'}
                  {simStep === 4 && 'Pass completed. Safe return recorded in institutional ledger.'}
                </p>

                {simStep >= 2 && (
                  <div className="tw:flex tw:items-center tw:justify-center tw:py-2">
                    <div className="tw:p-2.5 tw:rounded-xl tw:bg-white tw:shadow-md">
                      <QrCode size={80} className="tw:text-slate-950" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Screen 2: Security Gate Terminal Simulation */}
            <div className="tw:rounded-2xl tw:p-6 tw:bg-black/60 tw:border tw:border-white/[0.08] tw:space-y-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-mono tw:text-slate-400 tw:border-b tw:border-white/[0.06] tw:pb-3">
                <span className="tw:flex tw:items-center tw:gap-1.5">
                  <Laptop size={14} className="tw:text-emerald-400" />
                  Gate Terminal #01 (Main Exit)
                </span>
                <span className="tw:text-emerald-400">SCANNER ONLINE</span>
              </div>

              <div className="tw:p-4 tw:rounded-xl tw:bg-white/[0.02] tw:border tw:border-white/[0.05] tw:space-y-3">
                <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                  <span className="tw:text-slate-400">Student ID:</span>
                  <span className="tw:font-mono tw:text-white">2024-CS-042 (Aryan Verma)</span>
                </div>

                <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                  <span className="tw:text-slate-400">Gate Action:</span>
                  <span className="tw:font-mono tw:text-amber-300">
                    {simStep <= 2 && 'Awaiting Student at Checkpoint'}
                    {simStep === 3 && 'VERIFIED OUT (14:32 IST)'}
                    {simStep === 4 && 'VERIFIED IN (18:45 IST)'}
                  </span>
                </div>

                <div className="tw:flex tw:items-center tw:justify-between tw:text-xs">
                  <span className="tw:text-slate-400">Parent Notification:</span>
                  <span className="tw:font-mono tw:text-emerald-400">
                    {simStep <= 2 ? 'Standby' : 'Dispatched via Push & SMS'}
                  </span>
                </div>

                <div className="tw:pt-2 tw:border-t tw:border-white/[0.06] tw:flex tw:items-center tw:justify-between tw:text-[11px]">
                  <span className="tw:text-slate-400">Optical Validation Latency:</span>
                  <span className="tw:text-emerald-400 tw:font-mono tw:font-bold">0.68 seconds</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. THE CONTRAST: OLD CHAOS VS DWARPAL STANDARD          */}
      {/* ======================================================== */}
      <section
        id="contrast"
        className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full"
      >
        <div className="tw:text-center tw:max-w-2xl tw:mx-auto tw:space-y-3 tw:mb-14">
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-sky-500/10 tw:border tw:border-sky-500/20 tw:text-sky-300 tw:text-xs tw:font-mono tw:uppercase">
            <Layers size={13} />
            <span>The Institutional Difference</span>
          </div>
          <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
            Why Modern Campuses Are Retiring Paper Passes
          </h2>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:md:grid-cols-2 tw:gap-6">
          {COMPARISON_POINTS.map((pt, i) => (
            <div
              key={i}
              className="tw:p-7 tw:rounded-3xl tw:bg-[#0c131d]/90 tw:border tw:border-white/[0.08] tw:space-y-5"
            >
              <h3 className="tw:text-base tw:font-bold tw:text-white tw:border-b tw:border-white/[0.06] tw:pb-3">
                {pt.category}
              </h3>

              {/* The Old Way */}
              <div className="tw:flex tw:items-start tw:gap-3 tw:text-xs tw:text-rose-300/80 tw:bg-rose-950/20 tw:p-3.5 tw:rounded-xl tw:border tw:border-rose-900/30">
                <X size={16} className="tw:text-rose-400 tw:flex-shrink-0 tw:mt-0.5" />
                <div>
                  <span className="tw:font-bold tw:block tw:text-rose-200 tw:mb-0.5">The Legacy Problem</span>
                  {pt.oldWay}
                </div>
              </div>

              {/* The DwarPal Way */}
              <div className="tw:flex tw:items-start tw:gap-3 tw:text-xs tw:text-emerald-300/90 tw:bg-emerald-950/20 tw:p-3.5 tw:rounded-xl tw:border tw:border-emerald-900/30">
                <Check size={16} className="tw:text-emerald-400 tw:flex-shrink-0 tw:mt-0.5" />
                <div>
                  <span className="tw:font-bold tw:block tw:text-emerald-200 tw:mb-0.5">The DwarPal Standard</span>
                  {pt.dwarpalWay}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. ROLE-BASED CAMPUS WORKSPACES                         */}
      {/* ======================================================== */}
      <section
        id="experience"
        className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full"
      >
        <div className="tw:text-center tw:max-w-2xl tw:mx-auto tw:space-y-3 tw:mb-12">
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-purple-500/10 tw:border tw:border-purple-500/20 tw:text-purple-300 tw:text-xs tw:font-mono tw:uppercase">
            <Users size={13} />
            <span>Persona-Tailored UI</span>
          </div>
          <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
            Crafted for Everyone on Campus
          </h2>
        </div>

        {/* Tab Buttons */}
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:flex-wrap tw:mb-8">
          {ROLES_SHOWCASE.map((r, idx) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRoleIndex(idx)}
              className={`tw:px-5 tw:py-2.5 tw:rounded-xl tw:text-xs tw:font-bold tw:uppercase tw:tracking-wider tw:transition-all ${
                activeRoleIndex === idx
                  ? 'tw:bg-amber-400 tw:text-slate-950 tw:shadow-lg tw:shadow-amber-400/20'
                  : 'tw:bg-white/[0.04] hover:tw:bg-white/[0.08] tw:text-slate-300 tw:border tw:border-white/[0.06]'
              }`}
            >
              {r.role}
            </button>
          ))}
        </div>

        {/* Active Role Card */}
        {(() => {
          const role = ROLES_SHOWCASE[activeRoleIndex]
          return (
            <div className="tw:rounded-3xl tw:p-8 tw:lg:p-12 tw:bg-gradient-to-b tw:from-[#0d1622] tw:to-[#070c14] tw:border tw:border-white/[0.1] tw:shadow-2xl tw:space-y-8">
              <div className="tw:grid tw:grid-cols-1 tw:lg:grid-cols-12 tw:gap-8 tw:items-center">
                
                <div className="tw:lg:col-span-7 tw:space-y-5">
                  <span className="tw:px-3 tw:py-1 tw:rounded-md tw:bg-amber-400/10 tw:text-amber-300 tw:text-xs tw:font-mono">
                    {role.badge}
                  </span>

                  <h3 className="tw:text-2xl tw:sm:text-3xl tw:font-bold tw:text-white">
                    {role.headline}
                  </h3>

                  <p className="tw:text-xs tw:sm:text-sm tw:text-slate-300 tw:leading-relaxed">
                    {role.story}
                  </p>

                  <div className="tw:space-y-2.5 tw:pt-2">
                    {role.features.map((feat, i) => (
                      <div key={i} className="tw:flex tw:items-start tw:gap-3 tw:text-xs tw:text-slate-200">
                        <Check size={14} className="tw:text-amber-400 tw:mt-0.5 tw:flex-shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tw:pt-4">
                    <Link
                      to={role.actionLink}
                      className="tw:inline-flex tw:items-center tw:gap-2 tw:px-6 tw:py-3.5 tw:rounded-xl tw:bg-amber-400 hover:tw:bg-amber-300 tw:text-slate-950 tw:font-black tw:text-xs tw:uppercase tw:tracking-wider tw:shadow-md tw:transition-all"
                    >
                      <span>{role.actionText}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Metrics Box Right */}
                <div className="tw:lg:col-span-5 tw:space-y-4">
                  <div className="tw:grid tw:grid-cols-1 tw:gap-3">
                    {role.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="tw:p-5 tw:rounded-2xl tw:bg-black/50 tw:border tw:border-white/[0.08] tw:flex tw:items-center tw:justify-between"
                      >
                        <span className="tw:text-xs tw:text-slate-400">{m.label}</span>
                        <span className="tw:text-base tw:font-mono tw:font-bold tw:text-amber-300">
                          {m.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )
        })()}
      </section>

      {/* ======================================================== */}
      {/* 6. STEP-BY-STEP WORKFLOW TIMELINE                        */}
      {/* ======================================================== */}
      <section
        id="workflow"
        className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full"
      >
        <div className="tw:text-center tw:max-w-2xl tw:mx-auto tw:space-y-3 tw:mb-16">
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-emerald-500/10 tw:border tw:border-emerald-500/20 tw:text-emerald-300 tw:text-xs tw:font-mono tw:uppercase">
            <Zap size={13} />
            <span>Intuitive Progression</span>
          </div>
          <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
            How a Gatepass Moves in 4 Natural Steps
          </h2>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:gap-6">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.number}
              className="tw:p-6 tw:rounded-3xl tw:bg-[#0c141e]/90 tw:border tw:border-white/[0.08] tw:space-y-4 tw:relative"
            >
              <div className="tw:flex tw:items-center tw:justify-between">
                <span className={`tw:font-mono tw:text-2xl tw:font-black ${step.accent}`}>
                  {step.number}
                </span>
                <span className="tw:text-[10px] tw:font-mono tw:text-slate-400 tw:uppercase">
                  {step.subtitle}
                </span>
              </div>

              <h3 className="tw:text-base tw:font-bold tw:text-white">{step.title}</h3>
              <p className="tw:text-xs tw:text-slate-300 tw:leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. FREQUENTLY ASKED QUESTIONS (Accordion)                */}
      {/* ======================================================== */}
      <section
        id="faq"
        className="tw:py-24 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-4xl tw:mx-auto tw:w-full"
      >
        <div className="tw:text-center tw:space-y-3 tw:mb-12">
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3 tw:py-1 tw:rounded-full tw:bg-amber-400/10 tw:border tw:border-amber-400/20 tw:text-amber-300 tw:text-xs tw:font-mono tw:uppercase">
            <HelpCircle size={13} />
            <span>Clarity & Answers</span>
          </div>
          <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white tw:tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="tw:space-y-3.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="tw:rounded-2xl tw:bg-[#0b121a]/90 tw:border tw:border-white/[0.08] hover:tw:border-white/[0.14] tw:transition-colors tw:overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                  className="tw:w-full tw:p-5 tw:text-left tw:flex tw:items-center tw:justify-between tw:gap-4"
                >
                  <span className="tw:font-bold tw:text-white tw:text-sm">{faq.question}</span>
                  <ChevronDown
                    size={17}
                    className={`tw:text-amber-400 tw:transition-transform tw:duration-300 tw:flex-shrink-0 ${
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
                      className="tw:px-5 tw:pb-5 tw:text-xs tw:sm:text-sm tw:text-slate-300 tw:leading-relaxed tw:border-t tw:border-white/[0.06] tw:pt-3.5"
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. LUXURY BOTTOM CALL-TO-ACTION                          */}
      {/* ======================================================== */}
      <section className="tw:py-16 tw:px-4 tw:sm:px-6 tw:lg:px-8 tw:max-w-6xl tw:mx-auto tw:w-full">
        <div className="tw:relative tw:rounded-3xl tw:p-10 tw:sm:p-14 tw:bg-gradient-to-r tw:from-[#111e2f] tw:via-[#0c1420] tw:to-[#080d14] tw:border tw:border-amber-400/30 tw:shadow-2xl tw:text-center tw:space-y-6">
          <div className="tw:max-w-xl tw:mx-auto tw:space-y-3">
            <h2 className="tw:text-3xl tw:sm:text-4xl tw:font-black tw:text-white">
              Modernize Your Campus Checkpoints
            </h2>
            <p className="tw:text-xs tw:sm:text-sm tw:text-slate-300">
              Join leading colleges and institutions adopting DwarPal for zero-friction student movement and airtight campus accountability.
            </p>
          </div>

          <div className="tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:gap-4">
            <Link
              to="/access-portal"
              className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-amber-400 hover:tw:bg-amber-300 tw:text-slate-950 tw:font-black tw:text-xs tw:uppercase tw:tracking-widest tw:shadow-lg tw:transition-all tw:flex tw:items-center tw:justify-center tw:gap-2"
            >
              <span>Enter Access Portal</span>
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/student/register"
              className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-4 tw:rounded-xl tw:bg-white/[0.05] hover:tw:bg-white/[0.1] tw:border tw:border-white/[0.12] tw:text-white tw:font-bold tw:text-xs tw:uppercase tw:tracking-widest tw:transition-all"
            >
              Student Self-Registration
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 9. REFINED BESPOKE INSTITUTIONAL FOOTER                  */}
      {/* ======================================================== */}
      <footer className="tw:mt-auto tw:border-t tw:border-white/[0.08] tw:bg-[#04070b] tw:py-14 tw:px-4 tw:sm:px-6 tw:lg:px-8">
        <div className="tw:max-w-6xl tw:mx-auto tw:space-y-10">
          
          <div className="tw:grid tw:grid-cols-1 tw:md:grid-cols-4 tw:gap-8">
            
            {/* Column 1: Identity */}
            <div className="tw:space-y-3.5 tw:md:col-span-1">
              <div className="tw:flex tw:items-center tw:gap-3">
                <img src={logo} alt="DwarPal" className="tw:h-8 tw:w-auto" />
                <span className="tw:font-mono tw:text-base tw:font-black tw:tracking-[0.22em] tw:uppercase tw:text-white">
                  DwarPal
                </span>
              </div>
              <p className="tw:text-xs tw:text-slate-400 tw:leading-relaxed">
                Institutional digital gatepass and physical access management platform.
              </p>
              <div className="tw:flex tw:items-center tw:gap-2 tw:text-[10px] tw:font-mono tw:text-emerald-400">
                <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-emerald-400 tw:animate-ping" />
                <span>ALL GATES SYNCHRONIZED</span>
              </div>
            </div>

            {/* Column 2: Portals */}
            <div className="tw:space-y-2.5">
              <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                Access Portals
              </p>
              <ul className="tw:space-y-1.5 tw:text-xs tw:text-slate-400">
                <li><Link to="/student/login" className="hover:tw:text-amber-300 tw:transition-colors">Student Login</Link></li>
                <li><Link to="/faculty/login" className="hover:tw:text-amber-300 tw:transition-colors">Faculty Login</Link></li>
                <li><Link to="/security/login" className="hover:tw:text-amber-300 tw:transition-colors">Security Terminal</Link></li>
                <li><Link to="/student/register" className="hover:tw:text-amber-300 tw:transition-colors">Student Registration</Link></li>
                <li><Link to="/access-portal" className="hover:tw:text-amber-300 tw:transition-colors">Master Workspace</Link></li>
              </ul>
            </div>

            {/* Column 3: Institutional Compliance */}
            <div className="tw:space-y-2.5">
              <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                Compliance & Legal
              </p>
              <ul className="tw:space-y-1.5 tw:text-xs tw:text-slate-400">
                <li><Link to="/privacy-policy" className="hover:tw:text-amber-300 tw:transition-colors">Privacy Policy</Link></li>
                <li><Link to="/privacy-policy" className="hover:tw:text-amber-300 tw:transition-colors">Campus Data Security</Link></li>
                <li><Link to="/privacy-policy" className="hover:tw:text-amber-300 tw:transition-colors">Cookie Preferences</Link></li>
                <li><Link to="/support" className="hover:tw:text-amber-300 tw:transition-colors">Helpdesk & Support</Link></li>
              </ul>
            </div>

            {/* Column 4: Emergency Contacts */}
            <div className="tw:space-y-2.5">
              <p className="tw:text-xs tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase tw:text-slate-300">
                Checkpoint Support
              </p>
              <p className="tw:text-xs tw:text-slate-400 tw:leading-relaxed">
                For immediate gate terminal technical assistance:
              </p>
              <div className="tw:p-3 tw:rounded-xl tw:bg-white/[0.03] tw:border tw:border-white/[0.08] tw:space-y-1">
                <p className="tw:text-[11px] tw:font-mono tw:text-amber-300">support@dwarpal.campus</p>
                <p className="tw:text-[10px] tw:font-mono tw:text-slate-500">24/7 Security Operations</p>
              </div>
            </div>

          </div>

          {/* Footer Bottom Bar */}
          <div className="tw:pt-8 tw:border-t tw:border-white/[0.06] tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-[11px] tw:font-mono tw:text-slate-500">
            <p>&copy; {new Date().getFullYear()} DwarPal Institutional Systems. All rights reserved.</p>
            <div className="tw:flex tw:items-center tw:gap-6">
              <span>SYSTEM RELEASE v2.4</span>
              <span>TLS 1.3 ENCRYPTED</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  )
}


