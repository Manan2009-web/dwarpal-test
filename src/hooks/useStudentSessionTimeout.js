import { useEffect, useRef } from 'react'

// Auto-logout students after 20 minutes of inactivity.
// Non-student roles are unaffected - the hook is a complete no-op for them.
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes
const CHECK_INTERVAL_MS = 30 * 1000 // poll every 30 s

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click']

export function useStudentSessionTimeout(currentUser, onTimeout, navigate) {
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    // Only activate for student role
    if (!currentUser || currentUser.role !== 'student') return

    // Update last-activity timestamp on any user interaction
    const resetTimer = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    // Periodically check if the inactivity window has been exceeded
    const intervalId = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        // Clear session and send the student to the full login screen
        onTimeout()
        navigate('/login', { replace: true })
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
      window.clearInterval(intervalId)
    }
  }, [currentUser, onTimeout, navigate])
}
