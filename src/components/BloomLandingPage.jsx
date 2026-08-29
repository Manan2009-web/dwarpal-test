import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useSiteConfig } from './SiteConfigContext'

// Import generated 3D visual assets
import heroMeadowImg from '../assets/hero_meadow.jpg'
import cardFlowerImg from '../assets/card_flower.jpg'
import campusTempleImg from '../assets/campus_temple.jpg'

// --- INSTITUTIONAL TRUST LOGOS ---
const TRUST_PARTNERS = [
  'National Campus Council',
  'EduTrust Alliance',
  'CampusSec Global',
  'UniAccess Labs',
  'SmartColleges Network',
  'HigherEd Compliance',
]

// --- USE CASES DATA ---
const USE_CASES = [
  {
    id: 'faculty',
    title: 'Academic Departments & Faculty',
    subtitle: 'Streamlined Approval Hierarchy',
    description:
      'Empower faculty advisors, class coordinators, and HODs to review student leave requests with complete academic context, instant 1-tap approvals, and proxy assignment.',
    linkText: 'Learn about faculty tools',
    linkHref: '/faculty/login',
  },
  {
    id: 'security',
    title: 'Campus Security & Gate Checkpoints',
    subtitle: 'Sub-Second Optical Terminal Verification',
    description:
      'Equip security officers at vehicle and pedestrian gates with instant camera scanning, vehicle plate verification, emergency manual lookup, and offline sync.',
    linkText: 'Explore security terminal',
    linkHref: '/security/login',
  },
  {
    id: 'students',
    title: 'Students & Hostel Residents',
    subtitle: 'Frictionless Digital Pass Generation',
    description:
      'Submit passes in 30 seconds from your smartphone. Carry a tamper-proof rolling dynamic QR code and receive instant push notifications upon review.',
    linkText: 'Student registration portal',
    linkHref: '/student/register',
  },
]

// --- FAQS ---
const FAQS = [
  {
    q: 'How does the dynamic QR token prevent screenshot sharing?',
    a: 'DwarPal gatepasses use cryptographic rotating tokens that refresh every few seconds with an animated security watermark. A static screenshot immediately flags as expired and invalid at the gate scanner terminal.',
  },
  {
    q: 'What happens if the campus Wi-Fi or cellular network is offline at the gate?',
    a: 'The gate terminal runs as an offline-first Progressive Web Application (PWA). It verifies valid signed tokens locally and syncs all entry/exit audit logs the moment connectivity is restored.',
  },
  {
    q: 'Can parents receive automated notifications when a student checks out?',
    a: 'Yes. As soon as the checkpoint officer scans the pass, the platform automatically triggers Web Push alerts and automated email notifications with the exact timestamp.',
  },
  {
    q: 'How do students get onboarded to DwarPal?',
    a: 'Students can register in under two minutes via the self-service registration portal (/student/register) using their college enrollment number, department, semester, and official email.',
  },
]

export default function BloomLandingPage() {
  const { config } = useSiteConfig()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeUseCase, setActiveUseCase] = useState(0)
  const [openFaq, setOpenFaq] = useState(0)
  const [logoClicks, setLogoClicks] = useState(0)

  const handleLogoClick = (e) => {
    const next = logoClicks + 1
    if (next >= 5) {
      e.preventDefault()
      window.location.href = '/master-control'
      return
    }
    setLogoClicks(next)
    setTimeout(() => setLogoClicks(0), 3000)
  }

  const activeFaqs = (config?.cms?.faqs && config.cms.faqs.length > 0)
    ? config.cms.faqs.map((f) => ({ q: f.question, a: f.answer }))
    : FAQS

  return (
    <div
      className="tw:min-h-screen tw:w-full tw:py-6 tw:sm:tw:py-12 tw:px-3 tw:sm:tw:px-6 tw:flex tw:flex-col tw:items-center tw:justify-center tw:relative tw:overflow-x-hidden"
      style={{
        backgroundColor: '#95a1b3',
        backgroundImage: `radial-gradient(circle at 15% 15%, rgba(255, 255, 255, 0.25), transparent 45%), radial-gradient(circle at 85% 85%, rgba(130, 115, 175, 0.35), transparent 50%), linear-gradient(135deg, #8a96a8 0%, #a2aebf 50%, #9088a8 100%)`,
      }}
    >
      {/* ======================================================== */}
      {/* MAIN FLOATING WHITE CARD CONTAINER (BloomFi Style)      */}
      {/* ======================================================== */}
      <div className="tw:w-full tw:max-w-5xl tw:bg-[#fcfdfd] tw:rounded-[32px] tw:sm:tw:rounded-[44px] tw:shadow-[0_25px_80px_-15px_rgba(20,25,40,0.35)] tw:border tw:border-white/80 tw:overflow-hidden tw:relative tw:z-10 tw:text-[#181926]">
        
        {/* ======================================================== */}
        {/* 1. HEADER / NAVBAR                                       */}
        {/* ======================================================== */}
        <header className="tw:w-full tw:px-6 tw:sm:tw:px-10 tw:pt-7 tw:pb-5 tw:flex tw:items-center tw:justify-between tw:border-b tw:border-neutral-100">
          
          {/* Brand Logo */}
          <Link to="/" onClick={handleLogoClick} className="tw:flex tw:items-center tw:gap-2.5 tw:group">
            <span className="tw:text-lg tw:font-black tw:text-[#181926]">✦</span>
            <span className="tw:text-lg tw:font-bold tw:tracking-tight tw:text-[#181926] group-hover:tw:text-[#4f46e5] tw:transition-colors">
              {config?.cms?.branding?.siteTitle?.split('—')[0]?.trim() || 'DwarPal'}
            </span>
          </Link>


          {/* Desktop Navigation Links */}
          <nav className="tw:hidden tw:md:tw:flex tw:items-center tw:gap-8 tw:text-xs tw:font-medium tw:text-neutral-600">
            <a href="#about" className="hover:tw:text-[#181926] tw:transition-colors">DwarPal Pass</a>
            <a href="#features" className="hover:tw:text-[#181926] tw:transition-colors">Features</a>
            <a href="#usecases" className="hover:tw:text-[#181926] tw:transition-colors">Departments</a>
            <a href="#security" className="hover:tw:text-[#181926] tw:transition-colors">Security</a>
            <a href="#faq" className="hover:tw:text-[#181926] tw:transition-colors">FAQ</a>
          </nav>

          {/* Desktop CTA Action */}
          <div className="tw:hidden tw:md:tw:flex tw:items-center tw:gap-3">
            <Link
              to={config?.cms?.hero?.ctaPrimaryLink || '/access-portal'}
              className="tw:text-xs tw:font-semibold tw:text-[#181926] hover:tw:text-neutral-600 tw:transition-colors tw:px-3 tw:py-2"
            >
              Sign In
            </Link>
            <Link
              to={config?.cms?.hero?.ctaPrimaryLink || '/access-portal'}
              className="tw:px-5 tw:py-2.5 tw:rounded-full tw:bg-[#181926] hover:tw:bg-neutral-800 tw:text-white tw:text-xs tw:font-semibold tw:shadow-sm hover:tw:shadow tw:transition-all"
            >
              {config?.cms?.hero?.ctaPrimaryText || 'Launch App'}
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="tw:md:hidden tw:p-2 tw:text-[#181926]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile Flyout Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="tw:md:hidden tw:px-6 tw:py-4 tw:bg-white tw:border-b tw:border-neutral-100 tw:space-y-3 tw:text-xs"
            >
              <div className="tw:flex tw:flex-col tw:gap-3 tw:font-medium tw:text-neutral-700">
                <a href="#about" onClick={() => setMobileMenuOpen(false)}>DwarPal Pass</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#usecases" onClick={() => setMobileMenuOpen(false)}>Departments</a>
                <a href="#security" onClick={() => setMobileMenuOpen(false)}>Security</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              </div>
              <div className="tw:pt-3 tw:border-t tw:border-neutral-100 tw:flex tw:flex-col tw:gap-2">
                <Link
                  to={config?.cms?.hero?.ctaPrimaryLink || '/access-portal'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="tw:text-center tw:py-2.5 tw:rounded-full tw:bg-neutral-100 tw:text-[#181926] tw:text-xs tw:font-semibold"
                >
                  Sign In
                </Link>
                <Link
                  to={config?.cms?.hero?.ctaPrimaryLink || '/access-portal'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="tw:text-center tw:py-2.5 tw:rounded-full tw:bg-[#181926] tw:text-white tw:text-xs tw:font-semibold"
                >
                  {config?.cms?.hero?.ctaPrimaryText || 'Launch Access Portal'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* 2. HERO SECTION                                         */}
        {/* ======================================================== */}
        <section className="tw:pt-14 tw:sm:tw:pt-20 tw:pb-12 tw:px-6 tw:sm:tw:px-12 tw:text-center">
          <div className="tw:max-w-2xl tw:mx-auto tw:space-y-5">
            
            {/* Minimal Plus Crest */}
            <div className="tw:flex tw:justify-center">
              <span className="tw:text-xl tw:font-black tw:text-[#181926]">✦</span>
            </div>

            {/* Main Headline */}
            <h1 className="tw:text-4xl tw:sm:tw:text-5xl tw:md:tw:text-6xl tw:font-normal tw:tracking-tight tw:text-[#181926] tw:leading-[1.12]">
              {config?.cms?.hero?.headline || 'Where Campus Moves'}
            </h1>

            {/* Subtitle */}
            <p className="tw:text-xs tw:sm:tw:text-sm tw:text-neutral-600 tw:max-w-md tw:mx-auto tw:leading-relaxed tw:font-normal">
              {config?.cms?.hero?.subheadline || 'An intelligent, utility-driven digital gatepass designed for instant student leave accrual and seamless institutional trust.'}
            </p>

            {/* Center Pill CTA Button */}
            <div className="tw:pt-2">
              <Link
                to={config?.cms?.hero?.ctaPrimaryLink || '/access-portal'}
                className="tw:inline-block tw:px-7 tw:py-3 tw:rounded-full tw:bg-[#181926] hover:tw:bg-neutral-800 tw:text-white tw:text-xs tw:font-semibold tw:shadow-md hover:tw:shadow-lg tw:transition-all"
              >
                {config?.cms?.hero?.ctaPrimaryText || 'Access workspace'}
              </Link>
            </div>
          </div>

          {/* Hero Visual Banner (Wide 3D Meadow / Coins Landscape) */}
          <div className="tw:mt-12 tw:sm:tw:mt-16 tw:rounded-[24px] tw:sm:tw:rounded-[32px] tw:overflow-hidden tw:shadow-lg tw:border tw:border-neutral-200/60 tw:relative tw:bg-neutral-100">
            <img
              src={heroMeadowImg}
              alt="Where Campus Moves"
              className="tw:w-full tw:h-[260px] tw:sm:tw:h-[400px] tw:md:tw:h-[480px] tw:object-cover tw:object-center"
            />
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. SPLIT INTRO SECTION ("What is DwarPal?")               */}
        {/* ======================================================== */}
        <section id="about" className="tw:py-16 tw:sm:tw:py-20 tw:px-6 tw:sm:tw:px-12 tw:border-t tw:border-neutral-100">
          <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-12 tw:gap-8 tw:items-start">
            
            {/* Left Column: Title & Pill Button */}
            <div className="tw:md:tw:col-span-5 tw:space-y-6">
              <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-normal tw:text-[#181926] tw:tracking-tight">
                What is DwarPal?
              </h2>
              <div>
                <a
                  href="#features"
                  className="tw:inline-block tw:px-6 tw:py-2.5 tw:rounded-full tw:bg-[#181926] hover:tw:bg-neutral-800 tw:text-white tw:text-xs tw:font-semibold tw:transition-all"
                >
                  Explore features
                </a>
              </div>
            </div>

            {/* Right Column: Clean Editorial Explanation */}
            <div className="tw:md:tw:col-span-7">
              <p className="tw:text-lg tw:sm:tw:text-xl tw:text-[#181926] tw:leading-relaxed tw:font-normal">
                DwarPal is an institutional access management platform that helps campus communities coordinate instant digital gatepasses while staying 100% compliant with university safety regulations.
              </p>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. 3-CARD BENTO FEATURE ROW                              */}
        {/* ======================================================== */}
        <section id="features" className="tw:pb-16 tw:px-6 tw:sm:tw:px-12">
          <div className="tw:grid tw:grid-cols-1 tw:lg:tw:grid-cols-12 tw:gap-5">
            
            {/* Card 1: Wide Light Pastel Card with 3D Flower & Coin */}
            <div className="tw:lg:tw:col-span-6 tw:rounded-[28px] tw:p-8 tw:flex tw:flex-col tw:justify-between tw:min-h-[300px] tw:relative tw:overflow-hidden tw:shadow-sm tw:border tw:border-neutral-200/50"
              style={{
                backgroundColor: '#d8dfec',
                backgroundImage: `radial-gradient(circle at 80% 80%, rgba(195, 185, 230, 0.4), transparent 50%), linear-gradient(135deg, #d2dbe8 0%, #e2e8f4 100%)`
              }}
            >
              {/* Background Flower Asset */}
              <div className="tw:absolute tw:right-[-20px] tw:bottom-[-20px] tw:w-[240px] tw:sm:tw:w-[280px] tw:h-[240px] tw:sm:tw:h-[280px] tw:pointer-events-none tw:rounded-full tw:overflow-hidden tw:opacity-90">
                <img
                  src={cardFlowerImg}
                  alt="Passes that flow"
                  className="tw:w-full tw:h-full tw:object-cover"
                />
              </div>

              <div className="tw:relative tw:z-10 tw:space-y-2">
                <h3 className="tw:text-2xl tw:font-medium tw:text-[#181926] tw:tracking-tight">
                  Passes that move with you
                </h3>
              </div>

              <div className="tw:relative tw:z-10 tw:pt-20">
                <p className="tw:text-xs tw:text-neutral-700 tw:max-w-xs tw:leading-relaxed">
                  Instant digital gatepasses deployed directly to your smartphone wallet or institutional dashboard.
                </p>
              </div>
            </div>

            {/* Card 2: Dark Obsidian Card */}
            <div className="tw:lg:tw:col-span-3 tw:rounded-[28px] tw:bg-[#181926] tw:text-white tw:p-8 tw:flex tw:flex-col tw:justify-between tw:min-h-[300px] tw:shadow-sm">
              <div>
                <h3 className="tw:text-xl tw:font-medium tw:text-white tw:tracking-tight tw:leading-snug">
                  Always verified,<br />always secure
                </h3>
              </div>

              <div>
                <p className="tw:text-xs tw:text-neutral-400 tw:leading-relaxed">
                  Stay fully protected with rolling cryptographic QR tokens — no paper slips, no gate queues.
                </p>
              </div>
            </div>

            {/* Card 3: Dark Obsidian Card */}
            <div className="tw:lg:tw:col-span-3 tw:rounded-[28px] tw:bg-[#181926] tw:text-white tw:p-8 tw:flex tw:flex-col tw:justify-between tw:min-h-[300px] tw:shadow-sm">
              <div>
                <h3 className="tw:text-xl tw:font-medium tw:text-white tw:tracking-tight tw:leading-snug">
                  100%<br />hands-free
                </h3>
              </div>

              <div>
                <p className="tw:text-xs tw:text-neutral-400 tw:leading-relaxed">
                  No manual registers to manage. DwarPal automatically synchronizes headcount logs and parent alerts.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 5. INSTITUTIONAL TRUST BAR                               */}
        {/* ======================================================== */}
        <section className="tw:py-10 tw:px-6 tw:sm:tw:px-12 tw:border-t tw:border-neutral-100">
          <div className="tw:flex tw:flex-col tw:md:tw:flex-row tw:items-center tw:justify-between tw:gap-6">
            <p className="tw:text-[11px] tw:text-neutral-500 tw:max-w-xs tw:leading-relaxed tw:text-center tw:md:tw:text-left">
              Trusted by leading universities, colleges, and campus safety leadership.
            </p>

            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-6 tw:sm:tw:gap-8 tw:text-xs tw:font-mono tw:text-neutral-600 tw:tracking-wider tw:uppercase">
              {TRUST_PARTNERS.map((partner, idx) => (
                <span key={idx} className="tw:px-3 tw:py-1.5 tw:rounded-lg tw:bg-neutral-50 tw:border tw:border-neutral-200/60">
                  {partner}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 6. "USE CASES" SPLIT ARCHITECTURE SHOWCASE               */}
        {/* ======================================================== */}
        <section id="usecases" className="tw:py-16 tw:sm:tw:py-20 tw:px-6 tw:sm:tw:px-12 tw:border-t tw:border-neutral-100">
          <div className="tw:grid tw:grid-cols-1 tw:md:tw:grid-cols-12 tw:gap-8 tw:items-start">
            
            {/* Left Column: Section Title & Narrative */}
            <div className="tw:md:tw:col-span-5 tw:space-y-4">
              <span className="tw:text-[11px] tw:font-medium tw:text-neutral-500 tw:block">
                DwarPal in Action
              </span>
              <h2 className="tw:text-3xl tw:sm:tw:text-4xl tw:font-normal tw:text-[#181926] tw:tracking-tight">
                Use cases
              </h2>
              <p className="tw:text-xs tw:sm:tw:text-sm tw:text-neutral-600 tw:leading-relaxed tw:max-w-sm">
                DwarPal offers a variety of specialized workflows for academic departments, campus security checkpoints, students, and university leadership.
              </p>

              {/* Tab Selector Buttons */}
              <div className="tw:pt-4 tw:flex tw:flex-col tw:gap-2">
                {USE_CASES.map((uc, i) => (
                  <button
                    key={uc.id}
                    type="button"
                    onClick={() => setActiveUseCase(i)}
                    className={`tw:text-left tw:p-3.5 tw:rounded-2xl tw:text-xs tw:font-medium tw:transition-all ${
                      activeUseCase === i
                        ? 'tw:bg-[#181926] tw:text-white tw:shadow-sm'
                        : 'tw:bg-neutral-50 hover:tw:bg-neutral-100 tw:text-neutral-700'
                    }`}
                  >
                    {uc.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Featured Card with Temple 3D Visual */}
            <div className="tw:md:tw:col-span-7">
              {(() => {
                const currentCase = USE_CASES[activeUseCase]
                return (
                  <div className="tw:rounded-[32px] tw:bg-[#f5f7fa] tw:border tw:border-neutral-200/70 tw:p-8 tw:sm:tw:p-10 tw:flex tw:flex-col tw:justify-between tw:shadow-sm tw:space-y-8">
                    <div className="tw:space-y-3">
                      <span className="tw:text-[10px] tw:font-mono tw:text-neutral-500 tw:uppercase tw:tracking-wider">
                        {currentCase.subtitle}
                      </span>
                      <h3 className="tw:text-2xl tw:font-normal tw:text-[#181926] tw:tracking-tight">
                        {currentCase.title}
                      </h3>
                      <p className="tw:text-xs tw:sm:text-sm tw:text-neutral-600 tw:leading-relaxed">
                        {currentCase.description}
                      </p>
                      
                      <div className="tw:pt-2">
                        <Link
                          to={currentCase.linkHref}
                          className="tw:inline-flex tw:items-center tw:gap-2 tw:text-xs tw:font-semibold tw:text-[#181926] hover:tw:text-[#4f46e5] tw:transition-colors"
                        >
                          <span>{currentCase.linkText}</span>
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>

                    {/* 3D Temple / Classical Architecture Image */}
                    <div className="tw:rounded-2xl tw:overflow-hidden tw:bg-white tw:border tw:border-neutral-200/50 tw:shadow-sm">
                      <img
                        src={campusTempleImg}
                        alt="Institutional Architecture"
                        className="tw:w-full tw:h-[220px] tw:sm:tw:h-[280px] tw:object-cover tw:object-center"
                      />
                    </div>
                  </div>
                )
              })()}
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 7. FREQUENTLY ASKED QUESTIONS                            */}
        {/* ======================================================== */}
        <section id="faq" className="tw:py-16 tw:sm:tw:py-20 tw:px-6 tw:sm:tw:px-12 tw:border-t tw:border-neutral-100">
          <div className="tw:max-w-2xl tw:mx-auto tw:space-y-8">
            <div className="tw:text-center tw:space-y-2">
              <h2 className="tw:text-3xl tw:font-normal tw:text-[#181926] tw:tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="tw:text-xs tw:text-neutral-500">
                Everything you need to know about DwarPal institutional operations.
              </p>
            </div>

            <div className="tw:space-y-3">
              {activeFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx
                return (
                  <div
                    key={idx}
                    className="tw:rounded-2xl tw:bg-[#f8f9fa] tw:border tw:border-neutral-200/60 tw:overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                      className="tw:w-full tw:p-5 tw:text-left tw:flex tw:items-center tw:justify-between tw:gap-4"
                    >
                      <span className="tw:font-medium tw:text-xs tw:sm:tw:text-sm tw:text-[#181926]">
                        {faq.q}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`tw:text-neutral-500 tw:transition-transform tw:duration-200 ${
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
                          className="tw:px-5 tw:pb-5 tw:text-xs tw:text-neutral-600 tw:leading-relaxed tw:border-t tw:border-neutral-200/50 tw:pt-3"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 8. MINIMAL LUXURY FOOTER                                 */}
        {/* ======================================================== */}
        <footer className="tw:py-10 tw:px-6 tw:sm:tw:px-12 tw:border-t tw:border-neutral-100 tw:bg-white">
          <div className="tw:flex tw:flex-col tw:sm:tw:flex-row tw:items-center tw:justify-between tw:gap-6 tw:text-xs tw:text-neutral-500">
            <div className="tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-base tw:font-black tw:text-[#181926]">✦</span>
              <span className="tw:font-bold tw:text-[#181926]">DwarPal</span>
              <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
            </div>

            <div className="tw:flex tw:items-center tw:gap-6">
              <Link to="/privacy-policy" className="hover:tw:text-[#181926] tw:transition-colors">Privacy Policy</Link>
              <Link to="/privacy-policy" className="hover:tw:text-[#181926] tw:transition-colors">Terms of Service</Link>
              <Link to="/support" className="hover:tw:text-[#181926] tw:transition-colors">Support Desk</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
