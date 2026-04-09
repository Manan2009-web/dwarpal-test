import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, LoaderCircle, QrCode, ScanLine, ShieldCheck } from 'lucide-react'
import { ApiError, getApiErrorDetails } from '../lib/dwarpalApi'
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

function getRoleLabel(gatepass) {
  if (gatepass?.requestKind === 'faculty_leave') return 'Faculty'
  return gatepass?.requesterType === 'faculty' ? 'Faculty' : 'Student'
}

export default function SecurityVerificationPanel({
  onVerifyById,
  onVerifyQr,
  onGatepassAction,
  onOpenQrPreview,
}) {
  const toast = useToast()
  const [gatepassId, setGatepassId] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [verificationResult, setVerificationResult] = useState(null)
  const [isManualVerifying, setIsManualVerifying] = useState(false)
  const [isScanVerifying, setIsScanVerifying] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isPreparingScanner, setIsPreparingScanner] = useState(false)
  const [isScannerActive, setIsScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [cameraPermission, setCameraPermission] = useState('idle')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animationFrameRef = useRef(0)
  const detectorRef = useRef(null)
  const scanBusyRef = useRef(false)
  const lastScanAtRef = useRef(0)

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
      label: isActionLoading ? 'Marking Returned...' : 'Mark Returned',
      tone: 'secondary',
    }
  }, [isActionLoading, verificationResult])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  function resetFeedback() {
    setError('')
    setStatusMessage('')
  }

  function stopScanner() {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = 0
    }

    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    scanBusyRef.current = false
    setIsScannerActive(false)
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

    stopScanner()
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

  async function scanFrame() {
    if (!videoRef.current || !detectorRef.current || scanBusyRef.current) {
      animationFrameRef.current = window.requestAnimationFrame(scanFrame)
      return
    }

    if (performance.now() - lastScanAtRef.current < 180) {
      animationFrameRef.current = window.requestAnimationFrame(scanFrame)
      return
    }

    lastScanAtRef.current = performance.now()
    scanBusyRef.current = true

    try {
      const detections = await detectorRef.current.detect(videoRef.current)
      const qrResult = detections.find((item) => String(item?.rawValue || '').trim())

      if (qrResult?.rawValue) {
        stopScanner()
        await handleVerifyScannedQr(qrResult.rawValue)
        return
      }
    } catch (scanError) {
      const scanErrorMessage = readVerificationError(scanError, 'Unable to read the QR yet. Keep the code inside the frame and try again.')
      setScannerError(scanErrorMessage)
    } finally {
      scanBusyRef.current = false
    }

    animationFrameRef.current = window.requestAnimationFrame(scanFrame)
  }

  async function startScanner() {
    resetFeedback()
    setScannerError('')
    setVerificationResult(null)

    if (!window?.navigator?.mediaDevices?.getUserMedia) {
      setCameraPermission('unsupported')
      setScannerError('Camera scanning is not supported in this browser. Use the manual Gatepass ID check instead.')
      toast.warning({
        title: 'Camera unavailable',
        message: 'Camera scanning is not supported in this browser. Use manual Gatepass ID verification instead.',
      })
      return
    }

    if (!window.BarcodeDetector) {
      setCameraPermission('unsupported')
      setScannerError('This browser does not support QR scanning yet. Use the manual Gatepass ID check instead.')
      toast.warning({
        title: 'QR scanning unavailable',
        message: 'This browser does not support QR scanning yet. Use manual Gatepass ID verification instead.',
      })
      return
    }

    setIsPreparingScanner(true)

    try {
      detectorRef.current = detectorRef.current || new window.BarcodeDetector({ formats: ['qr_code'] })
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      setCameraPermission('granted')
      setIsScannerActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      animationFrameRef.current = window.requestAnimationFrame(scanFrame)
    } catch (cameraError) {
      stopScanner()
      const denied = ['NotAllowedError', 'SecurityError'].includes(cameraError?.name)
      setCameraPermission(denied ? 'denied' : 'error')
      const errorMessage = denied
        ? 'Camera access was denied. Allow camera permission and try again.'
        : 'Unable to start the camera scanner right now.'
      setScannerError(errorMessage)
      toast[denied ? 'warning' : 'error']({
        title: denied ? 'Camera permission denied' : 'Camera start failed',
        message: errorMessage,
      })
    } finally {
      setIsPreparingScanner(false)
    }
  }

  async function handleSecurityAction() {
    if (!verificationResult?.gatepass || !verificationResult?.nextAction || isActionLoading) {
      return
    }

    setIsActionLoading(true)
    resetFeedback()

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

      setVerificationResult(null)
      setGatepassId('')
      setStatusMessage(
        verificationResult.nextAction === 'markOut'
          ? 'Gatepass marked OUT successfully.'
          : 'Gatepass marked as returned successfully.',
      )
    } finally {
      setIsActionLoading(false)
    }
  }

  const gatepass = verificationResult?.gatepass

  return (
    <section className="workspace-card security-verify-card">
      <div className="section-heading">
        <div>
          <h3>Scan QR</h3>
          <p>Scan only DwarPal-generated QR codes. Every scan is verified securely against backend records.</p>
        </div>
      </div>

      <div className="security-verify-grid">
        <div className="security-scan-panel">
          <div className="security-scan-card">
            <div className="security-scan-card-header">
              <div>
                <span className="eyebrow">Camera Scanner</span>
                <h4>Open camera and scan QR</h4>
                <p>
                  Works on supported laptop and mobile browsers after camera permission is granted.
                </p>
              </div>
              <ActionButton
                type="button"
                icon={Camera}
                onClick={isScannerActive ? stopScanner : startScanner}
                disabled={isPreparingScanner || isScanVerifying}
              >
                {isPreparingScanner ? 'Opening camera...' : isScannerActive ? 'Stop Scanner' : 'Start Scanner'}
              </ActionButton>
            </div>

            <div className={`scanner-preview ${isScannerActive ? 'active' : ''}`}>
              {isScannerActive ? (
                <video ref={videoRef} autoPlay muted playsInline />
              ) : (
                <div className="scanner-placeholder">
                  <ScanLine size={20} />
                  <p>Camera preview will appear here after permission is granted.</p>
                </div>
              )}
            </div>

            {isScanVerifying ? (
              <div className="scanner-status-card">
                <LoaderCircle size={16} className="spin" />
                <span>QR detected. Verifying with the backend...</span>
              </div>
            ) : null}

            {scannerError ? <p className="form-error">{scannerError}</p> : null}
            {!scannerError && cameraPermission === 'denied' ? (
              <p className="field-help">Camera access is required for QR scanning. Use manual Gatepass ID verification if needed.</p>
            ) : null}
          </div>
        </div>

        <div className="security-verify-controls security-verify-manual">
          <div className="security-manual-copy">
            <span className="eyebrow">Manual Fallback</span>
            <h4>Verify by Gatepass ID</h4>
            <p>Use this when the camera is unavailable or the QR cannot be read.</p>
          </div>
          <label className="security-verify-input">
            <span className="field-label">
              <span className="field-label-text">Gatepass ID</span>
            </span>
            <input
              value={gatepassId}
              onChange={(event) => setGatepassId(event.target.value.toUpperCase())}
              placeholder="DP-STU-2026040001"
              autoComplete="off"
              spellCheck="false"
            />
          </label>
          <div className="security-verify-actions">
            <ActionButton
              type="button"
              icon={QrCode}
              onClick={() => handleVerifyById()}
              disabled={isManualVerifying}
            >
              {isManualVerifying ? 'Verifying Gatepass ID...' : 'Verify Gatepass ID'}
            </ActionButton>
          </div>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {!error && statusMessage ? <p className="form-success">{statusMessage}</p> : null}

      {gatepass ? (
        <div className="security-verify-result-card">
          <div className="security-verify-result-header">
            <div>
              <span className="eyebrow">Verification Result</span>
              <h4>{gatepass.gatepassId || gatepass.requestNumber || gatepass.id}</h4>
              <p>{verificationResult?.message}</p>
            </div>
            <div className={`security-verification-status ${verificationResult?.valid ? 'valid' : 'invalid'}`}>
              <ShieldCheck size={16} />
              <span>{verificationResult?.valid ? 'Valid' : 'Blocked'}</span>
            </div>
          </div>

          <div className="security-result-grid">
            <IdentityField label="Gatepass ID" value={gatepass.gatepassId || gatepass.requestNumber || gatepass.id} />
            <IdentityField label="Name" value={gatepass.name} />
            <IdentityField label="Role" value={getRoleLabel(gatepass)} />
            <IdentityField label="Department" value={gatepass.department} />
            <IdentityField label="Reason" value={gatepass.reason} />
            <IdentityField label="Out Time" value={formatVerificationValue(gatepass.outTime)} />
            <IdentityField
              label="Return Time"
              value={gatepass.expectedReturnTime ? formatVerificationValue(gatepass.expectedReturnTime) : 'One way'}
            />
            <IdentityField label="Status" value={gatepass.status} />
            <IdentityField label="Approved By" value={gatepass.approvedBy || 'Awaiting approval'} />
            <IdentityField label="Date" value={formatVerificationValue(gatepass.approvedAt || gatepass.submittedAt || gatepass.outTime)} />
          </div>

          <div className="security-result-actions">
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
          description="Start the scanner or verify a Gatepass ID to view its details here."
        />
      )}
    </section>
  )
}
