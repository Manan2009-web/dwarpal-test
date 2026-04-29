import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import logo from '../../assets/dwarpal_logo.png'

function useFinePointer() {
  const [canTrack, setCanTrack] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateCapability = () => setCanTrack(mediaQuery.matches)

    updateCapability()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateCapability)
      return () => mediaQuery.removeEventListener('change', updateCapability)
    }

    mediaQuery.addListener(updateCapability)
    return () => mediaQuery.removeListener(updateCapability)
  }, [])

  return canTrack
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function setMotionVars(node, { trackX = 0, trackY = 0, idleY = '0px', idleRotate = '0deg' } = {}) {
  if (!node) {
    return
  }

  node.style.setProperty('--track-x', String(trackX))
  node.style.setProperty('--track-y', String(trackY))
  node.style.setProperty('--idle-y', idleY)
  node.style.setProperty('--idle-rotate', idleRotate)
}

export default function MascotPanel() {
  const panelRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastFrameAtRef = useRef(0)
  const canTrack = useFinePointer()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const node = panelRef.current

    if (!node) {
      return undefined
    }

    currentRef.current = { x: 0, y: 0 }
    velocityRef.current = { x: 0, y: 0 }
    lastFrameAtRef.current = 0

    if (reduceMotion) {
      targetRef.current = { x: 0, y: 0 }
      setMotionVars(node)
      return undefined
    }

    let frameId = 0

    function animateFrame(now) {
      const target = targetRef.current
      const current = currentRef.current
      const velocity = velocityRef.current
      const previousFrameAt = lastFrameAtRef.current
      const dtMs = previousFrameAt ? Math.min(now - previousFrameAt, 40) : 16.67
      const dt = dtMs / 1000
      const stiffness = canTrack ? 20 : 9
      const damping = canTrack ? 0.84 : 0.9

      lastFrameAtRef.current = now

      for (const axis of ['x', 'y']) {
        const delta = target[axis] - current[axis]
        velocity[axis] += delta * stiffness * dt
        velocity[axis] *= Math.pow(damping, dt * 60)
        current[axis] = clamp(current[axis] + velocity[axis] * dt * 60, -1, 1)

        if (Math.abs(delta) < 0.0005 && Math.abs(velocity[axis]) < 0.0005) {
          current[axis] = target[axis]
          velocity[axis] = 0
        }
      }

      setMotionVars(node, {
        trackX: current.x.toFixed(4),
        trackY: current.y.toFixed(4),
        idleY: `${(Math.sin(now / 1100) * -6).toFixed(2)}px`,
        idleRotate: `${(Math.sin(now / 1800) * 0.9).toFixed(2)}deg`,
      })

      frameId = window.requestAnimationFrame(animateFrame)
    }

    frameId = window.requestAnimationFrame(animateFrame)

    return () => {
      window.cancelAnimationFrame(frameId)
      lastFrameAtRef.current = 0
    }
  }, [canTrack, reduceMotion])

  useEffect(() => {
    if (typeof window === 'undefined' || reduceMotion || !canTrack) {
      targetRef.current = { x: 0, y: 0 }
      return undefined
    }

    function updatePointer(clientX, clientY) {
      const width = Math.max(window.innerWidth || 0, 1)
      const height = Math.max(window.innerHeight || 0, 1)
      const x = clamp((clientX / width) * 2 - 1, -1, 1)
      const y = clamp((clientY / height) * 2 - 1, -1, 1)

      targetRef.current = {
        x: Number((x * 0.92).toFixed(4)),
        y: Number((y * 0.76).toFixed(4)),
      }
    }

    function resetPointer() {
      targetRef.current = { x: 0, y: 0 }
    }

    function handlePointerMove(event) {
      updatePointer(event.clientX, event.clientY)
    }

    function handleMouseOut(event) {
      if (!event.relatedTarget) {
        resetPointer()
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        resetPointer()
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', resetPointer)
    window.addEventListener('blur', resetPointer)
    document.addEventListener('mouseout', handleMouseOut)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', resetPointer)
      window.removeEventListener('blur', resetPointer)
      document.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [canTrack, reduceMotion])

  const motionRootStyle = {
    '--track-x': 0,
    '--track-y': 0,
    '--idle-y': '0px',
    '--idle-rotate': '0deg',
  }

  return (
    <section
      ref={panelRef}
      className="tw:relative tw:hidden tw:h-full tw:overflow-hidden tw:bg-[linear-gradient(180deg,rgba(242,248,255,0.9),rgba(232,243,255,0.86))] tw:p-8 tw:lg:flex tw:items-center tw:justify-center tw:xl:p-10"
      style={motionRootStyle}
    >
      <style>{`
        @keyframes dwarpal-blink {
          0%, 44%, 48%, 100% { transform: scaleY(0); }
          46% { transform: scaleY(1); }
        }
      `}</style>

      <div className="tw:relative tw:flex tw:w-full tw:max-w-2xl tw:flex-col tw:items-center tw:justify-center">
        <div className="tw:pointer-events-none tw:absolute tw:inset-0">
          <div className="tw:absolute tw:left-[10%] tw:top-[8%] tw:h-32 tw:w-32 tw:rounded-full tw:bg-[rgba(132,187,255,0.18)] tw:blur-3xl" />
          <div className="tw:absolute tw:bottom-[12%] tw:right-[8%] tw:h-40 tw:w-40 tw:rounded-full tw:bg-[rgba(78,145,215,0.14)] tw:blur-3xl" />
        </div>

        <div className="tw:relative tw:flex tw:flex-col tw:items-center tw:gap-6">
          <div className="tw:relative tw:flex tw:w-full tw:justify-center">
            <div
              className="tw:absolute tw:left-1/2 tw:top-0 tw:h-56 tw:w-56 tw:-translate-x-1/2 tw:rounded-full"
              style={{
                background: `
                  radial-gradient(circle at center, rgba(150,213,255,0.18) 0, rgba(150,213,255,0.04) 28%, transparent 58%),
                  linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0))
                `,
              }}
            />

            <div
              aria-hidden="true"
              className="tw:absolute tw:left-1/2 tw:top-12 tw:h-48 tw:w-48 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(129,194,255,0.26)] tw:blur-3xl"
              style={{
                transform: `translate3d(calc(-50% + (var(--track-x) * 20px)), calc(var(--track-y) * 18px), 0)`,
              }}
            />

            <div
              aria-hidden="true"
              className="tw:absolute tw:bottom-8 tw:left-1/2 tw:h-10 tw:w-48 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(70,106,142,0.16)] tw:blur-xl"
              style={{
                transform: `translateX(-50%) scaleX(calc(1 + (var(--track-y) * 0.08)))`,
              }}
            />

            <div
              className="tw:relative tw:flex tw:flex-col tw:items-center"
              style={{
                transform: `translate3d(calc(var(--track-x) * 11px), calc((var(--track-y) * 8px) + var(--idle-y)), 0) rotate(calc((var(--track-x) * 4deg) + var(--idle-rotate)))`,
                transformStyle: 'preserve-3d',
                willChange: 'transform',
              }}
            >
              <div
                className="tw:absolute tw:left-[-0.35rem] tw:top-[10.9rem] tw:h-[5.4rem] tw:w-6 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(166,200,234,0.84))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]"
                style={{
                  transform: `translate3d(calc(var(--track-x) * 1px), calc(var(--track-y) * 1px), 0) rotate(26deg)`,
                  transformOrigin: 'top center',
                }}
              />

              <div
                className="tw:absolute tw:right-[-0.35rem] tw:top-[10.9rem] tw:h-[5.4rem] tw:w-6 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(166,200,234,0.84))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]"
                style={{
                  transform: `translate3d(calc(var(--track-x) * -1px), calc(var(--track-y) * 1px), 0) rotate(-26deg)`,
                  transformOrigin: 'top center',
                }}
              />

              <div className="tw:relative tw:flex tw:flex-col tw:items-center">
                <div className="tw:absolute tw:-top-6 tw:flex tw:flex-col tw:items-center">
                  <div className="tw:h-6 tw:w-[3px] tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(89,139,185,0.95),rgba(89,139,185,0.35))]" />
                  <div className="tw:h-4 tw:w-4 tw:rounded-full tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,#fefefe,#bddfff)] tw:shadow-[0_8px_18px_rgba(78,124,165,0.22)]" />
                </div>

                <div
                  className="tw:relative tw:h-[12rem] tw:w-[10.2rem] tw:rounded-[2.7rem] tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(220,237,255,0.92))] tw:shadow-[0_28px_48px_rgba(47,94,136,0.18)]"
                  style={{
                    transform: `perspective(1100px) rotateX(calc(var(--track-y) * -5deg)) rotateY(calc(var(--track-x) * 8deg)) translate3d(calc(var(--track-x) * 6px), calc(var(--track-y) * 4px), 0)`,
                    transformStyle: 'preserve-3d',
                    willChange: 'transform',
                  }}
                >
                  <div className="tw:absolute tw:inset-x-4 tw:top-3 tw:h-2 tw:rounded-full tw:bg-white/70" />
                  <div className="tw:absolute tw:inset-[0.78rem] tw:rounded-[2rem] tw:bg-[linear-gradient(180deg,#1f4367,#153453)] tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                    <div className="tw:absolute tw:inset-x-4 tw:top-4 tw:h-[1px] tw:bg-white/12" />

                    <div className="tw:absolute tw:left-1/2 tw:top-[4.55rem] tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-3">
                      {[0, 1].map((eye) => (
                        <div
                          key={eye}
                          className="tw:relative tw:flex tw:h-11 tw:w-11 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-[1.1rem] tw:bg-[rgba(164,219,255,0.16)] tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                        >
                          <div
                            className="tw:flex tw:h-[1.38rem] tw:w-[1.38rem] tw:items-center tw:justify-center tw:rounded-full tw:bg-[linear-gradient(180deg,#93d8ff,#d9f5ff)] tw:shadow-[0_0_18px_rgba(123,210,255,0.45)]"
                            style={{
                              transform: `translate3d(calc(var(--track-x) * 4px), calc(var(--track-y) * 3px), 0)`,
                              willChange: 'transform',
                            }}
                          >
                            <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-white/90" />
                          </div>
                          <div
                            className="tw:absolute tw:inset-0 tw:origin-center tw:bg-[linear-gradient(180deg,#153453,#1b3f61)]"
                            style={{
                              transform: 'scaleY(0)',
                              animation: reduceMotion
                                ? 'none'
                                : `dwarpal-blink 6.2s ease-in-out ${eye === 0 ? '1.2s' : '1.32s'} infinite`,
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="tw:absolute tw:bottom-6 tw:left-1/2 tw:h-3 tw:w-12 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(184,230,255,0.14)]" />
                  </div>
                </div>

                <div className="tw:relative tw:-mt-2 tw:flex tw:w-[11rem] tw:justify-between">
                  <div className="tw:h-16 tw:w-5 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(163,197,232,0.85))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]" />
                  <div className="tw:h-16 tw:w-5 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(163,197,232,0.85))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]" />
                </div>

                <div
                  className="tw:relative tw:-mt-7 tw:h-[9.2rem] tw:w-[11.6rem] tw:rounded-[2.9rem] tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(214,232,252,0.92))] tw:shadow-[0_28px_46px_rgba(47,94,136,0.18)]"
                  style={{
                    transform: `translate3d(calc(var(--track-x) * 2px), calc(var(--track-y) * 1px), 0)`,
                  }}
                >
                  <div className="tw:absolute tw:inset-x-6 tw:top-6 tw:h-[1px] tw:bg-[rgba(86,132,179,0.16)]" />
                  <div className="tw:absolute tw:left-1/2 tw:top-[2.55rem] tw:flex tw:h-[4.1rem] tw:w-[5.1rem] tw:-translate-x-1/2 tw:items-center tw:justify-center tw:rounded-[1.9rem] tw:bg-[linear-gradient(180deg,#2f6db5,#1f4e84)] tw:text-white tw:shadow-[0_18px_26px_rgba(31,78,132,0.34)]">
                    <img src={logo} alt="" aria-hidden="true" className="tw:h-8 tw:w-8 tw:object-contain" />
                  </div>
                  <div className="tw:absolute tw:bottom-6 tw:left-1/2 tw:flex tw:w-[8.4rem] tw:-translate-x-1/2 tw:justify-between">
                    <span className="tw:h-2 tw:w-8 tw:rounded-full tw:bg-[rgba(56,107,167,0.18)]" />
                    <span className="tw:h-2 tw:w-4 tw:rounded-full tw:bg-[rgba(56,107,167,0.12)]" />
                    <span className="tw:h-2 tw:w-3 tw:rounded-full tw:bg-[rgba(56,107,167,0.12)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="tw:max-w-md tw:text-center">
            <p className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.28em] tw:text-sky-700/80">
              DwarPal Secure Access
            </p>
            <h2 className="tw:mt-3 tw:text-3xl tw:font-semibold tw:tracking-tight tw:text-slate-900">
              Sign in with your campus identity and a calm second step.
            </h2>
            <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-slate-600">
              Enrollment, OTP, and access checks stay protected while the experience stays clean and welcoming.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
