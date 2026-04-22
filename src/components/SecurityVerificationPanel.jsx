import { useMemo, useRef, useState } from 'react'
import { Camera, RefreshCcw, ShieldCheck } from 'lucide-react'
import {
  ApiError,
  extractGatepassVerificationData,
  getApiErrorDetails,
} from '../lib/dwarpalApi'
import ManualGatepassLookup from './ManualGatepassLookup'
import ScannerModal from './ScannerModal'
import { useToast } from './ToastProvider'
import { ActionButton, EmptyState, IdentityField, formatDateTime } from './ui'

function readVerificationError(error, fallbackMessage) {
  if (error instanceof ApiError) {
    return getApiErrorDetails(error, fallbackMessage).message
  }

  return fallbackMessage
}

function formatVerificationValue(value, fallback = 'Awaiting action') {
  if (!value) return fallback
  return formatDateTime(value)
}

function humanizeLabel(value, fallback = 'Not available') {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return fallback
  }

  return normalizedValue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getRoleLabel(gatepass) {
  if (gatepass?.requestKind === 'faculty_leave') return 'Faculty'
  return gatepass?.requesterType === 'faculty' ? 'Faculty' : 'Student'
}

function getWorkflowLabel(gatepass) {
  if (!gatepass) {
    return 'Workflow not available'
  }

  if (gatepass.requestKind === 'faculty_leave') {
    return [gatepass.leaveType || 'Leave', gatepass.workloadStage, gatepass.shortLeaveStage]
      .filter(Boolean)
      .join(' | ')
  }

  return [humanizeLabel(gatepass.stage, ''), humanizeLabel(gatepass.rawApprovalLevel, '')]
    .filter(Boolean)
    .join(' | ') || `${getRoleLabel(gatepass)} workflow`
}

function getGatepassIdentifier(gatepass) {
  return gatepass?.gatepassId || gatepass?.requestNumber || gatepass?.id || 'Not available'
}

function getNextSecurityAction(gatepass) {
  if (!gatepass) {
    return null
  }

  if (gatepass.security?.checkedInAt || gatepass.status === 'Returned') {
    return null
  }

  if (gatepass.security?.checkedOutAt || gatepass.status === 'Out') {
    return 'markIn'
  }

  if (gatepass.status === 'Approved') {
    return 'markOut'
  }

  return null
}

function buildOptimisticGatepassAfterAction(gatepass, action) {
  const now = new Date().toISOString()
  const nextSecurity = {
    ...(gatepass?.security || {}),
  }

  if (action === 'markOut') {
    nextSecurity.checkedOutAt = nextSecurity.checkedOutAt || now
  } else if (action === 'markIn') {
    nextSecurity.checkedInAt = nextSecurity.checkedInAt || now
  }

  return {
    ...gatepass,
    status: action === 'markOut' ? 'Out' : 'Returned',
    updatedAt: now,
    security: nextSecurity,
  }
}

function getVerificationStateMeta(result) {
  const gatepass = result?.gatepass

  if (gatepass?.status === 'Returned') {
    return {
      tone: 'completed',
      label: 'Completed',
    }
  }

  if (result?.valid) {
    return {
      tone: 'valid',
      label: 'Ready',
    }
  }

  return {
    tone: 'invalid',
    label: 'Blocked',
  }
}

export default function SecurityVerificationPanel({
  onVerifyById,
  onVerifyQr,
  onGatepassAction,
  onOpenQrPreview,
}) {
  const toast = useToast()
  const manualInputRef = useRef(null)
  const [gatepassId, setGatepassId] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [verificationResult, setVerificationResult] = useState(null)
  const [isManualVerifying, setIsManualVerifying] = useState(false)
  const [isScanVerifying, setIsScanVerifying] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const actionButton = useMemo(() => {
    if (!verificationResult?.valid || !verificationResult?.nextAction) {
      return null
    }

    if (verificationResult.nextAction === 'markOut') {
      return {
        label: isActionLoading ? 'Marking OUT...' : 'Mark OUT',
        tone: 'security-out',
      }
    }

    return {
      label: isActionLoading ? 'Marking Return...' : 'Mark Return',
      tone: 'secondary',
    }
  }, [isActionLoading, verificationResult])

  const resultFields = useMemo(() => {
    const gatepass = verificationResult?.gatepass

    if (!gatepass) {
      return []
    }

    return [
      { label: 'Gatepass ID', value: getGatepassIdentifier(gatepass) },
      { label: 'Name', value: gatepass.name || 'Not provided' },
      { label: 'Role', value: getRoleLabel(gatepass) },
      { label: 'Department', value: gatepass.department || 'Not provided' },
      {
        label: gatepass.requestKind === 'faculty_leave' ? 'Program / Designation' : 'Program',
        value: gatepass.program || gatepass.designation || 'Not provided',
      },
      { label: 'Reason', value: gatepass.reason || 'No reason provided' },
      { label: 'Created', value: formatVerificationValue(gatepass.submittedAt, 'Not created yet') },
      { label: 'Updated', value: formatVerificationValue(gatepass.updatedAt, 'Not updated yet') },
      { label: 'Out Time', value: formatVerificationValue(gatepass.outTime, 'Not scheduled') },
      {
        label: 'Return Time',
        value: gatepass.expectedReturnTime ? formatVerificationValue(gatepass.expectedReturnTime) : 'One way',
      },
      { label: 'Workflow Stage', value: getWorkflowLabel(gatepass) },
      { label: 'Approval Status', value: gatepass.status || 'Pending' },
      { label: 'Handled By', value: gatepass.approvedBy || 'Awaiting approval' },
      { label: 'Vehicle Number', value: gatepass.vehicleNumber || 'Not provided' },
      { label: 'Destination', value: gatepass.destination || gatepass.instituteName || 'Not provided' },
      { label: 'Marked OUT', value: formatVerificationValue(gatepass.security?.checkedOutAt, 'Pending') },
      { label: 'Marked Returned', value: formatVerificationValue(gatepass.security?.checkedInAt, 'Pending') },
      { label: 'Rejection Reason', value: gatepass.rejectionReason || 'Not applicable' },
    ]
  }, [verificationResult])

  function resetFeedback({ preserveResult = false } = {}) {
    setError('')
    setStatusMessage('')

    if (!preserveResult) {
      setVerificationResult(null)
    }
  }

  function handleLookupValueChange(nextValue) {
    setGatepassId(nextValue)
    setError('')
    setStatusMessage('')
  }

  async function applyVerificationResult(result, successFallback) {
    const resolvedMessage = result?.message || successFallback

    setVerificationResult(result)
    setStatusMessage(resolvedMessage)

    if (!result?.valid) {
      setError(resolvedMessage)
      toast.warning({
        title: 'Verification blocked',
        message: resolvedMessage,
      })
    } else {
      setError('')
      toast.success({
        title: 'Verification completed',
        message: resolvedMessage,
      })
    }
  }

  async function handleVerifyById(nextGatepassId = gatepassId) {
    const normalizedValue = String(nextGatepassId || '').trim()

    if (!normalizedValue) {
      setVerificationResult(null)
      setStatusMessage('')
      setError('Enter a Gatepass ID to continue.')
      return
    }

    setIsManualVerifying(true)
    resetFeedback()

    try {
      const result = await onVerifyById(normalizedValue)
      await applyVerificationResult(result, 'Gatepass verification completed.')
    } catch (verifyError) {
      const errorMessage = readVerificationError(verifyError, 'Unable to verify this Gatepass ID right now.')
      setVerificationResult(null)
      setError(errorMessage)
      toast.error({
        title: 'Verification failed',
        message: errorMessage,
      })
    } finally {
      setIsManualVerifying(false)
    }
  }

  async function handleManualVerify(nextValue = gatepassId) {
    const normalizedValue = String(nextValue || '').trim()

    if (!normalizedValue) {
      setVerificationResult(null)
      setStatusMessage('')
      setError('Enter a Gatepass ID or scan value to continue.')
      return
    }

    const verificationData = extractGatepassVerificationData(normalizedValue)

    if (verificationData.verificationToken) {
      await handleVerifyScannedQr(normalizedValue)
      return
    }

    await handleVerifyById(verificationData.gatepassId || normalizedValue)
  }

  async function handleVerifyScannedQr(rawValue) {
    setIsScanVerifying(true)
    resetFeedback()

    try {
      const result = await onVerifyQr(rawValue)
      await applyVerificationResult(result, 'QR verification completed.')
    } catch (verifyError) {
      const errorMessage = readVerificationError(verifyError, 'Unable to verify this QR right now.')
      setVerificationResult(null)
      setError(errorMessage)
      toast.error({
        title: 'QR verification failed',
        message: errorMessage,
      })
    } finally {
      setIsScanVerifying(false)
    }
  }

  async function handleScannerDetected(rawValue) {
    const verificationData = extractGatepassVerificationData(rawValue)
    setGatepassId(verificationData.gatepassId || rawValue)
    setScannerOpen(false)
    await handleVerifyScannedQr(rawValue)
  }

  function handleUseManualFallback() {
    setScannerOpen(false)

    window.setTimeout(() => {
      manualInputRef.current?.focus?.()
    }, 50)
  }

  async function handleSecurityAction() {
    if (!verificationResult?.gatepass || !verificationResult?.nextAction || isActionLoading) {
      return
    }

    setIsActionLoading(true)
    setError('')
    setStatusMessage('')

    const requestBody =
      verificationResult.nextAction === 'markOut' && verificationResult.gatepass.qr?.verificationToken
        ? { verificationToken: verificationResult.gatepass.qr.verificationToken }
        : null

    try {
      const actionResult = await onGatepassAction(
        verificationResult.gatepass,
        verificationResult.nextAction,
        requestBody,
      )

      if (!actionResult?.ok) {
        setError(actionResult?.error || 'Unable to update this gatepass right now.')
        return
      }

      const updatedGatepass =
        actionResult.request || buildOptimisticGatepassAfterAction(verificationResult.gatepass, verificationResult.nextAction)
      const nextAction = getNextSecurityAction(updatedGatepass)
      const actionMessage =
        verificationResult.nextAction === 'markOut'
          ? 'Gatepass marked OUT successfully.'
          : 'Gatepass marked as returned successfully.'

      setVerificationResult({
        valid: Boolean(nextAction),
        message: actionMessage,
        gatepass: updatedGatepass,
        nextAction,
      })
      setStatusMessage(actionMessage)
      setError('')
    } finally {
      setIsActionLoading(false)
    }
  }

  const gatepass = verificationResult?.gatepass
  const verificationStateMeta = getVerificationStateMeta(verificationResult)

  return (
    <section className="workspace-card security-verify-card">
      <div className="section-heading">
        <div>
          <h3>Security scanner</h3>
          <p>Open the camera for fast QR verification or fall back to manual Gatepass lookup without leaving the queue.</p>
        </div>
      </div>

      <div className="security-verify-grid">
        <div className="security-scan-panel">
          <div className="security-scan-card security-scan-launcher">
            <div className="security-scan-card-header">
              <div>
                <span className="eyebrow">Camera Scanner</span>
                <h4>Open Scanner</h4>
                <p>Uses the device camera, duplicate-scan protection, and immediate verification after a successful read.</p>
              </div>
              <ActionButton
                type="button"
                icon={Camera}
                onClick={() => setScannerOpen(true)}
                disabled={isScanVerifying}
              >
                {isScanVerifying ? 'Verifying scan...' : 'Open Scanner'}
              </ActionButton>
            </div>

            <div className="scanner-launch-surface" aria-hidden="true">
              <div className="scanner-launch-frame">
                <span className="scanner-frame-corner top-left" />
                <span className="scanner-frame-corner top-right" />
                <span className="scanner-frame-corner bottom-left" />
                <span className="scanner-frame-corner bottom-right" />
              </div>
              <div className="scanner-launch-copy">
                <strong>Align QR inside the frame</strong>
                <p>The scanner opens in a focused modal and fetches gatepass details as soon as the QR is detected.</p>
              </div>
            </div>

            <div className="scanner-launch-points">
              <span>Fast QR detection</span>
              <span>Permission + camera error handling</span>
              <span>Manual fallback always available</span>
            </div>
          </div>
        </div>

        <ManualGatepassLookup
          value={gatepassId}
          onChange={handleLookupValueChange}
          onSubmit={() => handleManualVerify()}
          loading={isManualVerifying || isScanVerifying}
          inputRef={manualInputRef}
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {!error && statusMessage ? <p className="form-success">{statusMessage}</p> : null}

      {gatepass ? (
        <div className="security-verify-result-card">
          <div className="security-verify-result-header">
            <div>
              <span className="eyebrow">Verification Result</span>
              <h4>{getGatepassIdentifier(gatepass)}</h4>
              <p>{verificationResult?.message}</p>
            </div>
            <div className={`security-verification-status ${verificationStateMeta.tone}`}>
              <ShieldCheck size={16} />
              <span>{verificationStateMeta.label}</span>
            </div>
          </div>

          <div className="security-result-grid">
            {resultFields.map((field) => (
              <IdentityField key={`${field.label}-${field.value}`} label={field.label} value={field.value} />
            ))}
          </div>

          <div className="security-result-actions">
            <ActionButton type="button" tone="secondary" icon={RefreshCcw} onClick={() => setScannerOpen(true)}>
              Scan Another
            </ActionButton>
            {gatepass.qr?.available ? (
              <ActionButton
                type="button"
                tone="secondary"
                onClick={() => onOpenQrPreview?.(gatepass)}
              >
                View QR
              </ActionButton>
            ) : null}
            {actionButton ? (
              <ActionButton
                type="button"
                tone={actionButton.tone}
                onClick={handleSecurityAction}
                disabled={isActionLoading}
              >
                {actionButton.label}
              </ActionButton>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No scanned gatepass yet"
          description="Open the scanner or verify a Gatepass ID to load the movement details here."
        />
      )}

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScannerDetected}
        onUseManualFallback={handleUseManualFallback}
        busy={isScanVerifying}
      />
    </section>
  )
}
