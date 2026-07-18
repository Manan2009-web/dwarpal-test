import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { ActionButton, ModalForm, formatDateTime } from './ui'

function SecureQrCanvas({ dataUrl, label, masked }) {
  const canvasRef = useRef(null)
  const [isRendering, setIsRendering] = useState(true)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !dataUrl) {
      setIsRendering(false)
      setRenderError('QR preview is not available right now.')
      return undefined
    }

    let cancelled = false
    const image = new Image()

    image.onload = () => {
      if (cancelled || !canvas) return

      const context = canvas.getContext('2d', { alpha: false })

      if (!context) {
        setRenderError('Unable to prepare the secure QR preview.')
        setIsRendering(false)
        return
      }

      const size = 360
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = Math.round(size * pixelRatio)
      canvas.height = Math.round(size * pixelRatio)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, size, size)
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, size, size)
      setRenderError('')
      setIsRendering(false)
    }

    image.onerror = () => {
      if (!cancelled) {
        setRenderError('Unable to load the QR preview.')
        setIsRendering(false)
      }
    }

    image.decoding = 'async'
    image.src = dataUrl

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [dataUrl])

  return (
    <div
      className={`secure-qr-canvas-shell ${masked ? 'masked' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        aria-label={label}
        className="secure-qr-canvas"
      />
      {isRendering ? (
        <div className="secure-qr-overlay">
          <p>Preparing secure QR...</p>
        </div>
      ) : null}
      {renderError ? (
        <div className="secure-qr-overlay error">
          <p>{renderError}</p>
        </div>
      ) : null}
      {masked && !renderError ? (
        <div className="secure-qr-overlay warning">
          <EyeOff size={18} />
          <p>QR hidden while the screen is inactive.</p>
        </div>
      ) : null}
    </div>
  )
}

function getQrDateLine(gatepass) {
  if (!gatepass) return ''

  if (gatepass.requestKind === 'faculty_leave') {
    return gatepass.shortLeaveDate ? formatDateTime(gatepass.outTime) : gatepass.leaveFrom || 'Approved leave'
  }

  return gatepass.outTime ? formatDateTime(gatepass.outTime) : 'Approved gatepass'
}

function getQrReturnLine(gatepass) {
  if (!gatepass) return 'Ready for security scan'

  if (gatepass.expectedReturnTime) {
    return `Return by ${formatDateTime(gatepass.expectedReturnTime)}`
  }

  if (gatepass.shortLeaveDurationLabel) {
    return gatepass.shortLeaveDurationLabel
  }

  return 'Ready for security scan'
}

export default function GatepassQrModal({ gatepass, open, onClose }) {
  const [requiresReveal, setRequiresReveal] = useState(false)
  const qrDataUrl = gatepass?.qr?.imageDataUrl || ''
  const gatepassLabel = gatepass?.gatepassId || gatepass?.requestNumber || gatepass?.id || 'gatepass'
  const qrInfo = useMemo(
    () => ({
      dateLine: getQrDateLine(gatepass),
      returnLine: getQrReturnLine(gatepass),
    }),
    [gatepass],
  )

  useEffect(() => {
    if (!open) {
      setRequiresReveal(false)
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Browsers do not provide reliable screenshot blocking in regular web pages.
    // Best effort: hide the QR whenever the tab loses focus so the preview is not
    // left exposed during app switching or background capture.
    function handleDocumentHidden() {
      if (document.hidden) {
        setRequiresReveal(true)
      }
    }

    function handleWindowBlur() {
      setRequiresReveal(true)
    }

    document.addEventListener('visibilitychange', handleDocumentHidden)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('visibilitychange', handleDocumentHidden)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [open])

  if (!open || !gatepass) {
    return null
  }

  return (
    <ModalForm
      open={open}
      title="Gatepass QR"
      subtitle={gatepassLabel}
      onClose={onClose}
      className="gatepass-qr-modal-card"
      backdropClassName="gatepass-qr-modal-backdrop"
    >
      <div className="gatepass-qr-modal-content">
        <div className="gatepass-qr-security-badge">
          <ShieldAlert size={14} className="badge-icon" />
          <span>Screenshot protection active. QR hides on tab blur.</span>
        </div>

        <div className="gatepass-qr-stage-wrapper">
          <div className="gatepass-qr-live-indicator">
            <span className="live-indicator-dot" />
            <span>LIVE GATEPASS</span>
          </div>
          <div
            className="gatepass-qr-stage"
            onContextMenu={(event) => event.preventDefault()}
          >
            <SecureQrCanvas
              dataUrl={qrDataUrl}
              label={`QR code for ${gatepassLabel}`}
              masked={requiresReveal}
            />
            {requiresReveal ? (
              <button
                type="button"
                className="secure-qr-reveal"
                onClick={() => setRequiresReveal(false)}
              >
                <Eye size={18} />
                <span>Reveal QR again</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="gatepass-qr-info-strip">
          <div className="info-item">
            <span className="label">Gatepass ID:</span>
            <span className="value">{gatepassLabel}</span>
          </div>
          <div className="info-divider" />
          <div className="info-item">
            <span className="label">Student:</span>
            <span className="value">{gatepass.name || 'Not provided'}</span>
          </div>
          <div className="info-divider" />
          <div className="info-item">
            <span className="label">Approved by:</span>
            <span className="value">{gatepass.approvedBy || 'Awaiting approval'}</span>
          </div>
        </div>

        <div className="gatepass-qr-footer">
          <div className="gatepass-qr-footer-copy">
            <span>{qrInfo.dateLine}</span>
            <span>{qrInfo.returnLine}</span>
          </div>
          <div className="gatepass-qr-footer-actions">
            <div className="gatepass-qr-limit-note">
              <AlertTriangle size={14} />
              <span>Right-click, long-press, and drag are disabled.</span>
            </div>
            <ActionButton type="button" tone="secondary" onClick={onClose}>
              Close QR
            </ActionButton>
          </div>
        </div>
      </div>
    </ModalForm>
  )
}
