import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleHelp, ChevronDown, ChevronUp, Mail, Clock3, Phone,
  AlertTriangle, ChevronLeft, QrCode, CheckCircle2, RefreshCw,
  Fingerprint, MessageSquare, Undo2, Siren,
} from 'lucide-react'
import { ActionButton } from './ui'

const FAQ_ITEMS = [
  {
    icon: CheckCircle2,
    question: 'How do I submit a campus gatepass request?',
    answer:
      'From your dashboard, tap the "+ New Gatepass" button. Fill in the departure date, leaving time, expected return time, reason for leaving, and destination, then submit. Your request will appear immediately with a "Pending" status while it awaits coordinator review. You\'ll receive a push notification once a decision is made.',
  },
  {
    icon: CheckCircle2,
    question: 'Who reviews and approves my gatepass?',
    answer:
      'Student gatepasses are reviewed by your department\'s Head of Department (HOD) or the Principal, depending on your program. Faculty gatepasses route to the Chief Administrative Officer (CAO) or Principal. Once approved, the status badge turns green and a QR code becomes available. The entire workflow is auditable — you can see who approved your request and when.',
  },
  {
    icon: QrCode,
    question: 'How does the security guard verify my gatepass at the gate?',
    answer:
      'Open your approved gatepass on DwarPal and tap "View QR Code." Show the full-screen QR code to the security guard. The guard scans it with the DwarPal Security console, which logs your campus exit timestamp automatically. When you return, the guard scans it again to log your entry. Both events are recorded in your gatepass history.',
  },
  {
    icon: Fingerprint,
    question: 'Why did my passkey (biometric) registration fail?',
    answer:
      'Passkey registration requires a secure browsing context (HTTPS or localhost) and a device with hardware authentication — Touch ID, Face ID, Windows Hello, or a FIDO2 security key. Check that your device biometrics are enabled in system settings and that you\'re using a compatible browser (Chrome 108+, Safari 16+, Edge 108+). If you\'re on an older device that does not support WebAuthn, use your password + OTP to log in instead.',
  },
  {
    icon: MessageSquare,
    question: 'I\'m not receiving OTP emails. What should I do?',
    answer:
      'First, check your spam or junk folder — automated emails sometimes land there. Make sure the email address shown on the login screen matches your official institutional address. If the problem persists for more than a few minutes, contact the campus IT Helpdesk directly (numbers listed above). The administrator can verify delivery status and resend the OTP manually if needed.',
  },
  {
    icon: Undo2,
    question: 'Can I withdraw or cancel a gatepass after it is approved?',
    answer:
      'Yes — provided you have not yet physically checked out at the gate. Open the gatepass card on your dashboard and tap "Delete" or "Cancel Request." Once a security guard scans your QR code and logs your exit, the gatepass becomes an auditable record and can no longer be deleted. If you need to correct information after checkout, contact the support email below.',
  },
  {
    icon: Siren,
    question: 'What happens if there is a network outage or emergency evacuation?',
    answer:
      'DwarPal operates a physical offline fallback. In the event of network outages or emergency evacuations, proceed directly to the security cabin. Guards maintain a manual register for recording exits and entries. Once connectivity is restored, these logs are reconciled and uploaded to the system by campus IT. Do not wait for digital approval in a genuine emergency — campus safety takes priority.',
  },
]

export default function SupportPage() {
  const navigate = useNavigate()
  const [openIndex, setOpenIndex] = useState(null)

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

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
              <CircleHelp size={26} />
            </div>
            <div>
              <h1 className="legal-header-title">Help &amp; Support</h1>
              <p className="legal-header-meta">Campus Gatepass Assistance · Mon–Sat, 9 AM – 5 PM IST</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="legal-body">

          {/* Commitment callout */}
          <div className="legal-callout">
            <div className="legal-callout-icon" aria-hidden="true"><CircleHelp size={18} /></div>
            <div>
              <strong>We're here to help</strong>
              <p>
                Whether you're troubleshooting biometric registration, chasing a delayed OTP, or have a question about
                the approval workflow — our support team is available during campus hours.
                For urgent gate issues, use the IT Helpdesk numbers below.
              </p>
            </div>
          </div>

          {/* Contact cards */}
          <section aria-labelledby="support-contacts-heading">
            <h2 id="support-contacts-heading" className="policy-section-heading" style={{ marginBottom: '1rem' }}>
              <span className="policy-section-icon" aria-hidden="true"><Mail size={16} /></span>
              Contact Channels
            </h2>
            <div className="support-contact-grid">

              <div className="support-contact-card">
                <div className="support-contact-icon"><Mail size={20} /></div>
                <strong>Email Support</strong>
                <a href="mailto:dwarpalcode@gmail.com" className="policy-link support-contact-value">
                  dwarpalcode@gmail.com
                </a>
                <span className="support-contact-note">Response within 24–48 hours</span>
              </div>

              <div className="support-contact-card">
                <div className="support-contact-icon"><Clock3 size={20} /></div>
                <strong>Support Hours</strong>
                <span className="support-contact-value">Monday – Saturday</span>
                <span className="support-contact-note">9:00 AM – 5:00 PM IST</span>
              </div>

              <div className="support-contact-card">
                <div className="support-contact-icon"><Phone size={20} /></div>
                <strong>Campus IT Helpdesk</strong>
                <div className="support-contact-value" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span>
                    Manan Dabgar —{' '}
                    <a href="tel:+919328563802" className="policy-link">+91 93285 63802</a>
                  </span>
                  <span>
                    Atharva Chitale —{' '}
                    <a href="tel:+919265793539" className="policy-link">+91 92657 93539</a>
                  </span>
                </div>
                <span className="support-contact-note">For urgent gate queries</span>
              </div>

            </div>
          </section>

          {/* FAQ accordion */}
          <section aria-labelledby="support-faq-heading">
            <h2 id="support-faq-heading" className="policy-section-heading" style={{ marginBottom: '1rem' }}>
              <span className="policy-section-icon" aria-hidden="true"><CircleHelp size={16} /></span>
              Frequently Asked Questions
            </h2>

            <div className="support-faq-list">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx
                return (
                  <div key={idx} className={`support-faq-item ${isOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="support-faq-trigger"
                      onClick={() => toggleFaq(idx)}
                      aria-expanded={isOpen}
                    >
                      <span className="support-faq-question">{item.question}</span>
                      <span className="support-faq-chevron" aria-hidden="true">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="support-faq-answer">
                        <p>{item.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Emergency notice */}
          <div className="legal-warning-card">
            <div className="legal-warning-icon" aria-hidden="true"><AlertTriangle size={18} /></div>
            <div>
              <strong>Emergency Gate Exit</strong>
              <p>
                In a genuine emergency — fire, evacuation, or medical — proceed to the security cabin immediately.
                Do not wait for digital approval. Guards will record your exit manually, and the log will be
                reconciled once the situation is resolved.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="legal-footer">
          <span className="legal-footer-copy">DwarPal Support Hub © 2026</span>
          <ActionButton type="button" onClick={() => navigate('/')}>
            Return to Dashboard
          </ActionButton>
        </div>

      </div>
    </div>
  )
}
