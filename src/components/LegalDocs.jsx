import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ChevronLeft, KeyRound, FileText, Eye, CheckCircle2, Settings } from 'lucide-react'
import { ActionButton } from './ui'

const SECTION_ICON_CLASS = 'policy-section-icon'

function PolicySection({ icon: Icon, title, children }) {
  return (
    <section className="policy-section">
      <h2 className="policy-section-heading">
        <span className={SECTION_ICON_CLASS} aria-hidden="true"><Icon size={16} /></span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function PolicyGrid({ children }) {
  return <div className="policy-grid">{children}</div>
}

function PolicyGridCard({ title, children }) {
  return (
    <div className="policy-grid-card">
      <strong className="policy-grid-card-title">{title}</strong>
      <p>{children}</p>
    </div>
  )
}

export default function LegalDocs({ onManageCookies }) {
  const navigate = useNavigate()

  return (
    <div className="legal-page">
      <div className="legal-container">

        {/* Page header */}
        <div className="legal-header">
          <button
            type="button"
            className="legal-back-button"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={15} />
            <span>Back</span>
          </button>

          <div className="legal-header-brand">
            <div className="legal-header-icon">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="legal-header-title">Privacy Policy</h1>
              <p className="legal-header-meta">Effective: 28 June 2026 · DPDP Act 2023 · GDPR Aligned</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="legal-body">

          {/* Commitment callout */}
          <div className="legal-callout">
            <div className="legal-callout-icon" aria-hidden="true"><KeyRound size={18} /></div>
            <div>
              <strong>Our Privacy Commitment</strong>
              <p>
                DwarPal is built to secure campus access while protecting your personal data. We comply with
                India's <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and apply
                <strong> GDPR</strong> principles globally. Your data is never sold or used for advertising.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <PolicySection icon={FileText} title="Personal Data We Collect">
            <p className="policy-body-text">
              We collect only what is necessary to operate the campus gatepass system and verify access permissions:
            </p>
            <ul className="policy-list">
              <li><strong>Identity:</strong> Full name, institutional email, mobile number, and securely hashed password.</li>
              <li><strong>Campus Details:</strong> Enrollment number or Employee ID, academic program, department, and semester.</li>
              <li><strong>Gatepass Records:</strong> Departure date/time, return time, purpose, approval status, coordinator comments, and security scan timestamps.</li>
              <li><strong>Verification Photo:</strong> Profile photo uploaded for visual identity checks at campus gates.</li>
              <li><strong>Biometric Credentials (optional):</strong> WebAuthn public keys and device identifiers when you opt in to passkey login. Raw biometric data — fingerprints, facial geometry — is <em>never</em> transmitted or stored on our servers; it stays inside your device's secure hardware.</li>
            </ul>
          </PolicySection>

          {/* Section 2 */}
          <PolicySection icon={Eye} title="Purpose of Data Processing">
            <p className="policy-body-text">
              Under Section 4 of the DPDP Act 2023, we process your data only for the following specified purposes:
            </p>
            <PolicyGrid>
              <PolicyGridCard title="Access Authorization">
                Generating QR-code gatepasses, verifying campus exit permissions, and logging check-in/check-out events at gates.
              </PolicyGridCard>
              <PolicyGridCard title="Real-time Notifications">
                Sending push notifications and email OTPs for approval status changes, security scans, and account events.
              </PolicyGridCard>
              <PolicyGridCard title="Audit Log &amp; Safety">
                Enabling administrators (Principals, HODs, CAOs) to monitor campus attendance, resolve access disputes, and ensure safety compliance.
              </PolicyGridCard>
              <PolicyGridCard title="System Security">
                Authenticating logins via multi-factor verification (OTP + WebAuthn passkeys) to prevent unauthorized access.
              </PolicyGridCard>
            </PolicyGrid>
          </PolicySection>

          {/* Section 3 */}
          <PolicySection icon={CheckCircle2} title="Cookie Policy &amp; Granular Controls">
            <p className="policy-body-text">
              We use three categories of cookies. You can manage your preferences at any time from the consent banner or via the button below.
            </p>
            <ul className="policy-list">
              <li>
                <strong>Strictly Necessary (Always Active):</strong> Authentication tokens and WebAuthn state cookies required for the app to function.
                Set with <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> flags to prevent XSS and CSRF attacks.
              </li>
              <li>
                <strong>Functional:</strong> Stores your UI preferences — sidebar state, dismissed tips, and dashboard settings.
                No cross-site tracking; data stays local.
              </li>
              <li>
                <strong>Analytics:</strong> Anonymous performance metrics — response latency, scanner throughput, page load timing.
                No advertising profiling, no third-party ad networks.
              </li>
            </ul>
            {onManageCookies && (
              <div style={{ marginTop: '1rem' }}>
                <ActionButton type="button" tone="secondary" icon={Settings} onClick={onManageCookies}>
                  Manage Cookie Preferences
                </ActionButton>
              </div>
            )}
          </PolicySection>

          {/* Section 4 */}
          <PolicySection icon={ShieldCheck} title="Retention &amp; Security">
            <p className="policy-body-text">
              All sensitive data is stored in encrypted database environments using AES encryption for configuration data
              and bcrypt for password hashes. We apply TLS in transit for all API communications.
            </p>
            <p className="policy-body-text">
              <strong>Retention:</strong> Academic profiles are retained for the duration of your enrollment or tenure.
              Gatepass records are retained for a maximum of <strong>one academic year</strong>, after which they are archived
              or permanently deleted — unless statutory requirements mandate longer retention.
            </p>
          </PolicySection>

          {/* Section 5 */}
          <PolicySection icon={FileText} title="Sharing with Third Parties">
            <p className="policy-body-text">
              DwarPal does <strong>not</strong> sell, rent, or share your personal data for advertising or marketing.
              Data is shared with the following service providers only as required to run the platform:
            </p>
            <ul className="policy-list">
              <li><strong>Firebase Cloud Messaging (Google):</strong> Push notifications for gatepass approvals and security scans.</li>
              <li><strong>Transactional Email Service:</strong> Sending OTPs, verification emails, and password reset links.</li>
              <li><strong>Cloud Database Provider:</strong> Hosted in ISO 27001-compliant infrastructure with encryption at rest.</li>
            </ul>
            <p className="policy-body-text">
              All providers are bound by data processing agreements and are prohibited from using your data for any purpose
              other than delivering the contracted service.
            </p>
          </PolicySection>

          {/* Section 6 */}
          <PolicySection icon={CheckCircle2} title="Your Legal Rights">
            <p className="policy-body-text">
              Under Sections 11–14 of the DPDP Act 2023 and GDPR Articles 15–22, you have the following rights.
              Exercise them from your Profile page or by contacting our Data Protection Officer:
            </p>
            <PolicyGrid>
              <PolicyGridCard title="Access &amp; Correction">
                View all your personal data and gatepass history. Request corrections to inaccurate entries.
              </PolicyGridCard>
              <PolicyGridCard title="Consent Withdrawal">
                Disable passkey authentication or push notification permissions at any time to stop that processing.
              </PolicyGridCard>
              <PolicyGridCard title="Right to Erasure">
                Request deletion of non-mandatory personal data once your academic enrollment or employment ends.
              </PolicyGridCard>
            </PolicyGrid>
          </PolicySection>

          {/* Section 7 — Grievance */}
          <section className="policy-section policy-section-bordered">
            <h2 className="policy-section-heading">
              <span className={SECTION_ICON_CLASS} aria-hidden="true"><ShieldCheck size={16} /></span>
              Grievance Officer &amp; Contact
            </h2>
            <p className="policy-body-text">
              For questions about this policy, cookie preferences, or to file a grievance under the DPDP Act,
              contact our Data Protection Officer:
            </p>
            <div className="policy-contact-card">
              <p className="policy-contact-name">DwarPal Data Protection Officer</p>
              <p>
                Email:{' '}
                <a href="mailto:dwarpal@neotech.ac.in" className="policy-link">
                  dwarpal@neotech.ac.in
                </a>
              </p>
              <p className="policy-contact-note">Responses are typically provided within 48 business hours.</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="legal-footer">
          <span className="legal-footer-copy">DwarPal Security Hub © 2026</span>
          <ActionButton type="button" onClick={() => navigate('/')}>
            Return to Dashboard
          </ActionButton>
        </div>

      </div>
    </div>
  )
}
