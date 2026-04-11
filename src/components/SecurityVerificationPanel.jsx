import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, LoaderCircle, QrCode, ScanLine, ShieldCheck } from 'lucide-react'
import { ApiError, extractGatepassVerificationData, getApiErrorDetails } from '../lib/dwarpalApi'
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
  const scannerWatchdogRef = useRef(0)

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

    if (scannerWatchdogRef.current) {
      window.clearTimeout(scannerWatchdogRef.current)
      scannerWatchdogRef.current = 0
    }

    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    scanBusyRef.current = false
    setIsScannerActive(false)
  }

  async function hasVideoInputDevice() {
    if (!window?.navigator?.mediaDevices?.enumerateDevices) {
      return true
    }

    try {
      const devices = await window.navigator.mediaDevices.enumerateDevices()
      return devices.some((device) => device.kind === 'videoinput')
    } catch {
      return true
    }
  }

  async function requestCameraStream() {
    const constraintCandidates = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ]

    let lastError = null

    for (const constraints of constraintCandidates) {
      try {
        return await window.navigator.mediaDevices.getUserMedia(constraints)
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Unable to initialize camera stream.')
  }

  function waitForVideoReady(videoElement, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (!videoElement) {
        reject(new Error('Video preview is not available.'))
        return
      }

      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        resolve()
        return
      }

      let timeoutId = 0

      function cleanup() {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
        videoElement.removeEventListener('error', handleVideoError)

        if (timeoutId) {
          window.clearTimeout(timeoutId)
        }
      }

      function handleLoadedMetadata() {
        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          cleanup()
          resolve()
        }
      }

      function handleVideoError() {
        cleanup()
        reject(new Error('Camera preview failed to initialize.'))
      }

      timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error('Camera opened but no video feed was received.'))
      }, timeoutMs)

      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata)
      videoElement.addEventListener('error', handleVideoError)
    })
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
      stopScanner()
      setGatepassId(normalizedValue)
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
      const hasCamera = await hasVideoInputDevice()

      if (!hasCamera) {
        setCameraPermission('missing')
        setScannerError('No camera was found on this device. Use manual Gatepass ID verification instead.')
        toast.warning({
          title: 'No camera found',
          message: 'No camera was found on this device. Use manual Gatepass ID verification instead.',
        })
        return
      }

      detectorRef.current = detectorRef.current || new window.BarcodeDetector({ formats: ['qr_code'] })
      const stream = await requestCameraStream()

      streamRef.current = stream
      setCameraPermission('granted')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        await waitForVideoReady(videoRef.current)
      }

      setIsScannerActive(true)
      animationFrameRef.current = window.requestAnimationFrame(scanFrame)

      scannerWatchdogRef.current = window.setTimeout(() => {
        if (!videoRef.current || videoRef.current.videoWidth > 0) {
          return
        }

        stopScanner()
        setScannerError('Camera opened but the preview stayed black. Please close other camera apps and try again.')
        toast.warning({
          title: 'Camera preview issue',
          message: 'Camera opened but the preview stayed black. Please close other camera apps and try again.',
        })
      }, 4500)
    } catch (cameraError) {
      stopScanner()
      const denied = ['NotAllowedError', 'SecurityError'].includes(cameraError?.name)
      const noCamera = ['NotFoundError', 'OverconstrainedError'].includes(cameraError?.name)
      const cameraBusy = ['NotReadableError', 'TrackStartError'].includes(cameraError?.name)
      setCameraPermission(denied ? 'denied' : noCamera ? 'missing' : 'error')
      const errorMessage = denied
        ? 'Camera access was denied. Allow camera permission and try again.'
        : noCamera
          ? 'No usable camera was found. Use manual Gatepass ID verification instead.'
          : cameraBusy
            ? 'Camera is busy in another app. Close that app and try again.'
            : cameraError?.message || 'Scanner initialization failed. Please try again.'

      setScannerError(errorMessage)
      toast[denied || noCamera ? 'warning' : 'error']({
        title: denied
          ? 'Camera permission denied'
          : noCamera
            ? 'No camera available'
            : cameraBusy
              ? 'Camera busy'
              : 'Scanner initialization failed',
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
          <h3>Scan Gatepass</h3>
          <p>Scan only DwarPal-generated QR codes. Every scan is verified securely against backend records.</p>
        </div>
      </div>

      <div className="security-verify-grid">
        <div className="security-scan-panel">
          <div className="security-scan-card">
            <div className="security-scan-card-header">
              <div>
                <span className="eyebrow">Camera Scanner</span>
                <h4>Scan Gatepass</h4>
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
                {isPreparingScanner ? 'Opening scanner...' : isScannerActive ? 'Stop Scanner' : 'Scan Gatepass'}
              </ActionButton>
            </div>

            <div className={`scanner-preview ${isScannerActive ? 'active' : ''}`}>
              {isScannerActive ? (
                <video ref={videoRef} autoPlay muted playsInline />
              ) : (
                <div className="scanner-placeholder">
                  <ScanLine size={20} />
                  <p>Tap Scan Gatepass to open the camera and verify a QR code.</p>
                </div>
              )}
            </div>

            {isScanVerifying ? (
              <div className="scanner-status-card">
                <LoaderCircle size={16} className="spin" />
                <span>QR detected. Verifying the gatepass...</span>
              </div>
            ) : null}

            {scannerError ? <p className="form-error">{scannerError}</p> : null}
            {!scannerError && cameraPermission === 'denied' ? (
              <p className="field-help">Camera access is required for QR scanning. Use manual Gatepass ID verification if needed.</p>
            ) : null}
            {!scannerError && cameraPermission === 'missing' ? (
              <p className="field-help">No camera detected. Continue with manual Gatepass ID verification.</p>
            ) : null}
          </div>
        </div>

        <div className="security-verify-controls security-verify-manual">
          <div className="security-manual-copy">
            <span className="eyebrow">Manual Fallback</span>
            <h4>Verify by Gatepass ID</h4>
            <p>Use this when the camera is unavailable or paste a QR link/token if needed.</p>
          </div>
          <label className="security-verify-input">
            <span className="field-label">
              <span className="field-label-text">Gatepass ID or QR value</span>
            </span>
            <input
              value={gatepassId}
              onChange={(event) => setGatepassId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleManualVerify()
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
              onClick={() => handleManualVerify()}
              disabled={isManualVerifying || isScanVerifying}
            >
              {isManualVerifying || isScanVerifying ? 'Verifying...' : 'Verify Gatepass'}
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
            <IdentityField label="Program" value={gatepass.program || 'Not assigned'} />
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
