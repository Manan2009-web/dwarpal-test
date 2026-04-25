import { CircleHelp, Mail, ShieldCheck } from 'lucide-react'
import { ActionButton, IdentityField, ModalForm } from './ui'

export default function SupportModal({ open, onClose, support }) {
  return (
    <ModalForm
      open={open}
      onClose={onClose}
      title="Help & Support"
      subtitle="Professional support details for DwarPal access, OTP, approvals, and gatepass issues."
      className="support-modal-card"
    >
      <div className="support-modal-body">
        <div className="support-modal-intro">
          <div className="support-modal-icon">
            <CircleHelp size={22} />
          </div>
          <div>
            <h4>{support.appName}</h4>
            <p>{support.description}</p>
          </div>
        </div>

        <div className="support-modal-grid">
          <IdentityField label="Support Email" value={support.supportEmail} />
          <IdentityField label="App Name" value={support.appName} />
          <IdentityField label="Purpose" value={support.purpose} />
        </div>

        <div className="support-modal-note">
          <Mail size={16} />
          <span>{support.description}</span>
        </div>

        <div className="support-modal-actions">
          <ActionButton type="button" tone="secondary" icon={ShieldCheck} onClick={onClose}>
            Close
          </ActionButton>
        </div>
      </div>
    </ModalForm>
  )
}
