import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, LoaderCircle, QrCode, ScanLine, X } from 'lucide-react'
import QrScanner from 'qr-scanner'
import { ActionButton } from './ui'

const BLACK_PREVIEW_TIMEOUT_MS = 4200

function buildScanRegion(video) {
  const smallestDimension = Math.min(video.videoWidth || 720, video.videoHeight || 720)
  const regionSize = Math.round(smallestDimension * 0.66)
  const x = Math.round(((video.videoWidth || regionSize) - regionSize) / 2)
  const y = Math.round(((video.videoHeight || regionSize) - regionSize) / 2)

  return {
    x,
    y,
    width: regionSize,
    height: regionSize,
    downScaledWidth: 640,
    downScaledHeight: 640,
  }
}

function getCameraErrorState(error) {
  const errorName = error?.name || ''

  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return {
      permission: 'denied',
      message: 'Camera access was denied. Allow camera permission and try again.',
    }
  }

  if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') {
    return {
      permission: 'missing',
      message: 'No usable camera was found on this device. Use manual Gatepass lookup instead.',
    }
  }

  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return {
      permission: 'busy',
      message: 'The camera is already in use by another app. Close that app and try again.',
    }
  }

  return {
    permission: 'error',
    message: error?.message || 'Scanner initialization failed. Please try again.',
  }
}

export default function ScannerModal({
  open,
  onClose,
  onDetected,
  onUseManualFallback,
  busy = false,
}) {
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const blackPreviewTimeoutRef = useRef(0)
  const decodeLockRef = useRef(false)
  const lastDetectedValueRef = useRef('')
  const lastDetectedAtRef = useRef(0)
  const [status, setStatus] = useState('idle')
  const [statusText, setStatusText] = useState('Align QR inside the frame')
  const [error, setError] = useState('')
  const [cameraPermission, setCameraPermission] = useState('idle')
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) {
      destroyScanner()
      resetScannerState()
      return undefined
    }

    let cancelled = false

    async function startScanner() {
      resetScannerState()
      setStatus('starting')
      setStatusText('Opening camera...')

      if (typeof window === 'undefined' || !videoRef.current) {
        setStatus('error')
        setCameraPermission('unsupported')
        setError('Camera preview is not available in this browser.')
        return
      }

      try {
        const hasCamera = await QrScanner.hasCamera()

        if (!hasCamera) {
          setStatus('error')
          setCameraPermission('missing')
          setError('No camera was found on this device. Use manual Gatepass lookup instead.')
          return
        }

        if (cancelled || !videoRef.current) {
          return
        }

        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            const rawValue = String(result?.data || '').trim()

            if (!rawValue || decodeLockRef.current) {
              return
            }

            const now = Date.now()
            const isDuplicate =
              rawValue === lastDetectedValueRef.current && now - lastDetectedAtRef.current < 2500

            if (isDuplicate) {
              return
            }

            decodeLockRef.current = true
            lastDetectedValueRef.current = rawValue
            lastDetectedAtRef.current = now
            setStatus('verifying')
            setStatusText('QR detected. Fetching gatepass details...')
            setError('')

            try {
              await scanner.pause(true)
              await onDetected?.(rawValue)
            } catch (detectionError) {
              decodeLockRef.current = false
              setStatus('ready')
              setStatusText('Align QR inside the frame')
              setError(detectionError?.message || 'Unable to verify the scanned QR. Please try again.')

              try {
                await scanner.start()
              } catch (restartError) {
                const nextState = getCameraErrorState(restartError)
                setStatus('error')
                setCameraPermission(nextState.permission)
                setError(nextState.message)
              }
            }
          },
          {
            calculateScanRegion: buildScanRegion,
            maxScansPerSecond: 12,
            preferredCamera: 'environment',
            returnDetailedScanResult: true,
            onDecodeError: (decodeError) => {
              if (String(decodeError) === QrScanner.NO_QR_CODE_FOUND || decodeLockRef.current) {
                return
              }

              setError('Unable to read the QR clearly yet. Hold steady and keep it inside the frame.')
            },
          },
        )

        scannerRef.current = scanner
        await scanner.start()

        if (cancelled) {
          scanner.destroy()
          return
        }

        setStatus('ready')
        setStatusText('Align QR inside the frame')
        setCameraPermission('granted')
        setError('')

        blackPreviewTimeoutRef.current = window.setTimeout(() => {
          if (!videoRef.current) {
            return
          }

          if (videoRef.current.videoWidth > 0 && videoRef.current.readyState >= 2) {
            return
          }

          destroyScanner()
          setStatus('error')
          setCameraPermission('error')
          setError('Camera opened but the preview stayed black. Close other camera apps and try again.')
        }, BLACK_PREVIEW_TIMEOUT_MS)

        try {
          const flashSupported = await scanner.hasFlash()

          if (!cancelled) {
            setHasFlash(Boolean(flashSupported))
          }
        } catch {
          if (!cancelled) {
            setHasFlash(false)
          }
        }
      } catch (cameraError) {
        const nextState = getCameraErrorState(cameraError)
        destroyScanner()
        setStatus('error')
        setCameraPermission(nextState.permission)
        setError(nextState.message)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      destroyScanner()
    }
  }, [onDetected, open])

  function resetScannerState() {
    decodeLockRef.current = false
    lastDetectedValueRef.current = ''
    lastDetectedAtRef.current = 0
    setStatus('idle')
    setStatusText('Align QR inside the frame')
    setError('')
    setCameraPermission('idle')
    setHasFlash(false)
    setFlashOn(false)
  }

  function destroyScanner() {
    if (blackPreviewTimeoutRef.current) {
      window.clearTimeout(blackPreviewTimeoutRef.current)
      blackPreviewTimeoutRef.current = 0
    }

    if (scannerRef.current) {
      scannerRef.current.destroy()
      scannerRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function handleToggleFlash() {
    if (!scannerRef.current || !hasFlash) {
      return
    }

    try {
      if (flashOn) {
        await scannerRef.current.turnFlashOff()
        setFlashOn(false)
        return
      }

      await scannerRef.current.turnFlashOn()
      setFlashOn(true)
    } catch {
      setHasFlash(false)
    }
  }

  if (!open) {
    return null
  }

  const showPreview = status === 'starting' || status === 'ready' || status === 'verifying' || busy

  return (
    <div className="scanner-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="scanner-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Gatepass scanner"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="scanner-modal-header">
          <div>
            <span className="eyebrow">Security Scanner</span>
            <h3>Open Scanner</h3>
            <p>Scan a DwarPal QR code or switch to manual Gatepass lookup if the camera is unavailable.</p>
          </div>
          <button type="button" className="icon-button scanner-modal-close" onClick={onClose} aria-label="Close scanner">
            <X size={18} />
          </button>
        </div>

        <div className={`scanner-modal-viewport ${showPreview ? 'live' : 'empty'}`}>
          <video ref={videoRef} autoPlay muted playsInline />

          {showPreview ? (
            <div className="scanner-modal-overlay" aria-hidden="true">
              <div className={`scanner-focus-frame ${status === 'verifying' || busy ? 'busy' : ''}`}>
                <span className="scanner-frame-corner top-left" />
                <span className="scanner-frame-corner top-right" />
                <span className="scanner-frame-corner bottom-left" />
                <span className="scanner-frame-corner bottom-right" />
              </div>
            </div>
          ) : null}

          {!showPreview ? (
            <div className="scanner-modal-placeholder">
              <AlertTriangle size={22} />
              <strong>Camera unavailable</strong>
              <p>{error || 'Use manual Gatepass lookup to continue.'}</p>
            </div>
          ) : null}

          {status === 'starting' || status === 'verifying' || busy ? (
            <div className="scanner-modal-busy">
              <LoaderCircle size={18} className="spin" />
              <span>{busy || status === 'verifying' ? 'Verifying scanned gatepass...' : 'Opening camera...'}</span>
            </div>
          ) : null}
        </div>

        <div className="scanner-modal-toolbar">
          <div className={`scanner-modal-status ${error ? 'error' : ''}`}>
            {error ? <AlertTriangle size={16} /> : status === 'ready' ? <ScanLine size={16} /> : <Camera size={16} />}
            <span>{error || statusText}</span>
          </div>

          <div className="scanner-modal-actions">
            {hasFlash ? (
              <button type="button" className="text-button scanner-modal-link" onClick={handleToggleFlash}>
                {flashOn ? 'Turn flash off' : 'Turn flash on'}
              </button>
            ) : null}
            <button type="button" className="text-button scanner-modal-link" onClick={onUseManualFallback}>
              <QrCode size={15} />
              <span>Use manual lookup</span>
            </button>
          </div>
        </div>

        {cameraPermission === 'denied' ? (
          <p className="field-help">Allow camera access in your browser settings, then reopen the scanner.</p>
        ) : null}
        {cameraPermission === 'missing' ? (
          <p className="field-help">No camera device was detected. Manual Gatepass lookup will still work.</p>
        ) : null}

        <div className="scanner-modal-footer">
          <ActionButton type="button" tone="secondary" onClick={onUseManualFallback}>
            Use Manual Entry
          </ActionButton>
          <ActionButton type="button" onClick={onClose}>
            Close Scanner
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
