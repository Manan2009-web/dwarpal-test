import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleHelp, ChevronDown, ChevronUp, Mail, Clock3, Phone, AlertCircle, ChevronLeft, ShieldCheck } from 'lucide-react'
import { ActionButton } from './ui'

const FAQ_ITEMS = [
  {
    question: 'How do I submit a campus gatepass request?',
    answer: 'Log in as a Student or Faculty member, go to your dashboard, and click the "+" or "Create Gatepass" button. Fill in the leaving date, time, reason, and destination, then submit. The gatepass will appear on your dashboard as "Pending".'
  },
  {
    question: 'Who approves my gatepass requests?',
    answer: 'Student gatepasses are reviewed by HODs or the Principal. Coordinator roles approve student requests. Faculty gatepasses are reviewed by the Chief Administrative Officer (CAO) or Principal. Once approved, the status changes to "Approved" with a green badge.'
  },
  {
    question: 'How does the Security Guard verify my gatepass?',
    answer: 'At the campus exit gate, open your approved gatepass on your phone and tap "View QR Code". Show this QR code to the Security Guard. The guard will scan the QR code to log your exit and entry times automatically.'
  },
  {
    question: 'Why did my biometric registration fail?',
    answer: 'Biometric WebAuthn logins require a secure browser context (HTTPS or localhost) and a device hardware credential setup (TouchID, FaceID, or Windows Hello). Ensure your device biometrics are enabled and your browser supports security keys.'
  },
  {
    question: 'I am not receiving OTP verification emails. What should I do?',
    answer: 'Check your spam or junk folder. Ensure your registered email address matches your institutional records. If the issue persists, contact the site administrator at dwarpalcode@gmail.com to check connection statuses.'
  },
  {
    question: 'Can I withdraw a gatepass request after it is approved?',
    answer: 'If you have not checked out yet, you can cancel your gatepass by opening the gatepass card on your dashboard and clicking "Delete" or "Cancel Request". Once you check out of the gate, the pass cannot be deleted as it becomes an audit log record.'
  }
]

export default function SupportPage() {
  const navigate = useNavigate()
  const [openIndex, setOpenIndex] = useState(null)

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-neutral-950 tw:text-neutral-250 tw:font-sans tw:py-12 tw:px-4 sm:tw:px-6 lg:tw:px-8">
      <div className="tw:max-w-4xl tw:mx-auto tw:space-y-8">
        
        {/* Support Card */}
        <div className="tw:bg-neutral-900 tw:border tw:border-neutral-800 tw:rounded-2xl tw:shadow-2xl tw:overflow-hidden">
          
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
                <CircleHelp size={28} />
              </div>
              <div>
                <h1 className="tw:text-2xl sm:tw:text-3xl tw:font-black tw:text-white tw:tracking-tight tw:uppercase">Help & Support</h1>
                <p className="tw:text-xs tw:font-mono tw:text-neutral-400 tw:mt-1 tw:tracking-widest">CAMPUS GATEPASS ASSISTANCE</p>
              </div>
            </div>
          </div>

          <div className="tw:p-8 tw:space-y-8">
            
            {/* Customer Service Statement */}
            <section className="tw:space-y-3">
              <h3 className="tw:text-sm tw:font-bold tw:text-white tw:uppercase tw:tracking-wider">Customer Service Commitment</h3>
              <p className="tw:text-neutral-400 tw:text-xs tw:leading-relaxed">
                The DwarPal administration is committed to providing a secure and seamless access-management experience. 
                Whether you are experiencing biometric verification failures, delayed OTP emails, or approval delays, 
                our dedicated support team is available during campus hours to resolve system anomalies.
              </p>
            </section>

            {/* Contact Grid */}
            <section className="tw:grid tw:grid-cols-1 md:tw:grid-cols-3 tw:gap-4">
              <div className="tw:bg-neutral-950 tw:border tw:border-neutral-800/60 tw:p-5 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:text-center">
                <div className="tw:text-purple-400 tw:mb-2"><Mail size={20} /></div>
                <strong className="tw:text-xs tw:text-white">Email Support</strong>
                <p className="tw:text-[10px] tw:text-neutral-400 tw:mt-1 tw:font-mono">dwarpalcode@gmail.com</p>
                <span className="tw:text-[8px] tw:font-mono tw:text-neutral-500 tw:mt-auto tw:pt-2">Response in 24-48 Hours</span>
              </div>

              <div className="tw:bg-neutral-950 tw:border tw:border-neutral-800/60 tw:p-5 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:text-center">
                <div className="tw:text-purple-400 tw:mb-2"><Clock3 size={20} /></div>
                <strong className="tw:text-xs tw:text-white">Support Hours</strong>
                <p className="tw:text-[10px] tw:text-neutral-400 tw:mt-1">Monday - Saturday</p>
                <span className="tw:text-[8px] tw:font-mono tw:text-neutral-500 tw:mt-auto tw:pt-2">9:00 AM - 5:00 PM IST</span>
              </div>

              <div className="tw:bg-neutral-950 tw:border tw:border-neutral-800/60 tw:p-5 tw:rounded-xl tw:flex tw:flex-col tw:items-center tw:text-center">
                <div className="tw:text-purple-400 tw:mb-2"><Phone size={20} /></div>
                <strong className="tw:text-xs tw:text-white">Campus IT Helpdesk</strong>
                <p className="tw:text-[10px] tw:text-neutral-400 tw:mt-1 tw:font-mono">9328563802</p>
                <p className="tw:text-[10px] tw:text-neutral-400 tw:font-mono">926579539</p>
                <span className="tw:text-[8px] tw:font-mono tw:text-neutral-500 tw:mt-auto tw:pt-2">For Urgent Gate Queries</span>
              </div>
            </section>

            {/* Interactive FAQs Accordion */}
            <section className="tw:space-y-4">
              <h3 className="tw:text-sm tw:font-bold tw:text-white tw:uppercase tw:tracking-wider tw:mb-2">Frequently Asked Questions</h3>
              
              <div className="tw:space-y-2.5">
                {FAQ_ITEMS.map((item, idx) => {
                  const isOpen = openIndex === idx
                  return (
                    <div 
                      key={idx} 
                      className="tw:border tw:border-neutral-800/80 tw:bg-neutral-950/30 tw:rounded-xl tw:overflow-hidden tw:transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(idx)}
                        className="tw:w-full tw:py-4 tw:px-5 tw:flex tw:justify-between tw:items-center tw:text-left tw:gap-4 hover:tw:bg-neutral-800/20 tw:transition-colors tw:cursor-pointer tw:bg-transparent tw:border-none tw:shadow-none tw:outline-none"
                        style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                      >
                        <span className="tw:text-xs tw:font-semibold tw:text-neutral-200">{item.question}</span>
                        <span className="tw:text-purple-400">
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </button>
                      
                      {isOpen && (
                        <div className="tw:px-5 tw:pb-4 tw:pt-1 tw:border-t tw:border-neutral-800/30 tw:bg-neutral-950/20">
                          <p className="tw:text-[11px] tw:text-neutral-400 tw:leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Quick Warning / Important Notice */}
            <div className="tw:bg-amber-950/10 tw:border tw:border-amber-900/25 tw:p-4 tw:rounded-xl tw:flex tw:gap-3">
              <div className="tw:text-amber-500 tw:mt-0.5"><AlertCircle size={16} /></div>
              <div>
                <h4 className="tw:text-white tw:font-semibold tw:text-xs tw:mb-0.5">Emergency Gate Exit</h4>
                <p className="tw:text-neutral-400 tw:text-[10px]">
                  In the event of network outages or emergency evacuations, the physical campus register remains active. 
                  Please proceed to the security cabin for manual offline authorization logs.
                </p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="tw:bg-neutral-950 tw:p-6 tw:border-t tw:border-neutral-800 tw:flex tw:justify-between tw:items-center tw:flex-wrap tw:gap-4">
            <span className="tw:text-xs tw:font-mono tw:text-neutral-500">DwarPal Support Hub © 2026</span>
            <ActionButton type="button" onClick={() => navigate('/')}>
              Return to Dashboard
            </ActionButton>
          </div>

        </div>

      </div>
    </div>
  )
}
