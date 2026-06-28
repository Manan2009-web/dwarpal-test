import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ChevronLeft, KeyRound, FileText, Eye, CheckCircle2 } from 'lucide-react'
import { ActionButton } from './ui'

export default function LegalDocs() {
  const navigate = useNavigate()

  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-neutral-950 tw:text-neutral-250 tw:font-sans tw:py-12 tw:px-4 sm:tw:px-6 lg:tw:px-8">
      <div className="tw:max-w-4xl tw:mx-auto tw:bg-neutral-900 tw:border tw:border-neutral-800 tw:rounded-2xl tw:shadow-2xl tw:overflow-hidden">
        
        {/* Header */}
        <div className="tw:bg-gradient-to-r tw:from-purple-950/40 tw:to-neutral-900 tw:p-8 tw:border-b tw:border-neutral-800 tw:relative">
          <button 
            onClick={() => navigate(-1)} 
            className="tw:absolute tw:top-6 tw:left-6 tw:flex tw:items-center tw:gap-2 tw:text-xs tw:font-mono tw:tracking-wider tw:text-purple-400 hover:tw:text-purple-300 tw:bg-neutral-800/60 tw:border tw:border-neutral-700 tw:px-3 tw:py-1.5 tw:rounded-full tw:transition-all tw:cursor-pointer tw:border-none"
          >
            <ChevronLeft size={14} /> BACK
          </button>
          
          <div className="tw:flex tw:items-center tw:gap-4 tw:mt-8">
            <div className="tw:p-3 tw:bg-purple-950/15 tw:text-purple-400 tw:border tw:border-purple-800/30 tw:rounded-xl">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="tw:text-2xl sm:tw:text-3xl tw:font-black tw:text-white tw:tracking-tight tw:uppercase">Privacy Policy</h1>
              <p className="tw:text-xs tw:font-mono tw:text-neutral-400 tw:mt-1 tw:tracking-widest">EFFECTIVE DATE: JUNE 28, 2026</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="tw:p-8 tw:space-y-8 tw:text-sm tw:leading-relaxed tw:text-neutral-350">
          
          {/* Summary / Introduction */}
          <section className="tw:bg-purple-950/10 tw:border tw:border-purple-900/20 tw:p-6 tw:rounded-xl tw:flex tw:gap-4">
            <div className="tw:text-purple-450 tw:mt-0.5"><KeyRound size={18} /></div>
            <div>
              <h4 className="tw:text-white tw:font-semibold tw:mb-1">Our Privacy Commitment</h4>
              <p className="tw:text-neutral-400 tw:text-xs">
                DwarPal is designed to secure student and faculty gate movements while preserving personal privacy. 
                We comply with the **Digital Personal Data Protection (DPDP) Act, 2023 (India)** and apply **GDPR** standards globally 
                to ensure your digital data remains securely under your control.
              </p>
            </div>
          </section>

          {/* Section 1: Data Collection */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><FileText size={16} /></span> Personal Data We Collect
            </h3>
            <p>
              To operate the digital gatepass system and verify campus access permissions, DwarPal collects the following categories of information:
            </p>
            <ul className="tw:list-disc tw:pl-5 tw:space-y-1.5 tw:text-neutral-400 tw:text-xs">
              <li><strong>Profile Information:</strong> Full name, official email address, mobile phone number, and account password (securely salted and hashed).</li>
              <li><strong>Campus Identity Details:</strong> Enrollment Number (for students) or Employee ID (for faculty/coordinators), current academic program, department, and semester.</li>
              <li><strong>Gatepass Records:</strong> Date, departure time, estimated/actual return time, purpose of departure, coordinator approval/rejection status, approval comments, and security guard scan logs.</li>
              <li><strong>Verification Media:</strong> Profile photo uploads used exclusively for guard-gate visual validation.</li>
              <li><strong>Biometric Credentials:</strong> WebAuthn public keys and device identifiers (if biometric authentication is explicitly opted-in). <em>We never store raw biometric data (such as fingerprints or facial geometry) on our servers; these remain securely inside your hardware device.</em></li>
            </ul>
          </section>

          {/* Section 2: Purpose of Processing */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><Eye size={16} /></span> Purpose of Data Processing
            </h3>
            <p>
              In compliance with Section 4 of the DPDP Act 2023, your personal data is collected and processed only for specified, lawful purposes:
            </p>
            <div className="tw:grid tw:grid-cols-1 md:tw:grid-cols-2 tw:gap-4 tw:text-xs">
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <strong className="tw:text-white tw:block tw:mb-1">Access Authorization</strong>
                Generating gatepass QR codes, verifying permissions, and recording student/faculty checkout and check-in statuses at campus gates.
              </div>
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <strong className="tw:text-white tw:block tw:mb-1">Real-time Notifications</strong>
                Dispatching real-time approval status notifications and email OTPs to students, faculty, and administrative authorities.
              </div>
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <strong className="tw:text-white tw:block tw:mb-1">Audit Log & Safety</strong>
                Assisting college administrators (Principals, HODs, CAOs) in monitoring campus attendance, ensuring safety compliance, and resolving entry/exit queries.
              </div>
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <strong className="tw:text-white tw:block tw:mb-1">System Security</strong>
                Verifying sign-ins via multi-factor authentication (OTP and WebAuthn biometrics) to prevent unauthorized credential usage.
              </div>
            </div>
          </section>

          {/* Section 3: Cookie Compliance */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><CheckCircle2 size={16} /></span> Cookie Policy & Granular Controls
            </h3>
            <p>
              We utilize secure cookies to run the application shell. You can manage functional and analytical cookie preferences via our consent banner.
            </p>
            <ul className="tw:list-disc tw:pl-5 tw:space-y-2 tw:text-neutral-400 tw:text-xs">
              <li><strong>Strictly Necessary Cookies (Always Active):</strong> Includes our authentication token and WebAuthn state cookies. These cookies use the <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> configurations to prevent cross-site scripting (XSS) and cross-site request forgery (CSRF) access.</li>
              <li><strong>Functional Cookies:</strong> Stores user-interface configuration settings, such as your navigation sidebar preferences and dark mode settings.</li>
              <li><strong>Analytics Cookies:</strong> Measures system response speeds and gateway scanner latency to optimize performance. No advertising or commercial cookies are utilized.</li>
            </ul>
          </section>

          {/* Section 4: Data Retention & Security */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-400"><ShieldCheck size={16} /></span> Retention & Security Standards
            </h3>
            <p>
              Your data is stored in secure database environments using AES encryption for sensitive configuration data and bcrypt for password hashing.
            </p>
            <p className="tw:text-xs tw:text-neutral-450">
              <strong>Retention Period:</strong> Academic profiles are preserved for the duration of the student's enrollment or faculty member's tenure. Active gatepass records are preserved for a maximum period of <strong>one academic year</strong>, after which they are archived or permanently purged, except where required by statutory compliance.
            </p>
          </section>

          {/* Section 5: Third-Party Sharing */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><FileText size={16} /></span> Sharing with Third Parties
            </h3>
            <p>
              DwarPal does **not** sell, rent, or trade your personal data for advertising or marketing. Data is shared with third-party service providers only when necessary to execute basic application functions:
            </p>
            <ul className="tw:list-disc tw:pl-5 tw:space-y-1 tw:text-neutral-400 tw:text-xs">
              <li><strong>Firebase Messaging (Google):</strong> Used to deliver push notifications regarding gatepass approvals and security scans.</li>
              <li><strong>NodeMailer Service Providers:</strong> Used to transmit verification emails, password resets, and register OTP tokens.</li>
              <li><strong>Database Services:</strong> Hosted in highly secure cloud servers matching standard ISO 27001 configurations.</li>
            </ul>
          </section>

          {/* Section 6: User Rights */}
          <section className="tw:space-y-3">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><CheckCircle2 size={16} /></span> Your Legal Rights
            </h3>
            <p>
              Under global data rules and Section 11-14 of India's DPDP Act 2023, you hold full authority over your data. You may execute these rights through your profile panel:
            </p>
            <div className="tw:grid tw:grid-cols-1 md:tw:grid-cols-3 tw:gap-4 tw:text-xs">
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <span className="tw:text-purple-450 tw:font-bold tw:block tw:mb-1">Access & Correction</span>
                The right to view all gatepass history and personal credentials, and request corrections to inaccurate entries.
              </div>
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <span className="tw:text-purple-450 tw:font-bold tw:block tw:mb-1">Consent Withdrawal</span>
                The right to disable biometrics or notification permissions at any time, halting future data processing.
              </div>
              <div className="tw:bg-neutral-950 tw:p-4 tw:rounded-lg tw:border tw:border-neutral-800">
                <span className="tw:text-purple-450 tw:font-bold tw:block tw:mb-1">Erasure (Right to be Forgotten)</span>
                Students/Faculty can request deletion of non-mandatory data upon completion of their academic terms.
              </div>
            </div>
          </section>

          {/* Section 7: Grievance Redressal */}
          <section className="tw:space-y-3 tw:border-t tw:border-neutral-800 tw:pt-6">
            <h3 className="tw:text-base tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:flex tw:items-center tw:gap-2">
              <span className="tw:text-purple-450"><ShieldCheck size={16} /></span> Grievance Officer & Redressal
            </h3>
            <p>
              If you have any questions regarding this Privacy Policy, your cookie preferences, or wish to file a grievance under DPDP Act requirements, please contact our designated Data Protection Officer:
            </p>
            <div className="tw:bg-neutral-950 tw:p-5 tw:rounded-xl tw:border tw:border-neutral-800 tw:inline-block">
              <p className="tw:font-semibold tw:text-white tw:text-xs tw:mb-1">DwarPal Grievance & Data Protection Officer</p>
              <p className="tw:text-xs tw:text-neutral-400">Email: <span className="tw:text-purple-450 tw:font-mono">dwarpalcode@gmail.com</span></p>
              <p className="tw:text-xs tw:text-neutral-450 tw:mt-2">Responses are typically provided within 48 business hours.</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="tw:bg-neutral-950 tw:p-6 tw:border-t tw:border-neutral-800 tw:flex tw:justify-between tw:items-center tw:flex-wrap tw:gap-4">
          <span className="tw:text-xs tw:font-mono tw:text-neutral-500">DwarPal Security Hub © 2026</span>
          <ActionButton type="button" onClick={() => navigate('/')}>
            Return to Dashboard
          </ActionButton>
        </div>

      </div>
    </div>
  )
}
