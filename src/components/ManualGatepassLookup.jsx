import { QrCode } from 'lucide-react'
import { ActionButton } from './ui'

export default function ManualGatepassLookup({
  value,
  onChange,
  onSubmit,
  loading = false,
  inputRef = null,
}) {
  return (
    <div className="security-verify-controls security-verify-manual">
      <div className="security-manual-copy">
        <span className="eyebrow">Manual Fallback</span>
        <h4>Verify by Gatepass ID</h4>
        <p>Paste a Gatepass ID, QR link, or verification token to fetch the same security actions instantly.</p>
      </div>

      <label className="security-verify-input">
        <span className="field-label">
          <span className="field-label-text">Gatepass ID or QR value</span>
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
          placeholder="DP-STU-2026040001 or QR link"
          autoComplete="off"
          spellCheck="false"
        />
      </label>

      <div className="security-verify-actions">
        <ActionButton
          type="button"
          icon={QrCode}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify Gatepass'}
        </ActionButton>
      </div>
    </div>
  )
}
